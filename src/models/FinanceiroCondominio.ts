import mongoose, { Document, Schema } from 'mongoose'

export interface IFinanceiroCondominio extends Document {
  tipo: 'receita' | 'despesa'
  categoria: string
  descricao: string
  valor: number
  data_vencimento: Date
  data_pagamento?: Date
  status: 'pendente' | 'pago' | 'atrasado' | 'cancelado'
  
  condominio_id: mongoose.Types.ObjectId
  master_id: mongoose.Types.ObjectId
  
  origem_sistema: 'colaborador' | 'morador' | 'manual'
  origem_id?: mongoose.Types.ObjectId
  origem_nome?: string
  origem_identificacao?: string  // CPF do colaborador ou identificação do morador
  bloco?: string
  apartamento?: string
  unidade?: string
  cargo?: string
  departamento?: string
  
  criado_por_tipo: 'master' | 'sindico' | 'subsindico'
  criado_por_id: mongoose.Types.ObjectId
  criado_por_nome: string
  data_criacao: Date
  data_atualizacao: Date
  ativo: boolean
  
  observacoes?: string
  recorrente: boolean
  periodicidade?: 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual'
  mes_referencia?: string
  
  sincronizado: boolean
  data_sincronizacao?: Date
  hash_origem?: string
}

const FinanceiroCondominioSchema: Schema = new Schema({
  tipo: {
    type: String,
    required: true,
    enum: ['receita', 'despesa']
  },
  categoria: {
    type: String,
    required: true,
    trim: true
  },
  descricao: {
    type: String,
    required: true,
    trim: true,
    maxlength: [300, 'Descrição deve ter no máximo 300 caracteres']
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
    default: 'pendente'
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
  origem_sistema: {
    type: String,
    required: true,
    enum: ['colaborador', 'morador', 'manual']
  },
  origem_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: false
  },
  origem_nome: {
    type: String,
    required: false,
    trim: true
  },
  origem_identificacao: {
    type: String,
    required: false,
    trim: true
  },
  bloco: {
    type: String,
    required: false,
    trim: true
  },
  apartamento: {
    type: String,
    required: false,
    trim: true
  },
  unidade: {
    type: String,
    required: false,
    trim: true
  },
  cargo: {
    type: String,
    required: false,
    trim: true
  },
  departamento: {
    type: String,
    required: false,
    trim: true
  },
  criado_por_tipo: {
    type: String,
    required: true,
    enum: ['master', 'sindico', 'subsindico']
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
  recorrente: {
    type: Boolean,
    default: false
  },
  periodicidade: {
    type: String,
    required: false,
    enum: ['mensal', 'bimestral', 'trimestral', 'semestral', 'anual']
  },
  mes_referencia: {
    type: String,
    required: false,
    trim: true
  },
  sincronizado: {
    type: Boolean,
    default: true
  },
  data_sincronizacao: {
    type: Date,
    default: Date.now
  },
  hash_origem: {
    type: String,
    required: false
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
  timestamps: true,
  collection: 'financeiro-condominio'
})

FinanceiroCondominioSchema.index({ condominio_id: 1, tipo: 1, status: 1 })
FinanceiroCondominioSchema.index({ origem_sistema: 1, origem_identificacao: 1, condominio_id: 1 })

export default mongoose.models.FinanceiroCondominio || mongoose.model<IFinanceiroCondominio>('FinanceiroCondominio', FinanceiroCondominioSchema)

export const gerarHashSincronizacao = (dados: any): string => {
  const { valor, data_vencimento, status, descricao } = dados
  return Buffer.from(`${valor}_${data_vencimento}_${status}_${descricao}`).toString('base64')
}