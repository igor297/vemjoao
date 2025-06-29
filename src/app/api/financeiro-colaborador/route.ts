import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import FinanceiroColaborador, { verificarPermissaoFinanceiroColaborador } from '@/models/FinanceiroColaborador'
import Colaborador from '@/models/Colaborador'
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
    const colaboradorId = url.searchParams.get('colaborador_id')
    const relatorio = url.searchParams.get('relatorio')
    const mesReferencia = url.searchParams.get('mes_referencia')
    const status = url.searchParams.get('status')
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

    // Verificar se é o próprio colaborador
    const isProprioColaborador = tipoUsuario === 'colaborador' && usuarioId === colaboradorId

    // Verificar permissão
    if (!verificarPermissaoFinanceiroColaborador('ver', tipoUsuario, isProprioColaborador)) {
      return NextResponse.json({
        success: false,
        error: 'Você não tem permissão para acessar dados financeiros de colaboradores'
      }, { status: 403 })
    }

    // Filtros base
    const filter: any = {
      master_id: new mongoose.Types.ObjectId(masterId),
      condominio_id: new mongoose.Types.ObjectId(condominioId),
      ativo: true
    }

    // Se for colaborador, só pode ver seus próprios dados
    if (tipoUsuario === 'colaborador' && usuarioId) {
      filter.colaborador_id = new mongoose.Types.ObjectId(usuarioId)
    } else if (colaboradorId) {
      filter.colaborador_id = new mongoose.Types.ObjectId(colaboradorId)
    }

    // Filtros adicionais
    if (mesReferencia) filter.mes_referencia = mesReferencia
    if (status) filter.status = status
    if (dataInicio || dataFim) {
      filter.data_vencimento = {}
      if (dataInicio) filter.data_vencimento.$gte = new Date(dataInicio)
      if (dataFim) filter.data_vencimento.$lte = new Date(dataFim)
    }

    // RELATÓRIOS ESPECÍFICOS DE COLABORADORES
    if (relatorio === 'resumo') {
      const pipeline = [
        { $match: filter },
        {
          $group: {
            _id: null,
            total_salarios: {
              $sum: {
                $cond: [{ $eq: ['$tipo', 'salario'] }, '$valor', 0]
              }
            },
            total_bonus: {
              $sum: {
                $cond: [{ $eq: ['$tipo', 'bonus'] }, '$valor', 0]
              }
            },
            total_descontos: {
              $sum: {
                $cond: [{ $eq: ['$tipo', 'desconto'] }, '$valor', 0]
              }
            },
            total_vales: {
              $sum: {
                $cond: [{ $eq: ['$tipo', 'vale'] }, '$valor', 0]
              }
            },
            total_horas_extras: {
              $sum: {
                $cond: [{ $eq: ['$tipo', 'hora_extra'] }, '$valor', 0]
              }
            },
            total_pendentes: {
              $sum: {
                $cond: [{ $eq: ['$status', 'pendente'] }, '$valor', 0]
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
            }
          }
        }
      ]

      const resumo = await FinanceiroColaborador.aggregate(pipeline)
      const resultado = resumo[0] || {
        total_salarios: 0,
        total_bonus: 0,
        total_descontos: 0,
        total_vales: 0,
        total_horas_extras: 0,
        total_pendentes: 0,
        total_pagos: 0,
        count_total: 0,
        count_pendentes: 0
      }

      resultado.total_liquido = resultado.total_salarios + resultado.total_bonus + resultado.total_horas_extras - resultado.total_descontos - resultado.total_vales

      return NextResponse.json({
        success: true,
        resumo: resultado
      })
    }

    if (relatorio === 'por_colaborador') {
      const pipeline = [
        { $match: filter },
        {
          $group: {
            _id: '$colaborador_id',
            colaborador_nome: { $first: '$colaborador_nome' },
            colaborador_cargo: { $first: '$colaborador_cargo' },
            colaborador_cpf: { $first: '$colaborador_cpf' },
            total_valor: { $sum: '$valor' },
            total_salarios: {
              $sum: {
                $cond: [{ $eq: ['$tipo', 'salario'] }, '$valor', 0]
              }
            },
            total_bonus: {
              $sum: {
                $cond: [{ $eq: ['$tipo', 'bonus'] }, '$valor', 0]
              }
            },
            total_descontos: {
              $sum: {
                $cond: [{ $eq: ['$tipo', 'desconto'] }, '$valor', 0]
              }
            },
            count: { $sum: 1 },
            pendentes: {
              $sum: {
                $cond: [{ $in: ['$status', ['pendente', 'atrasado']] }, '$valor', 0]
              }
            },
            atrasados: {
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
            }
          }
        },
        {
          $addFields: {
            valor_liquido: {
              $subtract: [
                { $add: ['$total_salarios', '$total_bonus'] },
                '$total_descontos'
              ]
            }
          }
        },
        { $sort: { total_valor: -1 } as any }
      ]

      const colaboradores = await FinanceiroColaborador.aggregate(pipeline)

      return NextResponse.json({
        success: true,
        colaboradores
      })
    }

    if (relatorio === 'folha_pagamento') {
      const pipeline = [
        { $match: { ...filter, mes_referencia: mesReferencia || new Date().toISOString().slice(0, 7) } },
        {
          $group: {
            _id: '$colaborador_id',
            colaborador_nome: { $first: '$colaborador_nome' },
            salario_base: {
              $sum: {
                $cond: [{ $eq: ['$tipo', 'salario'] }, '$valor', 0]
              }
            },
            bonus: {
              $sum: {
                $cond: [{ $eq: ['$tipo', 'bonus'] }, '$valor', 0]
              }
            },
            horas_extras: {
              $sum: {
                $cond: [{ $eq: ['$tipo', 'hora_extra'] }, '$valor', 0]
              }
            },
            descontos: {
              $sum: {
                $cond: [{ $eq: ['$tipo', 'desconto'] }, '$valor', 0]
              }
            },
            vales: {
              $sum: {
                $cond: [{ $eq: ['$tipo', 'vale'] }, '$valor', 0]
              }
            },
            total_horas_trabalhadas: { $sum: '$horas_trabalhadas' }
          }
        },
        {
          $addFields: {
            total_proventos: { $add: ['$salario_base', '$bonus', '$horas_extras'] },
            total_descontos: { $add: ['$descontos', '$vales'] },
            salario_liquido: {
              $subtract: [
                { $add: ['$salario_base', '$bonus', '$horas_extras'] },
                { $add: ['$descontos', '$vales'] }
              ]
            }
          }
        },
        { $sort: { colaborador_nome: 1 } }
      ]

      const folhaPagamento = await FinanceiroColaborador.aggregate(pipeline)

      return NextResponse.json({
        success: true,
        folha_pagamento: folhaPagamento,
        mes_referencia: mesReferencia || new Date().toISOString().slice(0, 7)
      })
    }

    if (relatorio === 'horas_extras') {
      const pipeline = [
        { $match: { ...filter, tipo: 'hora_extra' } },
        {
          $group: {
            _id: {
              colaborador_id: '$colaborador_id',
              mes_referencia: '$mes_referencia'
            },
            colaborador_nome: { $first: '$colaborador_nome' },
            total_horas: { $sum: '$horas_trabalhadas' },
            total_valor: { $sum: '$valor' },
            count_registros: { $sum: 1 }
          }
        },
        {
          $addFields: {
            valor_hora: {
              $cond: [
                { $gt: ['$total_horas', 0] },
                { $divide: ['$total_valor', '$total_horas'] },
                0
              ]
            }
          }
        },
        { $sort: { '_id.mes_referencia': -1, total_valor: -1 } as any }
      ]

      const horasExtras = await FinanceiroColaborador.aggregate(pipeline)

      return NextResponse.json({
        success: true,
        horas_extras: horasExtras
      })
    }

    // LISTAGEM PADRÃO
    const skip = (page - 1) * limit
    
    const lancamentos = await FinanceiroColaborador
      .find(filter)
      .sort({ data_vencimento: -1, data_criacao: -1 })
      .skip(skip)
      .limit(limit)
      .lean()

    const total = await FinanceiroColaborador.countDocuments(filter)

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
    console.error('Erro ao buscar financeiro de colaboradores:', error)
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
      descricao,
      valor,
      data_vencimento,
      colaborador_id,
      mes_referencia,
      horas_trabalhadas,
      observacoes,
      master_id,
      condominio_id,
      tipo_usuario,
      usuario_id,
      criado_por_nome
    } = data

    // Validações básicas
    if (!master_id || !condominio_id || !tipo_usuario || !colaborador_id) {
      return NextResponse.json({
        success: false,
        error: 'Dados obrigatórios faltando: master_id, condominio_id, tipo_usuario, colaborador_id'
      }, { status: 400 })
    }

    if (!tipo || !valor || !data_vencimento || !descricao) {
      return NextResponse.json({
        success: false,
        error: 'Dados obrigatórios faltando: tipo, valor, data_vencimento, descricao'
      }, { status: 400 })
    }

    // Verificar permissão
    if (!verificarPermissaoFinanceiroColaborador('criar', tipo_usuario)) {
      return NextResponse.json({
        success: false,
        error: 'Você não tem permissão para criar lançamentos de colaboradores'
      }, { status: 403 })
    }

    // Validar se colaborador existe e está ativo
    const colaborador = await Colaborador.findOne({
      _id: colaborador_id,
      condominio_id: condominio_id,
      master_id: master_id,
      ativo: true
    })

    if (!colaborador) {
      return NextResponse.json({
        success: false,
        error: 'Colaborador não encontrado ou inativo'
      }, { status: 404 })
    }

    // Validações específicas por tipo
    if (tipo === 'hora_extra' && (!horas_trabalhadas || horas_trabalhadas <= 0)) {
      return NextResponse.json({
        success: false,
        error: 'Horas trabalhadas são obrigatórias para lançamentos de hora extra'
      }, { status: 400 })
    }

    // Validar se já existe salário para o mesmo mês (evitar duplicação)
    if (tipo === 'salario' && mes_referencia) {
      const salarioExistente = await FinanceiroColaborador.findOne({
        colaborador_id: new mongoose.Types.ObjectId(colaborador_id),
        tipo: 'salario',
        mes_referencia,
        ativo: true
      })

      if (salarioExistente) {
        return NextResponse.json({
          success: false,
          error: `Já existe um salário registrado para ${colaborador.nome} no mês ${mes_referencia}`
        }, { status: 400 })
      }
    }

    // Criar lançamento
    const novoLancamento = new FinanceiroColaborador({
      tipo,
      descricao,
      valor: parseFloat(valor),
      data_vencimento: new Date(data_vencimento + 'T12:00:00'),
      colaborador_id: new mongoose.Types.ObjectId(colaborador_id),
      colaborador_nome: colaborador.nome,
      colaborador_cargo: colaborador.cargo,
      colaborador_cpf: colaborador.cpf,
      mes_referencia,
      horas_trabalhadas: tipo === 'hora_extra' ? parseFloat(horas_trabalhadas) : undefined,
      observacoes,
      condominio_id: new mongoose.Types.ObjectId(condominio_id),
      master_id: new mongoose.Types.ObjectId(master_id),
      criado_por_tipo: tipo_usuario,
      criado_por_id: new mongoose.Types.ObjectId(usuario_id),
      criado_por_nome,
      status: 'pendente'
    })

    // Calcular status baseado na data de vencimento
    const hoje = new Date()
    const vencimento = new Date(data_vencimento)
    
    if (vencimento < hoje) {
      novoLancamento.status = 'atrasado'
    }

    await novoLancamento.save()

    // Sincronizar com financeiro do condomínio
    try {
      const dadosSincronizacao = {
        _id: novoLancamento._id.toString(),
        tipo: 'despesa' as const,
        categoria: tipo,
        descricao,
        valor: parseFloat(valor),
        data_vencimento: new Date(data_vencimento + 'T12:00:00'),
        data_pagamento: novoLancamento.data_pagamento,
        status: novoLancamento.status,
        condominio_id: condominio_id,
        master_id: master_id,
        criado_por_tipo: tipo_usuario,
        criado_por_id: usuario_id,
        criado_por_nome,
        observacoes,
        recorrente: tipo === 'salario',
        periodicidade: tipo === 'salario' ? 'mensal' : undefined,
        mes_referencia,
        origem_nome: colaborador.nome,
        origem_identificacao: colaborador.cpf,
        bloco: colaborador.departamento || '',
        apartamento: colaborador.cargo || '',
        departamento: colaborador.departamento,
        cargo: colaborador.cargo
      }

      await SincronizacaoFinanceira.sincronizarColaborador(dadosSincronizacao)
      console.log('✅ Lançamento de colaborador sincronizado com condomínio')
    } catch (syncError) {
      console.error('⚠️ Erro na sincronização, mas lançamento foi criado:', syncError)
    }

    return NextResponse.json({
      success: true,
      message: 'Lançamento de colaborador criado com sucesso',
      lancamento: novoLancamento
    })

  } catch (error) {
    console.error('Erro ao criar lançamento de colaborador:', error)
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
      usuario_id,
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

    // Buscar lançamento
    const lancamento = await FinanceiroColaborador.findById(_id)
    if (!lancamento) {
      return NextResponse.json({
        success: false,
        error: 'Lançamento não encontrado'
      }, { status: 404 })
    }

    // Verificar se é o próprio colaborador
    const isProprioColaborador = tipo_usuario === 'colaborador' && 
                                usuario_id === lancamento.colaborador_id.toString()

    // Verificar permissão
    if (!verificarPermissaoFinanceiroColaborador('editar', tipo_usuario, isProprioColaborador)) {
      return NextResponse.json({
        success: false,
        error: 'Você não tem permissão para editar lançamentos de colaboradores'
      }, { status: 403 })
    }

    // Colaboradores só podem editar observações dos próprios lançamentos
    if (tipo_usuario === 'colaborador') {
      const dadosPermitidos = { observacoes }
      Object.keys(updateData).forEach(key => {
        if (!['observacoes'].includes(key)) {
          delete updateData[key]
        }
      })
    }

    // Preparar dados de atualização
    const dadosAtualizacao: any = {
      ...updateData,
      data_atualizacao: new Date()
    }

    // Lógica específica para mudança de status (apenas para administradores)
    if (status && status !== lancamento.status && tipo_usuario !== 'colaborador') {
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
    const lancamentoAtualizado = await FinanceiroColaborador.findByIdAndUpdate(
      _id,
      dadosAtualizacao,
      { new: true, runValidators: true }
    )

    if (!lancamentoAtualizado) {
      return NextResponse.json({
        success: false,
        error: 'Lançamento não encontrado'
      }, { status: 404 })
    }

    // Sincronizar alterações com financeiro do condomínio
    try {
      const dadosSincronizacao = {
        _id: lancamentoAtualizado._id.toString(),
        tipo: 'despesa' as const,
        categoria: lancamentoAtualizado.tipo,
        descricao: `${lancamentoAtualizado.colaborador_nome} - ${lancamentoAtualizado.tipo}`,
        valor: lancamentoAtualizado.valor,
        data_vencimento: lancamentoAtualizado.data_vencimento,
        data_pagamento: lancamentoAtualizado.data_pagamento,
        status: lancamentoAtualizado.status,
        condominio_id: lancamentoAtualizado.condominio_id.toString(),
        master_id: lancamentoAtualizado.master_id.toString(),
        criado_por_tipo: lancamentoAtualizado.criado_por_tipo,
        criado_por_id: lancamentoAtualizado.criado_por_id.toString(),
        criado_por_nome: lancamentoAtualizado.criado_por_nome,
        observacoes: lancamentoAtualizado.observacoes,
        recorrente: false,
        mes_referencia: lancamentoAtualizado.mes_referencia,
        origem_nome: lancamentoAtualizado.colaborador_nome,
        origem_identificacao: lancamentoAtualizado.colaborador_cpf
      }

      await SincronizacaoFinanceira.sincronizarColaborador(dadosSincronizacao)
      console.log('✅ Sincronização UPDATE realizada com sucesso')
    } catch (syncError) {
      console.error('❌ Erro na sincronização UPDATE:', syncError)
      // Não falha a operação se a sincronização der erro
    }

    return NextResponse.json({
      success: true,
      message: 'Lançamento atualizado com sucesso',
      lancamento: lancamentoAtualizado
    })

  } catch (error) {
    console.error('Erro ao atualizar lançamento de colaborador:', error)
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

    // Verificar permissão (colaboradores não podem excluir)
    if (!verificarPermissaoFinanceiroColaborador('excluir', tipoUsuario)) {
      return NextResponse.json({
        success: false,
        error: 'Você não tem permissão para excluir lançamentos de colaboradores'
      }, { status: 403 })
    }

    // Soft delete
    const lancamento = await FinanceiroColaborador.findByIdAndUpdate(
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

    // Sincronizar exclusão com financeiro do condomínio
    try {
      await SincronizacaoFinanceira.removerSincronizacao('colaborador', lancamento.colaborador_cpf, lancamento.condominio_id.toString())
      console.log('✅ Sincronização DELETE realizada com sucesso')
    } catch (syncError) {
      console.error('❌ Erro na sincronização DELETE:', syncError)
      // Não falha a operação se a sincronização der erro
    }

    return NextResponse.json({
      success: true,
      message: 'Lançamento excluído com sucesso'
    })

  } catch (error) {
    console.error('Erro ao excluir lançamento de colaborador:', error)
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}