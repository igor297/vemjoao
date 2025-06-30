import mongoose, { Document, Schema } from 'mongoose'

export interface IImobiliaria extends Document {
  // Using MongoDB's default _id as primary identifier
  nome: string
  cnpj: string
  email: string
  telefone1: string
  telefone2?: string
  endereco?: any
  responsavel_nome: string
  responsavel_celular: string
  responsavel_email: string
  condominio_id: mongoose.Types.ObjectId // Reference to Condominio._id
  master_id: mongoose.Types.ObjectId // Reference to Master._id
  data_criacao: Date
  ativo: boolean
  observacoes?: string
}

const ImobiliariaSchema: Schema = new Schema({
  nome: {
    type: String,
    required: true,
    trim: true,
    minlength: [2, 'Nome deve ter pelo menos 2 caracteres'],
    maxlength: [100, 'Nome deve ter no máximo 100 caracteres']
  },
  cnpj: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(cnpj: string) {
        // Remove pontos, barras e hífens
        cnpj = cnpj.replace(/[^\d]/g, '')
        
        // Aceita qualquer formato de CNPJ com 14 dígitos
        if (cnpj.length !== 14) return false
        
        return true
      },
      message: 'CNPJ deve ter 14 dígitos'
    }
  },
  email: {
    type: String,
    required: true,
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
  telefone1: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(telefone: string) {
        const phoneRegex = /^\(\d{2}\)\s\d{4,5}-\d{4}$/
        return phoneRegex.test(telefone)
      },
      message: 'Formato de telefone inválido. Use: (XX) XXXXX-XXXX'
    }
  },
  telefone2: {
    type: String,
    required: false,
    trim: true,
    validate: {
      validator: function(telefone: string) {
        if (!telefone) return true
        const phoneRegex = /^\(\d{2}\)\s\d{4,5}-\d{4}$/
        return phoneRegex.test(telefone)
      },
      message: 'Formato de telefone inválido. Use: (XX) XXXXX-XXXX'
    }
  },
  endereco: {
    type: mongoose.Schema.Types.Mixed,
    required: false,
    default: {}
  },
  responsavel_nome: {
    type: String,
    required: true,
    trim: true,
    minlength: [2, 'Nome do responsável deve ter pelo menos 2 caracteres'],
    maxlength: [100, 'Nome do responsável deve ter no máximo 100 caracteres']
  },
  responsavel_celular: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(celular: string) {
        const phoneRegex = /^\(\d{2}\)\s\d{4,5}-\d{4}$/
        return phoneRegex.test(celular)
      },
      message: 'Formato de celular inválido. Use: (XX) XXXXX-XXXX'
    }
  },
  responsavel_email: {
    type: String,
    required: true,
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
  timestamps: true
})

// Índices para otimização
ImobiliariaSchema.index({ condominio_id: 1, ativo: 1 })

export default mongoose.models.Imobiliaria || mongoose.model<IImobiliaria>('Imobiliaria', ImobiliariaSchema)