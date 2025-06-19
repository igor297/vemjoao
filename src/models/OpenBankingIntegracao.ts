import mongoose, { Document, Schema } from 'mongoose'

export interface IOpenBankingIntegracao extends Document {
  // Identificação
  condominio_id: mongoose.Types.ObjectId
  master_id: mongoose.Types.ObjectId
  conta_bancaria_id: mongoose.Types.ObjectId

  // Dados do provedor Open Banking
  provedor: 'pluggy' | 'belvo' | 'iugu' | 'stone' | 'custom'
  provedor_id_externo: string
  
  // Configurações de conexão
  client_id?: string
  client_secret?: string // Criptografado
  access_token?: string // Criptografado
  refresh_token?: string // Criptografado
  expires_at?: Date
  
  // Status da integração
  status: 'ativa' | 'inativa' | 'erro' | 'pendente_autorizacao' | 'expirada'
  ultimo_erro?: string
  ultima_sincronizacao: Date
  proxima_sincronizacao: Date
  
  // Configurações de sincronização
  auto_sync: boolean
  frequencia_sync: 'tempo_real' | 'horaria' | 'diaria' | 'semanal'
  horario_sync?: string // Para sincronização agendada
  
  // Dados do banco integrado
  banco_codigo: string
  banco_nome: string
  agencia: string
  conta: string
  
  // Permissões
  permissoes: {
    ler_saldo: boolean
    ler_extratos: boolean
    ler_investimentos: boolean
    fazer_transferencias: boolean
    pagar_boletos: boolean
  }
  
  // Configurações de filtragem
  filtros: {
    valor_minimo?: number
    categorias_ignorar?: string[]
    descricoes_ignorar?: string[]
    sincronizar_apenas_dias_uteis?: boolean
  }
  
  // Estatísticas
  total_transacoes_importadas: number
  total_reconciliacoes_automaticas: number
  taxa_sucesso_reconciliacao: number
  
  // Dados de controle
  data_criacao: Date
  data_atualizacao: Date
  criado_por_id: mongoose.Types.ObjectId
  criado_por_nome: string
  ativo: boolean
}

const OpenBankingIntegracaoSchema: Schema = new Schema({
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
  conta_bancaria_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'ContaBancaria'
  },
  provedor: {
    type: String,
    enum: ['pluggy', 'belvo', 'iugu', 'stone', 'custom'],
    required: true
  },
  provedor_id_externo: {
    type: String,
    required: true,
    trim: true
  },
  client_id: {
    type: String,
    trim: true
  },
  client_secret: {
    type: String,
    trim: true
  },
  access_token: {
    type: String,
    trim: true
  },
  refresh_token: {
    type: String,
    trim: true
  },
  expires_at: {
    type: Date
  },
  status: {
    type: String,
    enum: ['ativa', 'inativa', 'erro', 'pendente_autorizacao', 'expirada'],
    default: 'pendente_autorizacao'
  },
  ultimo_erro: {
    type: String,
    trim: true
  },
  ultima_sincronizacao: {
    type: Date,
    default: Date.now
  },
  proxima_sincronizacao: {
    type: Date,
    default: Date.now
  },
  auto_sync: {
    type: Boolean,
    default: true
  },
  frequencia_sync: {
    type: String,
    enum: ['tempo_real', 'horaria', 'diaria', 'semanal'],
    default: 'diaria'
  },
  horario_sync: {
    type: String,
    default: '06:00'
  },
  banco_codigo: {
    type: String,
    required: true,
    trim: true
  },
  banco_nome: {
    type: String,
    required: true,
    trim: true
  },
  agencia: {
    type: String,
    required: true,
    trim: true
  },
  conta: {
    type: String,
    required: true,
    trim: true
  },
  permissoes: {
    ler_saldo: { type: Boolean, default: true },
    ler_extratos: { type: Boolean, default: true },
    ler_investimentos: { type: Boolean, default: false },
    fazer_transferencias: { type: Boolean, default: false },
    pagar_boletos: { type: Boolean, default: false }
  },
  filtros: {
    valor_minimo: { type: Number, min: 0 },
    categorias_ignorar: [{ type: String }],
    descricoes_ignorar: [{ type: String }],
    sincronizar_apenas_dias_uteis: { type: Boolean, default: false }
  },
  total_transacoes_importadas: {
    type: Number,
    default: 0,
    min: 0
  },
  total_reconciliacoes_automaticas: {
    type: Number,
    default: 0,
    min: 0
  },
  taxa_sucesso_reconciliacao: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
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
  collection: 'open-banking-integracoes'
})

// Índices
OpenBankingIntegracaoSchema.index({ condominio_id: 1, ativo: 1 })
OpenBankingIntegracaoSchema.index({ conta_bancaria_id: 1 })
OpenBankingIntegracaoSchema.index({ status: 1, proxima_sincronizacao: 1 })

export default mongoose.models.OpenBankingIntegracao || mongoose.model<IOpenBankingIntegracao>('OpenBankingIntegracao', OpenBankingIntegracaoSchema)

// Tipos de transação do Open Banking
export interface TransacaoOpenBanking {
  id_externo: string
  data_transacao: Date
  valor: number
  tipo: 'credito' | 'debito'
  descricao: string
  categoria?: string
  saldo_antes: number
  saldo_depois: number
  codigo_transacao?: string
  historico_completo?: string
  dados_originais: any // JSON com dados completos da API
}

// Funções auxiliares
export const calcularProximaSincronizacao = (frequencia: string, horario?: string): Date => {
  const agora = new Date()
  const proxima = new Date()

  switch (frequencia) {
    case 'horaria':
      proxima.setHours(agora.getHours() + 1, 0, 0, 0)
      break
    case 'diaria':
      const [hora, minuto] = (horario || '06:00').split(':')
      proxima.setDate(agora.getDate() + 1)
      proxima.setHours(parseInt(hora), parseInt(minuto), 0, 0)
      break
    case 'semanal':
      proxima.setDate(agora.getDate() + 7)
      if (horario) {
        const [hora, minuto] = horario.split(':')
        proxima.setHours(parseInt(hora), parseInt(minuto), 0, 0)
      }
      break
    default: // tempo_real
      proxima.setMinutes(agora.getMinutes() + 15) // A cada 15 minutos
  }

  return proxima
}

export const validarConfiguracaoOpenBanking = (config: Partial<IOpenBankingIntegracao>): { valida: boolean, erros: string[] } => {
  const erros: string[] = []

  if (!config.provedor) {
    erros.push('Provedor é obrigatório')
  }

  if (!config.provedor_id_externo?.trim()) {
    erros.push('ID externo do provedor é obrigatório')
  }

  if (!config.banco_codigo?.trim()) {
    erros.push('Código do banco é obrigatório')
  }

  if (!config.agencia?.trim()) {
    erros.push('Agência é obrigatória')
  }

  if (!config.conta?.trim()) {
    erros.push('Conta é obrigatória')
  }

  return {
    valida: erros.length === 0,
    erros
  }
}