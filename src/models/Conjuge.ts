import mongoose, { Document, Schema } from 'mongoose'

export interface IConjuge extends Document {
  // Using MongoDB's default _id as primary identifier
  nome: string
  email?: string
  senha?: string
  condominio_id: mongoose.Types.ObjectId // Reference to Condominio._id
  condominio_nome?: string
  bloco?: string
  unidade: string
  morador_id?: mongoose.Types.ObjectId // Reference to Morador._id
  inquilino_id?: mongoose.Types.ObjectId // Reference to Morador._id (inquilino)
  master_id: mongoose.Types.ObjectId // Reference to Master._id
  data_criacao: Date
  ativo: boolean
  observacoes?: string
}

const ConjugeSchema: Schema = new Schema({
  nome: {
    type: String,
    required: true,
    trim: true,
    minlength: [2, 'Nome deve ter pelo menos 2 caracteres'],
    maxlength: [100, 'Nome deve ter no máximo 100 caracteres']
  },
  email: {
    type: String,
    required: false,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(email: string) {
        if (!email) return true
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return emailRegex.test(email)
      },
      message: 'Email inválido'
    }
  },
  senha: {
    type: String,
    required: false,
    minlength: [6, 'Senha deve ter pelo menos 6 caracteres']
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
  },
  observacoes: {
    type: String,
    required: false,
    trim: true,
    maxlength: [500, 'Observações devem ter no máximo 500 caracteres']
  }
}, {
  timestamps: true
})

// Métodos de privacidade e permissões
ConjugeSchema.methods.canBeViewedBy = function(userId: string, userType: string) {
  // Inquilino pode ver seus próprios cônjuges
  if (this.inquilino_id && this.inquilino_id.toString() === userId) {
    return true
  }
  
  // Proprietário pode ver seus próprios cônjuges, mas NÃO os do inquilino
  if (this.morador_id && this.morador_id.toString() === userId) {
    return true
  }
  
  // Adm, Master e Colaborador podem ver todos
  if (['adm', 'master', 'colaborador'].includes(userType.toLowerCase())) {
    return true
  }
  
  return false
}

ConjugeSchema.methods.canBeEditedBy = function(userId: string, userType: string) {
  // Inquilino pode editar seus próprios cônjuges
  if (this.inquilino_id && this.inquilino_id.toString() === userId) {
    return true
  }
  
  // Proprietário pode editar seus próprios cônjuges, mas NÃO os do inquilino
  if (this.morador_id && this.morador_id.toString() === userId) {
    return true
  }
  
  // Adm, Master e Colaborador podem editar todos
  if (['adm', 'master', 'colaborador'].includes(userType.toLowerCase())) {
    return true
  }
  
  return false
}

// Validação para garantir que um cônjuge pertence a apenas um morador
ConjugeSchema.pre('save', function(next) {
  if (this.morador_id && this.inquilino_id) {
    const error = new Error('Cônjuge não pode pertencer tanto ao proprietário quanto ao inquilino simultaneamente')
    return next(error)
  }
  
  if (!this.morador_id && !this.inquilino_id) {
    const error = new Error('Cônjuge deve pertencer a um proprietário OU a um inquilino')
    return next(error)
  }
  
  next()
})

// Índices para otimização
ConjugeSchema.index({ condominio_id: 1, ativo: 1 })
ConjugeSchema.index({ unidade: 1, bloco: 1, condominio_id: 1 })
ConjugeSchema.index({ morador_id: 1 })
ConjugeSchema.index({ inquilino_id: 1 })

export default mongoose.models.Conjuge || mongoose.model<IConjuge>('Conjuge', ConjugeSchema)