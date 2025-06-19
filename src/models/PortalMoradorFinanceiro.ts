import mongoose, { Document, Schema } from 'mongoose'

export interface IPortalMoradorFinanceiro extends Document {
  // Identificação
  morador_id: mongoose.Types.ObjectId
  condominio_id: mongoose.Types.ObjectId
  master_id: mongoose.Types.ObjectId

  // Configurações de acesso
  acesso_liberado: boolean
  primeiro_acesso: boolean
  senha_temporaria?: string
  data_ultimo_acesso?: Date
  tentativas_login: number
  bloqueado_ate?: Date
  
  // Preferências de notificação
  preferencias_notificacao: {
    email_vencimento: boolean
    email_pagamento_confirmado: boolean
    email_extrato_mensal: boolean
    whatsapp_vencimento: boolean
    whatsapp_pagamento_confirmado: boolean
    sms_vencimento: boolean
    push_app: boolean
    dias_antecedencia_aviso: number
  }
  
  // Configurações de pagamento
  forma_pagamento_preferida: 'boleto' | 'pix' | 'cartao' | 'debito_automatico'
  salvar_cartao: boolean
  debito_automatico_ativo: boolean
  dados_debito_automatico?: {
    banco: string
    agencia: string
    conta: string
    titular: string
    cpf: string
    data_ativacao: Date
  }
  
  // Histórico financeiro personalizado
  configuracoes_extrato: {
    exibir_detalhes_cobranca: boolean
    agrupar_por_categoria: boolean
    mostrar_grafico_gastos: boolean
    periodo_padrao: 'mes_atual' | 'ultimos_3_meses' | 'ultimos_6_meses' | 'ano_atual'
  }
  
  // Status de pagamentos
  status_pagamentos: {
    em_dia: boolean
    total_pendente: number
    proxima_cobranca: {
      valor: number
      vencimento: Date
      descricao: string
    }
    ultima_cobranca_paga: {
      valor: number
      data_pagamento: Date
      forma_pagamento: string
    }
  }
  
  // Comunicação com administração
  canal_comunicacao: {
    permite_chat: boolean
    permite_chamados: boolean
    permite_agendamento: boolean
    horario_atendimento: {
      inicio: string
      fim: string
      dias_semana: number[]
    }
  }
  
  // Documentos disponíveis
  documentos_disponiveis: Array<{
    tipo: 'extrato' | 'comprovante' | 'boleto' | 'comunicado' | 'ata' | 'balancete'
    nome: string
    data_documento: Date
    url_download: string
    tamanho_arquivo: number
    visualizado: boolean
    data_visualizacao?: Date
  }>
  
  // Alertas personalizados
  alertas_configurados: Array<{
    tipo: 'vencimento_proximo' | 'valor_alto' | 'mudanca_taxa' | 'assembleia' | 'manutencao'
    ativo: boolean
    parametros: any
    criado_em: Date
  }>
  
  // Histórico de ações
  log_atividades: Array<{
    data: Date
    acao: string
    detalhes: string
    ip_acesso?: string
    dispositivo?: string
  }>
  
  // Avaliação do serviço
  avaliacoes_servico: Array<{
    data: Date
    tipo_servico: string
    nota: number // 1 a 5
    comentario?: string
    respondida: boolean
  }>
  
  // Dados de controle
  data_criacao: Date
  data_atualizacao: Date
  criado_por_id: mongoose.Types.ObjectId
  criado_por_nome: string
  ativo: boolean
}

const PortalMoradorFinanceiroSchema: Schema = new Schema({
  morador_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Morador'
  },
  condominio_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Condominio'
  },
  master_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Master'
  },
  acesso_liberado: {
    type: Boolean,
    default: false
  },
  primeiro_acesso: {
    type: Boolean,
    default: true
  },
  senha_temporaria: {
    type: String,
    trim: true
  },
  data_ultimo_acesso: {
    type: Date
  },
  tentativas_login: {
    type: Number,
    default: 0,
    min: 0
  },
  bloqueado_ate: {
    type: Date
  },
  preferencias_notificacao: {
    email_vencimento: { type: Boolean, default: true },
    email_pagamento_confirmado: { type: Boolean, default: true },
    email_extrato_mensal: { type: Boolean, default: false },
    whatsapp_vencimento: { type: Boolean, default: false },
    whatsapp_pagamento_confirmado: { type: Boolean, default: false },
    sms_vencimento: { type: Boolean, default: false },
    push_app: { type: Boolean, default: true },
    dias_antecedencia_aviso: { type: Number, default: 5, min: 1, max: 30 }
  },
  forma_pagamento_preferida: {
    type: String,
    enum: ['boleto', 'pix', 'cartao', 'debito_automatico'],
    default: 'boleto'
  },
  salvar_cartao: {
    type: Boolean,
    default: false
  },
  debito_automatico_ativo: {
    type: Boolean,
    default: false
  },
  dados_debito_automatico: {
    banco: { type: String, trim: true },
    agencia: { type: String, trim: true },
    conta: { type: String, trim: true },
    titular: { type: String, trim: true },
    cpf: { type: String, trim: true },
    data_ativacao: { type: Date }
  },
  configuracoes_extrato: {
    exibir_detalhes_cobranca: { type: Boolean, default: true },
    agrupar_por_categoria: { type: Boolean, default: false },
    mostrar_grafico_gastos: { type: Boolean, default: true },
    periodo_padrao: {
      type: String,
      enum: ['mes_atual', 'ultimos_3_meses', 'ultimos_6_meses', 'ano_atual'],
      default: 'mes_atual'
    }
  },
  status_pagamentos: {
    em_dia: { type: Boolean, default: true },
    total_pendente: { type: Number, default: 0, min: 0 },
    proxima_cobranca: {
      valor: { type: Number, default: 0 },
      vencimento: { type: Date },
      descricao: { type: String, trim: true }
    },
    ultima_cobranca_paga: {
      valor: { type: Number, default: 0 },
      data_pagamento: { type: Date },
      forma_pagamento: { type: String, trim: true }
    }
  },
  canal_comunicacao: {
    permite_chat: { type: Boolean, default: true },
    permite_chamados: { type: Boolean, default: true },
    permite_agendamento: { type: Boolean, default: false },
    horario_atendimento: {
      inicio: { type: String, default: '08:00' },
      fim: { type: String, default: '18:00' },
      dias_semana: [{ type: Number, min: 1, max: 7 }]
    }
  },
  documentos_disponiveis: [{
    tipo: {
      type: String,
      enum: ['extrato', 'comprovante', 'boleto', 'comunicado', 'ata', 'balancete'],
      required: true
    },
    nome: { type: String, required: true, trim: true },
    data_documento: { type: Date, required: true },
    url_download: { type: String, required: true, trim: true },
    tamanho_arquivo: { type: Number, min: 0 },
    visualizado: { type: Boolean, default: false },
    data_visualizacao: { type: Date }
  }],
  alertas_configurados: [{
    tipo: {
      type: String,
      enum: ['vencimento_proximo', 'valor_alto', 'mudanca_taxa', 'assembleia', 'manutencao'],
      required: true
    },
    ativo: { type: Boolean, default: true },
    parametros: { type: mongoose.Schema.Types.Mixed },
    criado_em: { type: Date, default: Date.now }
  }],
  log_atividades: [{
    data: { type: Date, default: Date.now },
    acao: { type: String, required: true, trim: true },
    detalhes: { type: String, trim: true },
    ip_acesso: { type: String, trim: true },
    dispositivo: { type: String, trim: true }
  }],
  avaliacoes_servico: [{
    data: { type: Date, default: Date.now },
    tipo_servico: { type: String, required: true, trim: true },
    nota: { type: Number, required: true, min: 1, max: 5 },
    comentario: { type: String, trim: true },
    respondida: { type: Boolean, default: false }
  }],
  data_criacao: {
    type: Date,
    default: Date.now
  },
  data_atualizacao: {
    type: Date,
    default: Date.now
  },
  criado_por_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  criado_por_nome: {
    type: String,
    required: true,
    trim: true
  },
  ativo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'portal-morador-financeiro'
})

// Índices
PortalMoradorFinanceiroSchema.index({ morador_id: 1 }, { unique: true })
PortalMoradorFinanceiroSchema.index({ condominio_id: 1, acesso_liberado: 1 })
PortalMoradorFinanceiroSchema.index({ 'status_pagamentos.em_dia': 1 })

export default mongoose.models.PortalMoradorFinanceiro || mongoose.model<IPortalMoradorFinanceiro>('PortalMoradorFinanceiro', PortalMoradorFinanceiroSchema)

// Interface para dados do dashboard do morador
export interface DashboardMoradorData {
  status_geral: {
    em_dia: boolean
    total_pendente: number
    proxima_cobranca: Date
    dias_para_vencimento: number
  }
  resumo_financeiro: {
    valor_mensal_medio: number
    total_pago_ano: number
    economia_desconto: number
    historico_12_meses: Array<{
      mes: string
      valor: number
      pago: boolean
    }>
  }
  servicos_disponiveis: {
    pode_gerar_segunda_via: boolean
    pode_parcelar: boolean
    pode_contestar: boolean
    tem_desconto_pontualidade: boolean
  }
  comunicados_nao_lidos: number
  documentos_pendentes: number
}

// Função para gerar senha temporária
export const gerarSenhaTemporaria = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let senha = ''
  for (let i = 0; i < 8; i++) {
    senha += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return senha
}

// Função para validar configuração do portal
export const validarConfiguracaoPortal = (config: Partial<IPortalMoradorFinanceiro>): { valida: boolean, erros: string[] } => {
  const erros: string[] = []

  if (config.debito_automatico_ativo && !config.dados_debito_automatico) {
    erros.push('Dados bancários são obrigatórios para débito automático')
  }

  if (config.dados_debito_automatico) {
    if (!config.dados_debito_automatico.banco?.trim()) {
      erros.push('Banco é obrigatório para débito automático')
    }
    if (!config.dados_debito_automatico.agencia?.trim()) {
      erros.push('Agência é obrigatória para débito automático')
    }
    if (!config.dados_debito_automatico.conta?.trim()) {
      erros.push('Conta é obrigatória para débito automático')
    }
    if (!config.dados_debito_automatico.cpf?.trim()) {
      erros.push('CPF é obrigatório para débito automático')
    }
  }

  return {
    valida: erros.length === 0,
    erros
  }
}