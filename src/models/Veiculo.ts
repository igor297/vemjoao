import mongoose, { Document, Schema } from 'mongoose'

export interface IVeiculo extends Document {
  // Using MongoDB's default _id as primary identifier
  tipo: 'carro' | 'moto' | 'bicicleta' | 'outro'
  placa: string
  modelo?: string
  cor?: string
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

const VeiculoSchema: Schema = new Schema({
  tipo: {
    type: String,
    required: true,
    enum: ['carro', 'moto', 'bicicleta', 'outro'],
    lowercase: true
  },
  placa: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    validate: {
      validator: function(placa: string) {
        if (!placa) return false
        
        console.log('Validating placa:', placa)
        
        // Remove espaços e converte para maiúsculo
        const cleanPlaca = placa.trim().toUpperCase().replace(/\s+/g, '')
        
        console.log('Clean placa:', cleanPlaca)
        
        // Aceita formato antigo ABC-1234 ou ABC1234 ou novo ABC1D23
        const placaAntigaRegex = /^[A-Z]{3}[-]?\d{4}$/
        const placaNovaRegex = /^[A-Z]{3}\d{1}[A-Z]{1}\d{2}$/
        
        const isAntigaValid = placaAntigaRegex.test(cleanPlaca)
        const isNovaValid = placaNovaRegex.test(cleanPlaca)
        
        console.log('Antiga format valid:', isAntigaValid)
        console.log('Nova format valid:', isNovaValid)
        
        return isAntigaValid || isNovaValid
      },
      message: 'Formato de placa inválido. Use ABC-1234 ou ABC1D23'
    }
  },
  modelo: {
    type: String,
    required: false,
    trim: true,
    maxlength: [50, 'Modelo deve ter no máximo 50 caracteres']
  },
  cor: {
    type: String,
    required: false,
    trim: true,
    maxlength: [20, 'Cor deve ter no máximo 20 caracteres']
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
  timestamps: true
})

// Métodos de privacidade e permissões
VeiculoSchema.methods.canBeViewedBy = function(userId: string, userType: string) {
  // Inquilino pode ver seus próprios veículos
  if (this.inquilino_id && this.inquilino_id.toString() === userId) {
    return true
  }
  
  // Proprietário pode ver seus próprios veículos, mas NÃO os do inquilino
  if (this.morador_id && this.morador_id.toString() === userId) {
    return true
  }
  
  // Adm, Master e Colaborador podem ver todos
  if (['adm', 'master', 'colaborador'].includes(userType.toLowerCase())) {
    return true
  }
  
  return false
}

VeiculoSchema.methods.canBeEditedBy = function(userId: string, userType: string) {
  // Inquilino pode editar seus próprios veículos
  if (this.inquilino_id && this.inquilino_id.toString() === userId) {
    return true
  }
  
  // Proprietário pode editar seus próprios veículos, mas NÃO os do inquilino
  if (this.morador_id && this.morador_id.toString() === userId) {
    return true
  }
  
  // Adm, Master e Colaborador podem editar todos
  if (['adm', 'master', 'colaborador'].includes(userType.toLowerCase())) {
    return true
  }
  
  return false
}

// Validação para garantir que um veículo pertence a apenas um morador
VeiculoSchema.pre('save', function(next) {
  if (this.morador_id && this.inquilino_id) {
    const error = new Error('Veículo não pode pertencer tanto ao proprietário quanto ao inquilino simultaneamente')
    return next(error)
  }
  
  if (!this.morador_id && !this.inquilino_id) {
    const error = new Error('Veículo deve pertencer a um proprietário OU a um inquilino')
    return next(error)
  }
  
  next()
})

// Índices para otimização e performance
VeiculoSchema.index({ master_id: 1, ativo: 1 }) // 🚀 Performance: filtro principal
VeiculoSchema.index({ master_id: 1, condominio_id: 1 }) // 🚀 Performance: filtro por condomínio
VeiculoSchema.index({ condominio_id: 1, ativo: 1 })
VeiculoSchema.index({ placa: 1 }, { unique: true })
VeiculoSchema.index({ unidade: 1, bloco: 1, condominio_id: 1 })
VeiculoSchema.index({ morador_id: 1 })
VeiculoSchema.index({ inquilino_id: 1 })
VeiculoSchema.index({ data_criacao: -1 }) // 🚀 Performance: ordenação

export default mongoose.models.Veiculo || mongoose.model<IVeiculo>('Veiculo', VeiculoSchema)