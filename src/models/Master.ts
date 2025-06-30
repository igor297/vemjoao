import mongoose, { Document, Schema } from 'mongoose'

export interface IMaster extends Document {
  // Using MongoDB's default _id as primary identifier
  // id_master kept for backward compatibility
  id_master?: string
  nome: string
  email: string
  senha: string
  celular1: string
  celular2: string
  data_criacao: Date
}

const MasterSchema: Schema = new Schema({
  // Keep id_master for backward compatibility but make it optional
  id_master: {
    type: String,
    required: false,
    unique: true,
    sparse: true // Allows multiple null values
  },
  nome: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(email: string) {
        return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)
      },
      message: 'Email deve ter um formato válido'
    }
  },
  senha: {
    type: String,
    required: true,
    minlength: [8, 'Senha deve ter pelo menos 8 caracteres'],
    validate: {
      validator: function(senha: string) {
        // Senha deve ter pelo menos 8 caracteres, incluindo: maiúscula, minúscula, número e caractere especial
        return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s])[^\s]{8,}$/.test(senha)
      },
      message: 'Senha deve ter pelo menos 8 caracteres, incluindo: maiúscula, minúscula, número e caractere especial'
    }
  },
  celular1: {
    type: String,
    required: true,
    validate: {
      validator: function(v: string) {
        return /^\(\d{2}\)\s\d{4,5}-\d{4}$/.test(v)
      },
      message: 'Celular deve estar no formato (XX) XXXXX-XXXX'
    }
  },
  celular2: {
    type: String,
    required: true,
    validate: {
      validator: function(v: string) {
        return /^\(\d{2}\)\s\d{4,5}-\d{4}$/.test(v)
      },
      message: 'Celular deve estar no formato (XX) XXXXX-XXXX'
    }
  },
  data_criacao: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
})

export default mongoose.models.Master || mongoose.model<IMaster>('Master', MasterSchema)