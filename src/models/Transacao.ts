import mongoose, { Document, Schema } from 'mongoose';
import { ObjectId } from 'mongodb';

export interface ITransacao extends Document {
  // Identificação
  id_transacao: string;
  referencia_externa: string;
  tipo_origem: 'financeiro_morador' | 'financeiro_condominio' | 'financeiro_colaborador';
  origem_id: ObjectId;
  condominio_id: ObjectId;
  
  // Dados da transação
  valor_original: number;
  valor_final: number;
  valor_taxas: number;
  valor_desconto: number;
  valor_juros: number;
  valor_multa: number;
  
  // Gateway e pagamento
  gateway_provider: 'mercado_pago' | 'stone' | 'pagseguro' | 'pix_manual' | 'transferencia' | 'dinheiro';
  payment_id: string;
  metodo_pagamento: 'pix' | 'boleto' | 'cartao_credito' | 'cartao_debito' | 'transferencia' | 'dinheiro';
  parcelas: number;
  
  // Status e rastreamento
  status: 'pendente' | 'processando' | 'aprovado' | 'rejeitado' | 'cancelado' | 'estornado' | 'expirado';
  status_detalhado: string;
  tentativas_processamento: number;
  
  // Dados do pagamento
  dados_pagamento: {
    qr_code?: string;
    linha_digitavel?: string;
    codigo_barras?: string;
    link_pagamento?: string;
    token_cartao?: string;
    nsu?: string;
    tid?: string;
    authorization_code?: string;
  };
  
  // Webhooks e confirmações
  webhook_received: boolean;
  webhook_data: any[];
  confirmacao_automatica: boolean;
  confirmacao_manual: boolean;
  confirmado_por?: ObjectId;
  
  // Datas importantes
  data_criacao: Date;
  data_vencimento: Date;
  data_processamento?: Date;
  data_confirmacao?: Date;
  data_cancelamento?: Date;
  
  // Auditoria e logs
  logs_transacao: {
    timestamp: Date;
    evento: string;
    detalhes: any;
    usuario_id?: ObjectId;
    ip_address?: string;
  }[];
  
  // Reconciliação bancária
  reconciliado: boolean;
  extrato_bancario_id?: ObjectId;
  data_reconciliacao?: Date;
  
  // Fiscal e contábil
  categoria_contabil: string;
  centro_custo?: string;
  codigo_receita?: string;
  retem_imposto: boolean;
  impostos_retidos: {
    tipo: 'IRRF' | 'CSLL' | 'COFINS' | 'PIS' | 'ISS';
    valor: number;
    aliquota: number;
  }[];
  
  // Metadata
  metadata: any;
  observacoes?: string;
  documento_fiscal?: string;
  
  // Timestamps
  created_at: Date;
  updated_at: Date;
}

const LogTransacaoSchema = new Schema({
  timestamp: { type: Date, default: Date.now },
  evento: { type: String, required: true },
  detalhes: { type: Schema.Types.Mixed },
  usuario_id: { type: Schema.Types.ObjectId, ref: 'User' },
  ip_address: String
});

const ImpostoRetidoSchema = new Schema({
  tipo: { 
    type: String, 
    enum: ['IRRF', 'CSLL', 'COFINS', 'PIS', 'ISS'],
    required: true 
  },
  valor: { type: Number, required: true },
  aliquota: { type: Number, required: true }
});

const DadosPagamentoSchema = new Schema({
  qr_code: String,
  linha_digitavel: String,
  codigo_barras: String,
  link_pagamento: String,
  token_cartao: String,
  nsu: String,
  tid: String,
  authorization_code: String
}, { _id: false });

const TransacaoSchema = new Schema<ITransacao>({
  // Identificação
  id_transacao: { 
    type: String, 
    required: true, 
    unique: true,
    default: () => `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`
  },
  referencia_externa: String,
  tipo_origem: { 
    type: String, 
    enum: ['financeiro_morador', 'financeiro_condominio', 'financeiro_colaborador'],
    required: true 
  },
  origem_id: { type: Schema.Types.ObjectId, required: true },
  condominio_id: { type: Schema.Types.ObjectId, ref: 'Condominio', required: true },
  
  // Dados da transação
  valor_original: { type: Number, required: true, min: 0.01 },
  valor_final: { type: Number, required: true, min: 0.01 },
  valor_taxas: { type: Number, default: 0, min: 0 },
  valor_desconto: { type: Number, default: 0, min: 0 },
  valor_juros: { type: Number, default: 0, min: 0 },
  valor_multa: { type: Number, default: 0, min: 0 },
  
  // Gateway e pagamento
  gateway_provider: { 
    type: String, 
    enum: ['mercado_pago', 'stone', 'pagseguro', 'pix_manual', 'transferencia', 'dinheiro'],
    required: true 
  },
  payment_id: String,
  metodo_pagamento: { 
    type: String, 
    enum: ['pix', 'boleto', 'cartao_credito', 'cartao_debito', 'transferencia', 'dinheiro'],
    required: true 
  },
  parcelas: { type: Number, default: 1, min: 1, max: 12 },
  
  // Status e rastreamento
  status: { 
    type: String, 
    enum: ['pendente', 'processando', 'aprovado', 'rejeitado', 'cancelado', 'estornado', 'expirado'],
    default: 'pendente' 
  },
  status_detalhado: String,
  tentativas_processamento: { type: Number, default: 0 },
  
  // Dados do pagamento
  dados_pagamento: DadosPagamentoSchema,
  
  // Webhooks e confirmações
  webhook_received: { type: Boolean, default: false },
  webhook_data: [{ type: Schema.Types.Mixed }],
  confirmacao_automatica: { type: Boolean, default: false },
  confirmacao_manual: { type: Boolean, default: false },
  confirmado_por: { type: Schema.Types.ObjectId, ref: 'User' },
  
  // Datas importantes
  data_criacao: { type: Date, default: Date.now },
  data_vencimento: { type: Date, required: true },
  data_processamento: Date,
  data_confirmacao: Date,
  data_cancelamento: Date,
  
  // Auditoria e logs
  logs_transacao: [LogTransacaoSchema],
  
  // Reconciliação bancária
  reconciliado: { type: Boolean, default: false },
  extrato_bancario_id: { type: Schema.Types.ObjectId, ref: 'ExtratoBancario' },
  data_reconciliacao: Date,
  
  // Fiscal e contábil
  categoria_contabil: { type: String, required: true },
  centro_custo: String,
  codigo_receita: String,
  retem_imposto: { type: Boolean, default: false },
  impostos_retidos: [ImpostoRetidoSchema],
  
  // Metadata
  metadata: { type: Schema.Types.Mixed },
  observacoes: String,
  documento_fiscal: String,
  
  // Timestamps
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

// Índices para performance
TransacaoSchema.index({ condominio_id: 1, status: 1 });
TransacaoSchema.index({ origem_id: 1, tipo_origem: 1 });
TransacaoSchema.index({ gateway_provider: 1, payment_id: 1 });
TransacaoSchema.index({ data_vencimento: 1, status: 1 });
TransacaoSchema.index({ reconciliado: 1, data_reconciliacao: 1 });
TransacaoSchema.index({ created_at: -1 });

// Middleware para atualizar updated_at
TransacaoSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

// Método para adicionar log
TransacaoSchema.methods.adicionarLog = function(evento: string, detalhes: any, usuario_id?: ObjectId, ip_address?: string) {
  this.logs_transacao.push({
    timestamp: new Date(),
    evento,
    detalhes,
    usuario_id,
    ip_address
  });
};

// Método para calcular valores
TransacaoSchema.methods.calcularValorFinal = function() {
  this.valor_final = this.valor_original + this.valor_juros + this.valor_multa - this.valor_desconto;
  return this.valor_final;
};

// Método para verificar se está vencida
TransacaoSchema.methods.isVencida = function() {
  return new Date() > this.data_vencimento && this.status === 'pendente';
};

// Método para calcular dias de atraso
TransacaoSchema.methods.diasAtraso = function() {
  if (!this.isVencida()) return 0;
  const diff = new Date().getTime() - this.data_vencimento.getTime();
  return Math.floor(diff / (1000 * 3600 * 24));
};

export default mongoose.models.Transacao || mongoose.model<ITransacao>('Transacao', TransacaoSchema);