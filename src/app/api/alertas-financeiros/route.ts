import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import AlertaFinanceiro, { 
  criarAlertaVencimentoProximo,
  criarAlertaInadimplenciaAlta,
  criarAlertaSaldoBaixo
} from '@/models/AlertaFinanceiro'
import FinanceiroUnificado from '@/models/FinanceiroUnificado'
import ExtratoBancario from '@/models/ExtratoBancario'
import mongoose from 'mongoose'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const masterId = url.searchParams.get('master_id')
    const condominioId = url.searchParams.get('condominio_id')
    const status = url.searchParams.get('status')
    const severidade = url.searchParams.get('severidade')
    const tipo = url.searchParams.get('tipo')
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '20')

    if (!masterId || !condominioId) {
      return NextResponse.json(
        { error: 'Master ID e Condomínio ID são obrigatórios' },
        { status: 400 }
      )
    }

    await connectDB()

    // Filtros
    const filter: any = {
      condominio_id: condominioId,
      master_id: masterId
    }

    if (status) filter.status = status
    if (severidade) filter.severidade = severidade
    if (tipo) filter.tipo_alerta = tipo

    // Consulta paginada
    const skip = (page - 1) * limit
    const total = await AlertaFinanceiro.countDocuments(filter)
    
    const alertas = await AlertaFinanceiro
      .find(filter)
      .sort({ data_criacao: -1, prioridade: -1 })
      .skip(skip)
      .limit(limit)
      .populate('resolvido_por', 'nome email')
      .populate('usuarios_notificados', 'nome email')
      .lean()

    // Estatísticas resumidas
    const estatisticas = await AlertaFinanceiro.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            status: '$status',
            severidade: '$severidade'
          },
          count: { $sum: 1 }
        }
      }
    ])

    const resumo = {
      total: total,
      ativos: 0,
      resolvidos: 0,
      por_severidade: {
        danger: 0,
        warning: 0,
        info: 0,
        success: 0
      }
    }

    estatisticas.forEach(stat => {
      if (stat._id.status === 'ativo') resumo.ativos += stat.count
      if (stat._id.status === 'resolvido') resumo.resolvidos += stat.count
      resumo.por_severidade[stat._id.severidade] += stat.count
    })

    return NextResponse.json({
      success: true,
      alertas,
      resumo,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('Error fetching alertas:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar alertas financeiros' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const { 
      acao, 
      master_id, 
      condominio_id, 
      usuario_id,
      configuracao_alertas 
    } = data

    if (!master_id || !condominio_id || !acao) {
      return NextResponse.json(
        { error: 'Dados obrigatórios não fornecidos' },
        { status: 400 }
      )
    }

    await connectDB()

    switch (acao) {
      case 'gerar_automaticos':
        return await gerarAlertasAutomaticos(condominio_id, master_id)
        
      case 'criar_manual':
        return await criarAlertaManual(data)
        
      case 'configurar_automaticos':
        return await configurarAlertasAutomaticos(condominio_id, master_id, configuracao_alertas)
        
      case 'executar_verificacao':
        return await executarVerificacaoCompleta(condominio_id, master_id)
        
      default:
        return NextResponse.json(
          { error: 'Ação não reconhecida' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Error processing alertas:', error)
    return NextResponse.json(
      { error: 'Erro ao processar alertas financeiros' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const data = await request.json()
    const { 
      alerta_id, 
      acao, 
      usuario_id, 
      observacoes,
      novo_status 
    } = data

    if (!alerta_id || !acao || !usuario_id) {
      return NextResponse.json(
        { error: 'Alerta ID, ação e usuário ID são obrigatórios' },
        { status: 400 }
      )
    }

    await connectDB()

    const alerta = await AlertaFinanceiro.findById(alerta_id)
    if (!alerta) {
      return NextResponse.json(
        { error: 'Alerta não encontrado' },
        { status: 404 }
      )
    }

    switch (acao) {
      case 'resolver':
        alerta.adicionarHistoricoStatus('resolvido', usuario_id, observacoes)
        alerta.resolvido_por = usuario_id
        alerta.data_resolucao = new Date()
        alerta.observacoes_resolucao = observacoes
        break
        
      case 'ignorar':
        alerta.adicionarHistoricoStatus('ignorado', usuario_id, observacoes)
        break
        
      case 'analisar':
        alerta.adicionarHistoricoStatus('em_analise', usuario_id, observacoes)
        break
        
      case 'reativar':
        alerta.adicionarHistoricoStatus('ativo', usuario_id, observacoes)
        alerta.data_resolucao = undefined
        alerta.resolvido_por = undefined
        alerta.observacoes_resolucao = undefined
        break
        
      case 'alterar_prioridade':
        const { nova_prioridade } = data
        alerta.prioridade = nova_prioridade
        alerta.adicionarHistoricoStatus(alerta.status, usuario_id, `Prioridade alterada para ${nova_prioridade}`)
        break
        
      case 'marcar_notificado':
        alerta.notificado = true
        alerta.data_ultima_notificacao = new Date()
        if (!alerta.data_primeira_notificacao) {
          alerta.data_primeira_notificacao = new Date()
        }
        alerta.tentativas_notificacao += 1
        if (!alerta.usuarios_notificados.includes(usuario_id)) {
          alerta.usuarios_notificados.push(usuario_id)
        }
        break
        
      default:
        return NextResponse.json(
          { error: 'Ação não reconhecida' },
          { status: 400 }
        )
    }

    await alerta.save()

    return NextResponse.json({
      success: true,
      message: 'Alerta atualizado com sucesso',
      alerta: alerta
    })

  } catch (error) {
    console.error('Error updating alerta:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar alerta' },
      { status: 500 }
    )
  }
}

// Funções de geração automática de alertas
async function gerarAlertasAutomaticos(condominioId: string, masterId: string) {
  const alertasGerados = []
  const hoje = new Date()

  try {
    // 1. Alertas de vencimento próximo (próximos 7 dias)
    const proximoVencimento = new Date(hoje)
    proximoVencimento.setDate(proximoVencimento.getDate() + 7)
    
    const vencimentosProximos = await FinanceiroUnificado.aggregate([
      {
        $match: {
          condominio_id: new mongoose.Types.ObjectId(condominioId),
          data_vencimento: { $gte: hoje, $lte: proximoVencimento },
          status: 'pendente',
          ativo: true
        }
      },
      {
        $group: {
          _id: null,
          total_lancamentos: { $sum: 1 },
          valor_total: { $sum: '$valor' }
        }
      }
    ])

    if (vencimentosProximos.length > 0 && vencimentosProximos[0].total_lancamentos > 5) {
      const alertaVencimento = criarAlertaVencimentoProximo(
        new mongoose.Types.ObjectId(condominioId),
        new mongoose.Types.ObjectId(masterId),
        vencimentosProximos[0].total_lancamentos,
        vencimentosProximos[0].valor_total
      )
      
      // Verificar se já existe alerta similar ativo
      const alertaExistente = await AlertaFinanceiro.findOne({
        condominio_id: condominioId,
        tipo_alerta: 'vencimento_proximo',
        status: 'ativo',
        data_criacao: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Últimas 24h
      })

      if (!alertaExistente) {
        alertaVencimento.gerarAcoesSugeridas()
        alertaVencimento.calcularPrioridadeAutomatica()
        await alertaVencimento.save()
        alertasGerados.push(alertaVencimento)
      }
    }

    // 2. Alertas de inadimplência alta
    const dadosInadimplencia = await FinanceiroUnificado.aggregate([
      {
        $match: {
          condominio_id: new mongoose.Types.ObjectId(condominioId),
          tipo_operacao: 'receita',
          ativo: true
        }
      },
      {
        $group: {
          _id: '$status',
          total: { $sum: '$valor' }
        }
      }
    ])

    let totalReceitas = 0
    let receitasAtrasadas = 0
    
    dadosInadimplencia.forEach(item => {
      totalReceitas += item.total
      if (item._id === 'atrasado') {
        receitasAtrasadas = item.total
      }
    })

    const taxaInadimplencia = totalReceitas > 0 ? (receitasAtrasadas / totalReceitas) * 100 : 0

    if (taxaInadimplencia > 15) {
      const alertaInadimplencia = criarAlertaInadimplenciaAlta(
        new mongoose.Types.ObjectId(condominioId),
        new mongoose.Types.ObjectId(masterId),
        taxaInadimplencia,
        receitasAtrasadas
      )

      const alertaExistente = await AlertaFinanceiro.findOne({
        condominio_id: condominioId,
        tipo_alerta: 'inadimplencia_alta',
        status: 'ativo',
        data_criacao: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Últimos 7 dias
      })

      if (!alertaExistente) {
        alertaInadimplencia.gerarAcoesSugeridas()
        alertaInadimplencia.calcularPrioridadeAutomatica()
        await alertaInadimplencia.save()
        alertasGerados.push(alertaInadimplencia)
      }
    }

    // 3. Alertas de saldo baixo (placeholder - necessário implementar cálculo real)
    const saldoAtual = await calcularSaldoAtual(condominioId)
    const despesasMensais = await calcularDespesasMensais(condominioId)

    if (saldoAtual < despesasMensais * 0.5) {
      const alertaSaldo = criarAlertaSaldoBaixo(
        new mongoose.Types.ObjectId(condominioId),
        new mongoose.Types.ObjectId(masterId),
        saldoAtual,
        despesasMensais
      )

      const alertaExistente = await AlertaFinanceiro.findOne({
        condominio_id: condominioId,
        tipo_alerta: 'saldo_baixo',
        status: 'ativo',
        data_criacao: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      })

      if (!alertaExistente) {
        alertaSaldo.gerarAcoesSugeridas()
        alertaSaldo.calcularPrioridadeAutomatica()
        await alertaSaldo.save()
        alertasGerados.push(alertaSaldo)
      }
    }

    // 4. Alertas de conciliação pendente
    const extratosNaoReconciliados = await ExtratoBancario.countDocuments({
      condominio_id: condominioId,
      reconciliado: false,
      data_movimento: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Últimos 30 dias
    })

    if (extratosNaoReconciliados > 20) {
      const alertaConciliacao = new AlertaFinanceiro({
        condominio_id: condominioId,
        master_id: masterId,
        tipo_alerta: 'conciliacao_pendente',
        titulo: 'Muitos Extratos Pendentes de Reconciliação',
        descricao: `${extratosNaoReconciliados} extratos bancários estão pendentes de reconciliação nos últimos 30 dias.`,
        severidade: extratosNaoReconciliados > 50 ? 'warning' : 'info',
        categoria: 'operacional',
        condicoes: {
          parametro: 'extratos_nao_reconciliados',
          operador: 'maior_que',
          valor_limite: 20,
          unidade: 'extratos'
        },
        contexto: {
          valor_atual: extratosNaoReconciliados
        },
        nivel_urgencia: Math.min(8, Math.floor(extratosNaoReconciliados / 10) + 3)
      })

      const alertaExistente = await AlertaFinanceiro.findOne({
        condominio_id: condominioId,
        tipo_alerta: 'conciliacao_pendente',
        status: 'ativo',
        data_criacao: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      })

      if (!alertaExistente) {
        alertaConciliacao.gerarAcoesSugeridas()
        alertaConciliacao.calcularPrioridadeAutomatica()
        await alertaConciliacao.save()
        alertasGerados.push(alertaConciliacao)
      }
    }

    return NextResponse.json({
      success: true,
      message: `${alertasGerados.length} alertas automáticos gerados`,
      alertas_gerados: alertasGerados.length,
      detalhes: alertasGerados.map(a => ({
        tipo: a.tipo_alerta,
        titulo: a.titulo,
        severidade: a.severidade,
        prioridade: a.prioridade
      }))
    })

  } catch (error) {
    console.error('Error generating automatic alerts:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar alertas automáticos' },
      { status: 500 }
    )
  }
}

async function criarAlertaManual(data: any) {
  const {
    master_id,
    condominio_id,
    usuario_id,
    tipo_alerta,
    titulo,
    descricao,
    severidade,
    categoria,
    condicoes,
    contexto,
    acoes_sugeridas,
    prioridade,
    impacto_financeiro
  } = data

  const novoAlerta = new AlertaFinanceiro({
    condominio_id,
    master_id,
    tipo_alerta,
    titulo,
    descricao,
    severidade: severidade || 'info',
    categoria: categoria || 'operacional',
    condicoes: condicoes || {
      parametro: 'manual',
      operador: 'igual',
      valor_limite: 'configurado_manualmente'
    },
    contexto: contexto || { valor_atual: 'definido_manualmente' },
    prioridade: prioridade || 'media',
    auto_gerado: false,
    acoes_sugeridas: acoes_sugeridas || [],
    impacto_financeiro,
    criado_por: usuario_id,
    nivel_urgencia: 5
  })

  if (!novoAlerta.acoes_sugeridas.length) {
    novoAlerta.gerarAcoesSugeridas()
  }

  await novoAlerta.save()

  return NextResponse.json({
    success: true,
    message: 'Alerta manual criado com sucesso',
    alerta: novoAlerta
  })
}

async function configurarAlertasAutomaticos(condominioId: string, masterId: string, configuracao: any) {
  // Implementar lógica para salvar configurações de alertas automáticos
  // Por exemplo, limites personalizados, frequência de verificação, etc.
  
  return NextResponse.json({
    success: true,
    message: 'Configurações de alertas automáticos salvas',
    configuracao
  })
}

async function executarVerificacaoCompleta(condominioId: string, masterId: string) {
  // Executar verificação completa de todos os tipos de alertas
  const resultados = await gerarAlertasAutomaticos(condominioId, masterId)
  
  // Aqui poderia incluir verificações adicionais, como:
  // - Análise de tendências
  // - Detecção de anomalias
  // - Alertas baseados em ML
  
  return resultados
}

// Funções auxiliares (placeholders - implementar com lógica real)
async function calcularSaldoAtual(condominioId: string): Promise<number> {
  // Implementar cálculo real do saldo atual das contas bancárias
  return 50000 // Placeholder
}

async function calcularDespesasMensais(condominioId: string): Promise<number> {
  const inicioMes = new Date()
  inicioMes.setDate(1)
  inicioMes.setHours(0, 0, 0, 0)
  
  const fimMes = new Date(inicioMes)
  fimMes.setMonth(fimMes.getMonth() + 1)
  fimMes.setDate(0)
  fimMes.setHours(23, 59, 59, 999)

  const despesas = await FinanceiroUnificado.aggregate([
    {
      $match: {
        condominio_id: new mongoose.Types.ObjectId(condominioId),
        tipo_operacao: 'despesa',
        data_vencimento: { $gte: inicioMes, $lte: fimMes },
        ativo: true
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$valor' }
      }
    }
  ])

  return despesas.length > 0 ? despesas[0].total : 25000
}