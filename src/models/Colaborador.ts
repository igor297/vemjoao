import mongoose, { Document, Schema } from 'mongoose'

export interface IColaborador extends Document {
  // Using MongoDB's default _id as primary identifier
  nome: string
  cpf: string
  data_nasc: Date
  celular1: string
  celular2?: string
  email: string
  senha: string
  data_inicio: Date
  data_fim?: Date
  condominio_id: mongoose.Types.ObjectId // Reference to Condominio._id
  // Campos de endereço
  cep?: string
  logradouro?: string
  estado?: string
  cidade?: string
  numero?: string
  complemento?: string
  observacoes?: string
  // Campos profissionais
  cargo?: string
  salario?: number
  tipo_contrato?: string
  jornada_trabalho?: string
  departamento?: string
  supervisor?: string
  // Dependentes
  dependentes?: string
  // Contato de emergência
  contato_emergencia_nome?: string
  contato_emergencia_telefone?: string
  contato_emergencia_parentesco?: string
  // Documentos e informações
  rg?: string
  pis?: string
  ctps?: string
  escolaridade?: string
  estado_civil?: string
  observacoes_profissionais?: string
  // Documentos digitalizados
  foto_perfil?: string
  foto_rg_frente?: string
  foto_rg_verso?: string
  foto_cpf?: string
  foto_ctps?: string
  foto_comprovante_residencia?: string
  outros_documentos?: string[]
  master_id: mongoose.Types.ObjectId // Reference to Master._id
  data_criacao: Date
  ativo: boolean
}

const ColaboradorSchema: Schema = new Schema({
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
  celular1: {
    type: String,
    required: true
  },
  celular2: {
    type: String,
    required: false
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  senha: {
    type: String,
    required: true
  },
  data_inicio: {
    type: Date,
    required: true
  },
  data_fim: {
    type: Date,
    required: false
  },
  condominio_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Condominio'
  },
  // Campos de endereço
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
  // Campos profissionais
  cargo: {
    type: String,
    required: false,
    trim: true
  },
  salario: {
    type: Number,
    required: false
  },
  tipo_contrato: {
    type: String,
    required: false,
    trim: true
  },
  jornada_trabalho: {
    type: String,
    required: false,
    trim: true
  },
  departamento: {
    type: String,
    required: false,
    trim: true
  },
  supervisor: {
    type: String,
    required: false,
    trim: true
  },
  // Dependentes
  dependentes: {
    type: String,
    required: false,
    maxlength: 1000
  },
  // Contato de emergência
  contato_emergencia_nome: {
    type: String,
    required: false,
    trim: true
  },
  contato_emergencia_telefone: {
    type: String,
    required: false,
    trim: true
  },
  contato_emergencia_parentesco: {
    type: String,
    required: false,
    trim: true
  },
  // Documentos e informações
  rg: {
    type: String,
    required: false,
    trim: true
  },
  pis: {
    type: String,
    required: false,
    trim: true
  },
  ctps: {
    type: String,
    required: false,
    trim: true
  },
  escolaridade: {
    type: String,
    required: false,
    trim: true
  },
  estado_civil: {
    type: String,
    required: false,
    trim: true
  },
  observacoes_profissionais: {
    type: String,
    required: false,
    maxlength: 500
  },
  // Documentos digitalizados
  foto_perfil: {
    type: String,
    required: false
  },
  foto_rg_frente: {
    type: String,
    required: false
  },
  foto_rg_verso: {
    type: String,
    required: false
  },
  foto_cpf: {
    type: String,
    required: false
  },
  foto_ctps: {
    type: String,
    required: false
  },
  foto_comprovante_residencia: {
    type: String,
    required: false
  },
  outros_documentos: {
    type: [String],
    required: false,
    default: []
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
  collection: 'colaboradores'
})

// Índices para otimização e performance
ColaboradorSchema.index({ master_id: 1, ativo: 1 }) // 🚀 Performance: filtro principal
ColaboradorSchema.index({ master_id: 1, condominio_id: 1 }) // 🚀 Performance: filtro por condomínio
ColaboradorSchema.index({ condominio_id: 1, ativo: 1 })
ColaboradorSchema.index({ email: 1 }, { unique: true })
ColaboradorSchema.index({ cpf: 1 })
ColaboradorSchema.index({ data_criacao: -1 }) // 🚀 Performance: ordenação

export default mongoose.models.Colaborador || mongoose.model<IColaborador>('Colaborador', ColaboradorSchema)