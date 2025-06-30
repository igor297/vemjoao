import mongoose, { Document, Schema } from 'mongoose'

export interface IAlertaFinanceiro extends Document {
  // Identificação
  condominio_id: mongoose.Types.ObjectId
  master_id: mongoose.Types.ObjectId
  
  // Tipo e configuração do alerta
  tipo_alerta: 'vencimento_proximo' | 'inadimplencia_alta' | 'saldo_baixo' | 'orcamento_excedido' | 
              'conciliacao_pendente' | 'transacao_suspeita' | 'meta_nao_atingida' | 'anomalia_financeira'
  
  titulo: string
  descricao: string
  severidade: 'info' | 'warning' | 'danger' | 'success'
  categoria: 'operacional' | 'financeiro' | 'compliance' | 'performance'
  
  // Configuração de trigger
  condicoes: {
    parametro: string // ex: 'taxa_inadimplencia', 'dias_vencimento', 'valor_minimo'
    operador: 'maior_que' | 'menor_que' | 'igual' | 'entre' | 'contem'
    valor_limite: number | string
    valor_secundario?: number // Para operador 'entre'
    unidade?: string // 'dias', 'porcentagem', 'reais'
  }
  
  // Dados do contexto que gerou o alerta
  contexto: {
    valor_atual: number | string
    valor_referencia?: number
    entidade_relacionada?: {
      tipo: 'morador' | 'colaborador' | 'fornecedor' | 'conta_bancaria' | 'lancamento'
      id: mongoose.Types.ObjectId
      nome: string
    }
    periodo_referencia?: {
      inicio: Date
      fim: Date
    }
    dados_adicionais?: any
  }
  
  // Status e controle
  status: 'ativo' | 'resolvido' | 'ignorado' | 'em_analise'
  prioridade: 'baixa' | 'media' | 'alta' | 'critica'
  auto_gerado: boolean
  recorrente: boolean
  
  // Ações e resolução
  acoes_sugeridas: string[]
  acao_tomada?: string
  resolvido_por?: mongoose.Types.ObjectId
  data_resolucao?: Date
  observacoes_resolucao?: string
  
  // Notificações
  notificado: boolean
  usuarios_notificados: mongoose.Types.ObjectId[]
  canais_notificacao: ('email' | 'sistema' | 'sms' | 'whatsapp')[]
  data_primeira_notificacao?: Date
  data_ultima_notificacao?: Date
  tentativas_notificacao: number
  
  // Configuração de recorrência
  configuracao_recorrencia?: {
    frequencia: 'diaria' | 'semanal' | 'mensal' | 'condicional'
    dias_semana?: number[] // Para frequência semanal
    dia_mes?: number // Para frequência mensal
    horario?: string // HH:MM
    proxima_verificacao?: Date
  }
  
  // Auditoria
  data_criacao: Date
  data_atualizacao: Date
  criado_por?: mongoose.Types.ObjectId
  historico_status: {
    status_anterior: string
    status_novo: string
    data_mudanca: Date
    usuario_id?: mongoose.Types.ObjectId
    motivo?: string
  }[]
  
  // Métricas
  impacto_financeiro?: number
  nivel_urgencia: number // 1-10
  tempo_resolucao_esperado?: number // em horas
}

const CondicoesSchema = new Schema({
  parametro: { type: String, required: true },
  operador: { 
    type: String, 
    enum: ['maior_que', 'menor_que', 'igual', 'entre', 'contem'],
    required: true 
  },
  valor_limite: { type: Schema.Types.Mixed, required: true },
  valor_secundario: Schema.Types.Mixed,
  unidade: String
}, { _id: false })

const ContextoSchema = new Schema({
  valor_atual: { type: Schema.Types.Mixed, required: true },
  valor_referencia: Number,
  entidade_relacionada: {
    tipo: { 
      type: String, 
      enum: ['morador', 'colaborador', 'fornecedor', 'conta_bancaria', 'lancamento'] 
    },
    id: Schema.Types.ObjectId,
    nome: String
  },
  periodo_referencia: {
    inicio: Date,
    fim: Date
  },
  dados_adicionais: Schema.Types.Mixed
}, { _id: false })

const HistoricoStatusSchema = new Schema({
  status_anterior: { type: String, required: true },
  status_novo: { type: String, required: true },
  data_mudanca: { type: Date, default: Date.now },
  usuario_id: Schema.Types.ObjectId,
  motivo: String
})

const ConfiguracaoRecorrenciaSchema = new Schema({
  frequencia: { 
    type: String, 
    enum: ['diaria', 'semanal', 'mensal', 'condicional'],
    required: true 
  },
  dias_semana: [Number],
  dia_mes: Number,
  horario: String,
  proxima_verificacao: Date
}, { _id: false })

const AlertaFinanceiroSchema = new Schema<IAlertaFinanceiro>({
  // Identificação
  condominio_id: { type: Schema.Types.ObjectId, ref: 'Condominio', required: true },
  master_id: { type: Schema.Types.ObjectId, ref: 'Master', required: true },
  
  // Tipo e configuração
  tipo_alerta: { 
    type: String, 
    enum: [
      'vencimento_proximo', 'inadimplencia_alta', 'saldo_baixo', 'orcamento_excedido',
      'conciliacao_pendente', 'transacao_suspeita', 'meta_nao_atingida', 'anomalia_financeira'
    ],
    required: true 
  },
  titulo: { type: String, required: true, maxlength: 200 },
  descricao: { type: String, required: true, maxlength: 1000 },
  severidade: { 
    type: String, 
    enum: ['info', 'warning', 'danger', 'success'],
    default: 'info' 
  },
  categoria: { 
    type: String, 
    enum: ['operacional', 'financeiro', 'compliance', 'performance'],
    default: 'operacional' 
  },
  
  // Configuração
  condicoes: CondicoesSchema,
  contexto: ContextoSchema,
  
  // Status
  status: { 
    type: String, 
    enum: ['ativo', 'resolvido', 'ignorado', 'em_analise'],
    default: 'ativo' 
  },
  prioridade: { 
    type: String, 
    enum: ['baixa', 'media', 'alta', 'critica'],
    default: 'media' 
  },
  auto_gerado: { type: Boolean, default: true },
  recorrente: { type: Boolean, default: false },
  
  // Ações
  acoes_sugeridas: [String],
  acao_tomada: String,
  resolvido_por: Schema.Types.ObjectId,
  data_resolucao: Date,
  observacoes_resolucao: String,
  
  // Notificações
  notificado: { type: Boolean, default: false },
  usuarios_notificados: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  canais_notificacao: [{
    type: String,
    enum: ['email', 'sistema', 'sms', 'whatsapp']
  }],
  data_primeira_notificacao: Date,
  data_ultima_notificacao: Date,
  tentativas_notificacao: { type: Number, default: 0 },
  
  // Recorrência
  configuracao_recorrencia: ConfiguracaoRecorrenciaSchema,
  
  // Auditoria
  data_criacao: { type: Date, default: Date.now },
  data_atualizacao: { type: Date, default: Date.now },
  criado_por: Schema.Types.ObjectId,
  historico_status: [HistoricoStatusSchema],
  
  // Métricas
  impacto_financeiro: Number,
  nivel_urgencia: { type: Number, min: 1, max: 10, default: 5 },
  tempo_resolucao_esperado: Number
}, {
  timestamps: true,
  collection: 'alertas-financeiros'
})

// Índices para performance
AlertaFinanceiroSchema.index({ condominio_id: 1, status: 1, data_criacao: -1 })
AlertaFinanceiroSchema.index({ tipo_alerta: 1, severidade: 1 })
AlertaFinanceiroSchema.index({ master_id: 1, prioridade: 1 })
AlertaFinanceiroSchema.index({ 'configuracao_recorrencia.proxima_verificacao': 1 })
AlertaFinanceiroSchema.index({ auto_gerado: 1, recorrente: 1 })

// Middleware para atualizar timestamps
AlertaFinanceiroSchema.pre('save', function(next) {
  this.data_atualizacao = new Date()
  next()
})

// Método para adicionar histórico de status
AlertaFinanceiroSchema.methods.adicionarHistoricoStatus = function(
  novoStatus: string, 
  usuarioId?: mongoose.Types.ObjectId, 
  motivo?: string
) {
  this.historico_status.push({
    status_anterior: this.status,
    status_novo: novoStatus,
    data_mudanca: new Date(),
    usuario_id: usuarioId,
    motivo
  })
  this.status = novoStatus
}

// Método para calcular prioridade automática
AlertaFinanceiroSchema.methods.calcularPrioridadeAutomatica = function() {
  let score = this.nivel_urgencia
  
  // Ajustar baseado na severidade
  switch (this.severidade) {
    case 'danger': score += 3; break
    case 'warning': score += 1; break
    case 'info': score -= 1; break
  }
  
  // Ajustar baseado no impacto financeiro
  if (this.impacto_financeiro) {
    if (this.impacto_financeiro > 10000) score += 2
    else if (this.impacto_financeiro > 5000) score += 1
  }
  
  // Determinar prioridade
  if (score >= 9) this.prioridade = 'critica'
  else if (score >= 7) this.prioridade = 'alta'
  else if (score >= 5) this.prioridade = 'media'
  else this.prioridade = 'baixa'
  
  return this.prioridade
}

// Método para verificar se deve ser reativado
AlertaFinanceiroSchema.methods.deveSerReativado = function(valorAtual: any) {
  if (this.status !== 'resolvido') return false
  
  const condicao = this.condicoes
  return avaliarCondicao(condicao, valorAtual)
}

// Método para gerar ações sugeridas
AlertaFinanceiroSchema.methods.gerarAcoesSugeridas = function() {
  const acoes = []
  
  switch (this.tipo_alerta) {
    case 'vencimento_proximo':
      acoes.push('Enviar lembretes de cobrança')
      acoes.push('Verificar dados de contato do devedor')
      acoes.push('Considerar negociação de prazos')
      break
      
    case 'inadimplencia_alta':
      acoes.push('Analisar perfil dos inadimplentes')
      acoes.push('Implementar campanhas de cobrança')
      acoes.push('Revisar políticas de cobrança')
      acoes.push('Considerar parcelamentos')
      break
      
    case 'saldo_baixo':
      acoes.push('Analisar fluxo de caixa projetado')
      acoes.push('Acelerar recebimentos pendentes')
      acoes.push('Renegociar prazos de pagamentos')
      acoes.push('Considerar empréstimo de emergência')
      break
      
    case 'orcamento_excedido':
      acoes.push('Revisar orçamento da categoria')
      acoes.push('Analisar gastos não planejados')
      acoes.push('Implementar controles adicionais')
      acoes.push('Buscar economia em outras categorias')
      break
      
    case 'conciliacao_pendente':
      acoes.push('Executar reconciliação automática')
      acoes.push('Revisar extratos bancários')
      acoes.push('Verificar transações não identificadas')
      break
      
    default:
      acoes.push('Analisar situação detalhadamente')
      acoes.push('Consultar documentação relacionada')
  }
  
  this.acoes_sugeridas = acoes
  return acoes
}

// Função auxiliar para avaliar condições
function avaliarCondicao(condicao: any, valorAtual: any): boolean {
  const { operador, valor_limite, valor_secundario } = condicao
  
  switch (operador) {
    case 'maior_que':
      return valorAtual > valor_limite
    case 'menor_que':
      return valorAtual < valor_limite
    case 'igual':
      return valorAtual === valor_limite
    case 'entre':
      return valorAtual >= valor_limite && valorAtual <= valor_secundario
    case 'contem':
      return String(valorAtual).toLowerCase().includes(String(valor_limite).toLowerCase())
    default:
      return false
  }
}

export default mongoose.models.AlertaFinanceiro || mongoose.model<IAlertaFinanceiro>('AlertaFinanceiro', AlertaFinanceiroSchema)

// Funções utilitárias para criação de alertas
export const criarAlertaVencimentoProximo = (
  condominioId: mongoose.Types.ObjectId,
  masterId: mongoose.Types.ObjectId,
  quantidadeLancamentos: number,
  valorTotal: number
) => {
  return new (mongoose.models.AlertaFinanceiro || mongoose.model<IAlertaFinanceiro>('AlertaFinanceiro', AlertaFinanceiroSchema))({
    condominio_id: condominioId,
    master_id: masterId,
    tipo_alerta: 'vencimento_proximo',
    titulo: 'Vencimentos Próximos Detectados',
    descricao: `${quantidadeLancamentos} lançamentos totalizam ${valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} com vencimento nos próximos 7 dias.`,
    severidade: quantidadeLancamentos > 10 ? 'danger' : 'warning',
    categoria: 'operacional',
    condicoes: {
      parametro: 'vencimentos_7_dias',
      operador: 'maior_que',
      valor_limite: 5,
      unidade: 'lancamentos'
    },
    contexto: {
      valor_atual: quantidadeLancamentos,
      dados_adicionais: { valor_total: valorTotal }
    },
    impacto_financeiro: valorTotal,
    nivel_urgencia: Math.min(10, Math.floor(quantidadeLancamentos / 2) + 3)
  })
}

export const criarAlertaInadimplenciaAlta = (
  condominioId: mongoose.Types.ObjectId,
  masterId: mongoose.Types.ObjectId,
  taxaInadimplencia: number,
  valorTotal: number
) => {
  return new (mongoose.models.AlertaFinanceiro || mongoose.model<IAlertaFinanceiro>('AlertaFinanceiro', AlertaFinanceiroSchema))({
    condominio_id: condominioId,
    master_id: masterId,
    tipo_alerta: 'inadimplencia_alta',
    titulo: 'Taxa de Inadimplência Elevada',
    descricao: `Taxa de inadimplência atual: ${taxaInadimplencia.toFixed(1)}%. Valor total em atraso: ${valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
    severidade: taxaInadimplencia > 25 ? 'danger' : 'warning',
    categoria: 'financeiro',
    condicoes: {
      parametro: 'taxa_inadimplencia',
      operador: 'maior_que',
      valor_limite: 15,
      unidade: 'porcentagem'
    },
    contexto: {
      valor_atual: taxaInadimplencia,
      valor_referencia: 15,
      dados_adicionais: { valor_total_atraso: valorTotal }
    },
    impacto_financeiro: valorTotal,
    nivel_urgencia: Math.min(10, Math.floor(taxaInadimplencia / 3) + 2)
  })
}

export const criarAlertaSaldoBaixo = (
  condominioId: mongoose.Types.ObjectId,
  masterId: mongoose.Types.ObjectId,
  saldoAtual: number,
  despesasMensais: number
) => {
  const mesesCobertura = saldoAtual / despesasMensais
  
  return new (mongoose.models.AlertaFinanceiro || mongoose.model<IAlertaFinanceiro>('AlertaFinanceiro', AlertaFinanceiroSchema))({
    condominio_id: condominioId,
    master_id: masterId,
    tipo_alerta: 'saldo_baixo',
    titulo: 'Saldo Insuficiente Detectado',
    descricao: `Saldo atual: ${saldoAtual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}. Cobertura: ${mesesCobertura.toFixed(1)} meses de despesas.`,
    severidade: mesesCobertura < 0.5 ? 'danger' : 'warning',
    categoria: 'financeiro',
    condicoes: {
      parametro: 'meses_cobertura',
      operador: 'menor_que',
      valor_limite: 1,
      unidade: 'meses'
    },
    contexto: {
      valor_atual: mesesCobertura,
      valor_referencia: 1,
      dados_adicionais: { 
        saldo_atual: saldoAtual, 
        despesas_mensais: despesasMensais 
      }
    },
    impacto_financeiro: Math.abs(saldoAtual),
    nivel_urgencia: Math.min(10, Math.floor((1 - mesesCobertura) * 5) + 5)
  })
}