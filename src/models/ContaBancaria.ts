import mongoose, { Document, Schema } from 'mongoose'

export interface IContaBancaria extends Document {
  // Using MongoDB's default _id as primary identifier
  condominio_id: mongoose.Types.ObjectId // Reference to Condominio._id
  master_id: mongoose.Types.ObjectId // Reference to Master._id
  
  // Dados da conta
  nome_conta: string // Nome identificador da conta (ex: "Conta Principal", "Conta Reserva")
  banco: string
  codigo_banco: string // Código do banco (001, 237, etc.)
  agencia: string
  numero_conta: string
  digito_conta: string
  tipo_conta: 'corrente' | 'poupanca'
  
  // Dados do titular
  titular_nome: string
  titular_documento: string // CPF ou CNPJ
  titular_tipo: 'cpf' | 'cnpj'
  
  // PIX
  chave_pix?: string
  tipo_chave_pix?: 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria'
  
  // Status
  ativa: boolean // Se a conta está ativa/disponível
  conta_principal: boolean // Se é a conta principal ativa no momento
  
  // Configurações
  aceita_boleto: boolean
  aceita_pix: boolean
  aceita_ted_doc: boolean
  limite_pix_diario?: number
  
  // Observações
  observacoes?: string
  
  // Controle
  data_criacao: Date
  data_atualizacao: Date
  criado_por_id: mongoose.Types.ObjectId // Reference to user._id
  criado_por_nome: string
  ativo: boolean
}

const ContaBancariaSchema: Schema = new Schema({
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
  nome_conta: {
    type: String,
    required: true,
    trim: true
  },
  banco: {
    type: String,
    required: true,
    trim: true
  },
  codigo_banco: {
    type: String,
    required: true,
    trim: true
  },
  agencia: {
    type: String,
    required: true,
    trim: true
  },
  numero_conta: {
    type: String,
    required: true,
    trim: true
  },
  digito_conta: {
    type: String,
    required: true,
    trim: true
  },
  tipo_conta: {
    type: String,
    enum: ['corrente', 'poupanca'],
    required: true,
    lowercase: true
  },
  titular_nome: {
    type: String,
    required: true,
    trim: true
  },
  titular_documento: {
    type: String,
    required: true,
    trim: true
  },
  titular_tipo: {
    type: String,
    enum: ['cpf', 'cnpj'],
    required: true,
    lowercase: true
  },
  chave_pix: {
    type: String,
    trim: true,
    required: false
  },
  tipo_chave_pix: {
    type: String,
    enum: ['cpf', 'cnpj', 'email', 'telefone', 'aleatoria'],
    required: false,
    lowercase: true
  },
  ativa: {
    type: Boolean,
    default: true
  },
  conta_principal: {
    type: Boolean,
    default: false
  },
  aceita_boleto: {
    type: Boolean,
    default: true
  },
  aceita_pix: {
    type: Boolean,
    default: true
  },
  aceita_ted_doc: {
    type: Boolean,
    default: true
  },
  limite_pix_diario: {
    type: Number,
    min: [0, 'Limite PIX diário deve ser maior ou igual a 0'],
    required: false
  },
  observacoes: {
    type: String,
    trim: true,
    required: false
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
  timestamps: true,
  collection: 'contas-bancarias'
})

// Índices para otimização
ContaBancariaSchema.index({ condominio_id: 1, ativa: 1 })
ContaBancariaSchema.index({ condominio_id: 1, conta_principal: 1 })

export default mongoose.models.ContaBancaria || mongoose.model<IContaBancaria>('ContaBancaria', ContaBancariaSchema)

// Lista de bancos brasileiros
export const BANCOS_BRASILEIROS = [
  { codigo: '001', nome: 'Banco do Brasil' },
  { codigo: '237', nome: 'Bradesco' },
  { codigo: '341', nome: 'Itaú' },
  { codigo: '104', nome: 'Caixa Econômica Federal' },
  { codigo: '033', nome: 'Santander' },
  { codigo: '745', nome: 'Citibank' },
  { codigo: '399', nome: 'HSBC' },
  { codigo: '655', nome: 'Banco Votorantim' },
  { codigo: '707', nome: 'Banco Daycoval' },
  { codigo: '077', nome: 'Banco Inter' },
  { codigo: '260', nome: 'Nu Pagamentos (Nubank)' },
  { codigo: '323', nome: 'Mercado Pago' },
  { codigo: '290', nome: 'PagSeguro' },
  { codigo: '336', nome: 'C6 Bank' },
  { codigo: '364', nome: 'Gerencianet Pagamentos' },
  { codigo: '380', nome: 'PicPay' }
]

// Função para validar conta bancária
export const validarContaBancaria = (conta: Partial<IContaBancaria>): { valida: boolean, erros: string[] } => {
  const erros: string[] = []

  if (!conta.nome_conta?.trim()) {
    erros.push('Nome da conta é obrigatório')
  }

  if (!conta.banco?.trim()) {
    erros.push('Banco é obrigatório')
  }

  if (!conta.codigo_banco?.trim()) {
    erros.push('Código do banco é obrigatório')
  }

  if (!conta.agencia?.trim()) {
    erros.push('Agência é obrigatória')
  }

  if (!conta.numero_conta?.trim()) {
    erros.push('Número da conta é obrigatório')
  }

  if (!conta.digito_conta?.trim()) {
    erros.push('Dígito da conta é obrigatório')
  }

  if (!conta.titular_nome?.trim()) {
    erros.push('Nome do titular é obrigatório')
  }

  if (!conta.titular_documento?.trim()) {
    erros.push('Documento do titular é obrigatório')
  }

  // Validar CPF/CNPJ básico
  if (conta.titular_documento) {
    const doc = conta.titular_documento.replace(/\D/g, '')
    if (conta.titular_tipo === 'cpf' && doc.length !== 11) {
      erros.push('CPF deve ter 11 dígitos')
    } else if (conta.titular_tipo === 'cnpj' && doc.length !== 14) {
      erros.push('CNPJ deve ter 14 dígitos')
    }
  }

  return {
    valida: erros.length === 0,
    erros
  }
}

// Função para formatar número da conta
export const formatarNumeroConta = (numero: string, digito: string): string => {
  return `${numero}-${digito}`
}

// Função para obter conta principal ativa
export const obterContaPrincipal = async (condominioId: string, masterId: string) => {
  // Esta função seria implementada no backend
  return null
}