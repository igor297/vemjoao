import mongoose from 'mongoose'

const FinanceiroCondominioSchema = new mongoose.Schema({
  // Identificação básica
  master_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Master',
    required: true,
    index: true
  },
  condominio_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Condominio',
    required: true,
    index: true
  },

  // Dados do lançamento
  tipo: {
    type: String,
    enum: ['receita', 'despesa', 'transferencia'],
    required: true,
    index: true
  },
  categoria: {
    type: String,
    required: true,
    index: true
  },
  descricao: {
    type: String,
    required: true
  },
  valor: {
    type: Number,
    required: true,
    min: 0
  },

  // Datas
  data_vencimento: {
    type: Date,
    required: true,
    index: true
  },
  data_pagamento: {
    type: Date,
    default: null
  },
  data_criacao: {
    type: Date,
    default: Date.now,
    index: true
  },
  data_atualizacao: {
    type: Date,
    default: Date.now
  },

  // Status e controle
  status: {
    type: String,
    enum: ['pendente', 'pago', 'atrasado', 'cancelado'],
    default: 'pendente',
    index: true
  },
  ativo: {
    type: Boolean,
    default: true,
    index: true
  },

  // Observações
  observacoes: {
    type: String,
    default: ''
  },

  // Recorrência
  recorrente: {
    type: Boolean,
    default: false
  },
  periodicidade: {
    type: String,
    enum: ['mensal', 'bimestral', 'trimestral', 'semestral', 'anual'],
    default: null
  },

  // Origem do lançamento
  origem_sistema: {
    type: String,
    enum: ['manual', 'morador', 'colaborador', 'importacao', 'recorrencia'],
    default: 'manual',
    index: true
  },
  origem_nome: {
    type: String,
    default: ''
  },
  origem_identificacao: {
    type: String,
    default: ''
  },
  // NOVOS CAMPOS
  origem_cpf: {
    type: String,
    default: '',
    index: true
  },
  origem_cargo: {
    type: String,
    default: ''
  },

  // Dados de localização (para moradores)
  bloco: {
    type: String,
    default: ''
  },
  apartamento: {
    type: String,
    default: ''
  },
  unidade: {
    type: String,
    default: ''
  },

  // Dados profissionais (para colaboradores)
  cargo: {
    type: String,
    default: ''
  },
  departamento: {
    type: String,
    default: ''
  },

  // Auditoria
  criado_por_tipo: {
    type: String,
    enum: ['master', 'adm', 'sindico', 'subsindico', 'conselheiro', 'sistema'],
    required: true
  },
  criado_por_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  criado_por_nome: {
    type: String,
    required: true
  },

  // Metadados adicionais
  origem_referencia_id: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  taxa_juros: {
    type: Number,
    default: 0
  },
  taxa_multa: {
    type: Number,
    default: 0
  },
  valor_juros: {
    type: Number,
    default: 0
  },
  valor_multa: {
    type: Number,
    default: 0
  },
  valor_desconto: {
    type: Number,
    default: 0
  },
  valor_total: {
    type: Number,
    default: 0
  },

  // Dados bancários (para transferências)
  banco_origem: {
    type: String,
    default: ''
  },
  banco_destino: {
    type: String,
    default: ''
  },
  numero_documento: {
    type: String,
    default: ''
  },

  // Tags e categorizações
  tags: [{
    type: String
  }],
  prioridade: {
    type: String,
    enum: ['baixa', 'normal', 'alta', 'urgente'],
    default: 'normal'
  },

  // Anexos
  anexos: [{
    nome: String,
    url: String,
    tipo: String,
    tamanho: Number,
    data_upload: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
  collection: 'financeiro-condominios'
})

// Índices compostos para performance otimizada
FinanceiroCondominioSchema.index({ master_id: 1, condominio_id: 1, ativo: 1, data_vencimento: -1 }) // Índice principal otimizado
FinanceiroCondominioSchema.index({ master_id: 1, condominio_id: 1, ativo: 1, status: 1 })
FinanceiroCondominioSchema.index({ master_id: 1, condominio_id: 1, ativo: 1, tipo: 1 })
FinanceiroCondominioSchema.index({ master_id: 1, condominio_id: 1, ativo: 1, categoria: 1 })
FinanceiroCondominioSchema.index({ master_id: 1, condominio_id: 1, ativo: 1 }) // Para contagens rápidas
FinanceiroCondominioSchema.index({ origem_cpf: 1, condominio_id: 1 })
FinanceiroCondominioSchema.index({ origem_sistema: 1, condominio_id: 1, ativo: 1 })

// Middleware para calcular valor total automaticamente
FinanceiroCondominioSchema.pre('save', function(next) {
  if (this.isModified('valor') || this.isModified('valor_juros') || this.isModified('valor_multa') || this.isModified('valor_desconto')) {
    this.valor_total = this.valor + (this.valor_juros || 0) + (this.valor_multa || 0) - (this.valor_desconto || 0)
  }
  
  // Atualizar data de atualização
  this.data_atualizacao = new Date()
  
  next()
})

// Método para calcular atraso
FinanceiroCondominioSchema.methods.calcularAtraso = function() {
  if (this.status === 'pago') return 0
  
  const hoje = new Date()
  const vencimento = new Date(this.data_vencimento)
  
  if (hoje > vencimento) {
    return Math.ceil((hoje.getTime() - vencimento.getTime()) / (1000 * 60 * 60 * 24))
  }
  
  return 0
}

// Método para formatar valor como moeda
FinanceiroCondominioSchema.methods.formatarValor = function() {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(this.valor_total || this.valor)
}

// Virtual para CPF formatado
FinanceiroCondominioSchema.virtual('cpf_formatado').get(function() {
  if (!this.origem_cpf) return ''
  
  const cpf = this.origem_cpf.replace(/\D/g, '')
  if (cpf.length === 11) {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }
  
  return this.origem_cpf
})

// Método estático para buscar por CPF
FinanceiroCondominioSchema.statics.findByCPF = function(cpf: string, condominioId: string) {
  const cpfLimpo = cpf.replace(/\D/g, '')
  return this.find({
    origem_cpf: cpfLimpo,
    condominio_id: condominioId,
    ativo: true
  }).sort({ data_vencimento: -1 })
}

// Método estático para relatório por cargo
FinanceiroCondominioSchema.statics.relatorioPorCargo = function(condominioId: string, masterId: string) {
  return this.aggregate([
    {
      $match: {
        condominio_id: new mongoose.Types.ObjectId(condominioId),
        master_id: new mongoose.Types.ObjectId(masterId),
        ativo: true,
        origem_cargo: { $exists: true, $ne: '' }
      }
    },
    {
      $group: {
        _id: '$origem_cargo',
        total_valor: { $sum: '$valor' },
        count: { $sum: 1 },
        receitas: {
          $sum: {
            $cond: [{ $eq: ['$tipo', 'receita'] }, '$valor', 0]
          }
        },
        despesas: {
          $sum: {
            $cond: [{ $eq: ['$tipo', 'despesa'] }, '$valor', 0]
          }
        }
      }
    },
    {
      $sort: { total_valor: -1 }
    }
  ])
}

import crypto from 'crypto';

interface DadosLancamentoParaHash {
  _id: string;
  tipo: string;
  categoria: string;
  descricao: string;
  valor: number;
  data_vencimento: Date;
  status: string;
  condominio_id: string;
  master_id: string;
  origem_sistema?: string;
  origem_identificacao?: string;
}

export function gerarHashSincronizacao(dados: DadosLancamentoParaHash): string {
  const dataString = [
    dados._id.toString(),
    dados.tipo,
    dados.categoria,
    dados.descricao,
    dados.valor.toFixed(2),
    dados.data_vencimento.toISOString().split('T')[0],
    dados.status,
    dados.condominio_id.toString(),
    dados.master_id.toString(),
    dados.origem_sistema || '',
    dados.origem_identificacao || ''
  ].join('|');
  return crypto.createHash('sha256').update(dataString).digest('hex');
}

export default mongoose.models.FinanceiroCondominio || mongoose.model('FinanceiroCondominio', FinanceiroCondominioSchema)