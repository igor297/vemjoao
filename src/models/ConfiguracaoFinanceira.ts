import mongoose, { Document, Schema } from 'mongoose'

export interface IConfiguracaoFinanceira extends Document {
  // Using MongoDB's default _id as primary identifier
  // id_configuracao kept for backward compatibility
  id_configuracao?: string
  condominio_id: mongoose.Types.ObjectId // Reference to Condominio._id
  master_id: mongoose.Types.ObjectId // Reference to Master._id
  
  // Configuração principal
  cobranca_automatica_ativa: boolean
  
  // APIs de pagamento habilitadas
  mercado_pago: {
    ativo: boolean
    access_token?: string
    public_key?: string
    taxa_boleto?: number // Percentual ou valor fixo
    taxa_pix?: number
    taxa_cartao_debito?: number
    taxa_cartao_credito?: number
    tipo_taxa: 'percentual' | 'fixo' // Se é % ou R$
  }
  
  stone: {
    ativo: boolean
    api_key?: string
    secret_key?: string
    taxa_boleto?: number
    taxa_pix?: number
    taxa_cartao_debito?: number
    taxa_cartao_credito?: number
    tipo_taxa: 'percentual' | 'fixo'
  }
  
  pagseguro: {
    ativo: boolean
    email?: string
    token?: string
    taxa_boleto?: number
    taxa_pix?: number
    taxa_cartao_debito?: number
    taxa_cartao_credito?: number
    tipo_taxa: 'percentual' | 'fixo'
  }
  
  // Configurações gerais
  configuracoes_gerais: {
    dias_vencimento_boleto: number // Padrão: 10 dias
    dias_vencimento_pix: number // Padrão: 1 dia
    juros_atraso_mes: number // Percentual mensal
    multa_atraso: number // Percentual fixo
    descricao_padrao_boleto: string
    instrucoes_boleto: string
  }
  
  // Dados de controle
  data_criacao: Date
  data_atualizacao: Date
  criado_por_id: mongoose.Types.ObjectId // Reference to user._id
  criado_por_nome: string
  ativo: boolean
}

const ConfiguracaoFinanceiraSchema: Schema = new Schema({
  // Keep id_configuracao for backward compatibility but make it optional
  id_configuracao: {
    type: String,
    required: false,
    unique: true,
    sparse: true, // Allows multiple null values
    default: () => new mongoose.Types.ObjectId().toString()
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
  cobranca_automatica_ativa: {
    type: Boolean,
    default: false
  },
  mercado_pago: {
    ativo: { type: Boolean, default: false },
    access_token: { type: String, required: false, trim: true },
    public_key: { type: String, required: false, trim: true },
    taxa_boleto: { type: Number, default: 0, min: 0 },
    taxa_pix: { type: Number, default: 0, min: 0 },
    taxa_cartao_debito: { type: Number, default: 0, min: 0 },
    taxa_cartao_credito: { type: Number, default: 0, min: 0 },
    tipo_taxa: { type: String, enum: ['percentual', 'fixo'], default: 'percentual', lowercase: true }
  },
  stone: {
    ativo: { type: Boolean, default: false },
    api_key: { type: String, required: false, trim: true },
    secret_key: { type: String, required: false, trim: true },
    taxa_boleto: { type: Number, default: 0, min: 0 },
    taxa_pix: { type: Number, default: 0, min: 0 },
    taxa_cartao_debito: { type: Number, default: 0, min: 0 },
    taxa_cartao_credito: { type: Number, default: 0, min: 0 },
    tipo_taxa: { type: String, enum: ['percentual', 'fixo'], default: 'percentual', lowercase: true }
  },
  pagseguro: {
    ativo: { type: Boolean, default: false },
    email: { type: String, required: false, lowercase: true, trim: true },
    token: { type: String, required: false, trim: true },
    taxa_boleto: { type: Number, default: 0, min: 0 },
    taxa_pix: { type: Number, default: 0, min: 0 },
    taxa_cartao_debito: { type: Number, default: 0, min: 0 },
    taxa_cartao_credito: { type: Number, default: 0, min: 0 },
    tipo_taxa: { type: String, enum: ['percentual', 'fixo'], default: 'percentual', lowercase: true }
  },
  configuracoes_gerais: {
    dias_vencimento_boleto: { type: Number, default: 10, min: 1, max: 30 },
    dias_vencimento_pix: { type: Number, default: 1, min: 1, max: 7 },
    juros_atraso_mes: { type: Number, default: 1, min: 0, max: 10 },
    multa_atraso: { type: Number, default: 2, min: 0, max: 10 },
    descricao_padrao_boleto: { type: String, default: 'Taxa Condominial', trim: true },
    instrucoes_boleto: { type: String, default: 'Pagamento da taxa condominial conforme regulamento interno.', trim: true }
  },
  data_criacao: {
    type: Date,
    default: Date.now
  },
  data_atualizacao: {
    type: Date,
    default: Date.now
  },
  criado_por_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  criado_por_nome: {
    type: String,
    required: true,
    trim: true
  },
  ativo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
})

// Índice para garantir uma configuração por condomínio
ConfiguracaoFinanceiraSchema.index({ condominio_id: 1 }, { unique: true })

export default mongoose.models.ConfiguracaoFinanceira || mongoose.model<IConfiguracaoFinanceira>('ConfiguracaoFinanceira', ConfiguracaoFinanceiraSchema)

// Função para verificar se o usuário pode acessar configurações financeiras
export const verificarPermissaoConfigFinanceira = (tipoUsuario: string) => {
  // Apenas Master pode acessar configurações financeiras
  return tipoUsuario === 'master'
}