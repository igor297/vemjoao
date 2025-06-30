import mongoose, { Document, Schema } from 'mongoose'

export interface ICobrancaAutomatizada extends Document {
  // Identificação
  condominio_id: mongoose.Types.ObjectId
  master_id: mongoose.Types.ObjectId

  // Configuração da cobrança
  nome: string
  descricao: string
  tipo_cobranca: 'taxa_condominio' | 'taxa_extra' | 'multa' | 'juros' | 'servicos' | 'personalizada'
  
  // Regras de disparo
  regras_disparo: {
    dias_antes_vencimento?: number // Enviar X dias antes do vencimento
    dias_apos_vencimento?: number // Enviar X dias após vencimento
    valor_minimo?: number // Só disparar se valor >= X
    apenas_inadimplentes?: boolean // Só enviar para quem já está devendo
    apenas_primeiros_avisos?: boolean // Não enviar se já foi avisado hoje
  }
  
  // Canais de comunicação
  canais: {
    email: boolean
    whatsapp: boolean
    sms: boolean
    notificacao_app: boolean
  }
  
  // Templates de mensagem
  template_email: {
    assunto: string
    corpo: string // Suporte a variáveis: {{nome}}, {{valor}}, {{vencimento}}, etc.
    incluir_boleto: boolean
    incluir_qr_pix: boolean
  }
  
  template_whatsapp: {
    mensagem: string
    incluir_link_pagamento: boolean
    incluir_qr_pix: boolean
  }
  
  template_sms: {
    mensagem: string // Máximo 160 caracteres
    incluir_link_curto: boolean
  }
  
  // Configurações de frequência
  frequencia: 'unica' | 'diaria' | 'semanal' | 'mensal'
  horario_envio: string // HH:MM
  dias_semana?: number[] // Para frequência semanal [1,2,3,4,5] = seg a sex
  dia_mes?: number // Para frequência mensal
  
  // Limite de envios
  max_tentativas_por_cobranca: number
  intervalo_entre_tentativas: number // Em horas
  parar_apos_pagamento: boolean
  
  // Filtros e segmentação
  filtros: {
    categorias_incluir?: string[]
    categorias_excluir?: string[]
    valores: {
      minimo?: number
      maximo?: number
    }
    unidades?: string[] // Apartamentos específicos
    blocos?: string[] // Blocos específicos
    tags_morador?: string[] // Tags específicas de moradores
  }
  
  // Configurações de pagamento
  gerar_boleto_automatico: boolean
  gerar_pix_automatico: boolean
  valor_juros_diario?: number // %
  valor_multa?: number // % ou valor fixo
  tipo_multa?: 'percentual' | 'fixo'
  desconto_pagamento_antecipado?: number // %
  dias_desconto?: number
  
  // Status e controle
  ativa: boolean
  pausada: boolean
  data_inicio: Date
  data_fim?: Date
  
  // Estatísticas
  estatisticas: {
    total_envios: number
    total_emails: number
    total_whatsapp: number
    total_sms: number
    total_pagamentos_gerados: number
    valor_total_cobrado: number
    valor_total_recebido: number
    taxa_sucesso: number // %
    ultima_execucao?: Date
    proxima_execucao?: Date
  }
  
  // Logs de execução
  historico_execucoes: Array<{
    data: Date
    tipo: 'manual' | 'automatica'
    status: 'sucesso' | 'erro' | 'parcial'
    detalhes: string
    quantidade_envios: number
    tempo_execucao: number // em ms
    erros?: string[]
  }>
  
  // Dados de controle
  data_criacao: Date
  data_atualizacao: Date
  criado_por_id: mongoose.Types.ObjectId
  criado_por_nome: string
  ativo: boolean
}

const CobrancaAutomatizadaSchema: Schema = new Schema({
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
  nome: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  descricao: {
    type: String,
    trim: true,
    maxlength: 500
  },
  tipo_cobranca: {
    type: String,
    enum: ['taxa_condominio', 'taxa_extra', 'multa', 'juros', 'servicos', 'personalizada'],
    required: true
  },
  regras_disparo: {
    dias_antes_vencimento: { type: Number, min: 0, max: 90 },
    dias_apos_vencimento: { type: Number, min: 0, max: 365 },
    valor_minimo: { type: Number, min: 0 },
    apenas_inadimplentes: { type: Boolean, default: false },
    apenas_primeiros_avisos: { type: Boolean, default: true }
  },
  canais: {
    email: { type: Boolean, default: true },
    whatsapp: { type: Boolean, default: false },
    sms: { type: Boolean, default: false },
    notificacao_app: { type: Boolean, default: false }
  },
  template_email: {
    assunto: { type: String, maxlength: 200, default: 'Cobrança - {{nome_condominio}}' },
    corpo: { type: String, maxlength: 5000, default: 'Prezado {{nome_morador}}, você possui uma pendência no valor de {{valor}}' },
    incluir_boleto: { type: Boolean, default: true },
    incluir_qr_pix: { type: Boolean, default: true }
  },
  template_whatsapp: {
    mensagem: { type: String, maxlength: 1000, default: 'Olá {{nome_morador}}, você possui uma pendência de {{valor}} com vencimento em {{vencimento}}' },
    incluir_link_pagamento: { type: Boolean, default: true },
    incluir_qr_pix: { type: Boolean, default: true }
  },
  template_sms: {
    mensagem: { type: String, maxlength: 160, default: '{{nome_condominio}}: Pendência de {{valor}}. Venc: {{vencimento}}' },
    incluir_link_curto: { type: Boolean, default: true }
  },
  frequencia: {
    type: String,
    enum: ['unica', 'diaria', 'semanal', 'mensal'],
    default: 'unica'
  },
  horario_envio: {
    type: String,
    default: '09:00',
    match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
  },
  dias_semana: [{
    type: Number,
    min: 1,
    max: 7
  }],
  dia_mes: {
    type: Number,
    min: 1,
    max: 31
  },
  max_tentativas_por_cobranca: {
    type: Number,
    default: 3,
    min: 1,
    max: 10
  },
  intervalo_entre_tentativas: {
    type: Number,
    default: 24,
    min: 1,
    max: 168 // 1 semana
  },
  parar_apos_pagamento: {
    type: Boolean,
    default: true
  },
  filtros: {
    categorias_incluir: [{ type: String }],
    categorias_excluir: [{ type: String }],
    valores: {
      minimo: { type: Number, min: 0 },
      maximo: { type: Number, min: 0 }
    },
    unidades: [{ type: String }],
    blocos: [{ type: String }],
    tags_morador: [{ type: String }]
  },
  gerar_boleto_automatico: {
    type: Boolean,
    default: true
  },
  gerar_pix_automatico: {
    type: Boolean,
    default: true
  },
  valor_juros_diario: {
    type: Number,
    min: 0,
    max: 10,
    default: 0.1
  },
  valor_multa: {
    type: Number,
    min: 0,
    default: 2
  },
  tipo_multa: {
    type: String,
    enum: ['percentual', 'fixo'],
    default: 'percentual'
  },
  desconto_pagamento_antecipado: {
    type: Number,
    min: 0,
    max: 50
  },
  dias_desconto: {
    type: Number,
    min: 1,
    max: 30
  },
  ativa: {
    type: Boolean,
    default: true
  },
  pausada: {
    type: Boolean,
    default: false
  },
  data_inicio: {
    type: Date,
    default: Date.now
  },
  data_fim: {
    type: Date
  },
  estatisticas: {
    total_envios: { type: Number, default: 0 },
    total_emails: { type: Number, default: 0 },
    total_whatsapp: { type: Number, default: 0 },
    total_sms: { type: Number, default: 0 },
    total_pagamentos_gerados: { type: Number, default: 0 },
    valor_total_cobrado: { type: Number, default: 0 },
    valor_total_recebido: { type: Number, default: 0 },
    taxa_sucesso: { type: Number, default: 0, min: 0, max: 100 },
    ultima_execucao: { type: Date },
    proxima_execucao: { type: Date }
  },
  historico_execucoes: [{
    data: { type: Date, default: Date.now },
    tipo: { type: String, enum: ['manual', 'automatica'], required: true },
    status: { type: String, enum: ['sucesso', 'erro', 'parcial'], required: true },
    detalhes: { type: String, required: true },
    quantidade_envios: { type: Number, default: 0 },
    tempo_execucao: { type: Number, default: 0 },
    erros: [{ type: String }]
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
  collection: 'cobrancas-automatizadas'
})

// Índices
CobrancaAutomatizadaSchema.index({ condominio_id: 1, ativa: 1 })
CobrancaAutomatizadaSchema.index({ 'estatisticas.proxima_execucao': 1, ativa: 1 })
CobrancaAutomatizadaSchema.index({ tipo_cobranca: 1 })

export default mongoose.models.CobrancaAutomatizada || mongoose.model<ICobrancaAutomatizada>('CobrancaAutomatizada', CobrancaAutomatizadaSchema)

// Variáveis disponíveis para templates
export const VARIAVEIS_TEMPLATE = {
  '{{nome_morador}}': 'Nome do morador',
  '{{nome_condominio}}': 'Nome do condomínio',
  '{{valor}}': 'Valor da cobrança formatado (R$ 1.500,00)',
  '{{valor_numero}}': 'Valor da cobrança sem formatação (1500.00)',
  '{{vencimento}}': 'Data de vencimento formatada (15/12/2023)',
  '{{dias_atraso}}': 'Quantidade de dias em atraso',
  '{{apartamento}}': 'Número do apartamento',
  '{{bloco}}': 'Bloco do apartamento',
  '{{codigo_cobranca}}': 'Código único da cobrança',
  '{{link_pagamento}}': 'Link para portal de pagamento',
  '{{qr_pix}}': 'Código PIX para pagamento',
  '{{boleto_linha}}': 'Linha digitável do boleto',
  '{{telefone_condominio}}': 'Telefone do condomínio',
  '{{email_condominio}}': 'Email do condomínio'
}

// Função para substituir variáveis no template
export const substituirVariaveisTemplate = (template: string, dados: any): string => {
  let resultado = template

  Object.keys(VARIAVEIS_TEMPLATE).forEach(variavel => {
    const chave = variavel.replace('{{', '').replace('}}', '')
    if (dados[chave] !== undefined) {
      resultado = resultado.replace(new RegExp(variavel.replace(/[{}]/g, '\\$&'), 'g'), dados[chave])
    }
  })

  return resultado
}

// Função para validar configuração de cobrança
export const validarCobrancaAutomatizada = (config: Partial<ICobrancaAutomatizada>): { valida: boolean, erros: string[] } => {
  const erros: string[] = []

  if (!config.nome?.trim()) {
    erros.push('Nome da cobrança é obrigatório')
  }

  if (!config.tipo_cobranca) {
    erros.push('Tipo de cobrança é obrigatório')
  }

  if (!config.canais?.email && !config.canais?.whatsapp && !config.canais?.sms) {
    erros.push('Pelo menos um canal de comunicação deve estar ativo')
  }

  if (config.frequencia === 'semanal' && (!config.dias_semana || config.dias_semana.length === 0)) {
    erros.push('Para frequência semanal, é necessário especificar os dias da semana')
  }

  if (config.frequencia === 'mensal' && !config.dia_mes) {
    erros.push('Para frequência mensal, é necessário especificar o dia do mês')
  }

  return {
    valida: erros.length === 0,
    erros
  }
}