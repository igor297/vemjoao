import mongoose, { Document, Schema } from 'mongoose'

export interface IAutomacaoFinanceira extends Document {
  // Identificação
  condominio_id: mongoose.Types.ObjectId
  master_id: mongoose.Types.ObjectId
  
  // Configuração da automação
  nome: string
  descricao: string
  tipo_automacao: 'cobranca_automatica' | 'aplicacao_juros_multa' | 'geracao_lancamentos' | 
                  'aprovacao_automatica' | 'conciliacao_automatica' | 'envio_notificacoes' |
                  'calculo_rateios' | 'backup_dados' | 'relatorio_programado' | 'validacao_dados'
  
  categoria: 'operacional' | 'financeiro' | 'administrativo' | 'compliance'
  
  // Configuração de trigger (quando executar)
  trigger: {
    tipo: 'agendamento' | 'evento' | 'condicao' | 'manual'
    
    // Para tipo 'agendamento'
    agendamento?: {
      frequencia: 'diaria' | 'semanal' | 'mensal' | 'anual' | 'personalizada'
      dias_semana?: number[] // 0-6 (domingo a sábado)
      dia_mes?: number // 1-31
      horario: string // HH:MM
      timezone?: string
      proxima_execucao: Date
    }
    
    // Para tipo 'evento'
    evento?: {
      tipo_evento: 'novo_lancamento' | 'vencimento_proximo' | 'pagamento_recebido' | 
                   'extrato_importado' | 'inadimplencia_detectada' | 'meta_atingida'
      filtros?: any // Condições específicas para o evento
    }
    
    // Para tipo 'condicao'
    condicao?: {
      campo: string // ex: 'taxa_inadimplencia', 'saldo_conta', 'valor_total'
      operador: 'maior_que' | 'menor_que' | 'igual' | 'entre' | 'diferente'
      valor: number | string
      valor_secundario?: number // Para operador 'entre'
    }
  }
  
  // Ações a serem executadas
  acoes: {
    tipo_acao: 'criar_lancamento' | 'enviar_email' | 'gerar_relatorio' | 'aplicar_juros' |
               'enviar_cobranca' | 'conciliar_extrato' | 'aprovar_pagamento' | 'backup_dados' |
               'calcular_rateio' | 'gerar_alerta' | 'atualizar_status' | 'executar_api'
    
    configuracao: {
      // Para criar_lancamento
      template_lancamento?: {
        tipo_operacao: 'receita' | 'despesa' | 'transferencia'
        categoria_origem: string
        subcategoria: string
        descricao_template: string // Pode ter variáveis: {{morador_nome}}, {{mes_atual}}
        valor_fixo?: number
        valor_formula?: string // Ex: "taxa_condominio * 0.02"
        recorrente?: boolean
        periodicidade?: string
      }
      
      // Para enviar_email
      template_email?: {
        destinatarios: string[] // Pode incluir variáveis: {{morador_email}}
        assunto_template: string
        corpo_template: string
        anexos?: string[]
        prioridade: 'baixa' | 'normal' | 'alta'
      }
      
      // Para gerar_relatorio
      configuracao_relatorio?: {
        tipo_relatorio: 'dre' | 'balancete' | 'fluxo_caixa' | 'inadimplencia' | 'personalizado'
        periodo: string // Ex: "mes_atual", "trimestre_anterior"
        formato: 'pdf' | 'excel' | 'csv'
        destinatarios?: string[]
        salvar_historico: boolean
      }
      
      // Para aplicar_juros
      configuracao_juros?: {
        tipo_calculo: 'percentual_mes' | 'percentual_dia' | 'valor_fixo'
        valor_juros: number
        valor_multa?: number
        aplicar_apos_dias: number
        maximo_aplicacoes?: number
      }
      
      // Para executar_api
      configuracao_api?: {
        url: string
        metodo: 'GET' | 'POST' | 'PUT' | 'DELETE'
        headers?: { [key: string]: string }
        body_template?: string
        auth_type?: 'none' | 'bearer' | 'basic'
        auth_config?: any
      }
      
      // Configurações gerais
      condicoes_execucao?: {
        dias_semana?: number[]
        horario_inicio?: string
        horario_fim?: string
        feriados_inclusos?: boolean
      }
      
      // Variáveis disponíveis para templates
      variaveis_contexto?: string[]
    }
  }[]
  
  // Controle de execução
  ativo: boolean
  pausado: boolean
  pausado_ate?: Date
  pausado_motivo?: string
  
  // Histórico de execuções
  ultima_execucao?: Date
  proxima_execucao?: Date
  total_execucoes: number
  execucoes_sucesso: number
  execucoes_erro: number
  
  // Configurações avançadas
  configuracoes_avancadas: {
    max_tentativas: number
    timeout_segundos: number
    retry_delay_segundos: number
    executar_em_paralelo: boolean
    prioridade: number // 1-10
    dependencias?: mongoose.Types.ObjectId[] // IDs de outras automações que devem executar antes
    ambiente: 'desenvolvimento' | 'producao' | 'ambos'
  }
  
  // Monitoramento
  metricas: {
    tempo_medio_execucao: number // em segundos
    taxa_sucesso: number // 0-100
    impacto_financeiro_total?: number
    economia_gerada?: number
    ultimo_erro?: string
    alertas_gerados: number
  }
  
  // Auditoria
  data_criacao: Date
  data_atualizacao: Date
  criado_por: mongoose.Types.ObjectId
  modificado_por?: mongoose.Types.ObjectId
  
  // Logs de execução (últimas 100)
  logs_execucao: {
    data_execucao: Date
    status: 'sucesso' | 'erro' | 'parcial' | 'cancelado'
    duracao_segundos: number
    detalhes: string
    resultados?: any
    erros?: string[]
    metricas_execucao?: {
      registros_processados: number
      emails_enviados: number
      lancamentos_criados: number
      valores_processados: number
    }
  }[]
}

const AgendamentoSchema = new Schema({
  frequencia: { 
    type: String, 
    enum: ['diaria', 'semanal', 'mensal', 'anual', 'personalizada'],
    required: true 
  },
  dias_semana: [{ type: Number, min: 0, max: 6 }],
  dia_mes: { type: Number, min: 1, max: 31 },
  horario: { 
    type: String, 
    required: true,
    match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
  },
  timezone: { type: String, default: 'America/Sao_Paulo' },
  proxima_execucao: { type: Date, required: true }
}, { _id: false })

const EventoSchema = new Schema({
  tipo_evento: { 
    type: String, 
    enum: [
      'novo_lancamento', 'vencimento_proximo', 'pagamento_recebido',
      'extrato_importado', 'inadimplencia_detectada', 'meta_atingida'
    ],
    required: true 
  },
  filtros: Schema.Types.Mixed
}, { _id: false })

const CondicaoSchema = new Schema({
  campo: { type: String, required: true },
  operador: { 
    type: String, 
    enum: ['maior_que', 'menor_que', 'igual', 'entre', 'diferente'],
    required: true 
  },
  valor: { type: Schema.Types.Mixed, required: true },
  valor_secundario: Schema.Types.Mixed
}, { _id: false })

const TriggerSchema = new Schema({
  tipo: { 
    type: String, 
    enum: ['agendamento', 'evento', 'condicao', 'manual'],
    required: true 
  },
  agendamento: AgendamentoSchema,
  evento: EventoSchema,
  condicao: CondicaoSchema
}, { _id: false })

const ConfiguracaoAcaoSchema = new Schema({
  template_lancamento: {
    tipo_operacao: { type: String, enum: ['receita', 'despesa', 'transferencia'] },
    categoria_origem: String,
    subcategoria: String,
    descricao_template: String,
    valor_fixo: Number,
    valor_formula: String,
    recorrente: Boolean,
    periodicidade: String
  },
  template_email: {
    destinatarios: [String],
    assunto_template: String,
    corpo_template: String,
    anexos: [String],
    prioridade: { type: String, enum: ['baixa', 'normal', 'alta'], default: 'normal' }
  },
  configuracao_relatorio: {
    tipo_relatorio: { 
      type: String, 
      enum: ['dre', 'balancete', 'fluxo_caixa', 'inadimplencia', 'personalizado'] 
    },
    periodo: String,
    formato: { type: String, enum: ['pdf', 'excel', 'csv'] },
    destinatarios: [String],
    salvar_historico: Boolean
  },
  configuracao_juros: {
    tipo_calculo: { type: String, enum: ['percentual_mes', 'percentual_dia', 'valor_fixo'] },
    valor_juros: Number,
    valor_multa: Number,
    aplicar_apos_dias: Number,
    maximo_aplicacoes: Number
  },
  configuracao_api: {
    url: String,
    metodo: { type: String, enum: ['GET', 'POST', 'PUT', 'DELETE'] },
    headers: Schema.Types.Mixed,
    body_template: String,
    auth_type: { type: String, enum: ['none', 'bearer', 'basic'] },
    auth_config: Schema.Types.Mixed
  },
  condicoes_execucao: {
    dias_semana: [Number],
    horario_inicio: String,
    horario_fim: String,
    feriados_inclusos: Boolean
  },
  variaveis_contexto: [String]
}, { _id: false })

const AcaoSchema = new Schema({
  tipo_acao: { 
    type: String, 
    enum: [
      'criar_lancamento', 'enviar_email', 'gerar_relatorio', 'aplicar_juros',
      'enviar_cobranca', 'conciliar_extrato', 'aprovar_pagamento', 'backup_dados',
      'calcular_rateio', 'gerar_alerta', 'atualizar_status', 'executar_api'
    ],
    required: true 
  },
  configuracao: ConfiguracaoAcaoSchema
})

const LogExecucaoSchema = new Schema({
  data_execucao: { type: Date, default: Date.now },
  status: { 
    type: String, 
    enum: ['sucesso', 'erro', 'parcial', 'cancelado'],
    required: true 
  },
  duracao_segundos: { type: Number, required: true },
  detalhes: { type: String, required: true },
  resultados: Schema.Types.Mixed,
  erros: [String],
  metricas_execucao: {
    registros_processados: { type: Number, default: 0 },
    emails_enviados: { type: Number, default: 0 },
    lancamentos_criados: { type: Number, default: 0 },
    valores_processados: { type: Number, default: 0 }
  }
})

const AutomacaoFinanceiraSchema = new Schema<IAutomacaoFinanceira>({
  // Identificação
  condominio_id: { type: Schema.Types.ObjectId, ref: 'Condominio', required: true },
  master_id: { type: Schema.Types.ObjectId, ref: 'Master', required: true },
  
  // Configuração
  nome: { 
    type: String, 
    required: true, 
    trim: true,
    minlength: 3,
    maxlength: 100
  },
  descricao: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 500
  },
  tipo_automacao: { 
    type: String, 
    enum: [
      'cobranca_automatica', 'aplicacao_juros_multa', 'geracao_lancamentos',
      'aprovacao_automatica', 'conciliacao_automatica', 'envio_notificacoes',
      'calculo_rateios', 'backup_dados', 'relatorio_programado', 'validacao_dados'
    ],
    required: true 
  },
  categoria: { 
    type: String, 
    enum: ['operacional', 'financeiro', 'administrativo', 'compliance'],
    default: 'operacional' 
  },
  
  // Trigger e ações
  trigger: { type: TriggerSchema, required: true },
  acoes: { type: [AcaoSchema], required: true, validate: [arrayLimit, 'Máximo 10 ações por automação'] },
  
  // Status
  ativo: { type: Boolean, default: true },
  pausado: { type: Boolean, default: false },
  pausado_ate: Date,
  pausado_motivo: String,
  
  // Execuções
  ultima_execucao: Date,
  proxima_execucao: Date,
  total_execucoes: { type: Number, default: 0 },
  execucoes_sucesso: { type: Number, default: 0 },
  execucoes_erro: { type: Number, default: 0 },
  
  // Configurações avançadas
  configuracoes_avancadas: {
    max_tentativas: { type: Number, default: 3, min: 1, max: 10 },
    timeout_segundos: { type: Number, default: 300, min: 30, max: 3600 },
    retry_delay_segundos: { type: Number, default: 60, min: 10, max: 600 },
    executar_em_paralelo: { type: Boolean, default: false },
    prioridade: { type: Number, default: 5, min: 1, max: 10 },
    dependencias: [{ type: Schema.Types.ObjectId, ref: 'AutomacaoFinanceira' }],
    ambiente: { type: String, enum: ['desenvolvimento', 'producao', 'ambos'], default: 'ambos' }
  },
  
  // Métricas
  metricas: {
    tempo_medio_execucao: { type: Number, default: 0 },
    taxa_sucesso: { type: Number, default: 100, min: 0, max: 100 },
    impacto_financeiro_total: Number,
    economia_gerada: Number,
    ultimo_erro: String,
    alertas_gerados: { type: Number, default: 0 }
  },
  
  // Auditoria
  data_criacao: { type: Date, default: Date.now },
  data_atualizacao: { type: Date, default: Date.now },
  criado_por: { type: Schema.Types.ObjectId, required: true },
  modificado_por: Schema.Types.ObjectId,
  
  // Logs (últimas 100 execuções)
  logs_execucao: { 
    type: [LogExecucaoSchema],
    validate: [arrayMaxSize, 'Máximo 100 logs de execução']
  }
}, {
  timestamps: true,
  collection: 'automacoes-financeiras'
})

// Validadores personalizados
function arrayLimit(val: any[]) {
  return val.length <= 10
}

function arrayMaxSize(val: any[]) {
  return val.length <= 100
}

// Índices para performance
AutomacaoFinanceiraSchema.index({ condominio_id: 1, ativo: 1, pausado: 1 })
AutomacaoFinanceiraSchema.index({ tipo_automacao: 1, categoria: 1 })
AutomacaoFinanceiraSchema.index({ proxima_execucao: 1, ativo: 1 })
AutomacaoFinanceiraSchema.index({ 'configuracoes_avancadas.prioridade': -1 })
AutomacaoFinanceiraSchema.index({ master_id: 1, data_criacao: -1 })

// Middleware para atualizar timestamps
AutomacaoFinanceiraSchema.pre('save', function(next) {
  this.data_atualizacao = new Date()
  
  // Calcular próxima execução para agendamentos
  if (this.trigger.tipo === 'agendamento' && this.trigger.agendamento) {
    this.proxima_execucao = this.calcularProximaExecucao()
  }
  
  next()
})

// Método para calcular próxima execução
AutomacaoFinanceiraSchema.methods.calcularProximaExecucao = function() {
  if (this.trigger.tipo !== 'agendamento' || !this.trigger.agendamento) {
    return undefined
  }
  
  const agendamento = this.trigger.agendamento
  const agora = new Date()
  const proxima = new Date()
  
  const [hora, minuto] = agendamento.horario.split(':').map(Number)
  proxima.setHours(hora, minuto, 0, 0)
  
  switch (agendamento.frequencia) {
    case 'diaria':
      if (proxima <= agora) {
        proxima.setDate(proxima.getDate() + 1)
      }
      break
      
    case 'semanal':
      if (agendamento.dias_semana && agendamento.dias_semana.length > 0) {
        // Encontrar próximo dia da semana válido
        let diasParaAdicionar = 1
        while (diasParaAdicionar <= 7) {
          const testData = new Date(proxima)
          testData.setDate(testData.getDate() + diasParaAdicionar)
          if (agendamento.dias_semana.includes(testData.getDay()) && testData > agora) {
            proxima.setDate(proxima.getDate() + diasParaAdicionar)
            break
          }
          diasParaAdicionar++
        }
      }
      break
      
    case 'mensal':
      if (agendamento.dia_mes) {
        proxima.setDate(agendamento.dia_mes)
        if (proxima <= agora) {
          proxima.setMonth(proxima.getMonth() + 1)
          proxima.setDate(agendamento.dia_mes)
        }
      }
      break
      
    case 'anual':
      if (proxima <= agora) {
        proxima.setFullYear(proxima.getFullYear() + 1)
      }
      break
  }
  
  return proxima
}

// Método para adicionar log de execução
AutomacaoFinanceiraSchema.methods.adicionarLogExecucao = function(
  status: string,
  duracao: number,
  detalhes: string,
  resultados?: any,
  erros?: string[],
  metricas?: any
) {
  const novoLog = {
    data_execucao: new Date(),
    status,
    duracao_segundos: duracao,
    detalhes,
    resultados,
    erros,
    metricas_execucao: metricas
  }
  
  this.logs_execucao.unshift(novoLog)
  
  // Manter apenas últimos 100 logs
  if (this.logs_execucao.length > 100) {
    this.logs_execucao = this.logs_execucao.slice(0, 100)
  }
  
  // Atualizar métricas
  this.total_execucoes++
  if (status === 'sucesso') {
    this.execucoes_sucesso++
  } else if (status === 'erro') {
    this.execucoes_erro++
    this.metricas.ultimo_erro = detalhes
  }
  
  this.metricas.taxa_sucesso = (this.execucoes_sucesso / this.total_execucoes) * 100
  
  // Calcular tempo médio de execução
  const temposExecucao = this.logs_execucao.map(log => log.duracao_segundos)
  this.metricas.tempo_medio_execucao = temposExecucao.reduce((sum, tempo) => sum + tempo, 0) / temposExecucao.length
  
  this.ultima_execucao = new Date()
  
  // Calcular próxima execução
  if (this.trigger.tipo === 'agendamento') {
    this.proxima_execucao = this.calcularProximaExecucao()
  }
}

// Método para verificar se deve executar
AutomacaoFinanceiraSchema.methods.deveExecutar = function(contexto: any = {}) {
  if (!this.ativo || this.pausado) {
    return false
  }
  
  if (this.pausado_ate && new Date() < this.pausado_ate) {
    return false
  }
  
  switch (this.trigger.tipo) {
    case 'agendamento':
      return this.proxima_execucao && new Date() >= this.proxima_execucao
      
    case 'evento':
      return this.verificarEvento(contexto)
      
    case 'condicao':
      return this.verificarCondicao(contexto)
      
    case 'manual':
      return contexto.execucao_manual === true
      
    default:
      return false
  }
}

// Método para verificar evento
AutomacaoFinanceiraSchema.methods.verificarEvento = function(contexto: any) {
  if (!this.trigger.evento) return false
  
  const evento = this.trigger.evento
  
  // Verificar se o tipo de evento coincide
  if (contexto.tipo_evento !== evento.tipo_evento) {
    return false
  }
  
  // Aplicar filtros se existirem
  if (evento.filtros && Object.keys(evento.filtros).length > 0) {
    return this.aplicarFiltros(evento.filtros, contexto)
  }
  
  return true
}

// Método para verificar condição
AutomacaoFinanceiraSchema.methods.verificarCondicao = function(contexto: any) {
  if (!this.trigger.condicao) return false
  
  const condicao = this.trigger.condicao
  const valorAtual = contexto[condicao.campo]
  
  if (valorAtual === undefined) return false
  
  switch (condicao.operador) {
    case 'maior_que':
      return valorAtual > condicao.valor
    case 'menor_que':
      return valorAtual < condicao.valor
    case 'igual':
      return valorAtual === condicao.valor
    case 'entre':
      return valorAtual >= condicao.valor && valorAtual <= condicao.valor_secundario
    case 'diferente':
      return valorAtual !== condicao.valor
    default:
      return false
  }
}

// Método para aplicar filtros
AutomacaoFinanceiraSchema.methods.aplicarFiltros = function(filtros: any, contexto: any) {
  for (const [campo, valor] of Object.entries(filtros)) {
    if (contexto[campo] !== valor) {
      return false
    }
  }
  return true
}

// Método para processar templates
AutomacaoFinanceiraSchema.methods.processarTemplate = function(template: string, variaveis: any) {
  let resultado = template
  
  for (const [chave, valor] of Object.entries(variaveis)) {
    const regex = new RegExp(`{{${chave}}}`, 'g')
    resultado = resultado.replace(regex, String(valor))
  }
  
  return resultado
}

export default mongoose.models.AutomacaoFinanceira || mongoose.model<IAutomacaoFinanceira>('AutomacaoFinanceira', AutomacaoFinanceiraSchema)

// Funções utilitárias para criação de automações pré-definidas
export const criarAutomacaoCobranca = (
  condominioId: mongoose.Types.ObjectId,
  masterId: mongoose.Types.ObjectId,
  usuarioId: mongoose.Types.ObjectId
) => {
  return new (mongoose.models.AutomacaoFinanceira || mongoose.model<IAutomacaoFinanceira>('AutomacaoFinanceira', AutomacaoFinanceiraSchema))({
    condominio_id: condominioId,
    master_id: masterId,
    nome: 'Cobrança Automática - Vencimentos Próximos',
    descricao: 'Envia automaticamente emails de cobrança 3 dias antes do vencimento',
    tipo_automacao: 'cobranca_automatica',
    categoria: 'financeiro',
    trigger: {
      tipo: 'agendamento',
      agendamento: {
        frequencia: 'diaria',
        horario: '09:00',
        proxima_execucao: new Date()
      }
    },
    acoes: [
      {
        tipo_acao: 'enviar_email',
        configuracao: {
          template_email: {
            destinatarios: ['{{morador_email}}'],
            assunto_template: 'Lembrete: Vencimento da Taxa Condominial em 3 dias',
            corpo_template: `
              Prezado(a) {{morador_nome}},
              
              Informamos que a taxa condominial do mês {{mes_referencia}} vencerá em 3 dias.
              
              Valor: {{valor_formatado}}
              Vencimento: {{data_vencimento}}
              Apartamento: {{apartamento}}
              
              Para evitar juros e multas, realize o pagamento até a data de vencimento.
              
              Atenciosamente,
              Administração do Condomínio
            `,
            prioridade: 'normal'
          },
          variaveis_contexto: [
            'morador_nome', 'morador_email', 'mes_referencia', 
            'valor_formatado', 'data_vencimento', 'apartamento'
          ]
        }
      }
    ],
    criado_por: usuarioId,
    configuracoes_avancadas: {
      max_tentativas: 3,
      timeout_segundos: 300,
      retry_delay_segundos: 60,
      executar_em_paralelo: true,
      prioridade: 7,
      ambiente: 'ambos'
    }
  })
}

export const criarAutomacaoJurosMulta = (
  condominioId: mongoose.Types.ObjectId,
  masterId: mongoose.Types.ObjectId,
  usuarioId: mongoose.Types.ObjectId
) => {
  return new (mongoose.models.AutomacaoFinanceira || mongoose.model<IAutomacaoFinanceira>('AutomacaoFinanceira', AutomacaoFinanceiraSchema))({
    condominio_id: condominioId,
    master_id: masterId,
    nome: 'Aplicação Automática de Juros e Multa',
    descricao: 'Aplica automaticamente juros e multa em pagamentos em atraso',
    tipo_automacao: 'aplicacao_juros_multa',
    categoria: 'financeiro',
    trigger: {
      tipo: 'agendamento',
      agendamento: {
        frequencia: 'diaria',
        horario: '08:00',
        proxima_execucao: new Date()
      }
    },
    acoes: [
      {
        tipo_acao: 'aplicar_juros',
        configuracao: {
          configuracao_juros: {
            tipo_calculo: 'percentual_mes',
            valor_juros: 1.0, // 1% ao mês
            valor_multa: 2.0, // 2% de multa
            aplicar_apos_dias: 1,
            maximo_aplicacoes: 12
          }
        }
      }
    ],
    criado_por: usuarioId,
    configuracoes_avancadas: {
      max_tentativas: 5,
      timeout_segundos: 600,
      retry_delay_segundos: 120,
      executar_em_paralelo: false,
      prioridade: 9,
      ambiente: 'ambos'
    }
  })
}