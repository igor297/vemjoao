import mongoose, { Document, Schema } from 'mongoose';

export interface IWebhookRetry extends Document {
  // Identificação
  webhook_id: string;
  provider: 'mercado_pago' | 'stone' | 'pagseguro';
  webhook_type: string;
  request_id?: string;
  
  // Dados originais
  payload: any;
  headers: Record<string, string>;
  signature?: string;
  
  // Controle de retry
  tentativas: number;
  max_tentativas: number;
  ultimo_erro?: string;
  stack_trace?: string;
  status: 'pendente' | 'processando' | 'sucesso' | 'falha_permanente' | 'cancelado';
  
  // Datas
  primeiro_processamento: Date;
  ultimo_processamento?: Date;
  proxima_tentativa?: Date;
  data_sucesso?: Date;
  data_cancelamento?: Date;
  
  // Logs das tentativas
  logs_tentativas: {
    tentativa: number;
    timestamp: Date;
    sucesso: boolean;
    erro?: string;
    duracao_ms: number;
    response_status?: number;
  }[];
  
  // Metadata
  condominio_id?: mongoose.Types.ObjectId;
  transacao_id?: mongoose.Types.ObjectId;
  metadata: any;
  
  // Timestamps
  created_at: Date;
  updated_at: Date;
}

const LogTentativaSchema = new Schema({
  tentativa: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
  sucesso: { type: Boolean, required: true },
  erro: String,
  duracao_ms: { type: Number, required: true },
  response_status: Number
}, { _id: false });

const WebhookRetrySchema = new Schema<IWebhookRetry>({
  // Identificação
  webhook_id: { 
    type: String, 
    required: true,
    index: true
  },
  provider: { 
    type: String, 
    enum: ['mercado_pago', 'stone', 'pagseguro'],
    required: true,
    index: true
  },
  webhook_type: { 
    type: String, 
    required: true 
  },
  request_id: String,
  
  // Dados originais
  payload: { 
    type: Schema.Types.Mixed, 
    required: true 
  },
  headers: { 
    type: Map, 
    of: String 
  },
  signature: String,
  
  // Controle de retry
  tentativas: { 
    type: Number, 
    default: 0,
    min: 0
  },
  max_tentativas: { 
    type: Number, 
    default: 5,
    min: 1,
    max: 10
  },
  ultimo_erro: String,
  stack_trace: String,
  status: { 
    type: String, 
    enum: ['pendente', 'processando', 'sucesso', 'falha_permanente', 'cancelado'],
    default: 'pendente',
    index: true
  },
  
  // Datas
  primeiro_processamento: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  ultimo_processamento: Date,
  proxima_tentativa: { 
    type: Date, 
    index: true
  },
  data_sucesso: Date,
  data_cancelamento: Date,
  
  // Logs das tentativas
  logs_tentativas: [LogTentativaSchema],
  
  // Metadata
  condominio_id: { 
    type: Schema.Types.ObjectId, 
    ref: 'Condominio' 
  },
  transacao_id: { 
    type: Schema.Types.ObjectId, 
    ref: 'Transacao' 
  },
  metadata: { 
    type: Schema.Types.Mixed 
  },
  
  // Timestamps
  created_at: { 
    type: Date, 
    default: Date.now 
  },
  updated_at: { 
    type: Date, 
    default: Date.now 
  }
});

// Índices compostos para performance
WebhookRetrySchema.index({ status: 1, proxima_tentativa: 1 });
WebhookRetrySchema.index({ provider: 1, webhook_type: 1, created_at: -1 });
WebhookRetrySchema.index({ condominio_id: 1, created_at: -1 });

// Middleware para atualizar updated_at
WebhookRetrySchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

// Método para calcular próxima tentativa com backoff exponencial
WebhookRetrySchema.methods.calcularProximaTentativa = function() {
  const baseDelay = 60000; // 1 minuto
  const exponentialDelay = Math.pow(2, this.tentativas) * baseDelay;
  const maxDelay = 30 * 60 * 1000; // 30 minutos máximo
  
  const delay = Math.min(exponentialDelay, maxDelay);
  
  this.proxima_tentativa = new Date(Date.now() + delay);
  return this.proxima_tentativa;
};

// Método para adicionar log de tentativa
WebhookRetrySchema.methods.adicionarLogTentativa = function(sucesso: boolean, erro?: string, duracao_ms?: number, response_status?: number) {
  this.logs_tentativas.push({
    tentativa: this.tentativas + 1,
    timestamp: new Date(),
    sucesso,
    erro,
    duracao_ms: duracao_ms || 0,
    response_status
  });
};

// Método para marcar como sucesso
WebhookRetrySchema.methods.marcarSucesso = function() {
  this.status = 'sucesso';
  this.data_sucesso = new Date();
  this.ultimo_processamento = new Date();
  this.proxima_tentativa = undefined;
};

// Método para marcar como falha permanente
WebhookRetrySchema.methods.marcarFalhaPermanente = function(erro: string) {
  this.status = 'falha_permanente';
  this.ultimo_erro = erro;
  this.ultimo_processamento = new Date();
  this.proxima_tentativa = undefined;
};

// Método para verificar se deve tentar novamente
WebhookRetrySchema.methods.deveReitentar = function() {
  return this.tentativas < this.max_tentativas && 
         this.status === 'pendente' && 
         (!this.proxima_tentativa || this.proxima_tentativa <= new Date());
};

export default mongoose.models.WebhookRetry || mongoose.model<IWebhookRetry>('WebhookRetry', WebhookRetrySchema);