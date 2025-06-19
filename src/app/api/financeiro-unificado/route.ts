import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import FinanceiroUnificado, { verificarPermissaoFinanceiroUnificado, getCategoriaContabil } from '@/models/FinanceiroUnificado'
import ContaBancaria from '@/models/ContaBancaria'
import Colaborador from '@/models/Colaborador'
import Morador from '@/models/Morador'
import mongoose from 'mongoose'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const masterId = url.searchParams.get('master_id')
    const condominioId = url.searchParams.get('condominio_id')
    const tipoUsuario = url.searchParams.get('tipo_usuario')
    const usuarioId = url.searchParams.get('usuario_id')
    const categoriaOrigem = url.searchParams.get('categoria_origem')
    const relatorio = url.searchParams.get('relatorio')
    const dataInicio = url.searchParams.get('data_inicio')
    const dataFim = url.searchParams.get('data_fim')
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    
    if (!masterId || !tipoUsuario || !condominioId) {
      return NextResponse.json(
        { error: 'Master ID, tipo de usuário e condomínio são obrigatórios' },
        { status: 400 }
      )
    }

    // Verificar permissão
    const acao = relatorio ? 'relatorios' : 'ver'
    if (!verificarPermissaoFinanceiroUnificado(acao, tipoUsuario, categoriaOrigem)) {
      return NextResponse.json(
        { error: 'Você não tem permissão para acessar dados financeiros' },
        { status: 403 }
      )
    }

    await connectDB()

    // Filtros base
    const filter: any = {
      master_id: masterId,
      condominio_id: condominioId,
      ativo: true
    }

    // Filtro por categoria de origem
    if (categoriaOrigem) {
      filter.categoria_origem = categoriaOrigem
    }

    // Filtro por usuário (para colaboradores e moradores)
    if (['colaborador', 'morador', 'inquilino', 'conjuge', 'dependente'].includes(tipoUsuario) && usuarioId) {
      filter.vinculo_id = usuarioId
    }

    // Filtro por data
    if (dataInicio && dataFim) {
      filter.data_vencimento = {
        $gte: new Date(dataInicio),
        $lte: new Date(dataFim)
      }
    }

    // Se for relatório, retornar dados agregados
    if (relatorio) {
      return await gerarRelatorio(filter, relatorio)
    }

    // Consulta paginada
    const skip = (page - 1) * limit
    const total = await FinanceiroUnificado.countDocuments(filter)
    
    const result = await FinanceiroUnificado
      .find(filter)
      .sort({ data_vencimento: -1 })
      .skip(skip)
      .limit(limit)
      .populate('conta_bancaria_id', 'banco agencia conta nome')
      .lean()

    return NextResponse.json({
      success: true,
      financeiro: result,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('Error fetching financeiro unificado:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar dados financeiros' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const {
      master_id,
      condominio_id,
      tipo_usuario,
      usuario_id,
      ...financeiroData
    } = data

    if (!master_id || !condominio_id || !tipo_usuario) {
      return NextResponse.json(
        { error: 'Dados obrigatórios não fornecidos' },
        { status: 400 }
      )
    }

    // Verificar permissão
    if (!verificarPermissaoFinanceiroUnificado('criar', tipo_usuario, financeiroData.categoria_origem)) {
      return NextResponse.json(
        { error: 'Você não tem permissão para criar lançamentos financeiros' },
        { status: 403 }
      )
    }

    await connectDB()

    // Validar vinculação se necessário
    if (financeiroData.vinculo_id) {
      const vinculoValido = await validarVinculo(
        financeiroData.vinculo_id,
        financeiroData.categoria_origem,
        condominio_id
      )
      
      if (!vinculoValido.valido) {
        return NextResponse.json(
          { error: vinculoValido.erro },
          { status: 400 }
        )
      }
      
      // Atualizar dados do vínculo
      financeiroData.vinculo_nome = vinculoValido.nome
      financeiroData.vinculo_tipo = vinculoValido.tipo
      if (vinculoValido.apartamento) financeiroData.apartamento = vinculoValido.apartamento
      if (vinculoValido.bloco) financeiroData.bloco = vinculoValido.bloco
    }

    // Calcular juros e multas se for um pagamento em atraso
    if (financeiroData.data_pagamento && financeiroData.data_vencimento) {
      const diasAtraso = Math.floor(
        (new Date(financeiroData.data_pagamento).getTime() - new Date(financeiroData.data_vencimento).getTime()) 
        / (1000 * 60 * 60 * 24)
      )
      
      if (diasAtraso > 0) {
        financeiroData.dias_atraso = diasAtraso
        financeiroData.valor_original = financeiroData.valor
        
        // Aplicar multa e juros baseados na configuração do condomínio
        const configFinanceira = await mongoose.model('ConfiguracaoFinanceira').findOne({
          condominio_id: condominio_id
        })
        
        if (configFinanceira) {
          const multa = (financeiroData.valor * (configFinanceira.multa_atraso || 2)) / 100
          const juros = (financeiroData.valor * (configFinanceira.juros_atraso_mes || 1) * diasAtraso) / (100 * 30)
          
          financeiroData.multa_atraso = multa
          financeiroData.juros_atraso = juros
          financeiroData.valor = financeiroData.valor_original + multa + juros
        }
      }
    }

    // Determinar status baseado nas datas
    if (!financeiroData.status) {
      if (financeiroData.data_pagamento) {
        financeiroData.status = 'pago'
      } else if (new Date(financeiroData.data_vencimento) < new Date()) {
        financeiroData.status = 'atrasado'
      } else {
        financeiroData.status = 'pendente'
      }
    }

    // Gerar mês de referência se não fornecido
    if (!financeiroData.mes_referencia) {
      const dataRef = new Date(financeiroData.data_vencimento)
      financeiroData.mes_referencia = `${String(dataRef.getMonth() + 1).padStart(2, '0')}/${dataRef.getFullYear()}`
    }

    const novoLancamento = new FinanceiroUnificado({
      ...financeiroData,
      master_id,
      condominio_id,
      criado_por_id: usuario_id,
      criado_por_tipo: tipo_usuario
    })

    const result = await novoLancamento.save()

    // Se for recorrente, criar próximos lançamentos
    if (financeiroData.recorrente && financeiroData.periodicidade) {
      await criarLancamentosRecorrentes(result, 12) // Criar próximos 12 lançamentos
    }

    return NextResponse.json({
      success: true,
      lancamento: result,
      message: 'Lançamento criado com sucesso'
    })

  } catch (error: any) {
    console.error('Error creating financeiro unificado:', error)
    
    if (error.name === 'ValidationError') {
      const firstError = Object.values(error.errors)[0] as any
      return NextResponse.json(
        { error: firstError.message },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Erro ao criar lançamento financeiro' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { _id, usuario_tipo, usuario_id, ...updateData } = await request.json()

    if (!_id || !usuario_tipo) {
      return NextResponse.json(
        { error: 'ID do lançamento e tipo de usuário são obrigatórios' },
        { status: 400 }
      )
    }

    await connectDB()

    const lancamentoExistente = await FinanceiroUnificado.findById(_id)
    if (!lancamentoExistente) {
      return NextResponse.json(
        { error: 'Lançamento não encontrado' },
        { status: 404 }
      )
    }

    // Verificar permissão
    if (!verificarPermissaoFinanceiroUnificado('editar', usuario_tipo, lancamentoExistente.categoria_origem)) {
      return NextResponse.json(
        { error: 'Você não tem permissão para editar este lançamento' },
        { status: 403 }
      )
    }

    // Recalcular juros e multas se necessário
    if (updateData.data_pagamento && lancamentoExistente.data_vencimento) {
      const diasAtraso = Math.floor(
        (new Date(updateData.data_pagamento).getTime() - lancamentoExistente.data_vencimento.getTime()) 
        / (1000 * 60 * 60 * 24)
      )
      
      if (diasAtraso > 0) {
        updateData.dias_atraso = diasAtraso
        updateData.status = 'pago'
        
        if (!lancamentoExistente.valor_original) {
          updateData.valor_original = lancamentoExistente.valor
        }
      } else {
        updateData.status = 'pago'
        updateData.dias_atraso = 0
      }
    }

    const result = await FinanceiroUnificado.findByIdAndUpdate(
      _id,
      { ...updateData, data_atualizacao: new Date() },
      { new: true, runValidators: true }
    )

    return NextResponse.json({
      success: true,
      lancamento: result,
      message: 'Lançamento atualizado com sucesso'
    })

  } catch (error: any) {
    console.error('Error updating financeiro unificado:', error)
    
    if (error.name === 'ValidationError') {
      const firstError = Object.values(error.errors)[0] as any
      return NextResponse.json(
        { error: firstError.message },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Erro ao atualizar lançamento' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const id = url.searchParams.get('id')
    const tipoUsuario = url.searchParams.get('tipo_usuario')

    if (!id || !tipoUsuario) {
      return NextResponse.json(
        { error: 'ID e tipo de usuário são obrigatórios' },
        { status: 400 }
      )
    }

    await connectDB()

    const lancamento = await FinanceiroUnificado.findById(id)
    if (!lancamento) {
      return NextResponse.json(
        { error: 'Lançamento não encontrado' },
        { status: 404 }
      )
    }

    // Verificar permissão
    if (!verificarPermissaoFinanceiroUnificado('excluir', tipoUsuario, lancamento.categoria_origem)) {
      return NextResponse.json(
        { error: 'Você não tem permissão para excluir este lançamento' },
        { status: 403 }
      )
    }

    // Soft delete
    await FinanceiroUnificado.findByIdAndUpdate(id, {
      ativo: false,
      data_atualizacao: new Date()
    })

    return NextResponse.json({
      success: true,
      message: 'Lançamento excluído com sucesso'
    })

  } catch (error) {
    console.error('Error deleting financeiro unificado:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir lançamento' },
      { status: 500 }
    )
  }
}

// Funções auxiliares
async function validarVinculo(vinculoId: string, categoriaOrigem: string, condominioId: string) {
  try {
    if (categoriaOrigem === 'colaborador') {
      const colaborador = await Colaborador.findOne({
        _id: vinculoId,
        condominio_id: condominioId,
        ativo: true
      })
      
      if (!colaborador) {
        return { valido: false, erro: 'Colaborador não encontrado ou inativo' }
      }
      
      return {
        valido: true,
        nome: colaborador.nome,
        tipo: 'colaborador'
      }
    }
    
    if (categoriaOrigem === 'morador') {
      const morador = await Morador.findOne({
        _id: vinculoId,
        condominio_id: condominioId,
        ativo: true
      })
      
      if (!morador) {
        return { valido: false, erro: 'Morador não encontrado ou inativo' }
      }
      
      return {
        valido: true,
        nome: morador.nome,
        tipo: 'morador',
        apartamento: morador.unidade,
        bloco: morador.bloco
      }
    }
    
    return { valido: true }
  } catch (error) {
    return { valido: false, erro: 'Erro ao validar vínculo' }
  }
}

async function criarLancamentosRecorrentes(lancamentoPai: any, quantidade: number) {
  try {
    const proximosLancamentos = []
    
    for (let i = 1; i <= quantidade; i++) {
      const proximaData = new Date(lancamentoPai.data_vencimento)
      
      switch (lancamentoPai.periodicidade) {
        case 'mensal':
          proximaData.setMonth(proximaData.getMonth() + i)
          break
        case 'bimestral':
          proximaData.setMonth(proximaData.getMonth() + (i * 2))
          break
        case 'trimestral':
          proximaData.setMonth(proximaData.getMonth() + (i * 3))
          break
        case 'semestral':
          proximaData.setMonth(proximaData.getMonth() + (i * 6))
          break
        case 'anual':
          proximaData.setFullYear(proximaData.getFullYear() + i)
          break
      }
      
      const mesRef = `${String(proximaData.getMonth() + 1).padStart(2, '0')}/${proximaData.getFullYear()}`
      
      proximosLancamentos.push({
        ...lancamentoPai.toObject(),
        _id: undefined,
        codigo_lancamento: undefined,
        data_vencimento: proximaData,
        data_pagamento: undefined,
        status: 'pendente',
        mes_referencia: mesRef,
        lancamento_pai_id: lancamentoPai._id,
        data_criacao: new Date(),
        data_atualizacao: new Date()
      })
    }
    
    await FinanceiroUnificado.insertMany(proximosLancamentos)
  } catch (error) {
    console.error('Erro ao criar lançamentos recorrentes:', error)
  }
}

async function gerarRelatorio(filter: any, tipoRelatorio: string) {
  try {
    switch (tipoRelatorio) {
      case 'resumo':
        return await gerarResumoFinanceiro(filter)
      case 'dre':
        return await gerarDRE(filter)
      case 'fluxo-caixa':
        return await gerarFluxoCaixa(filter)
      case 'inadimplencia':
        return await gerarRelatorioInadimplencia(filter)
      case 'categorias':
        return await gerarRelatorioCategorias(filter)
      default:
        return NextResponse.json({ error: 'Tipo de relatório inválido' }, { status: 400 })
    }
  } catch (error) {
    console.error('Erro ao gerar relatório:', error)
    return NextResponse.json({ error: 'Erro ao gerar relatório' }, { status: 500 })
  }
}

async function gerarResumoFinanceiro(filter: any) {
  const pipeline = [
    { $match: filter },
    {
      $group: {
        _id: {
          tipo_operacao: '$tipo_operacao',
          status: '$status'
        },
        total: { $sum: '$valor' },
        quantidade: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.tipo_operacao',
        detalhes: {
          $push: {
            status: '$_id.status',
            total: '$total',
            quantidade: '$quantidade'
          }
        },
        total_geral: { $sum: '$total' }
      }
    }
  ]
  
  const resultado = await FinanceiroUnificado.aggregate(pipeline)
  
  return NextResponse.json({
    success: true,
    relatorio: 'resumo',
    dados: resultado
  })
}

async function gerarDRE(filter: any) {
  const pipeline = [
    { $match: filter },
    {
      $group: {
        _id: '$subcategoria',
        total: { $sum: '$valor' },
        tipo_operacao: { $first: '$tipo_operacao' },
        categoria_origem: { $first: '$categoria_origem' }
      }
    },
    {
      $sort: { tipo_operacao: 1, total: -1 }
    }
  ]
  
  const resultado = await FinanceiroUnificado.aggregate(pipeline)
  
  // Organizar em formato DRE
  const dre = {
    receitas: resultado.filter(item => item.tipo_operacao === 'receita'),
    despesas: resultado.filter(item => item.tipo_operacao === 'despesa'),
    transferencias: resultado.filter(item => item.tipo_operacao === 'transferencia')
  }
  
  const totalReceitas = dre.receitas.reduce((sum, item) => sum + item.total, 0)
  const totalDespesas = dre.despesas.reduce((sum, item) => sum + item.total, 0)
  const resultadoLiquido = totalReceitas - totalDespesas
  
  return NextResponse.json({
    success: true,
    relatorio: 'dre',
    dados: {
      ...dre,
      resumo: {
        total_receitas: totalReceitas,
        total_despesas: totalDespesas,
        resultado_liquido: resultadoLiquido
      }
    }
  })
}

async function gerarFluxoCaixa(filter: any) {
  const pipeline = [
    { $match: filter },
    {
      $group: {
        _id: {
          ano: { $year: '$data_vencimento' },
          mes: { $month: '$data_vencimento' },
          tipo_operacao: '$tipo_operacao'
        },
        total: { $sum: '$valor' }
      }
    },
    {
      $sort: { '_id.ano': 1, '_id.mes': 1 }
    }
  ]
  
  const resultado = await FinanceiroUnificado.aggregate(pipeline)
  
  return NextResponse.json({
    success: true,
    relatorio: 'fluxo-caixa',
    dados: resultado
  })
}

async function gerarRelatorioInadimplencia(filter: any) {
  const filterInadimplencia = {
    ...filter,
    status: { $in: ['atrasado', 'pendente'] },
    data_vencimento: { $lt: new Date() }
  }
  
  const pipeline = [
    { $match: filterInadimplencia },
    {
      $group: {
        _id: '$vinculo_id',
        vinculo_nome: { $first: '$vinculo_nome' },
        apartamento: { $first: '$apartamento' },
        bloco: { $first: '$bloco' },
        total_devido: { $sum: '$valor' },
        quantidade_pendencias: { $sum: 1 },
        mais_antigo: { $min: '$data_vencimento' }
      }
    },
    {
      $sort: { total_devido: -1 }
    }
  ]
  
  const resultado = await FinanceiroUnificado.aggregate(pipeline)
  
  return NextResponse.json({
    success: true,
    relatorio: 'inadimplencia',
    dados: resultado
  })
}

async function gerarRelatorioCategorias(filter: any) {
  const pipeline = [
    { $match: filter },
    {
      $group: {
        _id: {
          categoria_origem: '$categoria_origem',
          subcategoria: '$subcategoria'
        },
        total: { $sum: '$valor' },
        quantidade: { $sum: 1 }
      }
    },
    {
      $sort: { total: -1 }
    }
  ]
  
  const resultado = await FinanceiroUnificado.aggregate(pipeline)
  
  return NextResponse.json({
    success: true,
    relatorio: 'categorias',
    dados: resultado
  })
}