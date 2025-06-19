import mongoose, { Document, Schema } from 'mongoose'

export interface IFinanceiroMorador extends Document {
  // Using MongoDB's default _id as primary identifier
  tipo: 'receita' | 'despesa' | 'transferencia'
  categoria: 'taxa_condominio' | 'multa_atraso' | 'multa_infracao' | 'taxa_extra' | 'rateio_obra' | 'agua' | 'gas' | 'energia' | 'estacionamento' | 'multa_regulamento' | 'taxa_mudanca' | 'deposito_caucao' | 'outros'
  descricao: string
  valor: number
  data_vencimento: Date
  data_pagamento?: Date
  status: 'pendente' | 'pago' | 'atrasado' | 'cancelado'
  
  // Vinculação
  morador_id: mongoose.Types.ObjectId // Reference to Morador._id
  morador_nome: string
  apartamento: string
  bloco?: string
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
  recorrente: boolean
  periodicidade?: 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual'
  mes_referencia?: string // Para taxas mensais
  multa_atraso?: number // Valor adicional de multa por atraso
  juros_atraso?: number // Percentual de juros por atraso
  documento?: string
  codigo_barras?: string // Para boletos
}

const FinanceiroMoradorSchema: Schema = new Schema({
  tipo: {
    type: String,
    required: true,
    enum: ['receita', 'despesa', 'transferencia'],
    default: 'despesa'
  },
  categoria: {
    type: String,
    required: true,
    enum: ['taxa_condominio', 'multa_atraso', 'multa_infracao', 'taxa_extra', 'rateio_obra', 'agua', 'gas', 'energia', 'estacionamento', 'multa_regulamento', 'taxa_mudanca', 'deposito_caucao', 'outros']
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
  morador_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Morador'
  },
  morador_nome: {
    type: String,
    required: true,
    trim: true
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
  multa_atraso: {
    type: Number,
    required: false,
    min: [0, 'Multa de atraso deve ser maior ou igual a 0']
  },
  juros_atraso: {
    type: Number,
    required: false,
    min: [0, 'Juros de atraso deve ser maior ou igual a 0'],
    max: [100, 'Juros de atraso deve ser menor ou igual a 100%']
  },
  documento: {
    type: String,
    required: false,
    trim: true
  },
  codigo_barras: {
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
  timestamps: true,
  collection: 'financeiro-moradores'
})

// Índices para otimização
FinanceiroMoradorSchema.index({ condominio_id: 1, status: 1, data_vencimento: 1 })
FinanceiroMoradorSchema.index({ morador_id: 1, status: 1 })
FinanceiroMoradorSchema.index({ mes_referencia: 1, condominio_id: 1 })

export default mongoose.models.FinanceiroMorador || mongoose.model<IFinanceiroMorador>('FinanceiroMorador', FinanceiroMoradorSchema)

// Função para verificar permissões do financeiro de moradores
export const verificarPermissaoFinanceiroMorador = (
  acao: 'criar' | 'editar' | 'excluir' | 'ver',
  tipoUsuario: string,
  isProprioMorador: boolean = false
) => {
  // Master, Síndico e Subsíndico podem tudo
  if (['master', 'sindico', 'subsindico'].includes(tipoUsuario)) {
    return true
  }
  
  // Conselheiro só pode ver
  if (tipoUsuario === 'conselheiro') {
    return acao === 'ver'
  }
  
  // Morador, inquilino, cônjuge, dependente só podem ver seus próprios dados
  if (['morador', 'inquilino', 'conjuge', 'dependente'].includes(tipoUsuario)) {
    return acao === 'ver' && isProprioMorador
  }
  
  // Outros não têm acesso
  return false
}