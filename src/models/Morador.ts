import mongoose, { Document, Schema } from 'mongoose'

export interface IMorador extends Document {
  // Using MongoDB's default _id as primary identifier
  nome: string
  cpf: string | { encrypted: string; iv: string }
  data_nasc: Date
  celular1: string
  celular2?: string
  email: string
  senha: string
  tipo: 'proprietario' | 'inquilino' | 'dependente'
  unidade: string // Ex: "Apto 101", "Casa 15", etc.
  bloco?: string // Para condominios com blocos
  data_inicio: Date
  data_fim?: Date
  responsavel_id?: mongoose.Types.ObjectId // Reference to Morador._id (para dependentes)
  proprietario_id?: mongoose.Types.ObjectId // Reference to Morador._id (para inquilinos)
  imobiliaria_id?: mongoose.Types.ObjectId // Reference to Imobiliaria._id (para inquilinos)
  condominio_id: mongoose.Types.ObjectId // Reference to Condominio._id
  master_id: mongoose.Types.ObjectId // Reference to Master._id
  data_criacao: Date
  ativo: boolean
  observacoes?: string
}

const MoradorSchema: Schema = new Schema({
  nome: {
    type: String,
    required: true,
    trim: true,
    minlength: [2, 'Nome deve ter pelo menos 2 caracteres'],
    maxlength: [100, 'Nome deve ter no máximo 100 caracteres']
  },
  cpf: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    unique: true
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
  celular1: {
    type: String,
    required: true,
    validate: {
      validator: function(celular: string) {
        const phoneRegex = /^\(\d{2}\)\s\d{4,5}-\d{4}$/
        return phoneRegex.test(celular)
      },
      message: 'Formato de celular inválido. Use: (XX) XXXXX-XXXX'
    }
  },
  celular2: {
    type: String,
    required: false,
    validate: {
      validator: function(celular: string) {
        if (!celular) return true
        const phoneRegex = /^\(\d{2}\)\s\d{4,5}-\d{4}$/
        return phoneRegex.test(celular)
      },
      message: 'Formato de celular inválido. Use: (XX) XXXXX-XXXX'
    }
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(email: string) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return emailRegex.test(email)
      },
      message: 'Email inválido'
    }
  },
  senha: {
    type: String,
    required: true,
    minlength: [6, 'Senha deve ter pelo menos 6 caracteres']
  },
  tipo: {
    type: String,
    required: true,
    enum: ['proprietario', 'inquilino', 'dependente'],
    lowercase: true
  },
  unidade: {
    type: String,
    required: true,
    trim: true,
    minlength: [1, 'Unidade é obrigatória'],
    maxlength: [20, 'Unidade deve ter no máximo 20 caracteres']
  },
  bloco: {
    type: String,
    required: false,
    trim: true,
    maxlength: [10, 'Bloco deve ter no máximo 10 caracteres']
  },
  data_inicio: {
    type: Date,
    required: true
  },
  data_fim: {
    type: Date,
    required: false,
    validate: {
      validator: function(v: Date) {
        return !v || v > this.data_inicio
      },
      message: 'Data fim deve ser posterior à data início'
    }
  },
  responsavel_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
    ref: 'Morador',
    validate: {
      validator: function(v: any) {
        // Aceita null, undefined ou ObjectId válido
        return !v || v === '' || mongoose.Types.ObjectId.isValid(v)
      },
      message: 'ID do responsável deve ser um ObjectId válido'
    }
  },
  proprietario_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
    ref: 'Morador',
    validate: {
      validator: function(v: any) {
        // Aceita null, undefined ou ObjectId válido
        return !v || v === '' || mongoose.Types.ObjectId.isValid(v)
      },
      message: 'ID do proprietário deve ser um ObjectId válido'
    }
  },
  imobiliaria_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
    ref: 'Imobiliaria',
    validate: {
      validator: function(v: any) {
        // Aceita null, undefined ou ObjectId válido
        return !v || v === '' || mongoose.Types.ObjectId.isValid(v)
      },
      message: 'ID da imobiliária deve ser um ObjectId válido'
    }
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
  timestamps: true,
  collection: 'moradores'
})

// Índices para otimização e performance
MoradorSchema.index({ master_id: 1, ativo: 1 }) // 🚀 Performance: filtro principal
MoradorSchema.index({ master_id: 1, condominio_id: 1 }) // 🚀 Performance: filtro por condomínio
MoradorSchema.index({ condominio_id: 1, ativo: 1 })
MoradorSchema.index({ condominio_id: 1, tipo: 1, ativo: 1 }) // 🚀 Performance: filtro por tipo
MoradorSchema.index({ unidade: 1, bloco: 1, condominio_id: 1 })
MoradorSchema.index({ data_criacao: -1 }) // 🚀 Performance: ordenação

export default mongoose.models.Morador || mongoose.model<IMorador>('Morador', MoradorSchema)