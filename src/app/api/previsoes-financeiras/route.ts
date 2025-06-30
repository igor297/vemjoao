import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import FinanceiroUnificado from '@/models/FinanceiroUnificado'
import ExtratoBancario from '@/models/ExtratoBancario'
import mongoose from 'mongoose'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const masterId = url.searchParams.get('master_id')
    const condominioId = url.searchParams.get('condominio_id')
    const tipoPrevisao = url.searchParams.get('tipo')
    const horizonte = parseInt(url.searchParams.get('horizonte') || '6') // meses
    const modelo = url.searchParams.get('modelo') || 'tendencia_linear'

    if (!masterId || !condominioId) {
      return NextResponse.json(
        { error: 'Master ID e Condomínio ID são obrigatórios' },
        { status: 400 }
      )
    }

    await connectDB()

    switch (tipoPrevisao) {
      case 'fluxo_caixa':
        return await gerarPrevisaoFluxoCaixa(condominioId, horizonte, modelo)
        
      case 'receitas':
        return await gerarPrevisaoReceitas(condominioId, horizonte, modelo)
        
      case 'despesas':
        return await gerarPrevisaoDespesas(condominioId, horizonte, modelo)
        
      case 'inadimplencia':
        return await gerarPrevisaoInadimplencia(condominioId, horizonte)
        
      case 'sazonalidade':
        return await analisarSazonalidade(condominioId)
        
      case 'cenarios':
        return await gerarCenarios(condominioId, horizonte)
        
      default:
        return await gerarPrevisaoCompleta(condominioId, horizonte, modelo)
    }

  } catch (error) {
    console.error('Error generating predictions:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar previsões financeiras' },
      { status: 500 }
    )
  }
}

async function gerarPrevisaoFluxoCaixa(condominioId: string, horizonte: number, modelo: string) {
  // Buscar dados históricos dos últimos 12 meses
  const dataInicioHistorico = new Date()
  dataInicioHistorico.setMonth(dataInicioHistorico.getMonth() - 12)

  const dadosHistoricos = await FinanceiroUnificado.aggregate([
    {
      $match: {
        condominio_id: new mongoose.Types.ObjectId(condominioId),
        data_vencimento: { $gte: dataInicioHistorico },
        ativo: true
      }
    },
    {
      $group: {
        _id: {
          ano: { $year: '$data_vencimento' },
          mes: { $month: '$data_vencimento' },
          tipo_operacao: '$tipo_operacao'
        },
        total: { $sum: '$valor' },
        quantidade: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.ano': 1, '_id.mes': 1 }
    }
  ])

  // Organizar dados por mês
  const dadosPorMes = {}
  dadosHistoricos.forEach(item => {
    const chave = `${item._id.ano}-${String(item._id.mes).padStart(2, '0')}`
    if (!dadosPorMes[chave]) {
      dadosPorMes[chave] = { receitas: 0, despesas: 0, resultado: 0 }
    }
    dadosPorMes[chave][item._id.tipo_operacao === 'receita' ? 'receitas' : 'despesas'] = item.total
  })

  // Calcular resultado líquido
  Object.keys(dadosPorMes).forEach(mes => {
    dadosPorMes[mes].resultado = dadosPorMes[mes].receitas - dadosPorMes[mes].despesas
  })

  // Gerar previsões baseadas no modelo escolhido
  const previsoes = []
  const hoje = new Date()

  for (let i = 1; i <= horizonte; i++) {
    const dataPrevisao = new Date(hoje)
    dataPrevisao.setMonth(dataPrevisao.getMonth() + i)
    
    const chavePrevisao = `${dataPrevisao.getFullYear()}-${String(dataPrevisao.getMonth() + 1).padStart(2, '0')}`
    
    let previsao: any = {}
    
    switch (modelo) {
      case 'tendencia_linear':
        previsao = calcularTendenciaLinear(dadosPorMes, i)
        break
        
      case 'media_movel':
        previsao = calcularMediaMovel(dadosPorMes, 3) // Últimos 3 meses
        break
        
      case 'sazonalidade':
        previsao = calcularSazonalidade(dadosPorMes, dataPrevisao)
        break
        
      case 'crescimento_exponencial':
        previsao = calcularCrescimentoExponencial(dadosPorMes, i)
        break
        
      default:
        previsao = calcularTendenciaLinear(dadosPorMes, i)
    }

    // Calcular intervalo de confiança
    const intervalos = calcularIntervaloConfianca(dadosPorMes, previsao)
    
    previsoes.push({
      mes: chavePrevisao,
      data: dataPrevisao,
      receitas_previstas: Math.max(0, previsao.receitas),
      despesas_previstas: Math.max(0, previsao.despesas),
      resultado_previsto: previsao.receitas - previsao.despesas,
      intervalo_confianca: intervalos,
      confiabilidade: calcularConfiabilidade(dadosPorMes, i),
      fatores_considerados: obterFatoresModelo(modelo)
    })
  }

  // Buscar lançamentos já agendados para ajustar previsões
  const lancamentosAgendados = await buscarLancamentosAgendados(condominioId, horizonte)
  previsoes.forEach(previsao => {
    const agendadosMes = lancamentosAgendados.filter(l => 
      l.mes === previsao.mes
    )
    
    if (agendadosMes.length > 0) {
      const ajusteReceitas = agendadosMes
        .filter(l => l.tipo_operacao === 'receita')
        .reduce((sum, l) => sum + l.valor, 0)
        
      const ajusteDespesas = agendadosMes
        .filter(l => l.tipo_operacao === 'despesa')
        .reduce((sum, l) => sum + l.valor, 0)
      
      previsao.receitas_previstas += ajusteReceitas
      previsao.despesas_previstas += ajusteDespesas
      previsao.resultado_previsto = previsao.receitas_previstas - previsao.despesas_previstas
      previsao.tem_lancamentos_agendados = true
      previsao.ajustes_agendados = { receitas: ajusteReceitas, despesas: ajusteDespesas }
    }
  })

  // Análise de tendências
  const analiseTendencias = analisarTendenciasFluxo(dadosPorMes, previsoes)
  
  // Identificar riscos e oportunidades
  const riscosOportunidades = identificarRiscosOportunidades(previsoes)

  return NextResponse.json({
    success: true,
    previsao_fluxo_caixa: {
      horizonte_meses: horizonte,
      modelo_utilizado: modelo,
      dados_historicos: Object.keys(dadosPorMes).length,
      previsoes,
      analise_tendencias: analiseTendencias,
      riscos_oportunidades: riscosOportunidades,
      ultima_atualizacao: new Date()
    }
  })
}

async function gerarPrevisaoReceitas(condominioId: string, horizonte: number, modelo: string) {
  const dataInicioHistorico = new Date()
  dataInicioHistorico.setMonth(dataInicioHistorico.getMonth() - 12)

  // Análise por categoria de receita
  const receitasPorCategoria = await FinanceiroUnificado.aggregate([
    {
      $match: {
        condominio_id: new mongoose.Types.ObjectId(condominioId),
        tipo_operacao: 'receita',
        data_vencimento: { $gte: dataInicioHistorico },
        ativo: true
      }
    },
    {
      $group: {
        _id: {
          ano: { $year: '$data_vencimento' },
          mes: { $month: '$data_vencimento' },
          categoria_origem: '$categoria_origem',
          subcategoria: '$subcategoria'
        },
        total: { $sum: '$valor' },
        quantidade: { $sum: 1 },
        status_breakdown: {
          $push: {
            status: '$status',
            valor: '$valor'
          }
        }
      }
    },
    {
      $sort: { '_id.ano': 1, '_id.mes': 1 }
    }
  ])

  // Organizar por categoria
  const categorias = {}
  receitasPorCategoria.forEach(item => {
    const categoria = item._id.categoria_origem
    const subcategoria = item._id.subcategoria
    const chave = `${item._id.ano}-${String(item._id.mes).padStart(2, '0')}`
    
    if (!categorias[categoria]) {
      categorias[categoria] = {}
    }
    if (!categorias[categoria][subcategoria]) {
      categorias[categoria][subcategoria] = {}
    }
    
    categorias[categoria][subcategoria][chave] = {
      total: item.total,
      quantidade: item.quantidade,
      taxa_pagamento: calcularTaxaPagamento(item.status_breakdown)
    }
  })

  // Gerar previsões por categoria
  const previsoesPorCategoria = {}
  const hoje = new Date()

  Object.keys(categorias).forEach(categoria => {
    previsoesPorCategoria[categoria] = {}
    
    Object.keys(categorias[categoria]).forEach(subcategoria => {
      const historico = categorias[categoria][subcategoria]
      const previsoes = []
      
      for (let i = 1; i <= horizonte; i++) {
        const dataPrevisao = new Date(hoje)
        dataPrevisao.setMonth(dataPrevisao.getMonth() + i)
        const chavePrevisao = `${dataPrevisao.getFullYear()}-${String(dataPrevisao.getMonth() + 1).padStart(2, '0')}`
        
        const previsao = calcularPrevisaoCategoria(historico, i, modelo)
        
        previsoes.push({
          mes: chavePrevisao,
          valor_previsto: previsao.valor,
          confiabilidade: previsao.confiabilidade,
          fatores: previsao.fatores
        })
      }
      
      previsoesPorCategoria[categoria][subcategoria] = previsoes
    })
  })

  // Consolidar previsões totais
  const previsoesTotais = []
  for (let i = 1; i <= horizonte; i++) {
    const dataPrevisao = new Date(hoje)
    dataPrevisao.setMonth(dataPrevisao.getMonth() + i)
    const chavePrevisao = `${dataPrevisao.getFullYear()}-${String(dataPrevisao.getMonth() + 1).padStart(2, '0')}`
    
    let totalPrevisto = 0
    Object.keys(previsoesPorCategoria).forEach(categoria => {
      Object.keys(previsoesPorCategoria[categoria]).forEach(subcategoria => {
        const previsaoMes = previsoesPorCategoria[categoria][subcategoria].find(p => p.mes === chavePrevisao)
        if (previsaoMes) {
          totalPrevisto += previsaoMes.valor_previsto
        }
      })
    })
    
    previsoesTotais.push({
      mes: chavePrevisao,
      total_previsto: totalPrevisto
    })
  }

  return NextResponse.json({
    success: true,
    previsao_receitas: {
      horizonte_meses: horizonte,
      modelo_utilizado: modelo,
      previsoes_por_categoria: previsoesPorCategoria,
      previsoes_totais: previsoesTotais,
      ultima_atualizacao: new Date()
    }
  })
}

async function gerarPrevisaoDespesas(condominioId: string, horizonte: number, modelo: string) {
  // Similar à previsão de receitas, mas focado em despesas
  const dataInicioHistorico = new Date()
  dataInicioHistorico.setMonth(dataInicioHistorico.getMonth() - 12)

  const despesasPorCategoria = await FinanceiroUnificado.aggregate([
    {
      $match: {
        condominio_id: new mongoose.Types.ObjectId(condominioId),
        tipo_operacao: 'despesa',
        data_vencimento: { $gte: dataInicioHistorico },
        ativo: true
      }
    },
    {
      $group: {
        _id: {
          ano: { $year: '$data_vencimento' },
          mes: { $month: '$data_vencimento' },
          categoria_origem: '$categoria_origem',
          subcategoria: '$subcategoria'
        },
        total: { $sum: '$valor' },
        quantidade: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.ano': 1, '_id.mes': 1 }
    }
  ])

  // Análise de sazonalidade específica para despesas
  const padroesSazonais = analisarPadroesSazonaisDespesas(despesasPorCategoria)
  
  // Despesas fixas vs variáveis
  const classificacaoDespesas = classificarDespesasFixasVariaveis(despesasPorCategoria)

  return NextResponse.json({
    success: true,
    previsao_despesas: {
      horizonte_meses: horizonte,
      padroes_sazonais: padroesSazonais,
      classificacao: classificacaoDespesas,
      ultima_atualizacao: new Date()
    }
  })
}

async function gerarPrevisaoInadimplencia(condominioId: string, horizonte: number) {
  // Análise histórica de inadimplência
  const dadosInadimplencia = await FinanceiroUnificado.aggregate([
    {
      $match: {
        condominio_id: new mongoose.Types.ObjectId(condominioId),
        tipo_operacao: 'receita',
        categoria_origem: 'morador',
        ativo: true
      }
    },
    {
      $group: {
        _id: {
          ano: { $year: '$data_vencimento' },
          mes: { $month: '$data_vencimento' },
          status: '$status'
        },
        total_valor: { $sum: '$valor' },
        quantidade: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.ano': 1, '_id.mes': 1 }
    }
  ])

  // Calcular taxa de inadimplência histórica
  const taxasHistoricas = {}
  dadosInadimplencia.forEach(item => {
    const chave = `${item._id.ano}-${String(item._id.mes).padStart(2, '0')}`
    if (!taxasHistoricas[chave]) {
      taxasHistoricas[chave] = { total: 0, atrasado: 0 }
    }
    
    taxasHistoricas[chave].total += item.total_valor
    if (item._id.status === 'atrasado') {
      taxasHistoricas[chave].atrasado += item.total_valor
    }
  })

  // Calcular tendência e sazonalidade da inadimplência
  const tendenciaInadimplencia = calcularTendenciaInadimplencia(taxasHistoricas)
  
  // Projetar inadimplência futura
  const projecaoInadimplencia = []
  const hoje = new Date()

  for (let i = 1; i <= horizonte; i++) {
    const dataPrevisao = new Date(hoje)
    dataPrevisao.setMonth(dataPrevisao.getMonth() + i)
    const chavePrevisao = `${dataPrevisao.getFullYear()}-${String(dataPrevisao.getMonth() + 1).padStart(2, '0')}`
    
    const taxaPrevista = calcularTaxaInadimplenciaPrevista(
      taxasHistoricas, 
      tendenciaInadimplencia, 
      dataPrevisao
    )
    
    projecaoInadimplencia.push({
      mes: chavePrevisao,
      taxa_inadimplencia_prevista: taxaPrevista,
      fatores_risco: identificarFatoresRiscoInadimplencia(dataPrevisao)
    })
  }

  return NextResponse.json({
    success: true,
    previsao_inadimplencia: {
      horizonte_meses: horizonte,
      tendencia: tendenciaInadimplencia,
      projecao: projecaoInadimplencia,
      ultima_atualizacao: new Date()
    }
  })
}

async function analisarSazonalidade(condominioId: string) {
  const dataInicioHistorico = new Date()
  dataInicioHistorico.setMonth(dataInicioHistorico.getMonth() - 24) // 2 anos

  const dadosSazonalidade = await FinanceiroUnificado.aggregate([
    {
      $match: {
        condominio_id: new mongoose.Types.ObjectId(condominioId),
        data_vencimento: { $gte: dataInicioHistorico },
        ativo: true
      }
    },
    {
      $group: {
        _id: {
          mes: { $month: '$data_vencimento' },
          tipo_operacao: '$tipo_operacao',
          categoria_origem: '$categoria_origem'
        },
        total: { $sum: '$valor' },
        quantidade: { $sum: 1 },
        valores: { $push: '$valor' }
      }
    },
    {
      $sort: { '_id.mes': 1 }
    }
  ])

  // Calcular índices sazonais
  const indicesSazonais = calcularIndicesSazonais(dadosSazonalidade)
  
  // Identificar picos e vales
  const picosVales = identificarPicosVales(indicesSazonais)

  return NextResponse.json({
    success: true,
    analise_sazonalidade: {
      indices_sazonais: indicesSazonais,
      picos_vales: picosVales,
      recomendacoes: gerarRecomendacoesSazonalidade(picosVales),
      ultima_atualizacao: new Date()
    }
  })
}

async function gerarCenarios(condominioId: string, horizonte: number) {
  // Gerar múltiplos cenários: otimista, pessimista, realista
  const [fluxoBase, receitasBase, despesasBase] = await Promise.all([
    gerarPrevisaoFluxoCaixa(condominioId, horizonte, 'tendencia_linear'),
    gerarPrevisaoReceitas(condominioId, horizonte, 'tendencia_linear'),
    gerarPrevisaoDespesas(condominioId, horizonte, 'tendencia_linear')
  ])

  const cenarios = {
    otimista: gerarCenarioOtimista(fluxoBase, receitasBase, despesasBase),
    realista: fluxoBase,
    pessimista: gerarCenarioPessimista(fluxoBase, receitasBase, despesasBase),
    estresse: gerarCenarioEstresse(fluxoBase, receitasBase, despesasBase)
  }

  return NextResponse.json({
    success: true,
    cenarios,
    comparacao: compararCenarios(cenarios),
    ultima_atualizacao: new Date()
  })
}

async function gerarPrevisaoCompleta(condominioId: string, horizonte: number, modelo: string) {
  const [fluxoCaixa, receitas, despesas, inadimplencia, sazonalidade] = await Promise.all([
    gerarPrevisaoFluxoCaixa(condominioId, horizonte, modelo),
    gerarPrevisaoReceitas(condominioId, horizonte, modelo),
    gerarPrevisaoDespesas(condominioId, horizonte, modelo),
    gerarPrevisaoInadimplencia(condominioId, horizonte),
    analisarSazonalidade(condominioId)
  ])

  return NextResponse.json({
    success: true,
    previsao_completa: {
      fluxo_caixa: (await fluxoCaixa.json()).previsao_fluxo_caixa,
      receitas: (await receitas.json()).previsao_receitas,
      despesas: (await despesas.json()).previsao_despesas,
      inadimplencia: (await inadimplencia.json()).previsao_inadimplencia,
      sazonalidade: (await sazonalidade.json()).analise_sazonalidade,
      resumo_executivo: gerarResumoExecutivo(fluxoCaixa, receitas, despesas, inadimplencia),
      ultima_atualizacao: new Date()
    }
  })
}

// Funções auxiliares de cálculo
function calcularTendenciaLinear(dados: any, periodosFuturos: number) {
  const valores = Object.values(dados) as any[]
  if (valores.length < 2) {
    const ultimoValor = valores[valores.length - 1] || { receitas: 0, despesas: 0, resultado: 0 }
    return ultimoValor
  }

  // Regressão linear simples
  const n = valores.length
  const x = Array.from({ length: n }, (_, i) => i)
  
  const calcularTendencia = (y: number[]) => {
    const meanX = x.reduce((sum, val) => sum + val, 0) / n
    const meanY = y.reduce((sum, val) => sum + val, 0) / n
    
    let numerator = 0
    let denominator = 0
    
    for (let i = 0; i < n; i++) {
      numerator += (x[i] - meanX) * (y[i] - meanY)
      denominator += (x[i] - meanX) ** 2
    }
    
    const slope = denominator !== 0 ? numerator / denominator : 0
    const intercept = meanY - slope * meanX
    
    return slope * (n + periodosFuturos - 1) + intercept
  }

  const receitas = calcularTendencia(valores.map(v => v.receitas))
  const despesas = calcularTendencia(valores.map(v => v.despesas))

  return {
    receitas: Math.max(0, receitas),
    despesas: Math.max(0, despesas),
    resultado: receitas - despesas
  }
}

function calcularMediaMovel(dados: any, janela: number) {
  const valores = Object.values(dados) as any[]
  if (valores.length < janela) return valores[valores.length - 1] || { receitas: 0, despesas: 0, resultado: 0 }

  const ultimosValores = valores.slice(-janela)
  
  return {
    receitas: ultimosValores.reduce((sum, v) => sum + v.receitas, 0) / janela,
    despesas: ultimosValores.reduce((sum, v) => sum + v.despesas, 0) / janela,
    resultado: ultimosValores.reduce((sum, v) => sum + v.resultado, 0) / janela
  }
}

function calcularSazonalidade(dados: any, dataPrevisao: Date) {
  const mesPrevisao = dataPrevisao.getMonth() + 1
  const chaves = Object.keys(dados)
  
  // Buscar valores do mesmo mês em anos anteriores
  const valoresMesmoMes = chaves
    .filter(chave => parseInt(chave.split('-')[1]) === mesPrevisao)
    .map(chave => dados[chave])

  if (valoresMesmoMes.length === 0) {
    return calcularMediaMovel(dados, 3)
  }

  return {
    receitas: valoresMesmoMes.reduce((sum, v) => sum + v.receitas, 0) / valoresMesmoMes.length,
    despesas: valoresMesmoMes.reduce((sum, v) => sum + v.despesas, 0) / valoresMesmoMes.length,
    resultado: valoresMesmoMes.reduce((sum, v) => sum + v.resultado, 0) / valoresMesmoMes.length
  }
}

function calcularCrescimentoExponencial(dados: any, periodosFuturos: number) {
  const valores = Object.values(dados) as any[]
  if (valores.length < 2) return valores[valores.length - 1] || { receitas: 0, despesas: 0, resultado: 0 }

  const calcularCrescimento = (serie: number[]) => {
    const taxasCrescimento = []
    for (let i = 1; i < serie.length; i++) {
      if (serie[i-1] > 0) {
        taxasCrescimento.push(serie[i] / serie[i-1])
      }
    }
    
    if (taxasCrescimento.length === 0) return serie[serie.length - 1]
    
    const taxaMedia = taxasCrescimento.reduce((sum, taxa) => sum + taxa, 0) / taxasCrescimento.length
    return serie[serie.length - 1] * Math.pow(taxaMedia, periodosFuturos)
  }

  const receitas = calcularCrescimento(valores.map(v => v.receitas))
  const despesas = calcularCrescimento(valores.map(v => v.despesas))

  return {
    receitas: Math.max(0, receitas),
    despesas: Math.max(0, despesas),
    resultado: receitas - despesas
  }
}

function calcularIntervaloConfianca(dados: any, previsao: any) {
  // Calcular variabilidade histórica
  const valores = Object.values(dados) as any[]
  const desvios = valores.map(v => Math.abs(v.resultado - previsao.resultado))
  const desvioMedio = desvios.reduce((sum, d) => sum + d, 0) / desvios.length

  return {
    inferior: previsao.resultado - (desvioMedio * 1.96), // 95% confiança
    superior: previsao.resultado + (desvioMedio * 1.96)
  }
}

function calcularConfiabilidade(dados: any, periodosFuturos: number) {
  const valores = Object.values(dados).length
  let score = 100
  
  // Reduzir confiabilidade baseado na distância temporal
  score -= periodosFuturos * 10
  
  // Reduzir baseado na quantidade de dados históricos
  if (valores < 6) score -= 30
  else if (valores < 12) score -= 15
  
  return Math.max(10, Math.min(100, score))
}

function obterFatoresModelo(modelo: string) {
  const fatores = {
    'tendencia_linear': ['Tendência histórica', 'Progressão linear'],
    'media_movel': ['Média dos últimos períodos', 'Suavização de variações'],
    'sazonalidade': ['Padrões sazonais', 'Ciclos anuais'],
    'crescimento_exponencial': ['Taxa de crescimento composta', 'Aceleração/desaceleração']
  }
  
  return fatores[modelo] || ['Cálculo padrão']
}

async function buscarLancamentosAgendados(condominioId: string, horizonte: number) {
  const hoje = new Date()
  const dataLimite = new Date(hoje)
  dataLimite.setMonth(dataLimite.getMonth() + horizonte)

  const agendados = await FinanceiroUnificado.find({
    condominio_id: condominioId,
    data_vencimento: { $gte: hoje, $lte: dataLimite },
    status: { $in: ['agendado', 'pendente'] },
    ativo: true
  }).lean()

  return agendados.map(a => ({
    mes: `${a.data_vencimento.getFullYear()}-${String(a.data_vencimento.getMonth() + 1).padStart(2, '0')}`,
    tipo_operacao: a.tipo_operacao,
    valor: a.valor
  }))
}

// Placeholder functions - implementar com lógica real
function analisarTendenciasFluxo(dados: any, previsoes: any[]) {
  return {
    tendencia_geral: 'crescente',
    volatilidade: 'media',
    ponto_equilibrio: '2024-08'
  }
}

function identificarRiscosOportunidades(previsoes: any[]) {
  return {
    riscos: ['Sazonalidade de dezembro', 'Concentração em uma categoria'],
    oportunidades: ['Crescimento de receitas', 'Redução de despesas variáveis']
  }
}

function calcularTaxaPagamento(statusBreakdown: any[]) {
  const total = statusBreakdown.reduce((sum, item) => sum + item.valor, 0)
  const pago = statusBreakdown
    .filter(item => item.status === 'pago')
    .reduce((sum, item) => sum + item.valor, 0)
  
  return total > 0 ? (pago / total) * 100 : 0
}

function calcularPrevisaoCategoria(historico: any, periodos: number, modelo: string) {
  // Implementar lógica específica por categoria
  return {
    valor: 10000, // placeholder
    confiabilidade: 80,
    fatores: ['Histórico da categoria']
  }
}

function analisarPadroesSazonaisDespesas(dados: any[]) {
  return {
    meses_maior_gasto: ['dezembro', 'janeiro'],
    categorias_sazonais: ['manutenção', 'energia']
  }
}

function classificarDespesasFixasVariaveis(dados: any[]) {
  return {
    fixas: ['salario', 'administracao'],
    variaveis: ['manutencao', 'energia']
  }
}

function calcularTendenciaInadimplencia(dados: any) {
  return {
    direcao: 'estavel',
    taxa_media: 8.5,
    variacao_mensal: 0.2
  }
}

function calcularTaxaInadimplenciaPrevista(historico: any, tendencia: any, data: Date) {
  return tendencia.taxa_media + (Math.random() * 2 - 1) // Placeholder
}

function identificarFatoresRiscoInadimplencia(data: Date) {
  return ['Período pós-feriados', 'Sazonalidade']
}

function calcularIndicesSazonais(dados: any[]) {
  return Array.from({ length: 12 }, (_, i) => ({
    mes: i + 1,
    indice: 100 + (Math.random() * 40 - 20) // Placeholder
  }))
}

function identificarPicosVales(indices: any[]) {
  return {
    picos: [{ mes: 12, valor: 120 }],
    vales: [{ mes: 2, valor: 85 }]
  }
}

function gerarRecomendacoesSazonalidade(picosVales: any) {
  return ['Reservar verba para dezembro', 'Aproveitar economia de fevereiro']
}

function gerarCenarioOtimista(base: any, receitas: any, despesas: any) {
  // Aumentar receitas em 15%, reduzir despesas em 10%
  return { tipo: 'otimista', ajuste: '+15% receitas, -10% despesas' }
}

function gerarCenarioPessimista(base: any, receitas: any, despesas: any) {
  // Reduzir receitas em 20%, aumentar despesas em 15%
  return { tipo: 'pessimista', ajuste: '-20% receitas, +15% despesas' }
}

function gerarCenarioEstresse(base: any, receitas: any, despesas: any) {
  // Cenário extremo: -40% receitas, +30% despesas
  return { tipo: 'estresse', ajuste: '-40% receitas, +30% despesas' }
}

function compararCenarios(cenarios: any) {
  return {
    melhor_caso: 'otimista',
    pior_caso: 'estresse',
    mais_provavel: 'realista'
  }
}

function gerarResumoExecutivo(...args: any[]) {
  return {
    principais_insights: ['Crescimento sustentável', 'Baixo risco de inadimplência'],
    acoes_recomendadas: ['Manter estratégia atual', 'Monitorar sazonalidade'],
    alertas: ['Atenção ao mês de dezembro']
  }
}