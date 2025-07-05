import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import ContaBancaria, { validarContaBancaria, BANCOS_BRASILEIROS } from '@/models/ContaBancaria'
import OpenBankingIntegracao from '@/models/OpenBankingIntegracao'
import mongoose from 'mongoose'

export async function GET(request: NextRequest) {
  try {
    await connectDB()
    
    const url = new URL(request.url)
    const masterId = url.searchParams.get('master_id')
    const condominioId = url.searchParams.get('condominio_id')
    const acao = url.searchParams.get('acao')

    if (!masterId) {
      return NextResponse.json({
        success: false,
        error: 'Master ID é obrigatório'
      }, { status: 400 })
    }

    // Retornar lista de bancos
    if (acao === 'bancos') {
      return NextResponse.json({
        success: true,
        bancos: BANCOS_BRASILEIROS
      })
    }

    // Retornar apenas a conta principal
    if (acao === 'principal') {
      const contaPrincipal = await ContaBancaria.findOne({
        master_id: new mongoose.Types.ObjectId(masterId),
        ...(condominioId && { condominio_id: new mongoose.Types.ObjectId(condominioId) }),
        conta_principal: true,
        ativa: true,
        ativo: true
      })
      
      return NextResponse.json({
        success: true,
        conta_principal: contaPrincipal
      })
    }

    // Retornar resumo de contas
    if (acao === 'resumo') {
      const query = {
        master_id: new mongoose.Types.ObjectId(masterId),
        ativo: true
      }

      if (condominioId) {
        query.condominio_id = new mongoose.Types.ObjectId(condominioId)
      }

      const contas = await ContaBancaria.find(query)
      const integracoes = await OpenBankingIntegracao.find({
        master_id: new mongoose.Types.ObjectId(masterId),
        ativo: true
      })

      const resumo = {
        total_contas: contas.length,
        contas_ativas: contas.filter(c => c.ativa).length,
        conta_principal: contas.find(c => c.conta_principal)?.nome_conta,
        total_integracoes: integracoes.length,
        integracoes_ativas: integracoes.filter(i => i.status === 'ativa').length,
        bancos_conectados: [...new Set(contas.map(c => c.banco))].length
      }

      return NextResponse.json({
        success: true,
        resumo,
        contas: contas.map(conta => ({
          _id: conta._id,
          nome_conta: conta.nome_conta,
          banco: conta.banco,
          agencia: conta.agencia,
          numero_conta: conta.numero_conta,
          digito_conta: conta.digito_conta,
          tipo_conta: conta.tipo_conta,
          ativa: conta.ativa,
          conta_principal: conta.conta_principal,
          aceita_pix: conta.aceita_pix,
          tem_integracao: integracoes.some(i => 
            i.conta_bancaria_id.toString() === conta._id.toString()
          )
        }))
      })
    }

    const query = {
      master_id: new mongoose.Types.ObjectId(masterId),
      ativo: true
    }

    if (condominioId) {
      query.condominio_id = new mongoose.Types.ObjectId(condominioId)
    }

    const contas = await ContaBancaria.find(query)
      .sort({ conta_principal: -1, data_criacao: -1 })

    // Adicionar informações de integração Open Banking
    const contasComIntegracao = await Promise.all(
      contas.map(async (conta) => {
        const integracao = await OpenBankingIntegracao.findOne({
          conta_bancaria_id: conta._id,
          ativo: true
        })

        return {
          ...conta.toObject(),
          integracao_open_banking: integracao ? {
            _id: integracao._id,
            provedor: integracao.provedor,
            status: integracao.status,
            ultima_sincronizacao: integracao.ultima_sincronizacao,
            proxima_sincronizacao: integracao.proxima_sincronizacao
          } : null
        }
      })
    )

    return NextResponse.json({
      success: true,
      contas: contasComIntegracao
    })

  } catch (error) {
    console.error('Erro ao buscar contas bancárias:', error)
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const contaData = await request.json()
    
    // Log dos dados recebidos para debug
    console.log('Dados recebidos para criação de conta:', {
      ...contaData,
      titular_documento: contaData.titular_documento ? '***MASKED***' : undefined
    })
    
    // Validação básica
    const requiredFields = [
      'condominio_id', 'master_id', 'nome_conta', 'banco', 'codigo_banco',
      'agencia', 'numero_conta', 'digito_conta', 'titular_nome', 'titular_documento',
      'criado_por_id', 'criado_por_nome'
    ]
    
    const missingFields = []
    for (const field of requiredFields) {
      if (!contaData[field] || (typeof contaData[field] === 'string' && contaData[field].trim() === '')) {
        missingFields.push(field)
      }
    }
    
    if (missingFields.length > 0) {
      console.log('Campos obrigatórios faltando:', missingFields)
      return NextResponse.json(
        { 
          error: `Campos obrigatórios faltando: ${missingFields.join(', ')}`,
          missing_fields: missingFields
        },
        { status: 400 }
      )
    }

    // Validar dados da conta
    const validacao = validarContaBancaria(contaData)
    if (!validacao.valida) {
      console.log('Erros de validação:', validacao.erros)
      return NextResponse.json(
        { error: 'Dados inválidos', detalhes: validacao.erros },
        { status: 400 }
      )
    }

    await connectDB()
    // Verificar se já existe conta com os mesmos dados bancários
    const contaExistente = await ContaBancaria.findOne({
      condominio_id: new mongoose.Types.ObjectId(contaData.condominio_id),
      master_id: new mongoose.Types.ObjectId(contaData.master_id),
      codigo_banco: contaData.codigo_banco,
      agencia: contaData.agencia,
      numero_conta: contaData.numero_conta,
      digito_conta: contaData.digito_conta,
      ativo: true
    })
    
    if (contaExistente) {
      return NextResponse.json(
        { error: 'Já existe uma conta cadastrada com estes dados bancários' },
        { status: 400 }
      )
    }
    
    
    // Se é a primeira conta ou se foi marcada como principal, definir como principal
    const contasPrincipais = await ContaBancaria.countDocuments({
      condominio_id: new mongoose.Types.ObjectId(contaData.condominio_id),
      master_id: new mongoose.Types.ObjectId(contaData.master_id),
      conta_principal: true,
      ativo: true
    })
    
    const isFirstAccount = await ContaBancaria.countDocuments({
      condominio_id: new mongoose.Types.ObjectId(contaData.condominio_id),
      master_id: new mongoose.Types.ObjectId(contaData.master_id),
      ativo: true
    }) === 0
    
    const novaConta = {
      ...contaData,
      conta_principal: isFirstAccount || contaData.conta_principal || contasPrincipais === 0,
      ativa: contaData.ativa !== false,
      aceita_boleto: contaData.aceita_boleto !== false,
      aceita_pix: contaData.aceita_pix !== false,
      aceita_ted_doc: contaData.aceita_ted_doc !== false,
      tipo_conta: contaData.tipo_conta || 'corrente',
      titular_tipo: contaData.titular_tipo || (contaData.titular_documento?.replace(/\D/g, '').length === 11 ? 'cpf' : 'cnpj'),
      data_criacao: new Date(),
      data_atualizacao: new Date(),
      ativo: true,
      // Garantir que os campos obrigatórios estejam presentes
      criado_por_id: new mongoose.Types.ObjectId(contaData.criado_por_id),
      criado_por_nome: contaData.criado_por_nome,
      condominio_id: new mongoose.Types.ObjectId(contaData.condominio_id),
      master_id: new mongoose.Types.ObjectId(contaData.master_id)
    }

    // Se esta conta será principal, desativar outras principais
    if (novaConta.conta_principal) {
      await ContaBancaria.updateMany(
        {
          condominio_id: new mongoose.Types.ObjectId(contaData.condominio_id),
          master_id: new mongoose.Types.ObjectId(contaData.master_id),
          conta_principal: true,
          ativo: true
        },
        {
          $set: {
            conta_principal: false,
            data_atualizacao: new Date()
          }
        }
      )
    }

    const result = await ContaBancaria.create(novaConta)
    
    return NextResponse.json({
      success: true,
      conta: result
    })
    
  } catch (error) {
    console.error('Error creating conta bancaria:', error)
    return NextResponse.json(
      { error: 'Erro ao criar conta bancária' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { _id, action, ...contaData } = await request.json()
    
    if (!_id) {
      return NextResponse.json(
        { error: 'ID da conta é obrigatório' },
        { status: 400 }
      )
    }

    await connectDB()
    // Buscar conta existente
    const contaExistente = await ContaBancaria.findOne({ _id: new mongoose.Types.ObjectId(_id) })
    if (!contaExistente) {
      return NextResponse.json(
        { error: 'Conta bancária não encontrada' },
        { status: 404 }
      )
    }

    if (action === 'toggle_principal') {
      // Alternar conta principal
      const novoStatus = !contaExistente.conta_principal
      
      if (novoStatus) {
        // Desativar outras contas principais do mesmo condomínio
        await ContaBancaria.updateMany(
          {
            condominio_id: contaExistente.condominio_id,
            master_id: contaExistente.master_id,
            conta_principal: true,
            ativo: true,
            _id: { $ne: new mongoose.Types.ObjectId(_id) }
          },
          {
            $set: {
              conta_principal: false,
              data_atualizacao: new Date()
            }
          }
        )
      }
      
      // Atualizar conta atual
      const result = await ContaBancaria.updateOne(
        { _id: new mongoose.Types.ObjectId(_id) },
        {
          $set: {
            conta_principal: novoStatus,
            data_atualizacao: new Date()
          }
        }
      )
      
      if (!result) {
        return NextResponse.json(
          { error: 'Erro ao atualizar conta principal' },
          { status: 404 }
        )
      }
      
      return NextResponse.json({
        success: true,
        message: `Conta ${novoStatus ? 'definida como principal' : 'removida como principal'}`,
        conta_principal: novoStatus
      })
    }
    
    if (action === 'toggle_ativa') {
      // Alternar status ativo/inativo
      const novoStatus = !contaExistente.ativa
      
      // Se está desativando a conta principal, verificar se existe outra para ser principal
      if (!novoStatus && contaExistente.conta_principal) {
        const outraContaAtiva = await ContaBancaria.findOne({
          condominio_id: contaExistente.condominio_id,
          master_id: contaExistente.master_id,
          ativa: true,
          ativo: true,
          _id: { $ne: new mongoose.Types.ObjectId(_id) }
        })
        
        if (outraContaAtiva) {
          // Definir outra conta como principal
          await ContaBancaria.updateOne(
            { _id: outraContaAtiva._id },
            {
              $set: {
                conta_principal: true,
                data_atualizacao: new Date()
              }
            }
          )
        }
      }
      
      const result = await ContaBancaria.updateOne(
        { _id: new mongoose.Types.ObjectId(_id) },
        {
          $set: {
            ativa: novoStatus,
            conta_principal: novoStatus ? contaExistente.conta_principal : false,
            data_atualizacao: new Date()
          }
        }
      )
      
      return NextResponse.json({
        success: true,
        message: `Conta ${novoStatus ? 'ativada' : 'desativada'}`,
        ativa: novoStatus
      })
    }
    
    // Atualização normal dos dados
    const validacao = validarContaBancaria(contaData)
    if (!validacao.valida) {
      return NextResponse.json(
        { error: 'Dados inválidos', detalhes: validacao.erros },
        { status: 400 }
      )
    }

    const updateData = {
      ...contaData,
      data_atualizacao: new Date()
    }

    const result = await ContaBancaria.updateOne(
      { _id: new mongoose.Types.ObjectId(_id) },
      { $set: updateData }
    )
    
    if (!result) {
      return NextResponse.json(
        { error: 'Conta bancária não encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Conta bancária atualizada com sucesso'
    })
    
  } catch (error) {
    console.error('Error updating conta bancaria:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar conta bancária' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const contaId = url.searchParams.get('conta_id')
    const masterId = url.searchParams.get('master_id')
    
    if (!contaId || !masterId) {
      return NextResponse.json(
        { error: 'ID da conta e Master ID são obrigatórios' },
        { status: 400 }
      )
    }

    await connectDB()
    // Buscar conta para verificar se é principal
    const conta = await ContaBancaria.findOne({ _id: new mongoose.Types.ObjectId(contaId) })
    if (!conta) {
      return NextResponse.json(
        { error: 'Conta bancária não encontrada' },
        { status: 404 }
      )
    }
    
    // Soft delete
    const result = await ContaBancaria.updateOne(
      { _id: new mongoose.Types.ObjectId(contaId), master_id: new mongoose.Types.ObjectId(masterId) },
      {
        $set: {
          ativo: false,
          ativa: false,
          conta_principal: false,
          data_atualizacao: new Date()
        }
      }
    )
    
    if (!result) {
      return NextResponse.json(
        { error: 'Conta não encontrada ou sem permissão' },
        { status: 404 }
      )
    }
    
    // Se era conta principal, definir outra como principal
    if (conta.conta_principal) {
      const outraContaAtiva = await ContaBancaria.findOne({
        condominio_id: conta.condominio_id,
        master_id: new mongoose.Types.ObjectId(masterId),
        ativa: true,
        ativo: true,
        _id: { $ne: new mongoose.Types.ObjectId(contaId) }
      })
      
      if (outraContaAtiva) {
        await ContaBancaria.updateOne(
          { _id: outraContaAtiva._id },
          {
            $set: {
              conta_principal: true,
              data_atualizacao: new Date()
            }
          }
        )
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Conta bancária excluída com sucesso'
    })
    
  } catch (error) {
    console.error('Error deleting conta bancaria:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir conta bancária' },
      { status: 500 }
    )
  }
}