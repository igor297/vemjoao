import mongoose, { Document, Schema } from 'mongoose';
import { ObjectId } from 'mongodb';

export interface ILancamentoContabil extends Document {
  // Identificação
  numero_lancamento: string;
  data_lancamento: Date;
  condominio_id: ObjectId;
  
  // Dados do lançamento
  historico: string;
  valor_total: number;
  tipo_lancamento: 'manual' | 'automatico' | 'integracao';
  origem_lancamento: 'financeiro_morador' | 'financeiro_condominio' | 'financeiro_colaborador' | 'transacao' | 'conciliacao' | 'manual';
  documento_origem_id?: ObjectId;
  
  // Status
  status: 'rascunho' | 'confirmado' | 'cancelado';
  data_confirmacao?: Date;
  confirmado_por?: ObjectId;
  motivo_cancelamento?: string;
  
  // Partidas dobradas (débito e crédito)
  partidas: {
    conta_id: ObjectId;
    valor_debito: number;
    valor_credito: number;
    centro_custo?: string;
    historico_complementar?: string;
  }[];
  
  // Dados fiscais
  documento_fiscal?: string;
  data_documento?: Date;
  terceiro_nome?: string;
  terceiro_documento?: string;
  
  // Centro de custo
  centro_custo_principal?: string;
  
  // Conciliação bancária
  conciliado: boolean;
  extrato_bancario_id?: ObjectId;
  data_conciliacao?: Date;
  
  // Auditoria
  logs_lancamento: {
    timestamp: Date;
    evento: string;
    detalhes: any;
    usuario_id?: ObjectId;
  }[];
  
  // Integração SPED
  codigo_hash_sped?: string;
  enviado_sped: boolean;
  data_envio_sped?: Date;
  
  // Timestamps
  created_at: Date;
  updated_at: Date;
  created_by: ObjectId;
  updated_by?: ObjectId;
}

const PartidaSchema = new Schema({
  conta_id: { type: Schema.Types.ObjectId, ref: 'PlanoContas', required: true },
  valor_debito: { type: Number, default: 0, min: 0 },
  valor_credito: { type: Number, default: 0, min: 0 },
  centro_custo: String,
  historico_complementar: String
}, { _id: false });

const LogLancamentoSchema = new Schema({
  timestamp: { type: Date, default: Date.now },
  evento: { type: String, required: true },
  detalhes: { type: Schema.Types.Mixed },
  usuario_id: { type: Schema.Types.ObjectId, ref: 'User' }
});

const LancamentoContabilSchema = new Schema<ILancamentoContabil>({
  // Identificação
  numero_lancamento: { 
    type: String, 
    required: true,
    default: function() {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      return `LC${year}${month}${random}`;
    }
  },
  data_lancamento: { type: Date, required: true },
  condominio_id: { type: Schema.Types.ObjectId, ref: 'Condominio', required: true },
  
  // Dados do lançamento
  historico: { type: String, required: true, maxlength: 200 },
  valor_total: { type: Number, required: true, min: 0.01 },
  tipo_lancamento: { 
    type: String, 
    enum: ['manual', 'automatico', 'integracao'],
    default: 'manual'
  },
  origem_lancamento: { 
    type: String, 
    enum: ['financeiro_morador', 'financeiro_condominio', 'financeiro_colaborador', 'transacao', 'conciliacao', 'manual'],
    required: true
  },
  documento_origem_id: { type: Schema.Types.ObjectId },
  
  // Status
  status: { 
    type: String, 
    enum: ['rascunho', 'confirmado', 'cancelado'],
    default: 'rascunho'
  },
  data_confirmacao: Date,
  confirmado_por: { type: Schema.Types.ObjectId, ref: 'User' },
  motivo_cancelamento: String,
  
  // Partidas dobradas
  partidas: [PartidaSchema],
  
  // Dados fiscais
  documento_fiscal: String,
  data_documento: Date,
  terceiro_nome: String,
  terceiro_documento: String,
  
  // Centro de custo
  centro_custo_principal: String,
  
  // Conciliação bancária
  conciliado: { type: Boolean, default: false },
  extrato_bancario_id: { type: Schema.Types.ObjectId, ref: 'ExtratoBancario' },
  data_conciliacao: Date,
  
  // Auditoria
  logs_lancamento: [LogLancamentoSchema],
  
  // Integração SPED
  codigo_hash_sped: String,
  enviado_sped: { type: Boolean, default: false },
  data_envio_sped: Date,
  
  // Timestamps
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  created_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updated_by: { type: Schema.Types.ObjectId, ref: 'User' }
});

// Índices para performance
LancamentoContabilSchema.index({ condominio_id: 1, data_lancamento: -1 });
LancamentoContabilSchema.index({ status: 1, data_lancamento: -1 });
LancamentoContabilSchema.index({ 'partidas.conta_id': 1 });
LancamentoContabilSchema.index({ origem_lancamento: 1, documento_origem_id: 1 });
LancamentoContabilSchema.index({ numero_lancamento: 1 }, { unique: true });
LancamentoContabilSchema.index({ conciliado: 1, extrato_bancario_id: 1 });

// Middleware para validação antes de salvar
LancamentoContabilSchema.pre('save', function(next) {
  this.updated_at = new Date();
  
  // Validar se o lançamento está quadrado (débito = crédito)
  let totalDebito = 0;
  let totalCredito = 0;
  
  this.partidas.forEach(partida => {
    totalDebito += partida.valor_debito;
    totalCredito += partida.valor_credito;
  });
  
  if (Math.abs(totalDebito - totalCredito) > 0.01) {
    return next(new Error('Lançamento não está quadrado. Débito deve ser igual ao crédito.'));
  }
  
  if (Math.abs(this.valor_total - totalDebito) > 0.01) {
    return next(new Error('Valor total não confere com a soma dos débitos.'));
  }
  
  // Validar se há pelo menos 2 partidas
  if (this.partidas.length < 2) {
    return next(new Error('Lançamento deve ter pelo menos 2 partidas.'));
  }
  
  next();
});

// Método para adicionar log
LancamentoContabilSchema.methods.adicionarLog = function(evento: string, detalhes: any, usuario_id?: ObjectId) {
  this.logs_lancamento.push({
    timestamp: new Date(),
    evento,
    detalhes,
    usuario_id
  });
};

// Método para confirmar lançamento
LancamentoContabilSchema.methods.confirmar = function(usuario_id: ObjectId) {
  if (this.status !== 'rascunho') {
    throw new Error('Apenas lançamentos em rascunho podem ser confirmados');
  }
  
  this.status = 'confirmado';
  this.data_confirmacao = new Date();
  this.confirmado_por = usuario_id;
  
  this.adicionarLog('confirmado', {
    data_confirmacao: this.data_confirmacao
  }, usuario_id);
};

// Método para cancelar lançamento
LancamentoContabilSchema.methods.cancelar = function(motivo: string, usuario_id: ObjectId) {
  if (this.status === 'cancelado') {
    throw new Error('Lançamento já está cancelado');
  }
  
  this.status = 'cancelado';
  this.motivo_cancelamento = motivo;
  
  this.adicionarLog('cancelado', {
    motivo,
    status_anterior: this.status
  }, usuario_id);
};

// Método estático para criar lançamento automático de transação
LancamentoContabilSchema.statics.criarLancamentoTransacao = async function(transacao: any) {
  const PlanoContas = mongoose.model('PlanoContas');
  
  // Determinar contas contábeis baseado no tipo de transação
  let contaReceber, contaBanco;
  
  switch (transacao.tipo_origem) {
    case 'financeiro_morador':
      contaReceber = await PlanoContas.findOne({ 
        condominio_id: transacao.condominio_id,
        subtipo: 'contas_receber',
        aceita_lancamento: true
      });
      break;
    case 'financeiro_condominio':
      contaReceber = await PlanoContas.findOne({ 
        condominio_id: transacao.condominio_id,
        subtipo: 'contas_receber',
        aceita_lancamento: true
      });
      break;
    case 'financeiro_colaborador':
      contaReceber = await PlanoContas.findOne({ 
        condominio_id: transacao.condominio_id,
        subtipo: 'contas_pagar',
        aceita_lancamento: true
      });
      break;
  }
  
  // Conta bancária (sempre a mesma)
  contaBanco = await PlanoContas.findOne({ 
    condominio_id: transacao.condominio_id,
    subtipo: 'banco',
    aceita_lancamento: true
  });
  
  if (!contaReceber || !contaBanco) {
    throw new Error('Contas contábeis não encontradas para criar lançamento');
  }
  
  // Criar lançamento
  const lancamento = new this({
    condominio_id: transacao.condominio_id,
    data_lancamento: transacao.data_confirmacao || new Date(),
    historico: `Pagamento ${transacao.metodo_pagamento} - ${transacao.gateway_provider}`,
    valor_total: transacao.valor_final,
    tipo_lancamento: 'automatico',
    origem_lancamento: 'transacao',
    documento_origem_id: transacao._id,
    partidas: [
      {
        conta_id: contaBanco._id,
        valor_debito: transacao.valor_final,
        valor_credito: 0,
        historico_complementar: `Recebimento via ${transacao.gateway_provider}`
      },
      {
        conta_id: contaReceber._id,
        valor_debito: 0,
        valor_credito: transacao.valor_final,
        historico_complementar: `Baixa de conta a receber`
      }
    ],
    status: 'confirmado',
    data_confirmacao: new Date(),
    created_by: new mongoose.Types.ObjectId() // Sistema
  });
  
  await lancamento.save();
  
  console.log('Lançamento contábil criado automaticamente:', {
    numero_lancamento: lancamento.numero_lancamento,
    valor_total: lancamento.valor_total,
    transacao_id: transacao.id_transacao
  });
  
  return lancamento;
};

// Método estático para buscar lançamentos para DRE
LancamentoContabilSchema.statics.buscarParaDRE = async function(condominioId: ObjectId, dataInicio: Date, dataFim: Date) {
  const pipeline = [
    {
      $match: {
        condominio_id: condominioId,
        data_lancamento: { $gte: dataInicio, $lte: dataFim },
        status: 'confirmado'
      }
    },
    {
      $unwind: '$partidas'
    },
    {
      $lookup: {
        from: 'planocontas',
        localField: 'partidas.conta_id',
        foreignField: '_id',
        as: 'conta'
      }
    },
    {
      $unwind: '$conta'
    },
    {
      $match: {
        'conta.grupo_dre': { $exists: true, $ne: null }
      }
    },
    {
      $group: {
        _id: {
          grupo_dre: '$conta.grupo_dre',
          conta_id: '$conta._id',
          conta_nome: '$conta.nome'
        },
        total_debito: { $sum: '$partidas.valor_debito' },
        total_credito: { $sum: '$partidas.valor_credito' },
        saldo: {
          $sum: {
            $cond: [
              { $eq: ['$conta.natureza', 'debito'] },
              { $subtract: ['$partidas.valor_debito', '$partidas.valor_credito'] },
              { $subtract: ['$partidas.valor_credito', '$partidas.valor_debito'] }
            ]
          }
        }
      }
    },
    {
      $sort: { '_id.grupo_dre': 1, '_id.conta_nome': 1 }
    }
  ];
  
  return await this.aggregate(pipeline);
};

// Método estático para buscar lançamentos para Balancete
LancamentoContabilSchema.statics.buscarParaBalancete = async function(condominioId: ObjectId, dataInicio: Date, dataFim: Date) {
  const pipeline = [
    {
      $match: {
        condominio_id: condominioId,
        data_lancamento: { $gte: dataInicio, $lte: dataFim },
        status: 'confirmado'
      }
    },
    {
      $unwind: '$partidas'
    },
    {
      $lookup: {
        from: 'planocontas',
        localField: 'partidas.conta_id',
        foreignField: '_id',
        as: 'conta'
      }
    },
    {
      $unwind: '$conta'
    },
    {
      $group: {
        _id: {
          conta_id: '$conta._id',
          conta_codigo: '$conta.codigo_completo',
          conta_nome: '$conta.nome',
          tipo_conta: '$conta.tipo_conta',
          natureza: '$conta.natureza'
        },
        total_debito: { $sum: '$partidas.valor_debito' },
        total_credito: { $sum: '$partidas.valor_credito' },
        saldo: {
          $sum: {
            $cond: [
              { $eq: ['$conta.natureza', 'debito'] },
              { $subtract: ['$partidas.valor_debito', '$partidas.valor_credito'] },
              { $subtract: ['$partidas.valor_credito', '$partidas.valor_debito'] }
            ]
          }
        }
      }
    },
    {
      $match: {
        $or: [
          { total_debito: { $gt: 0 } },
          { total_credito: { $gt: 0 } },
          { saldo: { $ne: 0 } }
        ]
      }
    },
    {
      $sort: { '_id.conta_codigo': 1 }
    }
  ];
  
  return await this.aggregate(pipeline);
};

export default mongoose.models.LancamentoContabil || mongoose.model<ILancamentoContabil>('LancamentoContabil', LancamentoContabilSchema);