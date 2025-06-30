import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import FinanceiroCondominio from '@/models/FinanceiroCondominio'
import mongoose from 'mongoose'

export async function GET(request: NextRequest) {
  try {
    await connectDB()
    
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
    
    if (!masterId || !tipoUsuario || !condominioId) {
      return NextResponse.json({
        success: false,
        error: 'Master ID, tipo de usuário e condomínio são obrigatórios'
      }, { status: 400 })
    }

    const filter: any = {
      master_id: new mongoose.Types.ObjectId(masterId),
      condominio_id: new mongoose.Types.ObjectId(condominioId),
      ativo: true
    }

    if (origemSistema) filter.origem_sistema = origemSistema
    if (status) filter.status = status
    if (tipo) filter.tipo = tipo

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
      const resultado = resumo[0] || {
        total_receitas: 0,
        total_despesas: 0,
        total_pendentes: 0,
        total_atrasados: 0,
        count_pendentes: 0,
        count_atrasados: 0,
        count_total: 0
      }

      resultado.resultado_liquido = resultado.total_receitas - resultado.total_despesas

      return NextResponse.json({
        success: true,
        resumo: resultado
      })
    }

    if (relatorio === 'por_origem') {
      const pipeline = [
        { $match: filter },
        {
          $group: {
            _id: {
              origem_sistema: '$origem_sistema',
              tipo: '$tipo'
            },
            total_valor: { $sum: '$valor' },
            count: { $sum: 1 }
          }
        }
      ]

      const origens = await FinanceiroCondominio.aggregate(pipeline)

      return NextResponse.json({
        success: true,
        por_origem: origens
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

      const categorias = await FinanceiroCondominio.aggregate(pipeline)

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

      const fluxo_mensal = await FinanceiroCondominio.aggregate(pipeline)

      return NextResponse.json({
        success: true,
        fluxo_mensal
      })
    }

    const skip = (page - 1) * limit
    
    const lancamentos = await FinanceiroCondominio
      .find(filter)
      .sort({ data_vencimento: -1 })
      .skip(skip)
      .limit(limit)
      .lean()

    const total = await FinanceiroCondominio.countDocuments(filter)

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

    // Criar lançamento
    const novoLancamento = new FinanceiroCondominio({
      tipo,
      categoria,
      descricao,
      valor: parseFloat(valor),
      data_vencimento: new Date(data_vencimento + 'T12:00:00'),
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
      novoLancamento.data_pagamento = data_pagamento ? new Date(data_pagamento + 'T12:00:00') : new Date()
    } else {
      // Calcular status baseado na data de vencimento se não foi fornecido
      if (!status) {
        const hoje = new Date()
        const vencimento = new Date(data_vencimento + 'T12:00:00')
        
        if (vencimento < hoje) {
          novoLancamento.status = 'atrasado'
        }
      }
    }

    await novoLancamento.save()

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

    // Lógica específica para mudança de status
    if (status && status !== lancamento.status) {
      dadosAtualizacao.status = status
      
      if (status === 'pago' && data_pagamento) {
        dadosAtualizacao.data_pagamento = new Date(data_pagamento + 'T12:00:00')
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

    // Soft delete
    const lancamento = await FinanceiroCondominio.findByIdAndUpdate(
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
    console.error('Erro ao excluir lançamento:', error)
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}