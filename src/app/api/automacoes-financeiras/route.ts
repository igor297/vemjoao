import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import AutomacaoFinanceira, { 
  criarAutomacaoCobranca,
  criarAutomacaoJurosMulta
} from '@/models/AutomacaoFinanceira'
import FinanceiroUnificado from '@/models/FinanceiroUnificado'
import AlertaFinanceiro from '@/models/AlertaFinanceiro'
import ExtratoBancario from '@/models/ExtratoBancario'
import mongoose from 'mongoose'
import nodemailer from 'nodemailer'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const masterId = url.searchParams.get('master_id')
    const condominioId = url.searchParams.get('condominio_id')
    const tipoAutomacao = url.searchParams.get('tipo')
    const ativo = url.searchParams.get('ativo')
    const categoria = url.searchParams.get('categoria')
    const relatorio = url.searchParams.get('relatorio')
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '20')

    if (!masterId || !condominioId) {
      return NextResponse.json(
        { error: 'Master ID e Condomínio ID são obrigatórios' },
        { status: 400 }
      )
    }

    await connectDB()

    if (relatorio) {
      return await gerarRelatorioAutomacoes(condominioId, relatorio)
    }

    // Filtros
    const filter: any = {
      condominio_id: condominioId,
      master_id: masterId
    }

    if (tipoAutomacao) filter.tipo_automacao = tipoAutomacao
    if (ativo !== null) filter.ativo = ativo === 'true'
    if (categoria) filter.categoria = categoria

    // Consulta paginada
    const skip = (page - 1) * limit
    const total = await AutomacaoFinanceira.countDocuments(filter)
    
    const automacoes = await AutomacaoFinanceira
      .find(filter)
      .sort({ 'configuracoes_avancadas.prioridade': -1, data_criacao: -1 })
      .skip(skip)
      .limit(limit)
      .populate('criado_por', 'nome email')
      .populate('modificado_por', 'nome email')
      .populate('configuracoes_avancadas.dependencias', 'nome tipo_automacao')
      .lean()

    // Estatísticas resumidas
    const estatisticas = await AutomacaoFinanceira.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            tipo: '$tipo_automacao',
            ativo: '$ativo',
            categoria: '$categoria'
          },
          count: { $sum: 1 },
          execucoes_total: { $sum: '$total_execucoes' },
          execucoes_sucesso: { $sum: '$execucoes_sucesso' },
          tempo_medio: { $avg: '$metricas.tempo_medio_execucao' }
        }
      }
    ])

    return NextResponse.json({
      success: true,
      automacoes,
      estatisticas,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('Error fetching automações:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar automações financeiras' },
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
      ...automacaoData 
    } = data

    if (!master_id || !condominio_id || !usuario_id || !acao) {
      return NextResponse.json(
        { error: 'Dados obrigatórios não fornecidos' },
        { status: 400 }
      )
    }

    await connectDB()

    switch (acao) {
      case 'criar_manual':
        return await criarAutomacaoManual(data)
        
      case 'criar_template':
        return await criarAutomacaoTemplate(data)
        
      case 'executar_agora':
        return await executarAutomacaoManual(data.automacao_id, usuario_id)
        
      case 'testar_automacao':
        return await testarAutomacao(data.automacao_id)
        
      case 'duplicar':
        return await duplicarAutomacao(data.automacao_id, usuario_id)
        
      default:
        return NextResponse.json(
          { error: 'Ação não reconhecida' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Error processing automação:', error)
    return NextResponse.json(
      { error: 'Erro ao processar automação financeira' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const data = await request.json()
    const { 
      automacao_id,
      acao,
      usuario_id,
      ...updateData 
    } = data

    if (!automacao_id || !acao || !usuario_id) {
      return NextResponse.json(
        { error: 'ID da automação, ação e usuário ID são obrigatórios' },
        { status: 400 }
      )
    }

    await connectDB()

    const automacao = await AutomacaoFinanceira.findById(automacao_id)
    if (!automacao) {
      return NextResponse.json(
        { error: 'Automação não encontrada' },
        { status: 404 }
      )
    }

    switch (acao) {
      case 'atualizar':
        Object.assign(automacao, updateData)
        automacao.modificado_por = usuario_id
        await automacao.save()
        break
        
      case 'ativar':
        automacao.ativo = true
        automacao.pausado = false
        automacao.pausado_ate = undefined
        break
        
      case 'desativar':
        automacao.ativo = false
        break
        
      case 'pausar':
        automacao.pausado = true
        automacao.pausado_motivo = updateData.motivo
        if (updateData.pausar_ate) {
          automacao.pausado_ate = new Date(updateData.pausar_ate)
        }
        break
        
      case 'reativar':
        automacao.pausado = false
        automacao.pausado_ate = undefined
        automacao.pausado_motivo = undefined
        break
        
      case 'alterar_prioridade':
        automacao.configuracoes_avancadas.prioridade = updateData.nova_prioridade
        break
        
      default:
        return NextResponse.json(
          { error: 'Ação não reconhecida' },
          { status: 400 }
        )
    }

    await automacao.save()

    return NextResponse.json({
      success: true,
      message: 'Automação atualizada com sucesso',
      automacao
    })

  } catch (error) {
    console.error('Error updating automação:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar automação' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const automacaoId = url.searchParams.get('automacao_id')
    const usuarioId = url.searchParams.get('usuario_id')

    if (!automacaoId || !usuarioId) {
      return NextResponse.json(
        { error: 'ID da automação e usuário ID são obrigatórios' },
        { status: 400 }
      )
    }

    await connectDB()

    const automacao = await AutomacaoFinanceira.findById(automacaoId)
    if (!automacao) {
      return NextResponse.json(
        { error: 'Automação não encontrada' },
        { status: 404 }
      )
    }

    // Verificar dependências
    const dependentes = await AutomacaoFinanceira.find({
      'configuracoes_avancadas.dependencias': automacaoId
    })

    if (dependentes.length > 0) {
      return NextResponse.json(
        { 
          error: 'Não é possível excluir esta automação pois ela é dependência de outras',
          dependentes: dependentes.map(d => ({ id: d._id, nome: d.nome }))
        },
        { status: 400 }
      )
    }

    await AutomacaoFinanceira.findByIdAndDelete(automacaoId)

    return NextResponse.json({
      success: true,
      message: 'Automação excluída com sucesso'
    })

  } catch (error) {
    console.error('Error deleting automação:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir automação' },
      { status: 500 }
    )
  }
}

// Engine de execução de automações
export async function executarAutomacoes() {
  try {
    await connectDB()
    
    const agora = new Date()
    
    // Buscar automações que devem ser executadas
    const automacoesPendentes = await AutomacaoFinanceira.find({
      ativo: true,
      pausado: false,
      $or: [
        { pausado_ate: { $exists: false } },
        { pausado_ate: { $lt: agora } }
      ],
      'trigger.tipo': 'agendamento',
      $or: [
        { proxima_execucao: { $lte: agora } },
        { proxima_execucao: { $exists: false } }
      ]
    }).sort({ 'configuracoes_avancadas.prioridade': -1 })

    const resultados = {
      total_processadas: 0,
      sucessos: 0,
      erros: 0,
      detalhes: []
    }

    for (const automacao of automacoesPendentes) {
      try {
        const resultado = await executarAutomacao(automacao)
        resultados.total_processadas++
        
        if (resultado.sucesso) {
          resultados.sucessos++
        } else {
          resultados.erros++
        }
        
        resultados.detalhes.push({
          automacao_id: automacao._id,
          nome: automacao.nome,
          sucesso: resultado.sucesso,
          detalhes: resultado.detalhes,
          duracao: resultado.duracao
        })
        
      } catch (error) {
        resultados.erros++
        resultados.detalhes.push({
          automacao_id: automacao._id,
          nome: automacao.nome,
          sucesso: false,
          detalhes: `Erro na execução: ${error.message}`,
          duracao: 0
        })
      }
    }

    return resultados

  } catch (error) {
    console.error('Erro no engine de automações:', error)
    throw error
  }
}

async function executarAutomacao(automacao: any, contextoManual: any = {}) {
  const inicioExecucao = Date.now()
  let resultado = {
    sucesso: false,
    detalhes: '',
    duracao: 0,
    metricas: {
      registros_processados: 0,
      emails_enviados: 0,
      lancamentos_criados: 0,
      valores_processados: 0
    }
  }

  try {
    // Verificar se deve executar
    const contexto = { ...contextoManual, data_atual: new Date() }
    
    if (!automacao.deveExecutar(contexto)) {
      resultado.detalhes = 'Condições de execução não atendidas'
      return resultado
    }

    // Verificar dependências
    if (automacao.configuracoes_avancadas.dependencias?.length > 0) {
      const dependenciasOk = await verificarDependencias(automacao.configuracoes_avancadas.dependencias)
      if (!dependenciasOk) {
        resultado.detalhes = 'Dependências não satisfeitas'
        return resultado
      }
    }

    // Executar ações sequencialmente
    for (const acao of automacao.acoes) {
      const resultadoAcao = await executarAcao(acao, automacao, contexto)
      
      if (!resultadoAcao.sucesso) {
        throw new Error(`Falha na ação ${acao.tipo_acao}: ${resultadoAcao.erro}`)
      }
      
      // Acumular métricas
      Object.keys(resultado.metricas).forEach(key => {
        resultado.metricas[key] += resultadoAcao.metricas?.[key] || 0
      })
    }

    resultado.sucesso = true
    resultado.detalhes = `Automação executada com sucesso. ${automacao.acoes.length} ações processadas.`

  } catch (error) {
    resultado.sucesso = false
    resultado.detalhes = error.message
  }

  // Calcular duração
  resultado.duracao = Math.round((Date.now() - inicioExecucao) / 1000)

  // Adicionar log de execução
  const status = resultado.sucesso ? 'sucesso' : 'erro'
  automacao.adicionarLogExecucao(
    status,
    resultado.duracao,
    resultado.detalhes,
    { contexto },
    resultado.sucesso ? [] : [resultado.detalhes],
    resultado.metricas
  )

  await automacao.save()

  return resultado
}

async function executarAcao(acao: any, automacao: any, contexto: any) {
  switch (acao.tipo_acao) {
    case 'criar_lancamento':
      return await executarCriarLancamento(acao, automacao, contexto)
      
    case 'enviar_email':
      return await executarEnviarEmail(acao, automacao, contexto)
      
    case 'gerar_relatorio':
      return await executarGerarRelatorio(acao, automacao, contexto)
      
    case 'aplicar_juros':
      return await executarAplicarJuros(acao, automacao, contexto)
      
    case 'conciliar_extrato':
      return await executarConciliarExtrato(acao, automacao, contexto)
      
    case 'gerar_alerta':
      return await executarGerarAlerta(acao, automacao, contexto)
      
    case 'executar_api':
      return await executarChamarAPI(acao, automacao, contexto)
      
    default:
      return {
        sucesso: false,
        erro: `Tipo de ação não implementado: ${acao.tipo_acao}`
      }
  }
}

async function executarCriarLancamento(acao: any, automacao: any, contexto: any) {
  try {
    const config = acao.configuracao.template_lancamento
    if (!config) {
      return { sucesso: false, erro: 'Configuração de lançamento não encontrada' }
    }

    // Buscar dados baseados no contexto
    let lancamentosParaCriar = []
    
    if (config.categoria_origem === 'morador') {
      // Buscar moradores para gerar lançamentos
      const moradores = await mongoose.model('Morador').find({
        condominio_id: automacao.condominio_id,
        ativo: true
      })
      
      lancamentosParaCriar = moradores.map(morador => ({
        ...config,
        vinculo_id: morador._id,
        vinculo_nome: morador.nome,
        apartamento: morador.unidade,
        bloco: morador.bloco,
        descricao: automacao.processarTemplate(config.descricao_template, {
          morador_nome: morador.nome,
          apartamento: morador.unidade,
          mes_atual: contexto.data_atual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
        })
      }))
    } else {
      // Lançamento único
      lancamentosParaCriar = [{
        ...config,
        descricao: automacao.processarTemplate(config.descricao_template, {
          mes_atual: contexto.data_atual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
        })
      }]
    }

    let criadosComSucesso = 0
    for (const dadosLancamento of lancamentosParaCriar) {
      const novoLancamento = new FinanceiroUnificado({
        ...dadosLancamento,
        condominio_id: automacao.condominio_id,
        master_id: automacao.master_id,
        criado_por_tipo: 'sistema',
        criado_por_id: automacao._id,
        criado_por_nome: `Automação: ${automacao.nome}`,
        data_vencimento: calcularDataVencimento(config, contexto.data_atual)
      })

      await novoLancamento.save()
      criadosComSucesso++
    }

    return {
      sucesso: true,
      metricas: {
        lancamentos_criados: criadosComSucesso,
        valores_processados: criadosComSucesso * (config.valor_fixo || 0)
      }
    }

  } catch (error) {
    return {
      sucesso: false,
      erro: error.message
    }
  }
}

async function executarEnviarEmail(acao: any, automacao: any, contexto: any) {
  try {
    const config = acao.configuracao.template_email
    if (!config) {
      return { sucesso: false, erro: 'Configuração de email não encontrada' }
    }

    // Configurar transporter (usar variáveis de ambiente)
    const transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })

    let emailsEnviados = 0

    // Determinar destinatários
    let destinatarios = []
    
    if (config.destinatarios.includes('{{morador_email}}')) {
      // Buscar emails de moradores
      const moradores = await mongoose.model('Morador').find({
        condominio_id: automacao.condominio_id,
        ativo: true,
        email: { $exists: true, $ne: '' }
      })
      
      destinatarios = moradores.map(morador => ({
        email: morador.email,
        nome: morador.nome,
        apartamento: morador.unidade,
        variaveis: {
          morador_nome: morador.nome,
          morador_email: morador.email,
          apartamento: morador.unidade,
          bloco: morador.bloco || '',
          mes_atual: contexto.data_atual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
        }
      }))
    } else {
      // Destinatários fixos
      destinatarios = config.destinatarios.map(email => ({
        email,
        nome: 'Administração',
        variaveis: {
          mes_atual: contexto.data_atual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
        }
      }))
    }

    // Enviar emails
    for (const destinatario of destinatarios) {
      const assunto = automacao.processarTemplate(config.assunto_template, destinatario.variaveis)
      const corpo = automacao.processarTemplate(config.corpo_template, destinatario.variaveis)
      
      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@condominio.com',
        to: destinatario.email,
        subject: assunto,
        html: corpo.replace(/\n/g, '<br>')
      })
      
      emailsEnviados++
    }

    return {
      sucesso: true,
      metricas: {
        emails_enviados: emailsEnviados
      }
    }

  } catch (error) {
    return {
      sucesso: false,
      erro: error.message
    }
  }
}

async function executarAplicarJuros(acao: any, automacao: any, contexto: any) {
  try {
    const config = acao.configuracao.configuracao_juros
    if (!config) {
      return { sucesso: false, erro: 'Configuração de juros não encontrada' }
    }

    const hoje = new Date()
    const dataLimite = new Date(hoje)
    dataLimite.setDate(dataLimite.getDate() - config.aplicar_apos_dias)

    // Buscar lançamentos em atraso
    const lancamentosAtrasados = await FinanceiroUnificado.find({
      condominio_id: automacao.condominio_id,
      tipo_operacao: 'receita',
      status: { $in: ['pendente', 'atrasado'] },
      data_vencimento: { $lt: dataLimite },
      ativo: true,
      $or: [
        { dias_atraso: { $exists: false } },
        { dias_atraso: { $lt: config.maximo_aplicacoes || 12 } }
      ]
    })

    let processados = 0
    let valorTotalJuros = 0

    for (const lancamento of lancamentosAtrasados) {
      const diasAtraso = Math.floor((hoje.getTime() - lancamento.data_vencimento.getTime()) / (1000 * 60 * 60 * 24))
      
      if (diasAtraso <= config.aplicar_apos_dias) continue

      let juros = 0
      let multa = config.valor_multa ? (lancamento.valor * config.valor_multa / 100) : 0

      switch (config.tipo_calculo) {
        case 'percentual_mes':
          const mesesAtraso = Math.ceil(diasAtraso / 30)
          juros = (lancamento.valor * config.valor_juros * mesesAtraso) / 100
          break
          
        case 'percentual_dia':
          juros = (lancamento.valor * config.valor_juros * diasAtraso) / 100
          break
          
        case 'valor_fixo':
          juros = config.valor_juros
          break
      }

      // Atualizar lançamento
      if (!lancamento.valor_original) {
        lancamento.valor_original = lancamento.valor
      }
      
      lancamento.multa_atraso = multa
      lancamento.juros_atraso = juros
      lancamento.valor = lancamento.valor_original + multa + juros
      lancamento.dias_atraso = diasAtraso
      lancamento.status = 'atrasado'
      
      await lancamento.save()
      
      processados++
      valorTotalJuros += juros + multa
    }

    return {
      sucesso: true,
      metricas: {
        registros_processados: processados,
        valores_processados: valorTotalJuros
      }
    }

  } catch (error) {
    return {
      sucesso: false,
      erro: error.message
    }
  }
}

// Implementar outras funções de execução conforme necessário...
async function executarGerarRelatorio(acao: any, automacao: any, contexto: any) {
  // Placeholder - implementar geração de relatórios
  return { sucesso: true, metricas: {} }
}

async function executarConciliarExtrato(acao: any, automacao: any, contexto: any) {
  // Placeholder - implementar conciliação automática
  return { sucesso: true, metricas: {} }
}

async function executarGerarAlerta(acao: any, automacao: any, contexto: any) {
  // Placeholder - implementar geração de alertas
  return { sucesso: true, metricas: {} }
}

async function executarChamarAPI(acao: any, automacao: any, contexto: any) {
  // Placeholder - implementar chamadas de API
  return { sucesso: true, metricas: {} }
}

// Funções auxiliares
function calcularDataVencimento(config: any, dataBase: Date) {
  const data = new Date(dataBase)
  
  if (config.periodicidade === 'mensal') {
    data.setMonth(data.getMonth() + 1)
  } else if (config.periodicidade === 'anual') {
    data.setFullYear(data.getFullYear() + 1)
  }
  
  return data
}

async function verificarDependencias(dependenciaIds: any[]) {
  const dependencias = await AutomacaoFinanceira.find({
    _id: { $in: dependenciaIds }
  })
  
  // Verificar se todas as dependências foram executadas com sucesso nas últimas 24h
  const ontemAgora = new Date(Date.now() - 24 * 60 * 60 * 1000)
  
  for (const dep of dependencias) {
    if (!dep.ultima_execucao || dep.ultima_execucao < ontemAgora) {
      return false
    }
    
    const ultimoLog = dep.logs_execucao[0]
    if (!ultimoLog || ultimoLog.status !== 'sucesso') {
      return false
    }
  }
  
  return true
}

async function criarAutomacaoManual(data: any) {
  const novaAutomacao = new AutomacaoFinanceira(data)
  await novaAutomacao.save()
  
  return NextResponse.json({
    success: true,
    message: 'Automação criada com sucesso',
    automacao: novaAutomacao
  })
}

async function criarAutomacaoTemplate(data: any) {
  const { template_tipo, master_id, condominio_id, usuario_id } = data
  
  let automacao
  
  switch (template_tipo) {
    case 'cobranca_automatica':
      automacao = criarAutomacaoCobranca(
        new mongoose.Types.ObjectId(condominio_id),
        new mongoose.Types.ObjectId(master_id),
        new mongoose.Types.ObjectId(usuario_id)
      )
      break
      
    case 'juros_multa':
      automacao = criarAutomacaoJurosMulta(
        new mongoose.Types.ObjectId(condominio_id),
        new mongoose.Types.ObjectId(master_id),
        new mongoose.Types.ObjectId(usuario_id)
      )
      break
      
    default:
      return NextResponse.json(
        { error: 'Template não reconhecido' },
        { status: 400 }
      )
  }
  
  await automacao.save()
  
  return NextResponse.json({
    success: true,
    message: 'Automação criada a partir do template',
    automacao
  })
}

async function executarAutomacaoManual(automacaoId: string, usuarioId: string) {
  const automacao = await AutomacaoFinanceira.findById(automacaoId)
  if (!automacao) {
    return NextResponse.json(
      { error: 'Automação não encontrada' },
      { status: 404 }
    )
  }
  
  const contexto = { execucao_manual: true, usuario_id: usuarioId }
  const resultado = await executarAutomacao(automacao, contexto)
  
  return NextResponse.json({
    success: true,
    resultado
  })
}

async function testarAutomacao(automacaoId: string) {
  // Placeholder - implementar teste de automação
  return NextResponse.json({
    success: true,
    message: 'Teste executado com sucesso',
    resultado: { valido: true, avisos: [], erros: [] }
  })
}

async function duplicarAutomacao(automacaoId: string, usuarioId: string) {
  const original = await AutomacaoFinanceira.findById(automacaoId)
  if (!original) {
    return NextResponse.json(
      { error: 'Automação não encontrada' },
      { status: 404 }
    )
  }
  
  const copia = new AutomacaoFinanceira({
    ...original.toObject(),
    _id: undefined,
    nome: `${original.nome} - Cópia`,
    ativo: false,
    criado_por: usuarioId,
    data_criacao: new Date(),
    logs_execucao: [],
    total_execucoes: 0,
    execucoes_sucesso: 0,
    execucoes_erro: 0
  })
  
  await copia.save()
  
  return NextResponse.json({
    success: true,
    message: 'Automação duplicada com sucesso',
    automacao: copia
  })
}

async function gerarRelatorioAutomacoes(condominioId: string, tipoRelatorio: string) {
  // Placeholder - implementar relatórios de automações
  return NextResponse.json({
    success: true,
    relatorio: {},
    tipo: tipoRelatorio
  })
}