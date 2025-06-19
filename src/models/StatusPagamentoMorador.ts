import mongoose, { Document, Schema } from 'mongoose'

export interface IStatusPagamentoMorador extends Document {
  // Using MongoDB's default _id as primary identifier
  // id_status kept for backward compatibility
  id_status?: string
  condominio_id: mongoose.Types.ObjectId // Reference to Condominio._id
  master_id: mongoose.Types.ObjectId // Reference to Master._id
  morador_id: mongoose.Types.ObjectId // Reference to Morador._id
  apartamento: string
  bloco?: string
  
  // Dados do morador
  nome_morador: string
  tipo_morador: 'morador' | 'inquilino' | 'conjuge' | 'dependente'
  email?: string
  telefone?: string
  
  // Status financeiro
  status_pagamento: 'em_dia' | 'proximo_vencimento' | 'atrasado' | 'isento'
  valor_pendente: number
  valor_total_mes: number
  data_ultimo_pagamento?: Date
  data_proximo_vencimento: Date
  dias_atraso: number
  
  // Detalhes da situação
  descricao_situacao: string
  observacoes?: string
  
  // Configurações de pagamento automático
  pagamento_automatico_ativo: boolean
  forma_pagamento_preferida?: 'boleto' | 'pix' | 'cartao_debito' | 'cartao_credito'
  
  // Histórico de notificações
  ultima_notificacao?: Date
  notificacoes_enviadas: number
  
  // Controle
  data_atualizacao: Date
  atualizado_por_id: mongoose.Types.ObjectId // Reference to user._id
  atualizado_por_nome: string
  ativo: boolean
}

const StatusPagamentoMoradorSchema: Schema = new Schema({
  // Keep id_status for backward compatibility but make it optional
  id_status: {
    type: String,
    required: false,
    unique: true,
    sparse: true, // Allows multiple null values
    default: () => new mongoose.Types.ObjectId().toString()
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
  morador_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Morador'
  },
  apartamento: {
    type: String,
    required: true,
    trim: true
  },
  bloco: {
    type: String,
    required: false,
    trim: true
  },
  nome_morador: {
    type: String,
    required: true,
    trim: true
  },
  tipo_morador: {
    type: String,
    enum: ['morador', 'inquilino', 'conjuge', 'dependente'],
    required: true,
    lowercase: true
  },
  email: {
    type: String,
    required: false,
    lowercase: true,
    trim: true
  },
  telefone: {
    type: String,
    required: false,
    trim: true
  },
  status_pagamento: {
    type: String,
    enum: ['em_dia', 'proximo_vencimento', 'atrasado', 'isento'],
    required: true,
    lowercase: true
  },
  valor_pendente: {
    type: Number,
    default: 0,
    min: [0, 'Valor pendente deve ser maior ou igual a 0']
  },
  valor_total_mes: {
    type: Number,
    required: true,
    min: [0, 'Valor total do mês deve ser maior ou igual a 0']
  },
  data_ultimo_pagamento: {
    type: Date,
    required: false
  },
  data_proximo_vencimento: {
    type: Date,
    required: true
  },
  dias_atraso: {
    type: Number,
    default: 0,
    min: [0, 'Dias de atraso deve ser maior ou igual a 0']
  },
  descricao_situacao: {
    type: String,
    required: true,
    trim: true
  },
  observacoes: {
    type: String,
    required: false,
    trim: true
  },
  pagamento_automatico_ativo: {
    type: Boolean,
    default: false
  },
  forma_pagamento_preferida: {
    type: String,
    enum: ['boleto', 'pix', 'cartao_debito', 'cartao_credito'],
    required: false,
    lowercase: true
  },
  ultima_notificacao: {
    type: Date,
    required: false
  },
  notificacoes_enviadas: {
    type: Number,
    default: 0,
    min: [0, 'Número de notificações deve ser maior ou igual a 0']
  },
  data_atualizacao: {
    type: Date,
    default: Date.now
  },
  atualizado_por_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  atualizado_por_nome: {
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
  collection: 'status-pagamento-moradores'
})

// Índices para otimização
StatusPagamentoMoradorSchema.index({ condominio_id: 1, status_pagamento: 1 })
StatusPagamentoMoradorSchema.index({ morador_id: 1 }, { unique: true })
StatusPagamentoMoradorSchema.index({ data_proximo_vencimento: 1, status_pagamento: 1 })

export default mongoose.models.StatusPagamentoMorador || mongoose.model<IStatusPagamentoMorador>('StatusPagamentoMorador', StatusPagamentoMoradorSchema)

// Função para calcular status baseado na data de vencimento
export const calcularStatusPagamento = (dataVencimento: Date, valorPendente: number): {
  status: 'em_dia' | 'proximo_vencimento' | 'atrasado' | 'isento',
  diasAtraso: number,
  descricao: string
} => {
  const hoje = new Date()
  const vencimento = new Date(dataVencimento)
  const diffTime = vencimento.getTime() - hoje.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (valorPendente === 0) {
    return {
      status: 'em_dia',
      diasAtraso: 0,
      descricao: 'Pagamento em dia - Sem pendências'
    }
  }
  
  if (diffDays < 0) {
    const diasAtraso = Math.abs(diffDays)
    return {
      status: 'atrasado',
      diasAtraso,
      descricao: `Pagamento em atraso há ${diasAtraso} dia(s)`
    }
  }
  
  if (diffDays <= 5) {
    return {
      status: 'proximo_vencimento',
      diasAtraso: 0,
      descricao: `Vencimento em ${diffDays} dia(s)`
    }
  }
  
  return {
    status: 'em_dia',
    diasAtraso: 0,
    descricao: 'Pagamento em dia'
  }
}

// Função para atualizar status automaticamente
export const atualizarStatusAutomatico = async (condominioId: string, masterId: string) => {
  // Esta função seria implementada no backend para atualizar todos os status
  // baseado nos dados financeiros atuais
  return {
    success: true,
    atualizados: 0
  }
}