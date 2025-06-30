import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import ExtratoBancario from '@/models/ExtratoBancario'
import Transacao from '@/models/Transacao'
import FinanceiroUnificado from '@/models/FinanceiroUnificado'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const masterId = url.searchParams.get('master_id')
    const condominioId = url.searchParams.get('condominio_id')
    const contaBancariaId = url.searchParams.get('conta_bancaria_id')
    const relatorio = url.searchParams.get('relatorio')

    if (!masterId || !condominioId) {
      return NextResponse.json(
        { error: 'Master ID e Condomínio ID são obrigatórios' },
        { status: 400 }
      )
    }

    await connectDB()

    if (relatorio === 'dashboard') {
      return await gerarDashboardConciliacao(condominioId, contaBancariaId)
    } else if (relatorio === 'pendentes') {
      return await gerarRelatorioPendentes(condominioId, contaBancariaId)
    } else if (relatorio === 'sugestoes') {
      return await gerarSugestoesConciliacao(condominioId, contaBancariaId)
    }

    return NextResponse.json(
      { error: 'Tipo de relatório não especificado' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Error fetching conciliação bancária:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar dados de conciliação' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { 
      condominio_id, 
      conta_bancaria_id, 
      tipo_conciliacao, 
      usuario_id,
      parametros 
    } = await request.json()

    if (!condominio_id || !tipo_conciliacao || !usuario_id) {
      return NextResponse.json(
        { error: 'Condomínio ID, tipo de conciliação e usuário ID são obrigatórios' },
        { status: 400 }
      )
    }

    await connectDB()

    let resultado: any = {}

    switch (tipo_conciliacao) {
      case 'automatica_completa':
        resultado = await executarConciliacaoAutomaticaCompleta(condominio_id, conta_bancaria_id, usuario_id)
        break
      
      case 'automatica_conservadora':
        resultado = await executarConciliacaoAutomaticaConservadora(condominio_id, conta_bancaria_id, usuario_id)
        break
        
      case 'sugestoes_ia':
        resultado = await gerarSugestoesIA(condominio_id, conta_bancaria_id, parametros)
        break
        
      case 'reprocessar_extratos':
        resultado = await reprocessarExtratosSemConciliacao(condominio_id, conta_bancaria_id)
        break
        
      default:
        return NextResponse.json(
          { error: 'Tipo de conciliação não reconhecido' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      resultado
    })

  } catch (error) {
    console.error('Error executing conciliação:', error)
    return NextResponse.json(
      { error: 'Erro ao executar conciliação' },
      { status: 500 }
    )
  }
}

// Funções de conciliação automática
async function executarConciliacaoAutomaticaCompleta(condominioId: string, contaBancariaId?: string, usuarioId?: string) {
  const filtroExtrato: any = {
    condominio_id: condominioId,
    reconciliado: false,
    processado: true
  }
  
  if (contaBancariaId) {
    filtroExtrato.conta_bancaria_id = contaBancariaId
  }

  const extratosNaoReconciliados = await ExtratoBancario.find(filtroExtrato)
  const transacoesNaoReconciliadas = await Transacao.find({
    condominio_id: condominioId,
    status: { $in: ['aprovado', 'pendente'] },
    reconciliado: false
  })

  const resultados = {
    total_extratos: extratosNaoReconciliados.length,
    total_transacoes: transacoesNaoReconciliadas.length,
    reconciliacoes_automaticas: 0,
    reconciliacoes_manuais_sugeridas: 0,
    matches: [] as any[]
  }

  for (const extrato of extratosNaoReconciliados) {
    let melhorMatch: any = null
    let melhorScore = 0

    for (const transacao of transacoesNaoReconciliadas) {
      const score = extrato.calcularConfidenceScore(transacao)
      
      if (score > melhorScore) {
        melhorScore = score
        melhorMatch = transacao
      }
    }

    if (melhorMatch) {
      const matchInfo = {
        extrato_id: extrato._id,
        transacao_id: melhorMatch._id,
        confidence_score: melhorScore,
        valor_extrato: extrato.valor,
        valor_transacao: melhorMatch.valor_final,
        data_extrato: extrato.data_movimento,
        data_transacao: melhorMatch.data_vencimento,
        tipo_match: melhorScore >= 85 ? 'automatico' : 'sugerido'
      }

      resultados.matches.push(matchInfo)

      if (melhorScore >= 85) {
        // Reconciliação automática (alta confiança)
        await reconciliarPair(extrato, melhorMatch, usuarioId, 'automatico')
        resultados.reconciliacoes_automaticas++
        
        // Remover da lista
        const index = transacoesNaoReconciliadas.indexOf(melhorMatch)
        if (index > -1) {
          transacoesNaoReconciliadas.splice(index, 1)
        }
      } else if (melhorScore >= 60) {
        // Sugestão para reconciliação manual
        resultados.reconciliacoes_manuais_sugeridas++
      }
    }
  }

  return resultados
}

async function executarConciliacaoAutomaticaConservadora(condominioId: string, contaBancariaId?: string, usuarioId?: string) {
  // Versão mais conservadora - só reconcilia com 95%+ de confiança
  const filtroExtrato: any = {
    condominio_id: condominioId,
    reconciliado: false,
    processado: true
  }
  
  if (contaBancariaId) {
    filtroExtrato.conta_bancaria_id = contaBancariaId
  }

  const extratosNaoReconciliados = await ExtratoBancario.find(filtroExtrato)
  const transacoesNaoReconciliadas = await Transacao.find({
    condominio_id: condominioId,
    status: { $in: ['aprovado', 'pendente'] },
    reconciliado: false
  })

  const resultados = {
    total_extratos: extratosNaoReconciliados.length,
    reconciliacoes_automaticas: 0,
    matches_alta_confianca: [] as any[]
  }

  for (const extrato of extratosNaoReconciliados) {
    for (const transacao of transacoesNaoReconciliadas) {
      const score = extrato.calcularConfidenceScore(transacao)
      
      if (score >= 95) {
        await reconciliarPair(extrato, transacao, usuarioId, 'automatico_conservador')
        resultados.reconciliacoes_automaticas++
        
        resultados.matches_alta_confianca.push({
          extrato_id: extrato._id,
          transacao_id: transacao._id,
          confidence_score: score
        })

        // Remover da lista
        const index = transacoesNaoReconciliadas.indexOf(transacao)
        if (index > -1) {
          transacoesNaoReconciliadas.splice(index, 1)
        }
        break
      }
    }
  }

  return resultados
}

async function gerarSugestoesIA(condominioId: string, contaBancariaId?: string, parametros?: any) {
  // Algoritmo mais sofisticado de matching com IA
  const filtroExtrato: any = {
    condominio_id: condominioId,
    reconciliado: false,
    processado: true
  }
  
  if (contaBancariaId) {
    filtroExtrato.conta_bancaria_id = contaBancariaId
  }

  const extratosNaoReconciliados = await ExtratoBancario.find(filtroExtrato)
  const transacoesNaoReconciliadas = await Transacao.find({
    condominio_id: condominioId,
    status: { $in: ['aprovado', 'pendente'] },
    reconciliado: false
  })

  const sugestoes = []

  for (const extrato of extratosNaoReconciliados) {
    const candidatos = []

    for (const transacao of transacoesNaoReconciliadas) {
      const score = calcularScoreAvancado(extrato, transacao, parametros)
      
      if (score >= 30) { // Threshold mínimo para sugestão
        candidatos.push({
          transacao,
          score,
          motivos: analisarMotivosMatch(extrato, transacao)
        })
      }
    }

    // Ordenar por score e pegar os top 3
    candidatos.sort((a, b) => b.score - a.score)
    
    if (candidatos.length > 0) {
      sugestoes.push({
        extrato: {
          _id: extrato._id,
          valor: extrato.valor,
          data_movimento: extrato.data_movimento,
          historico: extrato.historico,
          categoria_automatica: extrato.categoria_automatica
        },
        candidatos: candidatos.slice(0, 3)
      })
    }
  }

  return {
    total_sugestoes: sugestoes.length,
    sugestoes
  }
}

function calcularScoreAvancado(extrato: any, transacao: any, parametros?: any) {
  let score = 0
  const pesos = parametros?.pesos || {
    valor: 40,
    data: 25,
    identificador: 30,
    historico: 5
  }

  // Score por valor
  const diffValor = Math.abs(extrato.valor - transacao.valor_final) / transacao.valor_final
  if (diffValor < 0.01) score += pesos.valor
  else if (diffValor < 0.05) score += pesos.valor * 0.8
  else if (diffValor < 0.1) score += pesos.valor * 0.5

  // Score por data
  const diffDias = Math.abs(extrato.data_movimento.getTime() - transacao.data_vencimento.getTime()) / (1000 * 3600 * 24)
  if (diffDias <= 1) score += pesos.data
  else if (diffDias <= 3) score += pesos.data * 0.8
  else if (diffDias <= 7) score += pesos.data * 0.5
  else if (diffDias <= 15) score += pesos.data * 0.2

  // Score por identificadores únicos
  if (extrato.dados_pix?.identificador_transacao && transacao.payment_id) {
    if (extrato.dados_pix.identificador_transacao === transacao.payment_id) {
      score += pesos.identificador
    }
  }

  if (extrato.dados_boleto?.nosso_numero && transacao.payment_id) {
    if (extrato.dados_boleto.nosso_numero.includes(transacao.payment_id) || 
        transacao.payment_id.includes(extrato.dados_boleto.nosso_numero)) {
      score += pesos.identificador
    }
  }

  // Score por similaridade de histórico
  const similaridadeHistorico = calcularSimilaridadeTexto(
    extrato.historico, 
    transacao.descricao || ''
  )
  score += similaridadeHistorico * pesos.historico

  return Math.min(score, 100)
}

function calcularSimilaridadeTexto(texto1: string, texto2: string): number {
  const palavras1 = texto1.toLowerCase().split(/\s+/)
  const palavras2 = texto2.toLowerCase().split(/\s+/)
  
  const intersecao = palavras1.filter(palavra => palavras2.includes(palavra))
  const uniao = [...new Set([...palavras1, ...palavras2])]
  
  return (intersecao.length / uniao.length) * 100
}

function analisarMotivosMatch(extrato: any, transacao: any): string[] {
  const motivos = []

  const diffValor = Math.abs(extrato.valor - transacao.valor_final)
  if (diffValor < 0.01) {
    motivos.push('Valor exato')
  } else if (diffValor < extrato.valor * 0.05) {
    motivos.push('Valor muito próximo')
  }

  const diffDias = Math.abs(extrato.data_movimento.getTime() - transacao.data_vencimento.getTime()) / (1000 * 3600 * 24)
  if (diffDias <= 1) {
    motivos.push('Data coincidente')
  } else if (diffDias <= 3) {
    motivos.push('Data próxima')
  }

  if (extrato.dados_pix?.identificador_transacao && transacao.payment_id) {
    motivos.push('PIX com identificador')
  }

  if (extrato.dados_boleto?.nosso_numero && transacao.payment_id) {
    motivos.push('Boleto com nosso número')
  }

  const similaridade = calcularSimilaridadeTexto(extrato.historico, transacao.descricao || '')
  if (similaridade > 70) {
    motivos.push('Descrições similares')
  }

  return motivos
}

async function reconciliarPair(extrato: any, transacao: any, usuarioId?: string, metodo: string = 'automatico') {
  extrato.reconciliado = true
  extrato.transacao_id = transacao._id
  extrato.data_reconciliacao = new Date()
  if (usuarioId) extrato.reconciliado_por = usuarioId
  extrato.confidence_score = extrato.calcularConfidenceScore(transacao)

  extrato.adicionarLog('reconciliacao_automatica', {
    transacao_id: transacao._id,
    confidence_score: extrato.confidence_score,
    metodo
  }, usuarioId)

  await extrato.save()

  transacao.reconciliado = true
  transacao.extrato_bancario_id = extrato._id
  transacao.data_reconciliacao = new Date()
  await transacao.save()
}

async function reprocessarExtratosSemConciliacao(condominioId: string, contaBancariaId?: string) {
  const filtroExtrato: any = {
    condominio_id: condominioId,
    reconciliado: false,
    processado: false
  }
  
  if (contaBancariaId) {
    filtroExtrato.conta_bancaria_id = contaBancariaId
  }

  const extratosNaoProcessados = await ExtratoBancario.find(filtroExtrato)
  
  let reprocessados = 0
  for (const extrato of extratosNaoProcessados) {
    // Recategorizar
    extrato.categorizarAutomaticamente()
    extrato.processado = true
    
    await extrato.save()
    reprocessados++
  }

  return {
    total_reprocessados: reprocessados
  }
}

// Relatórios específicos
async function gerarDashboardConciliacao(condominioId: string, contaBancariaId?: string) {
  const filtroBase: any = { condominio_id: condominioId }
  if (contaBancariaId) filtroBase.conta_bancaria_id = contaBancariaId

  const [
    totalExtratos,
    extratosReconciliados,
    extratosNaoReconciliados,
    transacoesNaoReconciliadas,
    reconciliacoesUltimos30Dias
  ] = await Promise.all([
    ExtratoBancario.countDocuments(filtroBase),
    ExtratoBancario.countDocuments({ ...filtroBase, reconciliado: true }),
    ExtratoBancario.countDocuments({ ...filtroBase, reconciliado: false }),
    Transacao.countDocuments({ condominio_id: condominioId, reconciliado: false }),
    ExtratoBancario.countDocuments({
      ...filtroBase,
      reconciliado: true,
      data_reconciliacao: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    })
  ])

  const percentualReconciliado = totalExtratos > 0 ? (extratosReconciliados / totalExtratos) * 100 : 0

  return NextResponse.json({
    success: true,
    dashboard: {
      total_extratos: totalExtratos,
      extratos_reconciliados: extratosReconciliados,
      extratos_nao_reconciliados: extratosNaoReconciliados,
      transacoes_nao_reconciliadas: transacoesNaoReconciliadas,
      percentual_reconciliado: Math.round(percentualReconciliado * 100) / 100,
      reconciliacoes_ultimos_30_dias: reconciliacoesUltimos30Dias
    }
  })
}

async function gerarRelatorioPendentes(condominioId: string, contaBancariaId?: string) {
  const filtroExtrato: any = {
    condominio_id: condominioId,
    reconciliado: false
  }
  
  if (contaBancariaId) {
    filtroExtrato.conta_bancaria_id = contaBancariaId
  }

  const extratosPendentes = await ExtratoBancario
    .find(filtroExtrato)
    .sort({ data_movimento: -1 })
    .limit(100)
    .populate('conta_bancaria_id', 'banco agencia conta nome')

  const transacoesPendentes = await Transacao
    .find({
      condominio_id: condominioId,
      reconciliado: false,
      status: { $in: ['aprovado', 'pendente'] }
    })
    .sort({ data_vencimento: -1 })
    .limit(100)

  return NextResponse.json({
    success: true,
    pendentes: {
      extratos: extratosPendentes,
      transacoes: transacoesPendentes
    }
  })
}

async function gerarSugestoesConciliacao(condominioId: string, contaBancariaId?: string) {
  return await gerarSugestoesIA(condominioId, contaBancariaId)
}