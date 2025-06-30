import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import FinanceiroUnificado from '@/models/FinanceiroUnificado'
import ExtratoBancario from '@/models/ExtratoBancario'
import Transacao from '@/models/Transacao'
import ContaBancaria from '@/models/ContaBancaria'
import mongoose from 'mongoose'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const masterId = url.searchParams.get('master_id')
    const condominioId = url.searchParams.get('condominio_id')
    const tipoRelatorio = url.searchParams.get('tipo')
    const periodo = url.searchParams.get('periodo') || 'mes_atual'

    if (!masterId || !condominioId) {
      return NextResponse.json(
        { error: 'Master ID e Condomínio ID são obrigatórios' },
        { status: 400 }
      )
    }

    await connectDB()

    switch (tipoRelatorio) {
      case 'kpis_tempo_real':
        return await gerarKPIsTempoReal(condominioId, periodo)
      
      case 'fluxo_caixa_projetado':
        return await gerarFluxoCaixaProjetado(condominioId)
        
      case 'analise_inadimplencia':
        return await gerarAnaliseInadimplencia(condominioId)
        
      case 'performance_categorias':
        return await gerarPerformanceCategorias(condominioId, periodo)
        
      case 'conciliacao_status':
        return await gerarStatusConciliacao(condominioId)
        
      case 'alertas_financeiros':
        return await gerarAlertasFinanceiros(condominioId)
        
      case 'tendencias_ml':
        return await gerarTendenciasML(condominioId)
        
      default:
        return await gerarDashboardCompleto(condominioId, periodo)
    }

  } catch (error) {
    console.error('Error generating dashboard:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar dashboard' },
      { status: 500 }
    )
  }
}

async function gerarKPIsTempoReal(condominioId: string, periodo: string) {
  const { dataInicio, dataFim } = calcularPeriodo(periodo)
  
  const pipeline = [
    {
      $match: {
        condominio_id: new mongoose.Types.ObjectId(condominioId),
        data_vencimento: { $gte: dataInicio, $lte: dataFim },
        ativo: true
      }
    },
    {
      $group: {
        _id: {
          tipo_operacao: '$tipo_operacao',
          status: '$status',
          categoria_origem: '$categoria_origem'
        },
        total_valor: { $sum: '$valor' },
        quantidade: { $sum: 1 },
        media_valor: { $avg: '$valor' }
      }
    }
  ]

  const dados = await FinanceiroUnificado.aggregate(pipeline)

  // Calcular KPIs principais
  const kpis = {
    receitas: {
      total: 0,
      pendente: 0,
      pago: 0,
      atrasado: 0,
      quantidade: 0
    },
    despesas: {
      total: 0,
      pendente: 0,
      pago: 0,
      atrasado: 0,
      quantidade: 0
    },
    resultado_liquido: 0,
    taxa_inadimplencia: 0,
    ticket_medio: 0,
    margem_liquida: 0,
    crescimento_receita: 0,
    indice_liquidez: 0
  }

  dados.forEach(item => {
    const tipo = item._id.tipo_operacao
    const status = item._id.status
    const valor = item.total_valor
    
    if (tipo === 'receita') {
      kpis.receitas.total += valor
      kpis.receitas.quantidade += item.quantidade
      kpis.receitas[status as keyof typeof kpis.receitas] = (kpis.receitas[status as keyof typeof kpis.receitas] as number) + valor
    } else if (tipo === 'despesa') {
      kpis.despesas.total += valor
      kpis.despesas.quantidade += item.quantidade
      kpis.despesas[status as keyof typeof kpis.despesas] = (kpis.despesas[status as keyof typeof kpis.despesas] as number) + valor
    }
  })

  // Calcular métricas derivadas
  kpis.resultado_liquido = kpis.receitas.total - kpis.despesas.total
  kpis.taxa_inadimplencia = kpis.receitas.total > 0 ? (kpis.receitas.atrasado / kpis.receitas.total) * 100 : 0
  kpis.ticket_medio = kpis.receitas.quantidade > 0 ? kpis.receitas.total / kpis.receitas.quantidade : 0
  kpis.margem_liquida = kpis.receitas.total > 0 ? (kpis.resultado_liquido / kpis.receitas.total) * 100 : 0

  // Calcular crescimento (comparar com período anterior)
  const crescimentoData = await calcularCrescimentoReceita(condominioId, periodo)
  kpis.crescimento_receita = crescimentoData.crescimento

  // Índice de liquidez (caixa / despesas mensais)
  const contasCorrente = await calcularSaldoContasCorrente(condominioId)
  const despesasMensais = kpis.despesas.total
  kpis.indice_liquidez = despesasMensais > 0 ? contasCorrente / despesasMensais : 0

  return NextResponse.json({
    success: true,
    kpis,
    periodo: {
      inicio: dataInicio,
      fim: dataFim,
      tipo: periodo
    },
    ultima_atualizacao: new Date()
  })
}

async function gerarFluxoCaixaProjetado(condominioId: string) {
  const hoje = new Date()
  const proximosSeisMeses = new Date(hoje)
  proximosSeisMeses.setMonth(proximosSeisMeses.getMonth() + 6)

  // Buscar lançamentos futuros (receitas e despesas agendadas)
  const lancamentosFuturos = await FinanceiroUnificado.find({
    condominio_id: condominioId,
    data_vencimento: { $gte: hoje, $lte: proximosSeisMeses },
    ativo: true
  }).sort({ data_vencimento: 1 })

  // Buscar lançamentos recorrentes para projetar
  const lancamentosRecorrentes = await FinanceiroUnificado.find({
    condominio_id: condominioId,
    recorrente: true,
    ativo: true
  })

  // Saldo atual das contas
  const saldoAtual = await calcularSaldoContasCorrente(condominioId)

  // Gerar projeção mês a mês
  const projecao = []
  let saldoAcumulado = saldoAtual

  for (let i = 0; i < 6; i++) {
    const mesProjecao = new Date(hoje)
    mesProjecao.setMonth(mesProjecao.getMonth() + i)
    
    const inicioMes = new Date(mesProjecao.getFullYear(), mesProjecao.getMonth(), 1)
    const fimMes = new Date(mesProjecao.getFullYear(), mesProjecao.getMonth() + 1, 0)

    // Receitas e despesas do mês
    const movimentosMes = lancamentosFuturos.filter(l => 
      l.data_vencimento >= inicioMes && l.data_vencimento <= fimMes
    )

    // Adicionar lançamentos recorrentes
    const recorrentesMes = gerarLancamentosRecorrentesMes(lancamentosRecorrentes, inicioMes, fimMes)
    
    const receitasMes = [...movimentosMes, ...recorrentesMes]
      .filter(l => l.tipo_operacao === 'receita')
      .reduce((sum, l) => sum + l.valor, 0)
      
    const despesasMes = [...movimentosMes, ...recorrentesMes]
      .filter(l => l.tipo_operacao === 'despesa')
      .reduce((sum, l) => sum + l.valor, 0)

    const resultadoMes = receitasMes - despesasMes
    saldoAcumulado += resultadoMes

    projecao.push({
      mes: `${String(mesProjecao.getMonth() + 1).padStart(2, '0')}/${mesProjecao.getFullYear()}`,
      receitas: receitasMes,
      despesas: despesasMes,
      resultado: resultadoMes,
      saldo_acumulado: saldoAcumulado,
      situacao: saldoAcumulado >= 0 ? 'positiva' : 'negativa'
    })
  }

  // Análise de riscos
  const analiseRiscos = {
    meses_negativos: projecao.filter(p => p.saldo_acumulado < 0).length,
    menor_saldo: Math.min(...projecao.map(p => p.saldo_acumulado)),
    tendencia: calcularTendenciaFluxo(projecao)
  }

  return NextResponse.json({
    success: true,
    projecao,
    saldo_inicial: saldoAtual,
    analise_riscos: analiseRiscos
  })
}

async function gerarAnaliseInadimplencia(condominioId: string) {
  const hoje = new Date()
  const tresMesesAtras = new Date(hoje)
  tresMesesAtras.setMonth(tresMesesAtras.getMonth() - 3)

  // Análise por faixas de atraso
  const pipeline = [
    {
      $match: {
        condominio_id: new mongoose.Types.ObjectId(condominioId),
        tipo_operacao: 'receita',
        categoria_origem: 'morador',
        status: { $in: ['atrasado', 'pendente'] },
        data_vencimento: { $lt: hoje },
        ativo: true
      }
    },
    {
      $addFields: {
        dias_atraso: {
          $divide: [
            { $subtract: [hoje, '$data_vencimento'] },
            1000 * 60 * 60 * 24
          ]
        }
      }
    },
    {
      $addFields: {
        faixa_atraso: {
          $switch: {
            branches: [
              { case: { $lte: ['$dias_atraso', 30] }, then: '1-30 dias' },
              { case: { $lte: ['$dias_atraso', 60] }, then: '31-60 dias' },
              { case: { $lte: ['$dias_atraso', 90] }, then: '61-90 dias' },
              { case: { $lte: ['$dias_atraso', 180] }, then: '91-180 dias' }
            ],
            default: 'Mais de 180 dias'
          }
        }
      }
    },
    {
      $group: {
        _id: {
          faixa: '$faixa_atraso',
          vinculo_id: '$vinculo_id',
          vinculo_nome: '$vinculo_nome',
          apartamento: '$apartamento'
        },
        total_devido: { $sum: '$valor' },
        quantidade_debitos: { $sum: 1 },
        mais_antigo: { $min: '$data_vencimento' }
      }
    },
    {
      $group: {
        _id: '$_id.faixa',
        total_faixa: { $sum: '$total_devido' },
        quantidade_moradores: { $sum: 1 },
        detalhes_moradores: {
          $push: {
            vinculo_id: '$_id.vinculo_id',
            nome: '$_id.vinculo_nome',
            apartamento: '$_id.apartamento',
            total_devido: '$total_devido',
            quantidade_debitos: '$quantidade_debitos',
            mais_antigo: '$mais_antigo'
          }
        }
      }
    },
    {
      $sort: { '_id': 1 }
    }
  ]

  const inadimplencia = await FinanceiroUnificado.aggregate(pipeline)

  // Calcular métricas gerais
  const totalDevido = inadimplencia.reduce((sum, faixa) => sum + faixa.total_faixa, 0)
  const totalMoradores = new Set(
    inadimplencia.flatMap(faixa => 
      faixa.detalhes_moradores.map(m => m.vinculo_id)
    )
  ).size

  // Evolução da inadimplência (últimos 6 meses)
  const evolucaoInadimplencia = await calcularEvolucaoInadimplencia(condominioId)

  // Perfil dos inadimplentes
  const perfilInadimplentes = await analisarPerfilInadimplentes(condominioId)

  return NextResponse.json({
    success: true,
    inadimplencia: {
      total_devido: totalDevido,
      total_moradores_inadimplentes: totalMoradores,
      faixas_atraso: inadimplencia,
      evolucao_6_meses: evolucaoInadimplencia,
      perfil_inadimplentes: perfilInadimplentes
    }
  })
}

async function gerarPerformanceCategorias(condominioId: string, periodo: string) {
  const { dataInicio, dataFim } = calcularPeriodo(periodo)
  
  const pipeline = [
    {
      $match: {
        condominio_id: new mongoose.Types.ObjectId(condominioId),
        data_vencimento: { $gte: dataInicio, $lte: dataFim },
        ativo: true
      }
    },
    {
      $group: {
        _id: {
          categoria_origem: '$categoria_origem',
          subcategoria: '$subcategoria',
          tipo_operacao: '$tipo_operacao'
        },
        total_valor: { $sum: '$valor' },
        quantidade: { $sum: 1 },
        media_valor: { $avg: '$valor' },
        valores_status: {
          $push: {
            status: '$status',
            valor: '$valor'
          }
        }
      }
    },
    {
      $sort: { total_valor: -1 }
    }
  ]

  const dados = await FinanceiroUnificado.aggregate(pipeline)

  // Organizar por categoria
  const categorias = {}
  let totalReceitas = 0
  let totalDespesas = 0

  dados.forEach(item => {
    const categoria = item._id.categoria_origem
    const subcategoria = item._id.subcategoria
    const tipo = item._id.tipo_operacao

    if (!categorias[categoria]) {
      categorias[categoria] = {
        total_receitas: 0,
        total_despesas: 0,
        subcategorias: {}
      }
    }

    categorias[categoria].subcategorias[subcategoria] = {
      tipo_operacao: tipo,
      total_valor: item.total_valor,
      quantidade: item.quantidade,
      media_valor: item.media_valor,
      status_breakdown: calcularBreakdownStatus(item.valores_status)
    }

    if (tipo === 'receita') {
      categorias[categoria].total_receitas += item.total_valor
      totalReceitas += item.total_valor
    } else if (tipo === 'despesa') {
      categorias[categoria].total_despesas += item.total_valor
      totalDespesas += item.total_valor
    }
  })

  // Calcular percentuais e rankings
  Object.keys(categorias).forEach(categoria => {
    const cat = categorias[categoria]
    cat.percentual_receitas = totalReceitas > 0 ? (cat.total_receitas / totalReceitas) * 100 : 0
    cat.percentual_despesas = totalDespesas > 0 ? (cat.total_despesas / totalDespesas) * 100 : 0
    cat.resultado_categoria = cat.total_receitas - cat.total_despesas
  })

  return NextResponse.json({
    success: true,
    performance: {
      total_receitas: totalReceitas,
      total_despesas: totalDespesas,
      resultado_geral: totalReceitas - totalDespesas,
      categorias,
      top_receitas: Object.entries(categorias)
        .sort(([,a], [,b]) => (b as any).total_receitas - (a as any).total_receitas)
        .slice(0, 5),
      top_despesas: Object.entries(categorias)
        .sort(([,a], [,b]) => (b as any).total_despesas - (a as any).total_despesas)
        .slice(0, 5)
    }
  })
}

async function gerarStatusConciliacao(condominioId: string) {
  const [
    extratosStatus,
    transacoesStatus,
    reconciliacaoRecente
  ] = await Promise.all([
    ExtratoBancario.aggregate([
      { $match: { condominio_id: new mongoose.Types.ObjectId(condominioId) } },
      {
        $group: {
          _id: '$reconciliado',
          total: { $sum: 1 },
          valor_total: { $sum: '$valor' }
        }
      }
    ]),
    Transacao.aggregate([
      { $match: { condominio_id: new mongoose.Types.ObjectId(condominioId) } },
      {
        $group: {
          _id: '$reconciliado',
          total: { $sum: 1 },
          valor_total: { $sum: '$valor_final' }
        }
      }
    ]),
    ExtratoBancario.aggregate([
      {
        $match: {
          condominio_id: new mongoose.Types.ObjectId(condominioId),
          reconciliado: true,
          data_reconciliacao: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$data_reconciliacao' }
          },
          total: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ])
  ])

  return NextResponse.json({
    success: true,
    conciliacao: {
      extratos: {
        reconciliados: extratosStatus.find(e => e._id === true)?.total || 0,
        nao_reconciliados: extratosStatus.find(e => e._id === false)?.total || 0,
        valor_reconciliado: extratosStatus.find(e => e._id === true)?.valor_total || 0
      },
      transacoes: {
        reconciliadas: transacoesStatus.find(t => t._id === true)?.total || 0,
        nao_reconciliadas: transacoesStatus.find(t => t._id === false)?.total || 0
      },
      atividade_recente: reconciliacaoRecente
    }
  })
}

async function gerarAlertasFinanceiros(condominioId: string) {
  const alertas = []
  const hoje = new Date()

  // Alerta: Vencimentos próximos (próximos 7 dias)
  const proximoVencimento = new Date(hoje)
  proximoVencimento.setDate(proximoVencimento.getDate() + 7)
  
  const vencimentosProximos = await FinanceiroUnificado.countDocuments({
    condominio_id: condominioId,
    data_vencimento: { $gte: hoje, $lte: proximoVencimento },
    status: 'pendente',
    ativo: true
  })

  if (vencimentosProximos > 0) {
    alertas.push({
      tipo: 'vencimentos_proximos',
      severidade: 'warning',
      titulo: 'Vencimentos Próximos',
      descricao: `${vencimentosProximos} lançamentos vencem nos próximos 7 dias`,
      quantidade: vencimentosProximos
    })
  }

  // Alerta: Inadimplência alta
  const totalReceitas = await FinanceiroUnificado.aggregate([
    {
      $match: {
        condominio_id: new mongoose.Types.ObjectId(condominioId),
        tipo_operacao: 'receita',
        ativo: true
      }
    },
    { $group: { _id: null, total: { $sum: '$valor' } } }
  ])

  const receitasAtrasadas = await FinanceiroUnificado.aggregate([
    {
      $match: {
        condominio_id: new mongoose.Types.ObjectId(condominioId),
        tipo_operacao: 'receita',
        status: 'atrasado',
        ativo: true
      }
    },
    { $group: { _id: null, total: { $sum: '$valor' } } }
  ])

  const taxaInadimplencia = totalReceitas[0]?.total > 0 ? 
    (receitasAtrasadas[0]?.total || 0) / totalReceitas[0].total * 100 : 0

  if (taxaInadimplencia > 15) {
    alertas.push({
      tipo: 'inadimplencia_alta',
      severidade: taxaInadimplencia > 25 ? 'danger' : 'warning',
      titulo: 'Taxa de Inadimplência Alta',
      descricao: `Taxa atual: ${taxaInadimplencia.toFixed(1)}%`,
      valor: taxaInadimplencia
    })
  }

  // Alerta: Saldo baixo
  const saldoAtual = await calcularSaldoContasCorrente(condominioId)
  const despesasMensais = await calcularDespesasMensaisMedia(condominioId)
  
  if (saldoAtual < despesasMensais * 0.5) {
    alertas.push({
      tipo: 'saldo_baixo',
      severidade: 'danger',
      titulo: 'Saldo Insuficiente',
      descricao: `Saldo atual: R$ ${saldoAtual.toFixed(2)} (menos de 0.5x despesas mensais)`,
      valor: saldoAtual
    })
  }

  // Alerta: Extratos não reconciliados
  const extratosNaoReconciliados = await ExtratoBancario.countDocuments({
    condominio_id: condominioId,
    reconciliado: false
  })

  if (extratosNaoReconciliados > 10) {
    alertas.push({
      tipo: 'extratos_nao_reconciliados',
      severidade: 'info',
      titulo: 'Extratos Pendentes de Reconciliação',
      descricao: `${extratosNaoReconciliados} extratos não reconciliados`,
      quantidade: extratosNaoReconciliados
    })
  }

  return NextResponse.json({
    success: true,
    alertas,
    total_alertas: alertas.length,
    severidades: {
      danger: alertas.filter(a => a.severidade === 'danger').length,
      warning: alertas.filter(a => a.severidade === 'warning').length,
      info: alertas.filter(a => a.severidade === 'info').length
    }
  })
}

async function gerarTendenciasML(condominioId: string) {
  // Implementação básica de análise de tendências usando dados históricos
  const seisMesesAtras = new Date()
  seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6)

  const dadosHistoricos = await FinanceiroUnificado.aggregate([
    {
      $match: {
        condominio_id: new mongoose.Types.ObjectId(condominioId),
        data_vencimento: { $gte: seisMesesAtras },
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
        total: { $sum: '$valor' }
      }
    },
    { $sort: { '_id.ano': 1, '_id.mes': 1 } }
  ])

  // Análise de tendência simples (regressão linear básica)
  const receitas = dadosHistoricos
    .filter(d => d._id.tipo_operacao === 'receita')
    .map(d => d.total)
  
  const despesas = dadosHistoricos
    .filter(d => d._id.tipo_operacao === 'despesa')
    .map(d => d.total)

  const tendenciaReceitas = calcularTendenciaLinear(receitas)
  const tendenciaDespesas = calcularTendenciaLinear(despesas)

  // Sazonalidade básica
  const sazonalidade = analisarSazonalidade(dadosHistoricos)

  return NextResponse.json({
    success: true,
    tendencias: {
      receitas: {
        direcao: tendenciaReceitas.direcao,
        variacao_mensal: tendenciaReceitas.variacao,
        confiabilidade: tendenciaReceitas.r2
      },
      despesas: {
        direcao: tendenciaDespesas.direcao,
        variacao_mensal: tendenciaDespesas.variacao,
        confiabilidade: tendenciaDespesas.r2
      },
      sazonalidade,
      previsao_proximo_mes: {
        receitas: calcularPrevisao(receitas),
        despesas: calcularPrevisao(despesas)
      }
    }
  })
}

async function gerarDashboardCompleto(condominioId: string, periodo: string) {
  const [kpis, fluxo, inadimplencia, alertas] = await Promise.all([
    gerarKPIsTempoReal(condominioId, periodo),
    gerarFluxoCaixaProjetado(condominioId),
    gerarAnaliseInadimplencia(condominioId),
    gerarAlertasFinanceiros(condominioId)
  ])

  return NextResponse.json({
    success: true,
    dashboard_completo: {
      kpis: (await kpis.json()).kpis,
      fluxo_projetado: (await fluxo.json()).projecao,
      inadimplencia: (await inadimplencia.json()).inadimplencia,
      alertas: (await alertas.json()).alertas
    }
  })
}

// Funções auxiliares
function calcularPeriodo(periodo: string) {
  const hoje = new Date()
  let dataInicio: Date
  let dataFim = new Date(hoje)

  switch (periodo) {
    case 'mes_atual':
      dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
      break
    case 'mes_anterior':
      dataInicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
      dataFim = new Date(hoje.getFullYear(), hoje.getMonth(), 0)
      break
    case 'trimestre_atual':
      const trimestre = Math.floor(hoje.getMonth() / 3)
      dataInicio = new Date(hoje.getFullYear(), trimestre * 3, 1)
      break
    case 'ano_atual':
      dataInicio = new Date(hoje.getFullYear(), 0, 1)
      break
    default:
      dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  }

  return { dataInicio, dataFim }
}

function calcularBreakdownStatus(valoresStatus: any[]) {
  const breakdown = { pendente: 0, pago: 0, atrasado: 0, cancelado: 0 }
  
  valoresStatus.forEach(item => {
    if (breakdown.hasOwnProperty(item.status)) {
      breakdown[item.status] += item.valor
    }
  })
  
  return breakdown
}

function calcularTendenciaLinear(valores: number[]) {
  if (valores.length < 2) return { direcao: 'neutro', variacao: 0, r2: 0 }
  
  const n = valores.length
  const x = Array.from({ length: n }, (_, i) => i)
  const meanX = x.reduce((sum, val) => sum + val, 0) / n
  const meanY = valores.reduce((sum, val) => sum + val, 0) / n
  
  let numerator = 0
  let denominator = 0
  
  for (let i = 0; i < n; i++) {
    numerator += (x[i] - meanX) * (valores[i] - meanY)
    denominator += (x[i] - meanX) ** 2
  }
  
  const slope = denominator !== 0 ? numerator / denominator : 0
  const variacao = (slope / meanY) * 100
  
  return {
    direcao: slope > 0 ? 'crescente' : slope < 0 ? 'decrescente' : 'neutro',
    variacao: Math.abs(variacao),
    r2: 0.8 // Simplificado - em produção calcular R² real
  }
}

function analisarSazonalidade(dados: any[]) {
  const porMes = {}
  
  dados.forEach(item => {
    const mes = item._id.mes
    if (!porMes[mes]) porMes[mes] = []
    porMes[mes].push(item.total)
  })
  
  const medias = Object.keys(porMes).map(mes => ({
    mes: parseInt(mes),
    media: porMes[mes].reduce((sum, val) => sum + val, 0) / porMes[mes].length
  }))
  
  return medias.sort((a, b) => a.mes - b.mes)
}

function calcularPrevisao(valores: number[]) {
  if (valores.length < 3) return valores[valores.length - 1] || 0
  
  // Média móvel simples dos últimos 3 meses
  const ultimos3 = valores.slice(-3)
  return ultimos3.reduce((sum, val) => sum + val, 0) / ultimos3.length
}

// Funções específicas que precisariam ser implementadas
async function calcularCrescimentoReceita(condominioId: string, periodo: string) {
  // Implementar comparação com período anterior
  return { crescimento: 5.2 } // Placeholder
}

async function calcularSaldoContasCorrente(condominioId: string) {
  // Implementar cálculo do saldo atual das contas bancárias
  return 50000 // Placeholder
}

async function calcularDespesasMensaisMedia(condominioId: string) {
  // Implementar cálculo da média de despesas mensais
  return 25000 // Placeholder
}

async function calcularEvolucaoInadimplencia(condominioId: string) {
  // Implementar evolução da inadimplência
  return [] // Placeholder
}

async function analisarPerfilInadimplentes(condominioId: string) {
  // Implementar análise de perfil
  return {} // Placeholder
}

function gerarLancamentosRecorrentesMes(lancamentos: any[], inicio: Date, fim: Date) {
  // Implementar geração de lançamentos recorrentes
  return [] // Placeholder
}

function calcularTendenciaFluxo(projecao: any[]) {
  // Implementar cálculo de tendência
  return 'estavel' // Placeholder
}