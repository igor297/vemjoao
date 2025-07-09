import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import FinanceiroCondominio from '@/models/FinanceiroCondominio'
import mongoose from 'mongoose'
import { cache } from '@/lib/cache'

export async function GET(request: NextRequest) {
  try {
    await connectDB()
    await FinanceiroCondominio.syncIndexes() // Garante que os índices estão criados
    
    const url = new URL(request.url)
    const masterId = url.searchParams.get('master_id')
    const condominioId = url.searchParams.get('condominio_id')
    const tipoUsuario = url.searchParams.get('tipo_usuario')
    const relatorio = url.searchParams.get('relatorio')
    const origemSistema = url.searchParams.get('origem_sistema')
    const status = url.searchParams.get('status')
    const tipo = url.searchParams.get('tipo')
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    
    console.log('📊 API financeiro-condominio GET - Parâmetros recebidos:', {
      masterId,
      condominioId,
      tipoUsuario,
      relatorio,
      origemSistema,
      status,
      tipo
    })
    
    console.log('🔍 DEBUG: Model sendo usado:', FinanceiroCondominio.modelName)
    console.log('🔍 DEBUG: Collection sendo consultada:', FinanceiroCondominio.collection.name)
    
    if (!masterId || !tipoUsuario || !condominioId) {
      console.log('❌ Parâmetros obrigatórios faltando:', { masterId, tipoUsuario, condominioId })
      return NextResponse.json({
        success: false,
        error: 'Master ID, tipo de usuário e condomínio são obrigatórios'
      }, { status: 400 })
    }

    // Gerar chave de cache
    const cacheKey = cache.generateKey('financeiro', {
      masterId,
      condominioId,
      relatorio: relatorio || 'list',
      origemSistema,
      status,
      tipo,
      page,
      limit
    })

    // Verificar cache (especialmente para relatórios que são consultados frequentemente)
    if (relatorio) {
      const cachedResult = cache.get(cacheKey)
      if (cachedResult) {
        console.log('📋 Cache hit para:', relatorio)
        return NextResponse.json(cachedResult)
      }
    }

    const filter: any = {
      master_id: new mongoose.Types.ObjectId(masterId),
      condominio_id: new mongoose.Types.ObjectId(condominioId),
      ativo: true,
      origem_sistema: { $nin: ['morador', 'colaborador'] } // Excluir lançamentos de moradores e colaboradores
    }

    if (origemSistema) filter.origem_sistema = origemSistema
    if (status) filter.status = status
    if (tipo) filter.tipo = tipo

    if (relatorio === 'resumo') {
      const pipeline = [
        { 
          $match: {
            ...filter,
            // Otimização: filtros mais específicos primeiro
            master_id: filter.master_id,
            condominio_id: filter.condominio_id,
            ativo: filter.ativo
          }
        },
        {
          $group: {
            _id: null,
            total_receitas: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$tipo', 'receita'] }, { $eq: ['$status', 'pago'] }] }, 
                  '$valor', 
                  0
                ]
              }
            },
            total_despesas: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$tipo', 'despesa'] }, { $eq: ['$status', 'pago'] }] }, 
                  '$valor', 
                  0
                ]
              }
            },
            total_receitas_pendentes: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$tipo', 'receita'] }, { $in: ['$status', ['pendente', 'atrasado']] }] }, 
                  '$valor', 
                  0
                ]
              }
            },
            total_despesas_pendentes: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$tipo', 'despesa'] }, { $in: ['$status', ['pendente', 'atrasado']] }] }, 
                  '$valor', 
                  0
                ]
              }
            },
            total_pendentes: {
              $sum: {
                $cond: [{ $eq: ['$status', 'pendente'] }, '$valor', 0]
              }
            },
            total_atrasados: {
              $sum: {
                $cond: [{ $eq: ['$status', 'atrasado'] }, '$valor', 0]
              }
            },
            count_pendentes: {
              $sum: {
                $cond: [{ $eq: ['$status', 'pendente'] }, 1, 0]
              }
            },
            count_atrasados: {
              $sum: {
                $cond: [{ $eq: ['$status', 'atrasado'] }, 1, 0]
              }
            },
            count_total: { $sum: 1 }
          }
        }
      ]

      const resumo = await FinanceiroCondominio.aggregate(pipeline)
        .hint({ master_id: 1, condominio_id: 1, ativo: 1 }) // Usar índice otimizado
        .allowDiskUse(false) // Forçar uso de memória para consultas pequenas
      const resultado = resumo[0] || {
        total_receitas: 0,
        total_despesas: 0,
        total_receitas_pendentes: 0,
        total_despesas_pendentes: 0,
        total_pendentes: 0,
        total_atrasados: 0,
        count_pendentes: 0,
        count_atrasados: 0,
        count_total: 0
      }

      resultado.resultado_liquido = resultado.total_receitas - resultado.total_despesas

      const response = {
        success: true,
        resumo: resultado
      }

      // Cache por 3 minutos (relatórios são consultados frequentemente)
      cache.set(cacheKey, response, 3)

      return NextResponse.json(response)
    }

    if (relatorio === 'por_origem') {
      const pipeline = [
        { 
          $match: {
            ...filter,
            master_id: filter.master_id,
            condominio_id: filter.condominio_id,
            ativo: filter.ativo
          }
        },
        {
          $group: {
            _id: {
              origem_sistema: '$origem_sistema',
              tipo: '$tipo'
            },
            total_valor: { $sum: '$valor' },
            count: { $sum: 1 }
          }
        },
        { $sort: { total_valor: -1 as const } }
      ]

      const origens = await FinanceiroCondominio.aggregate(pipeline)
        .hint({ origem_sistema: 1, condominio_id: 1, ativo: 1 })

      const response = {
        success: true,
        por_origem: origens
      }

      // Cache por 5 minutos
      cache.set(cacheKey, response, 5)

      return NextResponse.json(response)
    }

    if (relatorio === 'por_categoria') {
      const pipeline = [
        { 
          $match: {
            ...filter,
            master_id: filter.master_id,
            condominio_id: filter.condominio_id,
            ativo: filter.ativo
          }
        },
        {
          $group: {
            _id: '$categoria',
            total_valor: { $sum: '$valor' },
            count: { $sum: 1 }
          }
        },
        { $sort: { total_valor: -1 as const } },
        { $limit: 10 }
      ]

      const categorias = await FinanceiroCondominio.aggregate(pipeline)
        .hint({ master_id: 1, condominio_id: 1, ativo: 1, categoria: 1 })

      const response = {
        success: true,
        categorias
      }

      // Cache por 10 minutos (categorias mudam menos)
      cache.set(cacheKey, response, 10)

      return NextResponse.json(response)
    }

    if (relatorio === 'fluxo_mensal') {
      const pipeline = [
        { 
          $match: {
            ...filter,
            master_id: filter.master_id,
            condominio_id: filter.condominio_id,
            ativo: filter.ativo
          }
        },
        {
          $group: {
            _id: {
              ano: { $year: '$data_vencimento' },
              mes: { $month: '$data_vencimento' }
            },
            receitas: {
              $sum: {
                $cond: [{ $eq: ['$tipo', 'receita'] }, '$valor', 0]
              }
            },
            despesas: {
              $sum: {
                $cond: [{ $eq: ['$tipo', 'despesa'] }, '$valor', 0]
              }
            }
          }
        },
        { $sort: { '_id.ano': -1 as const, '_id.mes': -1 as const } },
        { $limit: 12 }
      ]

      const fluxo_mensal = await FinanceiroCondominio.aggregate(pipeline)
        .hint({ master_id: 1, condominio_id: 1, ativo: 1, data_vencimento: 1 })

      const response = {
        success: true,
        fluxo_mensal
      }

      // Cache por 15 minutos (dados históricos mudam pouco)
      cache.set(cacheKey, response, 15)

      return NextResponse.json(response)
    }

    const skip = (page - 1) * limit
    
    console.log('🔍 DEBUG: Filtro da consulta:', JSON.stringify(filter, null, 2))
    
    // Otimização: usar hint de índice e executar consultas em paralelo com projeção
    const [lancamentos, total] = await Promise.all([
      FinanceiroCondominio
        .find(filter)
        .select('tipo categoria descricao valor data_vencimento data_pagamento status origem_sistema origem_nome data_criacao valor_total') // Projeção: só campos necessários
        .hint({ master_id: 1, condominio_id: 1, ativo: 1, data_vencimento: -1 }) // Usar índice otimizado
        .sort({ data_vencimento: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      
      FinanceiroCondominio
        .countDocuments(filter)
        .hint({ master_id: 1, condominio_id: 1, ativo: 1 }) // Índice para contagem rápida
        .exec()
    ])
    
    console.log('🔍 DEBUG: Quantidade de lançamentos encontrados:', lancamentos.length)
    console.log('🔍 DEBUG: Primeiro lançamento (se existir):', lancamentos[0] ? JSON.stringify(lancamentos[0], null, 2) : 'Nenhum')

    return NextResponse.json({
      success: true,
      lancamentos,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(total / limit),
        total_items: total,
        items_per_page: limit
      }
    })

  } catch (error) {
    console.error('Erro ao buscar financeiro do condomínio:', error)
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB()
    
    const data = await request.json()
    const {
      tipo,
      categoria,
      descricao,
      valor,
      data_vencimento,
      data_pagamento,
      status,
      observacoes,
      recorrente,
      periodicidade,
      master_id,
      condominio_id,
      tipo_usuario,
      usuario_id,
      criado_por_nome
    } = data

    // Validações básicas
    if (!master_id || !condominio_id || !tipo_usuario) {
      return NextResponse.json({
        success: false,
        error: 'Dados obrigatórios faltando: master_id, condominio_id, tipo_usuario'
      }, { status: 400 })
    }

    // Verificar permissão
    if (!['master', 'sindico', 'subsindico'].includes(tipo_usuario)) {
      return NextResponse.json({
        success: false,
        error: 'Você não tem permissão para criar lançamentos'
      }, { status: 403 })
    }

    // Criar data corretamente sem problema de timezone
    const criarDataLocal = (dataString: string) => {
      const [ano, mes, dia] = dataString.split('-').map(Number)
      return new Date(ano, mes - 1, dia) // mes - 1 porque Date() usa índice 0-11 para meses
    }

    // Criar lançamento
    const novoLancamento = new FinanceiroCondominio({
      tipo,
      categoria,
      descricao,
      valor: parseFloat(valor),
      data_vencimento: criarDataLocal(data_vencimento),
      observacoes,
      recorrente: recorrente || false,
      periodicidade: recorrente ? periodicidade : undefined,
      condominio_id: new mongoose.Types.ObjectId(condominio_id),
      master_id: new mongoose.Types.ObjectId(master_id),
      criado_por_tipo: tipo_usuario,
      criado_por_id: new mongoose.Types.ObjectId(usuario_id),
      criado_por_nome,
      status: status || 'pendente',
      origem_sistema: 'manual'
    })

    // Definir data de pagamento se status for 'pago'
    if (status === 'pago') {
      novoLancamento.data_pagamento = data_pagamento ? criarDataLocal(data_pagamento) : new Date()
    } else {
      // Calcular status baseado na data de vencimento se não foi fornecido
      if (!status) {
        const hoje = new Date()
        const vencimento = criarDataLocal(data_vencimento)
        
        if (vencimento < hoje) {
          novoLancamento.status = 'atrasado'
        }
      }
    }

    await novoLancamento.save()

    // Limpar cache relacionado a este condomínio
    const keys = Array.from((cache as any).cache.keys()).filter((key: string) => {
      return key.includes(`condominio_id:${condominio_id}`) && 
             key.includes(`master_id:${master_id}`)
    })
    
    keys.forEach(key => {
      console.log('🗑️ Removendo cache após criação:', key)
      cache.delete(key)
    })

    return NextResponse.json({
      success: true,
      message: 'Lançamento criado com sucesso',
      lancamento: novoLancamento
    })

  } catch (error) {
    console.error('Erro ao criar lançamento:', error)
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    await connectDB()
    
    const data = await request.json()
    const {
      _id,
      tipo_usuario,
      data_pagamento,
      status,
      observacoes,
      ...updateData
    } = data

    if (!_id || !tipo_usuario) {
      return NextResponse.json({
        success: false,
        error: '_id e tipo_usuario são obrigatórios'
      }, { status: 400 })
    }

    // Verificar permissão
    if (!['master', 'sindico', 'subsindico'].includes(tipo_usuario)) {
      return NextResponse.json({
        success: false,
        error: 'Você não tem permissão para editar lançamentos'
      }, { status: 403 })
    }

    // Buscar lançamento
    const lancamento = await FinanceiroCondominio.findById(_id)
    if (!lancamento) {
      return NextResponse.json({
        success: false,
        error: 'Lançamento não encontrado'
      }, { status: 404 })
    }

    // Preparar dados de atualização
    const dadosAtualizacao: any = {
      ...updateData,
      data_atualizacao: new Date()
    }

    // Função para criar data local (reutilizada do POST)
    const criarDataLocal = (dataString: string) => {
      const [ano, mes, dia] = dataString.split('-').map(Number)
      return new Date(ano, mes - 1, dia) // mes - 1 porque Date() usa índice 0-11 para meses
    }

    // Lógica específica para mudança de status
    if (status && status !== lancamento.status) {
      dadosAtualizacao.status = status
      
      if (status === 'pago' && data_pagamento) {
        dadosAtualizacao.data_pagamento = criarDataLocal(data_pagamento)
      } else if (status === 'pago' && !data_pagamento) {
        dadosAtualizacao.data_pagamento = new Date()
      }
    }

    if (observacoes !== undefined) {
      dadosAtualizacao.observacoes = observacoes
    }

    // Atualizar
    const lancamentoAtualizado = await FinanceiroCondominio.findByIdAndUpdate(
      _id,
      dadosAtualizacao,
      { new: true, runValidators: true }
    )

    // Limpar cache relacionado a este condomínio
    if (lancamentoAtualizado && lancamentoAtualizado.condominio_id && lancamentoAtualizado.master_id) {
      const keys = Array.from((cache as any).cache.keys()).filter((key: string) => {
        return key.includes(`condominio_id:${lancamentoAtualizado.condominio_id}`) && 
               key.includes(`master_id:${lancamentoAtualizado.master_id}`)
      })
      
      keys.forEach(key => {
        console.log('🗑️ Removendo cache após atualização:', key)
        cache.delete(key)
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Lançamento atualizado com sucesso',
      lancamento: lancamentoAtualizado
    })

  } catch (error) {
    console.error('Erro ao atualizar lançamento:', error)
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
    const id = url.searchParams.get('id')
    const tipoUsuario = url.searchParams.get('tipo_usuario')

    if (!id || !tipoUsuario) {
      return NextResponse.json({
        success: false,
        error: 'ID e tipo_usuario são obrigatórios'
      }, { status: 400 })
    }

    // Verificar permissão
    if (!['master', 'sindico', 'subsindico'].includes(tipoUsuario)) {
      return NextResponse.json({
        success: false,
        error: 'Você não tem permissão para excluir lançamentos'
      }, { status: 403 })
    }

    // Hard delete - remove fisicamente do MongoDB
    const lancamento = await FinanceiroCondominio.findByIdAndDelete(id)

    if (!lancamento) {
      return NextResponse.json({
        success: false,
        error: 'Lançamento não encontrado'
      }, { status: 404 })
    }

    // Limpar cache relacionado a este condomínio
    if (lancamento && lancamento.condominio_id && lancamento.master_id) {
      const keys = Array.from((cache as any).cache.keys()).filter((key: unknown) => {
        const keyStr = key as string
        return keyStr.includes(`condominio_id:${lancamento.condominio_id}`) && 
               keyStr.includes(`master_id:${lancamento.master_id}`)
      })
      
      keys.forEach(key => {
        console.log('🗑️ Removendo cache após exclusão:', key as string)
        cache.delete(key as string)
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Lançamento excluído com sucesso'
    })

  } catch (error) {
    console.error('Erro ao excluir lançamento:', error)
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}