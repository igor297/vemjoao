import mongoose, { Document, Schema } from 'mongoose'

export interface IAdm extends Document {
  // Using MongoDB's default _id as primary identifier
  nome: string
  cpf: string
  data_nasc: Date
  tipo: 'sindico' | 'subsindico' | 'conselheiro'
  email: string
  senha: string
  data_inicio: Date
  data_fim?: Date
  condominio_id: mongoose.Types.ObjectId // Reference to Condominio._id
  bloco?: string
  unidade?: string
  celular1?: string
  celular2?: string
  // Campos de endereço para ADM não-interno
  cep?: string
  logradouro?: string
  estado?: string
  cidade?: string
  numero?: string
  complemento?: string
  observacoes?: string
  master_id: mongoose.Types.ObjectId // Reference to Master._id
  data_criacao: Date
  adm_interno: boolean
  morador_origem_id?: mongoose.Types.ObjectId // Reference to Morador._id
}

const AdmSchema: Schema = new Schema({
  nome: {
    type: String,
    required: true,
    trim: true
  },
  cpf: {
    type: String,
    required: true
  },
  data_nasc: {
    type: Date,
    required: true
  },
  tipo: {
    type: String,
    required: true,
    enum: ['sindico', 'subsindico', 'conselheiro'],
    lowercase: true
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
  data_inicio: {
    type: Date,
    required: true
  },
  data_fim: {
    type: Date,
    validate: {
      validator: function(v: Date) {
        return !v || v > this.data_inicio
      },
      message: 'Data fim deve ser posterior à data início'
    }
  },
  condominio_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Condominio'
  },
  bloco: {
    type: String,
    required: false
  },
  unidade: {
    type: String,
    required: false
  },
  celular1: {
    type: String,
    required: false
  },
  celular2: {
    type: String,
    required: false
  },
  // Campos de endereço para ADM não-interno
  cep: {
    type: String,
    required: false,
    validate: {
      validator: function(v: string) {
        return !v || /^\d{5}-?\d{3}$/.test(v)
      },
      message: 'CEP deve estar no formato 12345-678 ou 12345678'
    }
  },
  logradouro: {
    type: String,
    required: false,
    trim: true
  },
  estado: {
    type: String,
    required: false,
    maxlength: 2,
    uppercase: true
  },
  cidade: {
    type: String,
    required: false,
    trim: true
  },
  numero: {
    type: String,
    required: false,
    trim: true
  },
  complemento: {
    type: String,
    required: false,
    trim: true
  },
  observacoes: {
    type: String,
    required: false,
    maxlength: 500
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
  adm_interno: {
    type: Boolean,
    default: false
  },
  morador_origem_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
    ref: 'Morador'
  }
}, {
  timestamps: true,
  collection: 'adms'
})

// Índices para otimização e performance
AdmSchema.index({ master_id: 1, ativo: 1 }) // 🚀 Performance: filtro principal
AdmSchema.index({ master_id: 1, condominio_id: 1 }) // 🚀 Performance: filtro por condomínio
AdmSchema.index({ cpf: 1, condominio_id: 1 })
AdmSchema.index({ condominio_id: 1, tipo: 1, ativo: 1 }) // 🚀 Performance: filtro por tipo
AdmSchema.index({ data_criacao: -1 }) // 🚀 Performance: ordenação

// Índice composto para garantir apenas um síndico ativo por condomínio
AdmSchema.index(
  { condominio_id: 1, tipo: 1, data_fim: 1 }, 
  { 
    unique: true, 
    partialFilterExpression: { 
      tipo: 'sindico', 
      data_fim: { $exists: false } 
    } 
  }
)

export default mongoose.models.Adm || mongoose.model<IAdm>('Adm', AdmSchema)