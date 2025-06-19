import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import OpenBankingIntegracao, { calcularProximaSincronizacao, validarConfiguracaoOpenBanking } from '@/models/OpenBankingIntegracao'
import ContaBancaria from '@/models/ContaBancaria'
import ExtratoBancario from '@/models/ExtratoBancario'
import mongoose from 'mongoose'

export async function GET(request: NextRequest) {
  try {
    await connectDB()
    
    const url = new URL(request.url)
    const masterId = url.searchParams.get('master_id')
    const condominioId = url.searchParams.get('condominio_id')
    const integracaoId = url.searchParams.get('integracao_id')
    const acao = url.searchParams.get('acao')

    if (!masterId) {
      return NextResponse.json({
        success: false,
        error: 'Master ID é obrigatório'
      }, { status: 400 })
    }

    // Buscar integração específica
    if (integracaoId) {
      const integracao = await OpenBankingIntegracao.findById(integracaoId)
        .populate('conta_bancaria_id')
      
      if (!integracao) {
        return NextResponse.json({
          success: false,
          error: 'Integração não encontrada'
        }, { status: 404 })
      }

      return NextResponse.json({
        success: true,
        integracao
      })
    }

    // Ações especiais
    if (acao === 'status') {
      const integracoes = await OpenBankingIntegracao.find({
        master_id: new mongoose.Types.ObjectId(masterId),
        ...(condominioId && { condominio_id: new mongoose.Types.ObjectId(condominioId) }),
        ativo: true
      }).populate('conta_bancaria_id')

      const status = {
        total_integracoes: integracoes.length,
        ativas: integracoes.filter(i => i.status === 'ativa').length,
        com_erro: integracoes.filter(i => i.status === 'erro').length,
        pendentes: integracoes.filter(i => i.status === 'pendente_autorizacao').length,
        ultima_sincronizacao: integracoes.reduce((max, i) => 
          i.ultima_sincronizacao > max ? i.ultima_sincronizacao : max, 
          new Date(0)
        ),
        proxima_sincronizacao: integracoes.reduce((min, i) => 
          i.proxima_sincronizacao < min ? i.proxima_sincronizacao : min, 
          new Date(Date.now() + 86400000)
        )
      }

      return NextResponse.json({
        success: true,
        status,
        integracoes
      })
    }

    // Listar todas as integrações
    const query = {
      master_id: new mongoose.Types.ObjectId(masterId),
      ativo: true
    }

    if (condominioId) {
      query.condominio_id = new mongoose.Types.ObjectId(condominioId)
    }

    const integracoes = await OpenBankingIntegracao.find(query)
      .populate('conta_bancaria_id')
      .sort({ data_criacao: -1 })

    return NextResponse.json({
      success: true,
      integracoes
    })

  } catch (error) {
    console.error('Erro ao buscar integrações Open Banking:', error)
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB()
    
    const dados = await request.json()
    const {
      master_id,
      condominio_id,
      conta_bancaria_id,
      provedor,
      provedor_id_externo,
      configuracao,
      acao
    } = dados

    if (!master_id || !condominio_id) {
      return NextResponse.json({
        success: false,
        error: 'Master ID e Condomínio ID são obrigatórios'
      }, { status: 400 })
    }

    // Ação de sincronização manual
    if (acao === 'sincronizar') {
      const integracaoId = dados.integracao_id
      
      if (!integracaoId) {
        return NextResponse.json({
          success: false,
          error: 'ID da integração é obrigatório para sincronização'
        }, { status: 400 })
      }

      const integracao = await OpenBankingIntegracao.findById(integracaoId)
      
      if (!integracao) {
        return NextResponse.json({
          success: false,
          error: 'Integração não encontrada'
        }, { status: 404 })
      }

      try {
        // Aqui seria implementada a lógica de sincronização com o provedor
        const resultadoSync = await sincronizarDadosBancarios(integracao)
        
        // Atualizar dados da integração
        integracao.ultima_sincronizacao = new Date()
        integracao.proxima_sincronizacao = calcularProximaSincronizacao(
          integracao.frequencia_sync, 
          integracao.horario_sync
        )
        integracao.status = 'ativa'
        integracao.ultimo_erro = undefined
        
        await integracao.save()

        return NextResponse.json({
          success: true,
          message: 'Sincronização realizada com sucesso',
          resultado: resultadoSync
        })
      } catch (error) {
        integracao.status = 'erro'
        integracao.ultimo_erro = error.message
        await integracao.save()

        return NextResponse.json({
          success: false,
          error: `Erro na sincronização: ${error.message}`
        }, { status: 500 })
      }
    }

    // Criar nova integração
    const validacao = validarConfiguracaoOpenBanking({
      provedor,
      provedor_id_externo,
      banco_codigo: configuracao?.banco_codigo,
      agencia: configuracao?.agencia,
      conta: configuracao?.conta
    })

    if (!validacao.valida) {
      return NextResponse.json({
        success: false,
        error: 'Dados inválidos',
        erros: validacao.erros
      }, { status: 400 })
    }

    // Verificar se conta bancária existe
    const contaBancaria = await ContaBancaria.findById(conta_bancaria_id)
    if (!contaBancaria) {
      return NextResponse.json({
        success: false,
        error: 'Conta bancária não encontrada'
      }, { status: 404 })
    }

    // Verificar se já existe integração para esta conta
    const integracaoExistente = await OpenBankingIntegracao.findOne({
      conta_bancaria_id: new mongoose.Types.ObjectId(conta_bancaria_id),
      ativo: true
    })

    if (integracaoExistente) {
      return NextResponse.json({
        success: false,
        error: 'Já existe uma integração ativa para esta conta bancária'
      }, { status: 409 })
    }

    // Criar nova integração
    const novaIntegracao = new OpenBankingIntegracao({
      condominio_id: new mongoose.Types.ObjectId(condominio_id),
      master_id: new mongoose.Types.ObjectId(master_id),
      conta_bancaria_id: new mongoose.Types.ObjectId(conta_bancaria_id),
      provedor,
      provedor_id_externo,
      banco_codigo: configuracao.banco_codigo || contaBancaria.codigo_banco,
      banco_nome: configuracao.banco_nome || contaBancaria.banco,
      agencia: configuracao.agencia || contaBancaria.agencia,
      conta: configuracao.conta || contaBancaria.numero_conta,
      status: 'pendente_autorizacao',
      ultima_sincronizacao: new Date(),
      proxima_sincronizacao: calcularProximaSincronizacao(
        configuracao.frequencia_sync || 'diaria',
        configuracao.horario_sync || '06:00'
      ),
      auto_sync: configuracao.auto_sync !== false,
      frequencia_sync: configuracao.frequencia_sync || 'diaria',
      horario_sync: configuracao.horario_sync || '06:00',
      permissoes: {
        ler_saldo: true,
        ler_extratos: true,
        ler_investimentos: false,
        fazer_transferencias: false,
        pagar_boletos: false,
        ...configuracao.permissoes
      },
      filtros: {
        valor_minimo: configuracao.valor_minimo || 0,
        categorias_ignorar: configuracao.categorias_ignorar || [],
        descricoes_ignorar: configuracao.descricoes_ignorar || [],
        sincronizar_apenas_dias_uteis: configuracao.sincronizar_apenas_dias_uteis || false
      },
      criado_por_id: new mongoose.Types.ObjectId(dados.usuario_id || master_id),
      criado_por_nome: dados.usuario_nome || 'Sistema'
    })

    await novaIntegracao.save()

    return NextResponse.json({
      success: true,
      message: 'Integração Open Banking criada com sucesso',
      integracao: novaIntegracao
    })

  } catch (error) {
    console.error('Erro ao criar integração Open Banking:', error)
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    await connectDB()
    
    const dados = await request.json()
    const { integracao_id, ...dadosAtualizacao } = dados

    if (!integracao_id) {
      return NextResponse.json({
        success: false,
        error: 'ID da integração é obrigatório'
      }, { status: 400 })
    }

    const integracao = await OpenBankingIntegracao.findById(integracao_id)
    
    if (!integracao) {
      return NextResponse.json({
        success: false,
        error: 'Integração não encontrada'
      }, { status: 404 })
    }

    // Atualizar campos permitidos
    const camposPermitidos = [
      'auto_sync', 'frequencia_sync', 'horario_sync', 'permissoes', 
      'filtros', 'status', 'client_id', 'access_token'
    ]

    camposPermitidos.forEach(campo => {
      if (dadosAtualizacao[campo] !== undefined) {
        integracao[campo] = dadosAtualizacao[campo]
      }
    })

    // Recalcular próxima sincronização se a frequência mudou
    if (dadosAtualizacao.frequencia_sync || dadosAtualizacao.horario_sync) {
      integracao.proxima_sincronizacao = calcularProximaSincronizacao(
        integracao.frequencia_sync,
        integracao.horario_sync
      )
    }

    integracao.data_atualizacao = new Date()
    await integracao.save()

    return NextResponse.json({
      success: true,
      message: 'Integração atualizada com sucesso',
      integracao
    })

  } catch (error) {
    console.error('Erro ao atualizar integração Open Banking:', error)
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await connectDB()
    
    const url = new URL(request.url)
    const integracaoId = url.searchParams.get('integracao_id')

    if (!integracaoId) {
      return NextResponse.json({
        success: false,
        error: 'ID da integração é obrigatório'
      }, { status: 400 })
    }

    const integracao = await OpenBankingIntegracao.findById(integracaoId)
    
    if (!integracao) {
      return NextResponse.json({
        success: false,
        error: 'Integração não encontrada'
      }, { status: 404 })
    }

    // Soft delete
    integracao.ativo = false
    integracao.status = 'inativa'
    integracao.data_atualizacao = new Date()
    await integracao.save()

    return NextResponse.json({
      success: true,
      message: 'Integração removida com sucesso'
    })

  } catch (error) {
    console.error('Erro ao remover integração Open Banking:', error)
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}

// Função auxiliar para sincronizar dados bancários
async function sincronizarDadosBancarios(integracao: any) {
  try {
    // Aqui seria implementada a lógica específica de cada provedor
    switch (integracao.provedor) {
      case 'pluggy':
        return await sincronizarPluggy(integracao)
      case 'belvo':
        return await sincronizarBelvo(integracao)
      case 'stone':
        return await sincronizarStone(integracao)
      default:
        throw new Error(`Provedor ${integracao.provedor} não suportado`)
    }
  } catch (error) {
    console.error(`Erro na sincronização ${integracao.provedor}:`, error)
    throw error
  }
}

// Implementações específicas por provedor
async function sincronizarPluggy(integracao: any) {
  // Implementação da API Pluggy
  const response = {
    transacoes_importadas: 0,
    periodo: '30 dias',
    status: 'sucesso'
  }
  
  // Simular importação de transações
  // Na implementação real, aqui seria feita a chamada para a API do Pluggy
  
  return response
}

async function sincronizarBelvo(integracao: any) {
  // Implementação da API Belvo
  const response = {
    transacoes_importadas: 0,
    periodo: '30 dias',
    status: 'sucesso'
  }
  
  return response
}

async function sincronizarStone(integracao: any) {
  // Implementação da API Stone
  const response = {
    transacoes_importadas: 0,
    periodo: '30 dias',
    status: 'sucesso'
  }
  
  return response
}