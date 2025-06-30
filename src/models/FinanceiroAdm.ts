import mongoose, { Document, Schema } from 'mongoose'

export interface IFinanceiroAdm extends Document {
  // Identificação
  tipo: 'despesa_administrativa' | 'taxa_gestao' | 'comissao' | 'consultoria' | 'auditoria' | 'juridico' | 'contabil'
  descricao: string
  valor: number
  data_vencimento: Date
  data_pagamento?: Date
  status: 'pendente' | 'pago' | 'atrasado' | 'cancelado'
  
  // Vinculação
  adm_id?: mongoose.Types.ObjectId // Reference to Adm._id (quando aplicável)
  adm_nome?: string
  condominio_id: mongoose.Types.ObjectId // Reference to Condominio._id
  master_id: mongoose.Types.ObjectId // Reference to Master._id
  
  // Dados de controle
  criado_por_tipo: 'master' | 'sindico' | 'subsindico'
  criado_por_id: mongoose.Types.ObjectId // Reference to user._id
  criado_por_nome: string
  data_criacao: Date
  data_atualizacao: Date
  ativo: boolean
  
  // Dados específicos
  observacoes?: string
  documento?: string
  numero_contrato?: string
  periodo_referencia?: string // Para taxas de gestão mensais
}

const FinanceiroAdmSchema: Schema = new Schema({
  tipo: {
    type: String,
    required: true,
    enum: ['despesa_administrativa', 'taxa_gestao', 'comissao', 'consultoria', 'auditoria', 'juridico', 'contabil'],
    lowercase: true
  },
  descricao: {
    type: String,
    required: true,
    trim: true,
    minlength: [5, 'Descrição deve ter pelo menos 5 caracteres'],
    maxlength: [200, 'Descrição deve ter no máximo 200 caracteres']
  },
  valor: {
    type: Number,
    required: true,
    min: [0, 'Valor deve ser maior ou igual a 0']
  },
  data_vencimento: {
    type: Date,
    required: true
  },
  data_pagamento: {
    type: Date,
    required: false
  },
  status: {
    type: String,
    required: true,
    enum: ['pendente', 'pago', 'atrasado', 'cancelado'],
    default: 'pendente',
    lowercase: true
  },
  adm_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
    ref: 'Adm'
  },
  adm_nome: {
    type: String,
    required: false,
    trim: true
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
  criado_por_tipo: {
    type: String,
    required: true,
    enum: ['master', 'sindico', 'subsindico'],
    lowercase: true
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
  observacoes: {
    type: String,
    required: false,
    trim: true,
    maxlength: [500, 'Observações devem ter no máximo 500 caracteres']
  },
  documento: {
    type: String,
    required: false,
    trim: true
  },
  numero_contrato: {
    type: String,
    required: false,
    trim: true
  },
  periodo_referencia: {
    type: String,
    required: false,
    trim: true
  },
  data_criacao: {
    type: Date,
    default: Date.now
  },
  data_atualizacao: {
    type: Date,
    default: Date.now
  },
  ativo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
})

// Índices para otimização
FinanceiroAdmSchema.index({ condominio_id: 1, tipo: 1, data_vencimento: 1 })
FinanceiroAdmSchema.index({ adm_id: 1, status: 1 })
FinanceiroAdmSchema.index({ master_id: 1, periodo_referencia: 1 })

export default mongoose.models.FinanceiroAdm || mongoose.model<IFinanceiroAdm>('FinanceiroAdm', FinanceiroAdmSchema)

// Função para verificar permissões do financeiro administrativo
export const verificarPermissaoFinanceiroAdm = (
  acao: 'criar' | 'editar' | 'excluir' | 'ver',
  tipoUsuario: string
) => {
  // Apenas Master pode fazer tudo
  if (tipoUsuario === 'master') {
    return true
  }
  
  // Síndico pode ver e criar (não editar/excluir contratos importantes)
  if (tipoUsuario === 'sindico') {
    return ['ver', 'criar'].includes(acao)
  }
  
  // Outros não têm acesso
  return false
}