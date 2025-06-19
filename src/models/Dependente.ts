import mongoose, { Document, Schema } from 'mongoose'

export interface IDependente extends Document {
  // Using MongoDB's default _id as primary identifier
  nome: string
  data_nasc: Date
  email?: string // Só se >= 18 anos
  senha?: string // Só se >= 18 anos
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

const DependenteSchema: Schema = new Schema({
  nome: {
    type: String,
    required: true,
    trim: true,
    minlength: [2, 'Nome deve ter pelo menos 2 caracteres'],
    maxlength: [100, 'Nome deve ter no máximo 100 caracteres']
  },
  data_nasc: {
    type: Date,
    required: true,
    validate: {
      validator: function(data: Date) {
        const hoje = new Date()
        return data < hoje
      },
      message: 'Data de nascimento deve ser anterior a hoje'
    }
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
DependenteSchema.methods.canBeViewedBy = function(userId: string, userType: string) {
  // Inquilino pode ver seus próprios dependentes
  if (this.inquilino_id && this.inquilino_id.toString() === userId) {
    return true
  }
  
  // Proprietário pode ver seus próprios dependentes, mas NÃO os do inquilino
  if (this.morador_id && this.morador_id.toString() === userId) {
    return true
  }
  
  // Adm, Master e Colaborador podem ver todos
  if (['adm', 'master', 'colaborador'].includes(userType.toLowerCase())) {
    return true
  }
  
  return false
}

DependenteSchema.methods.canBeEditedBy = function(userId: string, userType: string) {
  // Inquilino pode editar seus próprios dependentes
  if (this.inquilino_id && this.inquilino_id.toString() === userId) {
    return true
  }
  
  // Proprietário pode editar seus próprios dependentes, mas NÃO os do inquilino
  if (this.morador_id && this.morador_id.toString() === userId) {
    return true
  }
  
  // Adm, Master e Colaborador podem editar todos
  if (['adm', 'master', 'colaborador'].includes(userType.toLowerCase())) {
    return true
  }
  
  return false
}

// Validação para garantir que um dependente pertence a apenas um morador
DependenteSchema.pre('save', function(next) {
  if (this.morador_id && this.inquilino_id) {
    const error = new Error('Dependente não pode pertencer tanto ao proprietário quanto ao inquilino simultaneamente')
    return next(error)
  }
  
  if (!this.morador_id && !this.inquilino_id) {
    const error = new Error('Dependente deve pertencer a um proprietário OU a um inquilino')
    return next(error)
  }
  
  next()
})

// Índices para otimização
DependenteSchema.index({ condominio_id: 1, ativo: 1 })
DependenteSchema.index({ unidade: 1, bloco: 1, condominio_id: 1 })
DependenteSchema.index({ data_nasc: 1 })
DependenteSchema.index({ morador_id: 1 })
DependenteSchema.index({ inquilino_id: 1 })

export default mongoose.models.Dependente || mongoose.model<IDependente>('Dependente', DependenteSchema)