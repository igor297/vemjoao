import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import ConfiguracaoFinanceira from '@/models/ConfiguracaoFinanceira'
import mongoose from 'mongoose'
import { verificarPermissaoConfigFinanceira } from '@/models/ConfiguracaoFinanceira'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const masterId = url.searchParams.get('master_id')
    const condominioId = url.searchParams.get('condominio_id')
    const tipoUsuario = url.searchParams.get('tipo_usuario')
    
    if (!masterId || !tipoUsuario) {
      return NextResponse.json(
        { error: 'Master ID e tipo de usuário são obrigatórios' },
        { status: 400 }
      )
    }

    // Verificar permissão
    if (!verificarPermissaoConfigFinanceira(tipoUsuario)) {
      return NextResponse.json(
        { error: 'Apenas masters podem acessar configurações financeiras' },
        { status: 403 }
      )
    }

    await connectDB()
    const filter: any = { 
      master_id: masterId,
      ativo: true 
    }
    
    if (condominioId) {
      filter.condominio_id = condominioId
    }
    
    const configuracao = await configuracoes.findOne(filter)
    
    // Se não existe configuração, retornar configuração padrão
    if (!configuracao && condominioId) {
      const configuracaoPadrao = {
        id_configuracao: '',
        condominio_id: condominioId,
        master_id: masterId,
        cobranca_automatica_ativa: false,
        mercado_pago: {
          ativo: false,
          taxa_boleto: 0,
          taxa_pix: 0,
          taxa_cartao_debito: 0,
          taxa_cartao_credito: 0,
          tipo_taxa: 'percentual'
        },
        stone: {
          ativo: false,
          taxa_boleto: 0,
          taxa_pix: 0,
          taxa_cartao_debito: 0,
          taxa_cartao_credito: 0,
          tipo_taxa: 'percentual'
        },
        pagseguro: {
          ativo: false,
          taxa_boleto: 0,
          taxa_pix: 0,
          taxa_cartao_debito: 0,
          taxa_cartao_credito: 0,
          tipo_taxa: 'percentual'
        },
        configuracoes_gerais: {
          dias_vencimento_boleto: 10,
          dias_vencimento_pix: 1,
          juros_atraso_mes: 1,
          multa_atraso: 2,
          descricao_padrao_boleto: 'Taxa Condominial',
          instrucoes_boleto: 'Pagamento da taxa condominial conforme regulamento interno.'
        }
      }
      
      return NextResponse.json({
        success: true,
        configuracao: configuracaoPadrao,
        isDefault: true
      })
    }
    
    return NextResponse.json({
      success: true,
      configuracao: configuracao || null
    })
    
  } catch (error) {
    console.error('Error fetching configuracao financeira:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar configuração financeira' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const configData = await request.json()
    
    // Validação básica
    const requiredFields = [
      'condominio_id', 'master_id', 'criado_por_id', 'criado_por_nome'
    ]
    
    for (const field of requiredFields) {
      if (!configData[field]) {
        return NextResponse.json(
          { error: `Campo ${field} é obrigatório` },
          { status: 400 }
        )
      }
    }

    // Verificar permissão
    if (!verificarPermissaoConfigFinanceira(configData.tipo_usuario || 'master')) {
      return NextResponse.json(
        { error: 'Apenas masters podem criar configurações financeiras' },
        { status: 403 }
      )
    }

    await connectDB()
    // Verificar se já existe configuração para este condomínio
    const configExistente = await configuracoes.findOne({
      condominio_id: configData.condominio_id,
      master_id: configData.master_id,
      ativo: true
    })
    
    if (configExistente) {
      return NextResponse.json(
        { error: 'Já existe uma configuração para este condomínio' },
        { status: 400 }
      )
    }
    
    // Gerar ID único
    const lastConfig = await configuracoes.findOne(
      {},
      { sort: { data_criacao: -1 } }
    )
    
    let nextId = 1
    if (lastConfig && lastConfig.id_configuracao) {
      const lastIdNumber = parseInt(lastConfig.id_configuracao.replace('CF', ''))
      nextId = lastIdNumber + 1
    }
    
    const newConfig = {
      ...configData,
      id_configuracao: `CF${nextId.toString().padStart(6, '0')}`,
      data_criacao: new Date(),
      data_atualizacao: new Date(),
      ativo: true
    }

    const result = await configuracoes.insertOne(newConfig)
    
    return NextResponse.json({
      success: true,
      configuracao: { _id: result._id, ...newConfig }
    })
    
  } catch (error) {
    console.error('Error creating configuracao financeira:', error)
    return NextResponse.json(
      { error: 'Erro ao criar configuração financeira' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { _id, tipo_usuario, ...configData } = await request.json()
    
    if (!_id) {
      return NextResponse.json(
        { error: 'ID da configuração é obrigatório' },
        { status: 400 }
      )
    }

    // Verificar permissão
    if (!verificarPermissaoConfigFinanceira(tipo_usuario || 'master')) {
      return NextResponse.json(
        { error: 'Apenas masters podem atualizar configurações financeiras' },
        { status: 403 }
      )
    }

    await connectDB()
    // Buscar configuração existente
    const configExistente = await configuracoes.findOne({ _id: new mongoose.Types.ObjectId(_id) })
    if (!configExistente) {
      return NextResponse.json(
        { error: 'Configuração não encontrada' },
        { status: 404 }
      )
    }

    const updateData = {
      ...configData,
      data_atualizacao: new Date()
    }

    const result = await configuracoes.updateOne(
      { _id: new mongoose.Types.ObjectId(_id) },
      { $set: updateData }
    )
    
    if (!result) {
      return NextResponse.json(
        { error: 'Configuração não encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Configuração atualizada com sucesso'
    })
    
  } catch (error) {
    console.error('Error updating configuracao financeira:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar configuração financeira' },
      { status: 500 }
    )
  }
}