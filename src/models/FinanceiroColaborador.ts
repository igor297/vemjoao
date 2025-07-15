import mongoose, { Document, Schema } from 'mongoose'

export interface IFinanceiroColaborador extends Document {
  // Using MongoDB's default _id as primary identifier
  tipo: 'salario' | 'bonus' | 'desconto' | 'vale' | 'comissao' | 'hora_extra' | 'ferias' | 'decimo_terceiro'
  descricao: string
  valor: number
  data_vencimento: Date
  data_pagamento?: Date
  status: 'pendente' | 'pago' | 'atrasado' | 'cancelado'
  
  // Vinculação
  colaborador_id: mongoose.Types.ObjectId // Reference to Colaborador._id
  colaborador_nome: string
  colaborador_cargo?: string
  colaborador_cpf?: string | { encrypted: string; iv: string }
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
  mes_referencia?: string // Para salários e pagamentos mensais
  horas_trabalhadas?: number // Para cálculo de horas extras
  documento?: string
}

const FinanceiroColaboradorSchema: Schema = new Schema({
  tipo: {
    type: String,
    required: true,
    enum: ['salario', 'bonus', 'desconto', 'vale', 'comissao', 'hora_extra', 'ferias', 'decimo_terceiro'],
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
  colaborador_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Colaborador'
  },
  colaborador_nome: {
    type: String,
    required: true,
    trim: true
  },
  colaborador_cargo: {
    type: String,
    required: false,
    trim: true
  },
  colaborador_cpf: {
    type: mongoose.Schema.Types.Mixed,
    required: false
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
  mes_referencia: {
    type: String,
    required: false,
    trim: true
  },
  horas_trabalhadas: {
    type: Number,
    required: false,
    min: [0, 'Horas trabalhadas deve ser maior ou igual a 0']
  },
  documento: {
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
  collection: 'financeiro-colaboradores'
})

// Índices para otimização
FinanceiroColaboradorSchema.index({ condominio_id: 1, colaborador_id: 1, mes_referencia: 1 })
FinanceiroColaboradorSchema.index({ colaborador_id: 1, status: 1 })
FinanceiroColaboradorSchema.index({ tipo: 1, data_vencimento: 1 })

export default mongoose.models.FinanceiroColaborador || mongoose.model<IFinanceiroColaborador>('FinanceiroColaborador', FinanceiroColaboradorSchema)

// Função para verificar permissões do financeiro de colaboradores
export const verificarPermissaoFinanceiroColaborador = (
  acao: 'criar' | 'editar' | 'excluir' | 'ver',
  tipoUsuario: string,
  isProprioColaborador: boolean = false
) => {
  // Master, Síndico e Subsíndico podem tudo
  if (['master', 'sindico', 'subsindico'].includes(tipoUsuario)) {
    return true
  }
  
  // Conselheiro só pode ver
  if (tipoUsuario === 'conselheiro') {
    return acao === 'ver'
  }
  
  // Colaborador só pode ver seus próprios dados
  if (tipoUsuario === 'colaborador') {
    return acao === 'ver' && isProprioColaborador
  }
  
  // Outros não têm acesso
  return false
}