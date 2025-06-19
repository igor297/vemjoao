import mongoose, { Document, Schema } from 'mongoose'

export interface IAnimal extends Document {
  // Using MongoDB's default _id as primary identifier
  tipo: 'cao' | 'gato' | 'passaro' | 'peixe' | 'outro'
  nome: string
  raca?: string
  idade?: number
  observacoes?: string
  condominio_id: mongoose.Types.ObjectId // Reference to Condominio._id
  condominio_nome?: string
  bloco?: string
  unidade: string
  morador_id?: mongoose.Types.ObjectId // Reference to Morador._id
  inquilino_id?: mongoose.Types.ObjectId // Reference to Morador._id (inquilino)
  master_id: mongoose.Types.ObjectId // Reference to Master._id
  data_criacao: Date
  ativo: boolean
}

const AnimalSchema: Schema = new Schema({
  tipo: {
    type: String,
    required: true,
    enum: ['cao', 'gato', 'passaro', 'peixe', 'outro'],
    lowercase: true
  },
  nome: {
    type: String,
    required: true,
    trim: true,
    minlength: [1, 'Nome é obrigatório'],
    maxlength: [50, 'Nome deve ter no máximo 50 caracteres']
  },
  raca: {
    type: String,
    required: false,
    trim: true,
    maxlength: [50, 'Raça deve ter no máximo 50 caracteres']
  },
  idade: {
    type: Number,
    required: false,
    min: [0, 'Idade deve ser maior ou igual a 0'],
    max: [50, 'Idade deve ser menor ou igual a 50']
  },
  observacoes: {
    type: String,
    required: false,
    trim: true,
    maxlength: [500, 'Observações devem ter no máximo 500 caracteres']
  },
  condominio_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Condominio'
  },
  condominio_nome: {
    type: String,
    required: false,
    trim: true
  },
  bloco: {
    type: String,
    required: false,
    trim: true,
    maxlength: [10, 'Bloco deve ter no máximo 10 caracteres']
  },
  unidade: {
    type: String,
    required: true,
    trim: true,
    minlength: [1, 'Unidade é obrigatória'],
    maxlength: [20, 'Unidade deve ter no máximo 20 caracteres']
  },
  morador_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
    ref: 'Morador'
  },
  inquilino_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
    ref: 'Morador'
  },
  master_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Master'
  },
  data_criacao: {
    type: Date,
    default: Date.now
  },
  ativo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'animais'
})

// Métodos de privacidade e permissões
AnimalSchema.methods.canBeViewedBy = function(userId: string, userType: string) {
  // Inquilino pode ver seus próprios animais
  if (this.inquilino_id && this.inquilino_id.toString() === userId) {
    return true
  }
  
  // Proprietário pode ver seus próprios animais, mas NÃO os do inquilino
  if (this.morador_id && this.morador_id.toString() === userId) {
    return true
  }
  
  // Adm, Master e Colaborador podem ver todos
  if (['adm', 'master', 'colaborador'].includes(userType.toLowerCase())) {
    return true
  }
  
  return false
}

AnimalSchema.methods.canBeEditedBy = function(userId: string, userType: string) {
  // Inquilino pode editar seus próprios animais
  if (this.inquilino_id && this.inquilino_id.toString() === userId) {
    return true
  }
  
  // Proprietário pode editar seus próprios animais, mas NÃO os do inquilino
  if (this.morador_id && this.morador_id.toString() === userId) {
    return true
  }
  
  // Adm, Master e Colaborador podem editar todos
  if (['adm', 'master', 'colaborador'].includes(userType.toLowerCase())) {
    return true
  }
  
  return false
}

// Validação para garantir que um animal pertence a apenas um morador
AnimalSchema.pre('save', function(next) {
  if (this.morador_id && this.inquilino_id) {
    const error = new Error('Animal não pode pertencer tanto ao proprietário quanto ao inquilino simultaneamente')
    return next(error)
  }
  
  if (!this.morador_id && !this.inquilino_id) {
    const error = new Error('Animal deve pertencer a um proprietário OU a um inquilino')
    return next(error)
  }
  
  next()
})

// Índices para otimização
AnimalSchema.index({ condominio_id: 1, ativo: 1 })
AnimalSchema.index({ unidade: 1, bloco: 1, condominio_id: 1 })
AnimalSchema.index({ morador_id: 1 })
AnimalSchema.index({ inquilino_id: 1 })

export default mongoose.models.Animal || mongoose.model<IAnimal>('Animal', AnimalSchema)