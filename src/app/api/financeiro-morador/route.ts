import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import FinanceiroMorador from '@/models/FinanceiroMorador'
import Morador from '@/models/Morador'
import { SincronizacaoFinanceira } from '@/services/sincronizacaoFinanceira'
import mongoose from 'mongoose'

export async function GET(request: NextRequest) {
  try {
    await connectDB()
    
    const url = new URL(request.url)
    const masterId = url.searchParams.get('master_id')
    const condominioId = url.searchParams.get('condominio_id')
    const tipoUsuario = url.searchParams.get('tipo_usuario')
    const usuarioId = url.searchParams.get('usuario_id')
    const moradorId = url.searchParams.get('morador_id')
    const relatorio = url.searchParams.get('relatorio')
    const apartamento = url.searchParams.get('apartamento')
    const bloco = url.searchParams.get('bloco')
    const status = url.searchParams.get('status')
    const categoria = url.searchParams.get('categoria')
    const tipo = url.searchParams.get('tipo')
    const dataInicio = url.searchParams.get('data_inicio')
    const dataFim = url.searchParams.get('data_fim')
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    
    if (!masterId || !tipoUsuario || !condominioId) {
      return NextResponse.json({
        success: false,
        error: 'Master ID, tipo de usuário e condomínio são obrigatórios'
      }, { status: 400 })
    }

    // Filtros base
    const filter: any = {
      master_id: new mongoose.Types.ObjectId(masterId),
      condominio_id: new mongoose.Types.ObjectId(condominioId),
      ativo: true
    }

    // Se for morador, só pode ver seus próprios dados
    if (tipoUsuario === 'morador' && usuarioId) {
      filter.morador_id = new mongoose.Types.ObjectId(usuarioId)
    } else if (moradorId) {
      filter.morador_id = new mongoose.Types.ObjectId(moradorId)
    }

    // Filtros adicionais
    if (apartamento) filter.apartamento = apartamento
    if (bloco) filter.bloco = bloco
    if (status) filter.status = status
    if (categoria) filter.categoria = categoria
    if (tipo) filter.tipo = tipo
    if (dataInicio || dataFim) {
      filter.data_vencimento = {}
      if (dataInicio) filter.data_vencimento.$gte = new Date(dataInicio)
      if (dataFim) filter.data_vencimento.$lte = new Date(dataFim)
    }

    // RELATÓRIOS ESPECÍFICOS DE MORADORES
    if (relatorio === 'resumo') {
      const pipeline = [
        { $match: filter },
        {
          $group: {
            _id: null,
            total_receitas: {
              $sum: {
                $cond: [{ $eq: ['$tipo', 'receita'] }, '$valor', 0]
              }
            },
            total_despesas: {
              $sum: {
                $cond: [{ $eq: ['$tipo', 'despesa'] }, '$valor', 0]
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
            total_pagos: {
              $sum: {
                $cond: [{ $eq: ['$status', 'pago'] }, '$valor', 0]
              }
            },
            count_total: { $sum: 1 },
            count_pendentes: {
              $sum: {
                $cond: [{ $eq: ['$status', 'pendente'] }, 1, 0]
              }
            },
            count_atrasados: {
              $sum: {
                $cond: [{ $eq: ['$status', 'atrasado'] }, 1, 0]
              }
            }
          }
        }
      ]

      const resumo = await FinanceiroMorador.aggregate(pipeline)
      const resultado = resumo[0] || {
        total_receitas: 0,
        total_despesas: 0,
        total_pendentes: 0,
        total_atrasados: 0,
        total_pagos: 0,
        count_total: 0,
        count_pendentes: 0,
        count_atrasados: 0
      }

      resultado.resultado_liquido = resultado.total_receitas - resultado.total_despesas

      return NextResponse.json({
        success: true,
        resumo: resultado
      })
    }

    if (relatorio === 'por_categoria') {
      const pipeline = [
        { $match: filter },
        {
          $group: {
            _id: '$categoria',
            total_valor: { $sum: '$valor' },
            count: { $sum: 1 }
          }
        },
        { $sort: { total_valor: -1 } },
        { $limit: 10 }
      ]

      const categorias = await FinanceiroMorador.aggregate(pipeline)

      return NextResponse.json({
        success: true,
        categorias
      })
    }

    if (relatorio === 'fluxo_mensal') {
      const pipeline = [
        { $match: filter },
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
        { $sort: { '_id.ano': -1, '_id.mes': -1 } },
        { $limit: 12 }
      ]

      const fluxo_mensal = await FinanceiroMorador.aggregate(pipeline)

      return NextResponse.json({
        success: true,
        fluxo_mensal
      })
    }

    if (relatorio === 'inadimplencia') {
      const pipeline = [
        { 
          $match: { 
            ...filter, 
            status: { $in: ['atrasado', 'pendente'] },
            data_vencimento: { $lt: new Date() }
          } 
        },
        {
          $group: {
            _id: '$morador_id',
            morador_nome: { $first: '$morador_nome' },
            apartamento: { $first: '$apartamento' },
            bloco: { $first: '$bloco' },
            total_devido: { $sum: '$valor' },
            count_parcelas: { $sum: 1 },
            primeira_pendencia: { $min: '$data_vencimento' },
            ultima_pendencia: { $max: '$data_vencimento' },
            tipos_debito: { $addToSet: '$tipo' }
          }
        },
        {
          $addFields: {
            dias_atraso: {
              $divide: [
                { $subtract: [new Date(), '$primeira_pendencia'] },
                86400000 // ms em um dia
              ]
            }
          }
        },
        { $sort: { total_devido: -1 } as any }
      ]

      const inadimplentes = await FinanceiroMorador.aggregate(pipeline)

      return NextResponse.json({
        success: true,
        inadimplentes
      })
    }

    if (relatorio === 'por_apartamento') {
      const pipeline = [
        { $match: filter },
        {
          $group: {
            _id: {
              apartamento: '$apartamento',
              bloco: '$bloco'
            },
            total_valor: { $sum: '$valor' },
            moradores: { $addToSet: { nome: '$morador_nome', id: '$morador_id' } },
            total_taxas: {
              $sum: {
                $cond: [{ $eq: ['$tipo', 'taxa_condominio'] }, '$valor', 0]
              }
            },
            total_multas: {
              $sum: {
                $cond: [{ $eq: ['$tipo', 'multa'] }, '$valor', 0]
              }
            },
            pendentes: {
              $sum: {
                $cond: [{ $eq: ['$status', 'pendente'] }, '$valor', 0]
              }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.bloco': 1, '_id.apartamento': 1 } as any }
      ]

      const apartamentos = await FinanceiroMorador.aggregate(pipeline)

      return NextResponse.json({
        success: true,
        apartamentos
      })
    }

    if (relatorio === 'historico_pagamentos') {
      const pipeline = [
        { 
          $match: { 
            ...filter, 
            status: 'pago',
            data_pagamento: { $exists: true }
          } 
        },
        {
          $group: {
            _id: {
              ano: { $year: '$data_pagamento' },
              mes: { $month: '$data_pagamento' }
            },
            total_arrecadado: { $sum: '$valor' },
            count_pagamentos: { $sum: 1 },
            moradores_pagantes: { $addToSet: '$morador_id' }
          }
        },
        {
          $addFields: {
            count_moradores_pagantes: { $size: '$moradores_pagantes' }
          }
        },
        { $sort: { '_id.ano': -1, '_id.mes': -1 } as any }
      ]

      const historico = await FinanceiroMorador.aggregate(pipeline)

      return NextResponse.json({
        success: true,
        historico_pagamentos: historico
      })
    }

    // LISTAGEM PADRÃO
    const skip = (page - 1) * limit
    
    const lancamentos = await FinanceiroMorador
      .find(filter)
      .sort({ data_vencimento: -1, data_criacao: -1 })
      .skip(skip)
      .limit(limit)
      .lean()

    const total = await FinanceiroMorador.countDocuments(filter)

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
    console.error('Erro ao buscar financeiro de moradores:', error)
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
      morador_id,
      observacoes,
      recorrente,
      periodicidade,
      multa_juros,
      master_id,
      condominio_id,
      tipo_usuario,
      usuario_id,
      criado_por_nome
    } = data

    // Validações básicas
    if (!master_id || !condominio_id || !tipo_usuario || !morador_id) {
      return NextResponse.json({
        success: false,
        error: 'Dados obrigatórios faltando: master_id, condominio_id, tipo_usuario, morador_id'
      }, { status: 400 })
    }

    // Verificar se tem permissão (moradores não podem criar lançamentos)
    if (!['master', 'sindico', 'subsindico'].includes(tipo_usuario)) {
      return NextResponse.json({
        success: false,
        error: 'Você não tem permissão para criar lançamentos de moradores'
      }, { status: 403 })
    }

    // Validar se morador existe e está ativo
    const morador = await Morador.findOne({
      _id: morador_id,
      condominio_id: condominio_id,
      master_id: master_id,
      ativo: true
    })

    if (!morador) {
      return NextResponse.json({
        success: false,
        error: 'Morador não encontrado ou inativo'
      }, { status: 404 })
    }

    // Criar lançamento
    const novoLancamento = new FinanceiroMorador({
      tipo,
      categoria,
      descricao,
      valor: parseFloat(valor),
      data_vencimento: new Date(data_vencimento),
      morador_id: new mongoose.Types.ObjectId(morador_id),
      morador_nome: morador.nome,
      apartamento: morador.unidade,
      bloco: morador.bloco || '',
      observacoes,
      recorrente: recorrente || false,
      periodicidade: recorrente ? periodicidade : undefined,
      condominio_id: new mongoose.Types.ObjectId(condominio_id),
      master_id: new mongoose.Types.ObjectId(master_id),
      criado_por_tipo: tipo_usuario,
      criado_por_id: new mongoose.Types.ObjectId(usuario_id),
      criado_por_nome,
      status: status || 'pendente'
    })

    // Definir data de pagamento se status for 'pago'
    if (status === 'pago') {
      novoLancamento.data_pagamento = data_pagamento ? new Date(data_pagamento) : new Date()
    } else {
      // Calcular status baseado na data de vencimento se não foi fornecido
      if (!status) {
        const hoje = new Date()
        const vencimento = new Date(data_vencimento)
        
        if (vencimento < hoje) {
          novoLancamento.status = 'atrasado'
        }
      }
    }

    await novoLancamento.save()

    // Sincronizar com financeiro do condomínio
    try {
      const dadosSincronizacao = {
        _id: novoLancamento._id.toString(),
        tipo: 'receita' as const,
        categoria,
        descricao,
        valor: parseFloat(valor),
        data_vencimento: new Date(data_vencimento),
        data_pagamento: novoLancamento.data_pagamento,
        status: novoLancamento.status,
        condominio_id: condominio_id,
        master_id: master_id,
        criado_por_tipo: tipo_usuario,
        criado_por_id: usuario_id,
        criado_por_nome,
        observacoes,
        recorrente: recorrente || false,
        periodicidade: recorrente ? periodicidade : undefined,
        mes_referencia: `${new Date(data_vencimento).getMonth() + 1}/${new Date(data_vencimento).getFullYear()}`,
        origem_nome: morador.nome,
        origem_identificacao: morador.cpf,
        bloco: morador.bloco || '',
        unidade: morador.unidade || ''
      }

      await SincronizacaoFinanceira.sincronizarMorador(dadosSincronizacao)
      console.log('✅ Lançamento de morador sincronizado com condomínio')
    } catch (syncError) {
      console.error('⚠️ Erro na sincronização, mas lançamento foi criado:', syncError)
    }

    return NextResponse.json({
      success: true,
      message: 'Lançamento de morador criado com sucesso',
      lancamento: novoLancamento
    })

  } catch (error) {
    console.error('Erro ao criar lançamento de morador:', error)
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

    // Verificar permissão (moradores não podem editar)
    if (!['master', 'sindico', 'subsindico'].includes(tipo_usuario)) {
      return NextResponse.json({
        success: false,
        error: 'Você não tem permissão para editar lançamentos de moradores'
      }, { status: 403 })
    }

    // Buscar lançamento
    const lancamento = await FinanceiroMorador.findById(_id)
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

    // Lógica específica para mudança de status
    if (status && status !== lancamento.status) {
      dadosAtualizacao.status = status
      
      if (status === 'pago' && data_pagamento) {
        dadosAtualizacao.data_pagamento = new Date(data_pagamento)
      } else if (status === 'pago' && !data_pagamento) {
        dadosAtualizacao.data_pagamento = new Date()
      }
    }

    if (observacoes !== undefined) {
      dadosAtualizacao.observacoes = observacoes
    }

    // Atualizar
    const lancamentoAtualizado = await FinanceiroMorador.findByIdAndUpdate(
      _id,
      dadosAtualizacao,
      { new: true, runValidators: true }
    )

    return NextResponse.json({
      success: true,
      message: 'Lançamento atualizado com sucesso',
      lancamento: lancamentoAtualizado
    })

  } catch (error) {
    console.error('Erro ao atualizar lançamento de morador:', error)
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

    // Verificar permissão (moradores não podem excluir)
    if (!['master', 'sindico', 'subsindico'].includes(tipoUsuario)) {
      return NextResponse.json({
        success: false,
        error: 'Você não tem permissão para excluir lançamentos de moradores'
      }, { status: 403 })
    }

    // Soft delete
    const lancamento = await FinanceiroMorador.findByIdAndUpdate(
      id,
      { 
        ativo: false,
        data_atualizacao: new Date()
      },
      { new: true }
    )

    if (!lancamento) {
      return NextResponse.json({
        success: false,
        error: 'Lançamento não encontrado'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'Lançamento excluído com sucesso'
    })

  } catch (error) {
    console.error('Erro ao excluir lançamento de morador:', error)
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}