import mongoose, { Document, Schema } from 'mongoose'

export interface IOrcamento extends Document {
  // Identificação
  condominio_id: mongoose.Types.ObjectId
  master_id: mongoose.Types.ObjectId
  
  // Informações básicas do orçamento
  nome: string
  descricao: string
  ano_referencia: number
  status: 'rascunho' | 'aprovado' | 'em_execucao' | 'finalizado' | 'cancelado'
  versao: number
  orcamento_anterior_id?: mongoose.Types.ObjectId
  
  // Período de vigência
  data_inicio: Date
  data_fim: Date
  
  // Configurações gerais
  configuracoes: {
    moeda: string // 'BRL'
    permite_reajuste_automatico: boolean
    percentual_alerta_consumo: number // Ex: 80% para alertar quando consumir 80% do orçado
    percentual_bloqueio_consumo: number // Ex: 100% para bloquear quando consumir 100%
    considera_sazonalidade: boolean
    permite_transferencia_entre_categorias: boolean
    valor_maximo_transferencia?: number
  }
  
  // Categorias e subcategorias orçamentárias
  categorias: {
    codigo: string // Ex: "RECEITAS", "DESPESAS_ADMIN", "DESPESAS_MANUT"
    nome: string
    tipo: 'receita' | 'despesa'
    categoria_pai?: string // Para subcategorias
    descricao: string
    
    // Valores orçados
    orcamento_anual: number
    orcamento_mensal: number[]  // Array com 12 posições (jan a dez)
    
    // Valores realizados (calculado automaticamente)
    realizado_acumulado: number
    realizado_mensal: number[]  // Array com 12 posições
    
    // Projeções
    projecao_anual: number
    projecao_mensal: number[]
    
    // Métricas e controles
    percentual_consumido: number // 0-100
    percentual_variacao: number // Diferença entre orçado e realizado
    status_categoria: 'dentro_meta' | 'atencao' | 'excedido' | 'bloqueado'
    
    // Configurações específicas da categoria
    permite_ajuste_automatico: boolean
    indice_reajuste?: string // Ex: "IPCA", "IGP-M"
    percentual_reserva: number // % de reserva de segurança
    
    // Centro de custo associado
    centro_custo?: string
    responsavel_categoria?: mongoose.Types.ObjectId
    
    // Justificativas e observações
    justificativa_orcamento?: string
    observacoes?: string
    
    // Histórico de alterações na categoria
    historico_alteracoes: {
      data_alteracao: Date
      usuario_id: mongoose.Types.ObjectId
      campo_alterado: string
      valor_anterior: any
      valor_novo: any
      motivo: string
    }[]
  }[]
  
  // Metas e indicadores
  metas: {
    codigo_meta: string
    nome: string
    descricao: string
    tipo_meta: 'valor_absoluto' | 'percentual' | 'razao' | 'indice'
    
    // Definição da meta
    valor_meta: number
    unidade_medida: string // Ex: "reais", "percentual", "dias"
    periodo_avaliacao: 'mensal' | 'trimestral' | 'semestral' | 'anual'
    
    // Fórmula de cálculo (para metas complexas)
    formula_calculo?: string
    categorias_relacionadas: string[]
    
    // Status da meta
    valor_atual: number
    percentual_atingido: number
    status_meta: 'nao_iniciado' | 'em_andamento' | 'atingido' | 'excedido' | 'nao_atingido'
    
    // Configurações de alerta
    alertar_quando: 'abaixo' | 'acima' | 'igual'
    percentual_alerta: number
    
    // Responsabilidade
    responsavel_meta?: mongoose.Types.ObjectId
    data_ultima_atualizacao: Date
  }[]
  
  // Cenários de planejamento
  cenarios: {
    nome_cenario: string // Ex: "Otimista", "Conservador", "Pessimista"
    descricao: string
    premissas: string[]
    ativo: boolean
    
    // Ajustes percentuais por categoria
    ajustes_receitas: number // Ex: +15% para cenário otimista
    ajustes_despesas: number
    
    // Valores totais do cenário
    total_receitas_cenario: number
    total_despesas_cenario: number
    resultado_cenario: number
    
    // Probabilidade de ocorrência
    probabilidade: number // 0-100
  }[]
  
  // Resumo financeiro consolidado
  resumo_financeiro: {
    // Receitas
    total_receitas_orcadas: number
    total_receitas_realizadas: number
    total_receitas_projetadas: number
    
    // Despesas
    total_despesas_orcadas: number
    total_despesas_realizadas: number
    total_despesas_projetadas: number
    
    // Resultado
    resultado_orcado: number
    resultado_realizado: number
    resultado_projetado: number
    
    // Indicadores
    margem_orcada: number // %
    margem_realizada: number // %
    eficiencia_orcamentaria: number // % de aderência ao orçado
    
    // Alertas globais
    categorias_em_alerta: number
    categorias_excedidas: number
    valor_total_excesso: number
  }
  
  // Controle de aprovações
  aprovacoes: {
    nivel_aprovacao: 'sindico' | 'conselho' | 'assembleia' | 'master'
    aprovado_por?: mongoose.Types.ObjectId
    data_aprovacao?: Date
    observacoes_aprovacao?: string
    documento_aprovacao?: string // URL do documento
    
    // Histórico de aprovações
    historico_aprovacoes: {
      nivel: string
      aprovador_id: mongoose.Types.ObjectId
      aprovador_nome: string
      data_aprovacao: Date
      acao: 'aprovado' | 'rejeitado' | 'solicitada_revisao'
      observacoes?: string
    }[]
  }
  
  // Monitoramento e controle
  monitoramento: {
    frequencia_atualizacao: 'diaria' | 'semanal' | 'mensal'
    ultima_atualizacao: Date
    proximo_review: Date
    
    // Alertas ativos
    alertas_ativos: {
      tipo_alerta: 'meta_nao_atingida' | 'categoria_excedida' | 'variacao_alta' | 'projecao_negativa'
      categoria_afetada?: string
      meta_afetada?: string
      severidade: 'baixa' | 'media' | 'alta' | 'critica'
      mensagem: string
      data_criacao: Date
      resolvido: boolean
    }[]
    
    // Indicadores de performance
    kpis: {
      aderencia_orcamentaria: number // %
      previsibilidade: number // %
      eficacia_controle: number // %
      tempo_medio_aprovacao: number // dias
    }
  }
  
  // Anexos e documentação
  documentos: {
    tipo_documento: 'planilha_detalhada' | 'apresentacao' | 'ata_aprovacao' | 'justificativas' | 'outros'
    nome_arquivo: string
    url_documento: string
    data_upload: Date
    tamanho_bytes: number
    usuario_upload: mongoose.Types.ObjectId
  }[]
  
  // Auditoria
  data_criacao: Date
  data_atualizacao: Date
  criado_por: mongoose.Types.ObjectId
  modificado_por?: mongoose.Types.ObjectId
  
  // Logs de alterações importantes
  logs_auditoria: {
    data_evento: Date
    usuario_id: mongoose.Types.ObjectId
    tipo_evento: 'criacao' | 'edicao' | 'aprovacao' | 'rejeicao' | 'finalizacao' | 'cancelamento'
    detalhes: string
    dados_anteriores?: any
    dados_novos?: any
  }[]
}

const HistoricoAlteracaoSchema = new Schema({
  data_alteracao: { type: Date, default: Date.now },
  usuario_id: { type: Schema.Types.ObjectId, required: true },
  campo_alterado: { type: String, required: true },
  valor_anterior: Schema.Types.Mixed,
  valor_novo: Schema.Types.Mixed,
  motivo: { type: String, required: true }
})

const CategoriaSchema = new Schema({
  codigo: { 
    type: String, 
    required: true,
    uppercase: true,
    trim: true
  },
  nome: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 100
  },
  tipo: { 
    type: String, 
    enum: ['receita', 'despesa'],
    required: true 
  },
  categoria_pai: String,
  descricao: { 
    type: String,
    maxlength: 500
  },
  
  // Valores orçamentários
  orcamento_anual: { 
    type: Number, 
    required: true,
    min: 0
  },
  orcamento_mensal: {
    type: [Number],
    validate: [arrayLimit12, 'Deve ter exatamente 12 valores mensais'],
    default: () => new Array(12).fill(0)
  },
  
  // Valores realizados
  realizado_acumulado: { type: Number, default: 0 },
  realizado_mensal: {
    type: [Number],
    default: () => new Array(12).fill(0)
  },
  
  // Projeções
  projecao_anual: { type: Number, default: 0 },
  projecao_mensal: {
    type: [Number],
    default: () => new Array(12).fill(0)
  },
  
  // Métricas
  percentual_consumido: { type: Number, default: 0, min: 0 },
  percentual_variacao: { type: Number, default: 0 },
  status_categoria: { 
    type: String, 
    enum: ['dentro_meta', 'atencao', 'excedido', 'bloqueado'],
    default: 'dentro_meta'
  },
  
  // Configurações
  permite_ajuste_automatico: { type: Boolean, default: false },
  indice_reajuste: String,
  percentual_reserva: { type: Number, default: 0, min: 0, max: 50 },
  
  // Controle
  centro_custo: String,
  responsavel_categoria: Schema.Types.ObjectId,
  justificativa_orcamento: String,
  observacoes: String,
  
  // Histórico
  historico_alteracoes: [HistoricoAlteracaoSchema]
}, { _id: false })

const MetaSchema = new Schema({
  codigo_meta: { 
    type: String, 
    required: true,
    uppercase: true,
    trim: true
  },
  nome: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 100
  },
  descricao: { 
    type: String,
    maxlength: 500
  },
  tipo_meta: { 
    type: String, 
    enum: ['valor_absoluto', 'percentual', 'razao', 'indice'],
    required: true 
  },
  
  // Definição
  valor_meta: { type: Number, required: true },
  unidade_medida: { type: String, required: true },
  periodo_avaliacao: { 
    type: String, 
    enum: ['mensal', 'trimestral', 'semestral', 'anual'],
    required: true 
  },
  
  // Cálculo
  formula_calculo: String,
  categorias_relacionadas: [String],
  
  // Status
  valor_atual: { type: Number, default: 0 },
  percentual_atingido: { type: Number, default: 0 },
  status_meta: { 
    type: String, 
    enum: ['nao_iniciado', 'em_andamento', 'atingido', 'excedido', 'nao_atingido'],
    default: 'nao_iniciado'
  },
  
  // Alertas
  alertar_quando: { 
    type: String, 
    enum: ['abaixo', 'acima', 'igual'],
    default: 'abaixo'
  },
  percentual_alerta: { type: Number, default: 80, min: 0, max: 100 },
  
  // Controle
  responsavel_meta: Schema.Types.ObjectId,
  data_ultima_atualizacao: { type: Date, default: Date.now }
}, { _id: false })

const CenarioSchema = new Schema({
  nome_cenario: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 50
  },
  descricao: { 
    type: String,
    maxlength: 500
  },
  premissas: [String],
  ativo: { type: Boolean, default: true },
  
  // Ajustes
  ajustes_receitas: { type: Number, default: 0 },
  ajustes_despesas: { type: Number, default: 0 },
  
  // Valores do cenário
  total_receitas_cenario: { type: Number, default: 0 },
  total_despesas_cenario: { type: Number, default: 0 },
  resultado_cenario: { type: Number, default: 0 },
  
  // Probabilidade
  probabilidade: { type: Number, min: 0, max: 100, default: 50 }
}, { _id: false })

const AlertaSchema = new Schema({
  tipo_alerta: { 
    type: String, 
    enum: ['meta_nao_atingida', 'categoria_excedida', 'variacao_alta', 'projecao_negativa'],
    required: true 
  },
  categoria_afetada: String,
  meta_afetada: String,
  severidade: { 
    type: String, 
    enum: ['baixa', 'media', 'alta', 'critica'],
    required: true 
  },
  mensagem: { type: String, required: true },
  data_criacao: { type: Date, default: Date.now },
  resolvido: { type: Boolean, default: false }
})

const AprovacaoHistoricoSchema = new Schema({
  nivel: { type: String, required: true },
  aprovador_id: { type: Schema.Types.ObjectId, required: true },
  aprovador_nome: { type: String, required: true },
  data_aprovacao: { type: Date, default: Date.now },
  acao: { 
    type: String, 
    enum: ['aprovado', 'rejeitado', 'solicitada_revisao'],
    required: true 
  },
  observacoes: String
})

const DocumentoSchema = new Schema({
  tipo_documento: { 
    type: String, 
    enum: ['planilha_detalhada', 'apresentacao', 'ata_aprovacao', 'justificativas', 'outros'],
    required: true 
  },
  nome_arquivo: { type: String, required: true },
  url_documento: { type: String, required: true },
  data_upload: { type: Date, default: Date.now },
  tamanho_bytes: { type: Number, required: true },
  usuario_upload: { type: Schema.Types.ObjectId, required: true }
})

const LogAuditoriaSchema = new Schema({
  data_evento: { type: Date, default: Date.now },
  usuario_id: { type: Schema.Types.ObjectId, required: true },
  tipo_evento: { 
    type: String, 
    enum: ['criacao', 'edicao', 'aprovacao', 'rejeicao', 'finalizacao', 'cancelamento'],
    required: true 
  },
  detalhes: { type: String, required: true },
  dados_anteriores: Schema.Types.Mixed,
  dados_novos: Schema.Types.Mixed
})

const OrcamentoSchema = new Schema<IOrcamento>({
  // Identificação
  condominio_id: { type: Schema.Types.ObjectId, ref: 'Condominio', required: true },
  master_id: { type: Schema.Types.ObjectId, ref: 'Master', required: true },
  
  // Informações básicas
  nome: { 
    type: String, 
    required: true,
    trim: true,
    minlength: 3,
    maxlength: 100
  },
  descricao: { 
    type: String,
    trim: true,
    maxlength: 500
  },
  ano_referencia: { 
    type: Number, 
    required: true,
    min: 2020,
    max: 2030
  },
  status: { 
    type: String, 
    enum: ['rascunho', 'aprovado', 'em_execucao', 'finalizado', 'cancelado'],
    default: 'rascunho'
  },
  versao: { type: Number, default: 1, min: 1 },
  orcamento_anterior_id: { type: Schema.Types.ObjectId, ref: 'Orcamento' },
  
  // Período
  data_inicio: { type: Date, required: true },
  data_fim: { type: Date, required: true },
  
  // Configurações
  configuracoes: {
    moeda: { type: String, default: 'BRL' },
    permite_reajuste_automatico: { type: Boolean, default: false },
    percentual_alerta_consumo: { type: Number, default: 80, min: 50, max: 100 },
    percentual_bloqueio_consumo: { type: Number, default: 100, min: 80, max: 120 },
    considera_sazonalidade: { type: Boolean, default: true },
    permite_transferencia_entre_categorias: { type: Boolean, default: false },
    valor_maximo_transferencia: Number
  },
  
  // Categorias e estrutura
  categorias: { 
    type: [CategoriaSchema],
    validate: [arrayMinSize, 'Deve ter pelo menos uma categoria']
  },
  metas: [MetaSchema],
  cenarios: [CenarioSchema],
  
  // Resumo financeiro
  resumo_financeiro: {
    // Receitas
    total_receitas_orcadas: { type: Number, default: 0 },
    total_receitas_realizadas: { type: Number, default: 0 },
    total_receitas_projetadas: { type: Number, default: 0 },
    
    // Despesas
    total_despesas_orcadas: { type: Number, default: 0 },
    total_despesas_realizadas: { type: Number, default: 0 },
    total_despesas_projetadas: { type: Number, default: 0 },
    
    // Resultado
    resultado_orcado: { type: Number, default: 0 },
    resultado_realizado: { type: Number, default: 0 },
    resultado_projetado: { type: Number, default: 0 },
    
    // Indicadores
    margem_orcada: { type: Number, default: 0 },
    margem_realizada: { type: Number, default: 0 },
    eficiencia_orcamentaria: { type: Number, default: 100 },
    
    // Alertas
    categorias_em_alerta: { type: Number, default: 0 },
    categorias_excedidas: { type: Number, default: 0 },
    valor_total_excesso: { type: Number, default: 0 }
  },
  
  // Aprovações
  aprovacoes: {
    nivel_aprovacao: { 
      type: String, 
      enum: ['sindico', 'conselho', 'assembleia', 'master'],
      default: 'sindico'
    },
    aprovado_por: Schema.Types.ObjectId,
    data_aprovacao: Date,
    observacoes_aprovacao: String,
    documento_aprovacao: String,
    historico_aprovacoes: [AprovacaoHistoricoSchema]
  },
  
  // Monitoramento
  monitoramento: {
    frequencia_atualizacao: { 
      type: String, 
      enum: ['diaria', 'semanal', 'mensal'],
      default: 'mensal'
    },
    ultima_atualizacao: { type: Date, default: Date.now },
    proximo_review: Date,
    alertas_ativos: [AlertaSchema],
    kpis: {
      aderencia_orcamentaria: { type: Number, default: 100 },
      previsibilidade: { type: Number, default: 100 },
      eficacia_controle: { type: Number, default: 100 },
      tempo_medio_aprovacao: { type: Number, default: 0 }
    }
  },
  
  // Documentos
  documentos: [DocumentoSchema],
  
  // Auditoria
  data_criacao: { type: Date, default: Date.now },
  data_atualizacao: { type: Date, default: Date.now },
  criado_por: { type: Schema.Types.ObjectId, required: true },
  modificado_por: Schema.Types.ObjectId,
  
  // Logs
  logs_auditoria: [LogAuditoriaSchema]
}, {
  timestamps: true,
  collection: 'orcamentos'
})

// Validadores personalizados
function arrayLimit12(val: any[]) {
  return val.length === 12
}

function arrayMinSize(val: any[]) {
  return val.length >= 1
}

// Índices para performance
OrcamentoSchema.index({ condominio_id: 1, ano_referencia: 1 })
OrcamentoSchema.index({ master_id: 1, status: 1 })
OrcamentoSchema.index({ ano_referencia: 1, status: 1 })
OrcamentoSchema.index({ 'aprovacoes.nivel_aprovacao': 1, status: 1 })

// Middleware para validações e cálculos automáticos
OrcamentoSchema.pre('save', function(next) {
  this.data_atualizacao = new Date()
  
  // Calcular totais automaticamente
  this.calcularResumoFinanceiro()
  
  // Atualizar status das categorias
  this.atualizarStatusCategorias()
  
  // Verificar metas
  this.verificarMetas()
  
  next()
})

// Método para calcular resumo financeiro
OrcamentoSchema.methods.calcularResumoFinanceiro = function() {
  const resumo = this.resumo_financeiro
  
  // Receitas
  resumo.total_receitas_orcadas = this.categorias
    .filter(cat => cat.tipo === 'receita')
    .reduce((sum, cat) => sum + cat.orcamento_anual, 0)
    
  resumo.total_receitas_realizadas = this.categorias
    .filter(cat => cat.tipo === 'receita')
    .reduce((sum, cat) => sum + cat.realizado_acumulado, 0)
    
  resumo.total_receitas_projetadas = this.categorias
    .filter(cat => cat.tipo === 'receita')
    .reduce((sum, cat) => sum + cat.projecao_anual, 0)
  
  // Despesas
  resumo.total_despesas_orcadas = this.categorias
    .filter(cat => cat.tipo === 'despesa')
    .reduce((sum, cat) => sum + cat.orcamento_anual, 0)
    
  resumo.total_despesas_realizadas = this.categorias
    .filter(cat => cat.tipo === 'despesa')
    .reduce((sum, cat) => sum + cat.realizado_acumulado, 0)
    
  resumo.total_despesas_projetadas = this.categorias
    .filter(cat => cat.tipo === 'despesa')
    .reduce((sum, cat) => sum + cat.projecao_anual, 0)
  
  // Resultado
  resumo.resultado_orcado = resumo.total_receitas_orcadas - resumo.total_despesas_orcadas
  resumo.resultado_realizado = resumo.total_receitas_realizadas - resumo.total_despesas_realizadas
  resumo.resultado_projetado = resumo.total_receitas_projetadas - resumo.total_despesas_projetadas
  
  // Indicadores
  if (resumo.total_receitas_orcadas > 0) {
    resumo.margem_orcada = (resumo.resultado_orcado / resumo.total_receitas_orcadas) * 100
  }
  
  if (resumo.total_receitas_realizadas > 0) {
    resumo.margem_realizada = (resumo.resultado_realizado / resumo.total_receitas_realizadas) * 100
  }
  
  // Eficiência orçamentária
  const totalOrcado = resumo.total_receitas_orcadas + resumo.total_despesas_orcadas
  const totalRealizado = resumo.total_receitas_realizadas + resumo.total_despesas_realizadas
  
  if (totalOrcado > 0) {
    resumo.eficiencia_orcamentaria = Math.abs(100 - Math.abs((totalRealizado - totalOrcado) / totalOrcado * 100))
  }
}

// Método para atualizar status das categorias
OrcamentoSchema.methods.atualizarStatusCategorias = function() {
  let categoriasAlerta = 0
  let categoriasExcedidas = 0
  let valorTotalExcesso = 0
  
  this.categorias.forEach(categoria => {
    // Calcular percentual consumido
    if (categoria.orcamento_anual > 0) {
      categoria.percentual_consumido = (categoria.realizado_acumulado / categoria.orcamento_anual) * 100
    }
    
    // Calcular variação
    categoria.percentual_variacao = categoria.percentual_consumido - 100
    
    // Determinar status
    const percentualAlerta = this.configuracoes.percentual_alerta_consumo
    const percentualBloqueio = this.configuracoes.percentual_bloqueio_consumo
    
    if (categoria.percentual_consumido >= percentualBloqueio) {
      categoria.status_categoria = 'bloqueado'
      categoriasExcedidas++
      valorTotalExcesso += categoria.realizado_acumulado - categoria.orcamento_anual
    } else if (categoria.percentual_consumido >= percentualAlerta) {
      categoria.status_categoria = 'atencao'
      categoriasAlerta++
    } else if (categoria.percentual_consumido > 100) {
      categoria.status_categoria = 'excedido'
      categoriasExcedidas++
      valorTotalExcesso += categoria.realizado_acumulado - categoria.orcamento_anual
    } else {
      categoria.status_categoria = 'dentro_meta'
    }
  })
  
  // Atualizar resumo
  this.resumo_financeiro.categorias_em_alerta = categoriasAlerta
  this.resumo_financeiro.categorias_excedidas = categoriasExcedidas
  this.resumo_financeiro.valor_total_excesso = Math.max(0, valorTotalExcesso)
}

// Método para verificar metas
OrcamentoSchema.methods.verificarMetas = function() {
  this.metas.forEach(meta => {
    // Aqui seria implementada a lógica específica para cada tipo de meta
    // Por exemplo, calcular indicadores baseados nas fórmulas
    
    meta.data_ultima_atualizacao = new Date()
    
    // Calcular percentual atingido
    if (meta.valor_meta > 0) {
      meta.percentual_atingido = (meta.valor_atual / meta.valor_meta) * 100
    }
    
    // Determinar status
    if (meta.percentual_atingido >= 100) {
      meta.status_meta = 'atingido'
    } else if (meta.percentual_atingido >= meta.percentual_alerta) {
      meta.status_meta = 'em_andamento'
    } else if (meta.valor_atual > 0) {
      meta.status_meta = 'em_andamento'
    } else {
      meta.status_meta = 'nao_iniciado'
    }
  })
}

// Método para aprovar orçamento
OrcamentoSchema.methods.aprovar = function(
  aprovadorId: mongoose.Types.ObjectId,
  aprovadorNome: string,
  nivel: string,
  observacoes?: string
) {
  this.aprovacoes.historico_aprovacoes.push({
    nivel,
    aprovador_id: aprovadorId,
    aprovador_nome: aprovadorNome,
    data_aprovacao: new Date(),
    acao: 'aprovado',
    observacoes
  })
  
  this.aprovacoes.aprovado_por = aprovadorId
  this.aprovacoes.data_aprovacao = new Date()
  this.aprovacoes.observacoes_aprovacao = observacoes
  
  if (this.status === 'rascunho') {
    this.status = 'aprovado'
  }
  
  this.adicionarLogAuditoria(aprovadorId, 'aprovacao', `Orçamento aprovado no nível ${nivel}`)
}

// Método para adicionar log de auditoria
OrcamentoSchema.methods.adicionarLogAuditoria = function(
  usuarioId: mongoose.Types.ObjectId,
  tipoEvento: string,
  detalhes: string,
  dadosAnteriores?: any,
  dadosNovos?: any
) {
  this.logs_auditoria.push({
    data_evento: new Date(),
    usuario_id: usuarioId,
    tipo_evento: tipoEvento,
    detalhes,
    dados_anteriores: dadosAnteriores,
    dados_novos: dadosNovos
  })
  
  // Manter apenas últimos 1000 logs
  if (this.logs_auditoria.length > 1000) {
    this.logs_auditoria = this.logs_auditoria.slice(-1000)
  }
}

// Método para atualizar realizado de uma categoria
OrcamentoSchema.methods.atualizarRealizado = function(
  codigoCategoria: string,
  mes: number,
  valor: number
) {
  const categoria = this.categorias.find(cat => cat.codigo === codigoCategoria)
  if (!categoria) return false
  
  // Atualizar valor mensal
  categoria.realizado_mensal[mes - 1] = valor
  
  // Recalcular acumulado
  categoria.realizado_acumulado = categoria.realizado_mensal.reduce((sum, val) => sum + val, 0)
  
  // Recalcular totais
  this.calcularResumoFinanceiro()
  this.atualizarStatusCategorias()
  
  return true
}

export default mongoose.models.Orcamento || mongoose.model<IOrcamento>('Orcamento', OrcamentoSchema)

// Funções utilitárias para criação de orçamentos
export const criarOrcamentoPadrao = (
  condominioId: mongoose.Types.ObjectId,
  masterId: mongoose.Types.ObjectId,
  usuarioId: mongoose.Types.ObjectId,
  anoReferencia: number
) => {
  const dataInicio = new Date(anoReferencia, 0, 1)
  const dataFim = new Date(anoReferencia, 11, 31)
  
  return new (mongoose.models.Orcamento || mongoose.model<IOrcamento>('Orcamento', OrcamentoSchema))({
    condominio_id: condominioId,
    master_id: masterId,
    nome: `Orçamento ${anoReferencia}`,
    descricao: `Orçamento anual para o exercício de ${anoReferencia}`,
    ano_referencia: anoReferencia,
    data_inicio: dataInicio,
    data_fim: dataFim,
    criado_por: usuarioId,
    
    categorias: [
      // Receitas
      {
        codigo: 'REC_TAXA_COND',
        nome: 'Taxa Condominial',
        tipo: 'receita',
        descricao: 'Receitas provenientes da taxa condominial mensal',
        orcamento_anual: 120000, // Exemplo
        orcamento_mensal: new Array(12).fill(10000),
        permite_ajuste_automatico: true,
        percentual_reserva: 5,
        historico_alteracoes: []
      },
      {
        codigo: 'REC_FUNDO_RESERVA',
        nome: 'Fundo de Reserva',
        tipo: 'receita',
        descricao: 'Arrecadação para fundo de reserva',
        orcamento_anual: 24000,
        orcamento_mensal: new Array(12).fill(2000),
        permite_ajuste_automatico: false,
        percentual_reserva: 0,
        historico_alteracoes: []
      },
      
      // Despesas Administrativas
      {
        codigo: 'DESP_ADMIN_GERAL',
        nome: 'Despesas Administrativas',
        tipo: 'despesa',
        descricao: 'Despesas administrativas gerais',
        orcamento_anual: 36000,
        orcamento_mensal: new Array(12).fill(3000),
        permite_ajuste_automatico: true,
        percentual_reserva: 10,
        historico_alteracoes: []
      },
      
      // Despesas de Manutenção
      {
        codigo: 'DESP_MANUT_PREV',
        nome: 'Manutenção Preventiva',
        tipo: 'despesa',
        descricao: 'Gastos com manutenção preventiva',
        orcamento_anual: 48000,
        orcamento_mensal: new Array(12).fill(4000),
        permite_ajuste_automatico: true,
        percentual_reserva: 15,
        historico_alteracoes: []
      },
      
      // Utilidades
      {
        codigo: 'DESP_UTIL_AGUA',
        nome: 'Água e Esgoto',
        tipo: 'despesa',
        descricao: 'Despesas com água e esgoto',
        orcamento_anual: 18000,
        orcamento_mensal: new Array(12).fill(1500),
        permite_ajuste_automatico: true,
        percentual_reserva: 20,
        historico_alteracoes: []
      },
      {
        codigo: 'DESP_UTIL_ENERGIA',
        nome: 'Energia Elétrica',
        tipo: 'despesa',
        descricao: 'Despesas com energia elétrica',
        orcamento_anual: 24000,
        orcamento_mensal: new Array(12).fill(2000),
        permite_ajuste_automatico: true,
        percentual_reserva: 25,
        historico_alteracoes: []
      }
    ],
    
    metas: [
      {
        codigo_meta: 'META_INADIMPLENCIA',
        nome: 'Taxa de Inadimplência',
        descricao: 'Manter taxa de inadimplência abaixo de 5%',
        tipo_meta: 'percentual',
        valor_meta: 5,
        unidade_medida: 'percentual',
        periodo_avaliacao: 'mensal',
        alertar_quando: 'acima',
        percentual_alerta: 80,
        valor_atual: 0,
        percentual_atingido: 0,
        status_meta: 'nao_iniciado',
        categorias_relacionadas: ['REC_TAXA_COND'],
        data_ultima_atualizacao: new Date()
      },
      {
        codigo_meta: 'META_ECONOMIA_ENERGIA',
        nome: 'Economia de Energia',
        descricao: 'Reduzir gastos com energia em 10% em relação ao ano anterior',
        tipo_meta: 'percentual',
        valor_meta: 10,
        unidade_medida: 'percentual',
        periodo_avaliacao: 'anual',
        alertar_quando: 'abaixo',
        percentual_alerta: 50,
        valor_atual: 0,
        percentual_atingido: 0,
        status_meta: 'nao_iniciado',
        categorias_relacionadas: ['DESP_UTIL_ENERGIA'],
        data_ultima_atualizacao: new Date()
      }
    ],
    
    cenarios: [
      {
        nome_cenario: 'Conservador',
        descricao: 'Cenário conservador com crescimento mínimo',
        premissas: ['Inflação de 4%', 'Sem inadimplência adicional', 'Manutenção apenas preventiva'],
        ativo: true,
        ajustes_receitas: 4,
        ajustes_despesas: 6,
        probabilidade: 70,
        total_receitas_cenario: 149760, // +4%
        total_despesas_cenario: 158880, // +6%
        resultado_cenario: -9120
      },
      {
        nome_cenario: 'Otimista',
        descricao: 'Cenário otimista com crescimento acelerado',
        premissas: ['Inflação de 3%', 'Redução de inadimplência', 'Economia em contratos'],
        ativo: true,
        ajustes_receitas: 8,
        ajustes_despesas: 3,
        probabilidade: 20,
        total_receitas_cenario: 155520, // +8%
        total_despesas_cenario: 154080, // +3%
        resultado_cenario: 1440
      }
    ]
  })
}