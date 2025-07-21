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
    minlength: [6, 'Senha deve ter pelo menos 6 caracteres']
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
    required: false,
    default: '',
    validate: {
      validator: function(v: string) {
        return !v || /^\(\d{2}\)\s\d{4,5}-\d{4}$/.test(v)
      },
      message: 'Celular deve estar no formato (XX) XXXXX-XXXX'
    }
  },
  // Campos adicionais para compatibilidade
  cpf: {
    type: String,
    required: false,
    default: ''
  },
  cnpj: {
    type: String,
    required: false,
    default: ''
  },
  status: {
    type: String,
    required: false,
    default: 'teste'
  },
  dataCriacao: {
    type: String,
    required: false,
    default: ''
  },
  horaCriacao: {
    type: String,
    required: false,
    default: ''
  },
  dataHoraCriacao: {
    type: String,
    required: false,
    default: ''
  },
  dataHoraUltimaAtualizacao: {
    type: String,
    required: false,
    default: ''
  },
  dataUltimaAtualizacao: {
    type: String,
    required: false,
    default: ''
  },
  horaUltimaAtualizacao: {
    type: String,
    required: false,
    default: ''
  },
  data_criacao: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
})

export default mongoose.models.Master || mongoose.model<IMaster>('Master', MasterSchema, 'masters')