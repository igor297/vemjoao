import mongoose, { Document, Schema } from 'mongoose';
import { ObjectId } from 'mongodb';

export interface IExtratoBancario extends Document {
  // Identificação
  condominio_id: ObjectId;
  conta_bancaria_id: ObjectId;
  
  // Dados do movimento
  data_movimento: Date;
  data_processamento: Date;
  tipo_movimento: 'credito' | 'debito';
  valor: number;
  saldo_anterior: number;
  saldo_atual: number;
  
  // Identificação do movimento
  documento: string;
  historico: string;
  codigo_movimento: string;
  agencia_origem?: string;
  conta_origem?: string;
  cpf_cnpj_origem?: string;
  nome_origem?: string;
  
  // Dados específicos por tipo
  dados_pix?: {
    chave_pix?: string;
    identificador_transacao: string;
    tipo_chave?: 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria';
  };
  
  dados_ted_doc?: {
    banco_origem: string;
    agencia_origem: string;
    conta_origem: string;
    finalidade: string;
  };
  
  dados_boleto?: {
    codigo_barras?: string;
    linha_digitavel?: string;
    nosso_numero?: string;
  };
  
  // Reconciliação
  reconciliado: boolean;
  transacao_id?: ObjectId;
  data_reconciliacao?: Date;
  reconciliado_por?: ObjectId;
  confidence_score: number; // 0-100 para match automático
  
  // Categorização automática
  categoria_automatica?: string;
  categoria_manual?: string;
  tags: string[];
  
  // Processamento
  processado: boolean;
  erros_processamento: string[];
  origem_importacao: 'api_bancaria' | 'ofx' | 'csv' | 'manual';
  arquivo_origem?: string;
  
  // Auditoria
  logs_movimento: {
    timestamp: Date;
    evento: string;
    detalhes: any;
    usuario_id?: ObjectId;
  }[];
  
  // Timestamps
  created_at: Date;
  updated_at: Date;
}

const DadosPixSchema = new Schema({
  chave_pix: String,
  identificador_transacao: { type: String, required: true },
  tipo_chave: { 
    type: String, 
    enum: ['cpf', 'cnpj', 'email', 'telefone', 'aleatoria'] 
  }
}, { _id: false });

const DadosTedDocSchema = new Schema({
  banco_origem: String,
  agencia_origem: String,
  conta_origem: String,
  finalidade: String
}, { _id: false });

const DadosBoletoSchema = new Schema({
  codigo_barras: String,
  linha_digitavel: String,
  nosso_numero: String
}, { _id: false });

const LogMovimentoSchema = new Schema({
  timestamp: { type: Date, default: Date.now },
  evento: { type: String, required: true },
  detalhes: { type: Schema.Types.Mixed },
  usuario_id: { type: Schema.Types.ObjectId, ref: 'User' }
});

const ExtratoBancarioSchema = new Schema<IExtratoBancario>({
  // Identificação
  condominio_id: { type: Schema.Types.ObjectId, ref: 'Condominio', required: true },
  conta_bancaria_id: { type: Schema.Types.ObjectId, ref: 'ContaBancaria', required: true },
  
  // Dados do movimento
  data_movimento: { type: Date, required: true },
  data_processamento: { type: Date, default: Date.now },
  tipo_movimento: { 
    type: String, 
    enum: ['credito', 'debito'], 
    required: true 
  },
  valor: { type: Number, required: true, min: 0.01 },
  saldo_anterior: { type: Number, required: true },
  saldo_atual: { type: Number, required: true },
  
  // Identificação do movimento
  documento: { type: String, required: true },
  historico: { type: String, required: true },
  codigo_movimento: String,
  agencia_origem: String,
  conta_origem: String,
  cpf_cnpj_origem: String,
  nome_origem: String,
  
  // Dados específicos por tipo
  dados_pix: DadosPixSchema,
  dados_ted_doc: DadosTedDocSchema,
  dados_boleto: DadosBoletoSchema,
  
  // Reconciliação
  reconciliado: { type: Boolean, default: false },
  transacao_id: { type: Schema.Types.ObjectId, ref: 'Transacao' },
  data_reconciliacao: Date,
  reconciliado_por: { type: Schema.Types.ObjectId, ref: 'User' },
  confidence_score: { type: Number, default: 0, min: 0, max: 100 },
  
  // Categorização automática
  categoria_automatica: String,
  categoria_manual: String,
  tags: [String],
  
  // Processamento
  processado: { type: Boolean, default: false },
  erros_processamento: [String],
  origem_importacao: { 
    type: String, 
    enum: ['api_bancaria', 'ofx', 'csv', 'manual'],
    required: true 
  },
  arquivo_origem: String,
  
  // Auditoria
  logs_movimento: [LogMovimentoSchema],
  
  // Timestamps
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

// Índices para performance
ExtratoBancarioSchema.index({ condominio_id: 1, conta_bancaria_id: 1 });
ExtratoBancarioSchema.index({ data_movimento: -1 });
ExtratoBancarioSchema.index({ reconciliado: 1, confidence_score: -1 });
ExtratoBancarioSchema.index({ documento: 1 }, { unique: true });
ExtratoBancarioSchema.index({ 'dados_pix.identificador_transacao': 1 });
ExtratoBancarioSchema.index({ 'dados_boleto.nosso_numero': 1 });

// Middleware para atualizar updated_at
ExtratoBancarioSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

// Método para adicionar log
ExtratoBancarioSchema.methods.adicionarLog = function(evento: string, detalhes: any, usuario_id?: ObjectId) {
  this.logs_movimento.push({
    timestamp: new Date(),
    evento,
    detalhes,
    usuario_id
  });
};

// Método para categorização automática
ExtratoBancarioSchema.methods.categorizarAutomaticamente = function() {
  const historico = this.historico.toLowerCase();
  
  // Regras de categorização
  if (historico.includes('pix') || this.dados_pix) {
    this.categoria_automatica = 'pix_recebido';
  } else if (historico.includes('boleto') || this.dados_boleto) {
    this.categoria_automatica = 'boleto_pago';
  } else if (historico.includes('ted') || historico.includes('doc')) {
    this.categoria_automatica = 'transferencia';
  } else if (historico.includes('tarifa') || historico.includes('taxa')) {
    this.categoria_automatica = 'tarifa_bancaria';
  } else if (historico.includes('salario') || historico.includes('folha')) {
    this.categoria_automatica = 'pagamento_funcionario';
  } else {
    this.categoria_automatica = 'outros';
  }
  
  return this.categoria_automatica;
};

// Método para calcular score de confiança para reconciliação
ExtratoBancarioSchema.methods.calcularConfidenceScore = function(transacao: any) {
  let score = 0;
  
  // Valor exato = +40 pontos
  if (Math.abs(this.valor - transacao.valor_final) < 0.01) {
    score += 40;
  }
  
  // Data próxima = +20 pontos
  const diffDias = Math.abs(this.data_movimento.getTime() - transacao.data_vencimento.getTime()) / (1000 * 3600 * 24);
  if (diffDias <= 1) score += 20;
  else if (diffDias <= 3) score += 15;
  else if (diffDias <= 7) score += 10;
  
  // PIX com identificador = +30 pontos
  if (this.dados_pix?.identificador_transacao && transacao.dados_pagamento?.qr_code) {
    score += 30;
  }
  
  // Boleto com nosso número = +30 pontos
  if (this.dados_boleto?.nosso_numero && transacao.payment_id) {
    score += 30;
  }
  
  // Mesmo condomínio = +10 pontos
  if (this.condominio_id.toString() === transacao.condominio_id.toString()) {
    score += 10;
  }
  
  return Math.min(score, 100);
};

export default mongoose.models.ExtratoBancario || mongoose.model<IExtratoBancario>('ExtratoBancario', ExtratoBancarioSchema);