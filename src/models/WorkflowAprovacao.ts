import mongoose, { Document, Schema } from 'mongoose'

export interface IWorkflowAprovacao extends Document {
  // Identificação
  condominio_id: mongoose.Types.ObjectId
  master_id: mongoose.Types.ObjectId
  
  // Configuração do workflow
  nome: string
  descricao: string
  tipo_documento: 'orcamento' | 'lancamento_financeiro' | 'despesa_extra' | 'contrato' | 
                  'alteracao_taxa' | 'obra' | 'assembleia' | 'regulamento' | 'personalizado'
  
  categoria: 'financeiro' | 'administrativo' | 'operacional' | 'legal' | 'obras'
  
  // Configuração de trigger (quando o workflow é acionado)
  triggers: {
    tipo_trigger: 'valor_minimo' | 'categoria_especifica' | 'usuario_criador' | 'data_limite' | 'personalizado'
    condicoes: {
      valor_minimo?: number
      categorias?: string[]
      usuarios_excluidos?: mongoose.Types.ObjectId[]
      prazo_limite?: number // dias
      condicao_personalizada?: string
    }
  }
  
  // Níveis de aprovação (sequencial)
  niveis_aprovacao: {
    ordem: number
    nome_nivel: string
    descricao: string
    tipo_aprovador: 'sindico' | 'subsindico' | 'conselho' | 'assembleia' | 'master' | 'usuario_especifico' | 'grupo'
    
    // Aprovadores específicos
    aprovadores: {
      usuario_id?: mongoose.Types.ObjectId
      usuario_nome?: string
      grupo_id?: mongoose.Types.ObjectId
      grupo_nome?: string
      email_notificacao?: string
    }[]
    
    // Configurações do nível
    configuracoes_nivel: {
      aprovacao_obrigatoria: boolean
      permite_delegacao: boolean
      aprovacao_unanime: boolean // Para grupos
      aprovacao_maioria_simples: boolean
      quorum_minimo?: number
      prazo_aprovacao_dias: number
      escalacao_automatica: boolean
      nivel_escalacao?: number // Para qual nível escalar se não aprovado
      permite_aprovacao_condicional: boolean
    }
    
    // Ações disponíveis neste nível
    acoes_permitidas: ('aprovar' | 'rejeitar' | 'solicitar_alteracao' | 'delegar' | 'pular_nivel')[]
    
    // Campos que podem ser editados neste nível
    campos_editaveis?: string[]
    
    // Notificações
    notificacoes: {
      enviar_email: boolean
      enviar_sms: boolean
      notificar_sistema: boolean
      template_notificacao?: string
      lembrete_dias?: number[] // Ex: [1, 3, 7] - lembretes em 1, 3 e 7 dias
    }
  }[]
  
  // Configurações gerais do workflow
  configuracoes_gerais: {
    permite_aprovacao_paralela: boolean // Se níveis podem aprovar em paralelo
    revoga_aprovacoes_anteriores_se_editado: boolean
    requer_justificativa_aprovacao: boolean
    requer_justificativa_rejeicao: boolean
    permite_anexos: boolean
    historico_completo_obrigatorio: boolean
    prazo_total_workflow: number // dias
    acao_prazo_vencido: 'aprovar_automatico' | 'rejeitar_automatico' | 'escalar' | 'notificar_apenas'
  }
  
  // Status e controle
  ativo: boolean
  versao: number
  workflow_pai_id?: mongoose.Types.ObjectId // Para versioning
  aplicavel_a_documentos_existentes: boolean
  data_inicio_vigencia: Date
  data_fim_vigencia?: Date
  
  // Métricas de performance
  metricas: {
    total_processos_iniciados: number
    processos_aprovados: number
    processos_rejeitados: number
    processos_em_andamento: number
    tempo_medio_aprovacao: number // horas
    taxa_aprovacao: number // %
    nivel_com_mais_rejeicoes: number
    tempo_medio_por_nivel: number[]
  }
  
  // Auditoria
  data_criacao: Date
  data_atualizacao: Date
  criado_por: mongoose.Types.ObjectId
  modificado_por?: mongoose.Types.ObjectId
  
  // Logs de alterações no workflow
  logs_alteracoes: {
    data_alteracao: Date
    usuario_id: mongoose.Types.ObjectId
    tipo_alteracao: 'criacao' | 'edicao' | 'ativacao' | 'desativacao' | 'nova_versao'
    detalhes: string
    alteracoes: {
      campo: string
      valor_anterior: any
      valor_novo: any
    }[]
  }[]
}

export interface IProcessoAprovacao extends Document {
  // Identificação
  workflow_id: mongoose.Types.ObjectId
  condominio_id: mongoose.Types.ObjectId
  master_id: mongoose.Types.ObjectId
  
  // Documento sendo aprovado
  documento: {
    tipo: string
    documento_id: mongoose.Types.ObjectId
    titulo: string
    descricao: string
    valor_total?: number
    categoria?: string
    criado_por: mongoose.Types.ObjectId
    criado_por_nome: string
    data_criacao: Date
    
    // Dados específicos por tipo de documento
    dados_documento: any
    
    // Anexos
    anexos: {
      nome_arquivo: string
      url_arquivo: string
      tipo_arquivo: string
      tamanho_bytes: number
      data_upload: Date
      usuario_upload: mongoose.Types.ObjectId
    }[]
    
    // Versões do documento
    versoes: {
      versao: number
      data_versao: Date
      alterado_por: mongoose.Types.ObjectId
      resumo_alteracoes: string
      snapshot_dados: any
    }[]
  }
  
  // Status do processo
  status_processo: 'iniciado' | 'em_andamento' | 'aprovado' | 'rejeitado' | 'cancelado' | 'expirado'
  nivel_atual: number
  data_inicio: Date
  data_fim?: Date
  prazo_final: Date
  
  // Histórico de aprovações
  historico_aprovacoes: {
    nivel: number
    nome_nivel: string
    aprovador_id: mongoose.Types.ObjectId
    aprovador_nome: string
    acao: 'aprovado' | 'rejeitado' | 'solicitada_alteracao' | 'delegado' | 'pulado'
    data_acao: Date
    justificativa?: string
    observacoes?: string
    tempo_decisao_horas: number
    
    // Para delegações
    delegado_para?: mongoose.Types.ObjectId
    delegado_para_nome?: string
    
    // Para aprovações condicionais
    condicoes?: string[]
    
    // Anexos da decisão
    anexos_decisao?: {
      nome_arquivo: string
      url_arquivo: string
      tipo_arquivo: string
    }[]
  }[]
  
  // Pendências atuais
  pendencias_atuais: {
    nivel: number
    aprovador_id: mongoose.Types.ObjectId
    aprovador_nome: string
    data_solicitacao: Date
    prazo_resposta: Date
    notificacoes_enviadas: number
    ultima_notificacao: Date
    status_pendencia: 'aguardando' | 'visualizado' | 'em_analise' | 'vencido'
  }[]
  
  // Configurações específicas deste processo
  configuracoes_processo: {
    permite_edicao_durante_processo: boolean
    nivel_edicao_permitido?: number
    usuarios_podem_visualizar: mongoose.Types.ObjectId[]
    notificacoes_customizadas: boolean
    
    // Override de prazos
    prazos_customizados?: {
      nivel: number
      prazo_dias: number
    }[]
  }
  
  // Métricas do processo
  metricas_processo: {
    tempo_total_horas: number
    tempo_por_nivel: {
      nivel: number
      tempo_horas: number
      data_inicio: Date
      data_fim?: Date
    }[]
    numero_idas_voltas: number // Quantas vezes foi rejeitado e resubmetido
    numero_visualizacoes: number
    numero_comentarios: number
  }
  
  // Comentários e discussões
  comentarios: {
    usuario_id: mongoose.Types.ObjectId
    usuario_nome: string
    data_comentario: Date
    texto: string
    nivel_comentario?: number
    resposta_a?: mongoose.Types.ObjectId
    tipo_comentario: 'pergunta' | 'sugestao' | 'observacao' | 'decisao'
    anexos?: {
      nome_arquivo: string
      url_arquivo: string
    }[]
  }[]
  
  // Notificações
  notificacoes: {
    tipo_notificacao: 'inicio_processo' | 'pendencia_aprovacao' | 'processo_aprovado' | 'processo_rejeitado' | 'prazo_vencendo' | 'escalacao'
    destinatario_id: mongoose.Types.ObjectId
    data_envio: Date
    canal: 'email' | 'sms' | 'sistema' | 'whatsapp'
    status_entrega: 'enviado' | 'entregue' | 'visualizado' | 'erro'
    conteudo?: string
  }[]
  
  // Auditoria completa
  logs_auditoria: {
    data_evento: Date
    usuario_id: mongoose.Types.ObjectId
    tipo_evento: 'criacao' | 'aprovacao' | 'rejeicao' | 'edicao' | 'visualizacao' | 'comentario' | 'escalacao'
    detalhes: string
    ip_origem?: string
    user_agent?: string
    dados_evento?: any
  }[]
}

// Schema para configurações de nível
const ConfiguracoesNivelSchema = new Schema({
  aprovacao_obrigatoria: { type: Boolean, default: true },
  permite_delegacao: { type: Boolean, default: false },
  aprovacao_unanime: { type: Boolean, default: false },
  aprovacao_maioria_simples: { type: Boolean, default: true },
  quorum_minimo: Number,
  prazo_aprovacao_dias: { type: Number, default: 3, min: 1, max: 30 },
  escalacao_automatica: { type: Boolean, default: false },
  nivel_escalacao: Number,
  permite_aprovacao_condicional: { type: Boolean, default: false }
}, { _id: false })

const NotificacoesNivelSchema = new Schema({
  enviar_email: { type: Boolean, default: true },
  enviar_sms: { type: Boolean, default: false },
  notificar_sistema: { type: Boolean, default: true },
  template_notificacao: String,
  lembrete_dias: [{ type: Number, min: 1, max: 30 }]
}, { _id: false })

const AprovadorSchema = new Schema({
  usuario_id: Schema.Types.ObjectId,
  usuario_nome: String,
  grupo_id: Schema.Types.ObjectId,
  grupo_nome: String,
  email_notificacao: String
}, { _id: false })

const NivelAprovacaoSchema = new Schema({
  ordem: { type: Number, required: true, min: 1 },
  nome_nivel: { type: String, required: true, trim: true, maxlength: 100 },
  descricao: { type: String, maxlength: 500 },
  tipo_aprovador: { 
    type: String, 
    enum: ['sindico', 'subsindico', 'conselho', 'assembleia', 'master', 'usuario_especifico', 'grupo'],
    required: true 
  },
  aprovadores: [AprovadorSchema],
  configuracoes_nivel: ConfiguracoesNivelSchema,
  acoes_permitidas: [{
    type: String,
    enum: ['aprovar', 'rejeitar', 'solicitar_alteracao', 'delegar', 'pular_nivel']
  }],
  campos_editaveis: [String],
  notificacoes: NotificacoesNivelSchema
})

const TriggersSchema = new Schema({
  tipo_trigger: { 
    type: String, 
    enum: ['valor_minimo', 'categoria_especifica', 'usuario_criador', 'data_limite', 'personalizado'],
    required: true 
  },
  condicoes: {
    valor_minimo: Number,
    categorias: [String],
    usuarios_excluidos: [Schema.Types.ObjectId],
    prazo_limite: Number,
    condicao_personalizada: String
  }
}, { _id: false })

const LogAlteracaoSchema = new Schema({
  data_alteracao: { type: Date, default: Date.now },
  usuario_id: { type: Schema.Types.ObjectId, required: true },
  tipo_alteracao: { 
    type: String, 
    enum: ['criacao', 'edicao', 'ativacao', 'desativacao', 'nova_versao'],
    required: true 
  },
  detalhes: { type: String, required: true },
  alteracoes: [{
    campo: String,
    valor_anterior: Schema.Types.Mixed,
    valor_novo: Schema.Types.Mixed
  }]
})

const WorkflowAprovacaoSchema = new Schema<IWorkflowAprovacao>({
  // Identificação
  condominio_id: { type: Schema.Types.ObjectId, ref: 'Condominio', required: true },
  master_id: { type: Schema.Types.ObjectId, ref: 'Master', required: true },
  
  // Configuração
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
  tipo_documento: { 
    type: String, 
    enum: [
      'orcamento', 'lancamento_financeiro', 'despesa_extra', 'contrato',
      'alteracao_taxa', 'obra', 'assembleia', 'regulamento', 'personalizado'
    ],
    required: true 
  },
  categoria: { 
    type: String, 
    enum: ['financeiro', 'administrativo', 'operacional', 'legal', 'obras'],
    default: 'administrativo' 
  },
  
  // Configurações
  triggers: TriggersSchema,
  niveis_aprovacao: {
    type: [NivelAprovacaoSchema],
    validate: [arrayMinSize, 'Deve ter pelo menos um nível de aprovação']
  },
  
  configuracoes_gerais: {
    permite_aprovacao_paralela: { type: Boolean, default: false },
    revoga_aprovacoes_anteriores_se_editado: { type: Boolean, default: true },
    requer_justificativa_aprovacao: { type: Boolean, default: false },
    requer_justificativa_rejeicao: { type: Boolean, default: true },
    permite_anexos: { type: Boolean, default: true },
    historico_completo_obrigatorio: { type: Boolean, default: true },
    prazo_total_workflow: { type: Number, default: 15, min: 1, max: 365 },
    acao_prazo_vencido: { 
      type: String, 
      enum: ['aprovar_automatico', 'rejeitar_automatico', 'escalar', 'notificar_apenas'],
      default: 'notificar_apenas'
    }
  },
  
  // Status
  ativo: { type: Boolean, default: true },
  versao: { type: Number, default: 1, min: 1 },
  workflow_pai_id: { type: Schema.Types.ObjectId, ref: 'WorkflowAprovacao' },
  aplicavel_a_documentos_existentes: { type: Boolean, default: false },
  data_inicio_vigencia: { type: Date, default: Date.now },
  data_fim_vigencia: Date,
  
  // Métricas
  metricas: {
    total_processos_iniciados: { type: Number, default: 0 },
    processos_aprovados: { type: Number, default: 0 },
    processos_rejeitados: { type: Number, default: 0 },
    processos_em_andamento: { type: Number, default: 0 },
    tempo_medio_aprovacao: { type: Number, default: 0 },
    taxa_aprovacao: { type: Number, default: 100 },
    nivel_com_mais_rejeicoes: { type: Number, default: 1 },
    tempo_medio_por_nivel: [Number]
  },
  
  // Auditoria
  data_criacao: { type: Date, default: Date.now },
  data_atualizacao: { type: Date, default: Date.now },
  criado_por: { type: Schema.Types.ObjectId, required: true },
  modificado_por: Schema.Types.ObjectId,
  
  // Logs
  logs_alteracoes: [LogAlteracaoSchema]
}, {
  timestamps: true,
  collection: 'workflows-aprovacao'
})

// Schema para Processo de Aprovação
const DocumentoSchema = new Schema({
  tipo: { type: String, required: true },
  documento_id: { type: Schema.Types.ObjectId, required: true },
  titulo: { type: String, required: true },
  descricao: String,
  valor_total: Number,
  categoria: String,
  criado_por: { type: Schema.Types.ObjectId, required: true },
  criado_por_nome: { type: String, required: true },
  data_criacao: { type: Date, default: Date.now },
  dados_documento: Schema.Types.Mixed,
  anexos: [{
    nome_arquivo: String,
    url_arquivo: String,
    tipo_arquivo: String,
    tamanho_bytes: Number,
    data_upload: Date,
    usuario_upload: Schema.Types.ObjectId
  }],
  versoes: [{
    versao: Number,
    data_versao: Date,
    alterado_por: Schema.Types.ObjectId,
    resumo_alteracoes: String,
    snapshot_dados: Schema.Types.Mixed
  }]
}, { _id: false })

const HistoricoAprovacaoSchema = new Schema({
  nivel: { type: Number, required: true },
  nome_nivel: { type: String, required: true },
  aprovador_id: { type: Schema.Types.ObjectId, required: true },
  aprovador_nome: { type: String, required: true },
  acao: { 
    type: String, 
    enum: ['aprovado', 'rejeitado', 'solicitada_alteracao', 'delegado', 'pulado'],
    required: true 
  },
  data_acao: { type: Date, default: Date.now },
  justificativa: String,
  observacoes: String,
  tempo_decisao_horas: { type: Number, default: 0 },
  delegado_para: Schema.Types.ObjectId,
  delegado_para_nome: String,
  condicoes: [String],
  anexos_decisao: [{
    nome_arquivo: String,
    url_arquivo: String,
    tipo_arquivo: String
  }]
})

const PendenciaSchema = new Schema({
  nivel: { type: Number, required: true },
  aprovador_id: { type: Schema.Types.ObjectId, required: true },
  aprovador_nome: { type: String, required: true },
  data_solicitacao: { type: Date, default: Date.now },
  prazo_resposta: { type: Date, required: true },
  notificacoes_enviadas: { type: Number, default: 0 },
  ultima_notificacao: Date,
  status_pendencia: { 
    type: String, 
    enum: ['aguardando', 'visualizado', 'em_analise', 'vencido'],
    default: 'aguardando'
  }
})

const ComentarioSchema = new Schema({
  usuario_id: { type: Schema.Types.ObjectId, required: true },
  usuario_nome: { type: String, required: true },
  data_comentario: { type: Date, default: Date.now },
  texto: { type: String, required: true },
  nivel_comentario: Number,
  resposta_a: Schema.Types.ObjectId,
  tipo_comentario: { 
    type: String, 
    enum: ['pergunta', 'sugestao', 'observacao', 'decisao'],
    default: 'observacao'
  },
  anexos: [{
    nome_arquivo: String,
    url_arquivo: String
  }]
})

const ProcessoAprovacaoSchema = new Schema<IProcessoAprovacao>({
  // Identificação
  workflow_id: { type: Schema.Types.ObjectId, ref: 'WorkflowAprovacao', required: true },
  condominio_id: { type: Schema.Types.ObjectId, ref: 'Condominio', required: true },
  master_id: { type: Schema.Types.ObjectId, ref: 'Master', required: true },
  
  // Documento
  documento: DocumentoSchema,
  
  // Status
  status_processo: { 
    type: String, 
    enum: ['iniciado', 'em_andamento', 'aprovado', 'rejeitado', 'cancelado', 'expirado'],
    default: 'iniciado'
  },
  nivel_atual: { type: Number, default: 1, min: 1 },
  data_inicio: { type: Date, default: Date.now },
  data_fim: Date,
  prazo_final: { type: Date, required: true },
  
  // Histórico e pendências
  historico_aprovacoes: [HistoricoAprovacaoSchema],
  pendencias_atuais: [PendenciaSchema],
  
  // Configurações específicas
  configuracoes_processo: {
    permite_edicao_durante_processo: { type: Boolean, default: false },
    nivel_edicao_permitido: Number,
    usuarios_podem_visualizar: [Schema.Types.ObjectId],
    notificacoes_customizadas: { type: Boolean, default: false },
    prazos_customizados: [{
      nivel: Number,
      prazo_dias: Number
    }]
  },
  
  // Métricas
  metricas_processo: {
    tempo_total_horas: { type: Number, default: 0 },
    tempo_por_nivel: [{
      nivel: Number,
      tempo_horas: Number,
      data_inicio: Date,
      data_fim: Date
    }],
    numero_idas_voltas: { type: Number, default: 0 },
    numero_visualizacoes: { type: Number, default: 0 },
    numero_comentarios: { type: Number, default: 0 }
  },
  
  // Comentários
  comentarios: [ComentarioSchema],
  
  // Notificações
  notificacoes: [{
    tipo_notificacao: { 
      type: String, 
      enum: ['inicio_processo', 'pendencia_aprovacao', 'processo_aprovado', 'processo_rejeitado', 'prazo_vencendo', 'escalacao']
    },
    destinatario_id: Schema.Types.ObjectId,
    data_envio: Date,
    canal: { type: String, enum: ['email', 'sms', 'sistema', 'whatsapp'] },
    status_entrega: { type: String, enum: ['enviado', 'entregue', 'visualizado', 'erro'] },
    conteudo: String
  }],
  
  // Auditoria
  logs_auditoria: [{
    data_evento: { type: Date, default: Date.now },
    usuario_id: { type: Schema.Types.ObjectId, required: true },
    tipo_evento: { 
      type: String, 
      enum: ['criacao', 'aprovacao', 'rejeicao', 'edicao', 'visualizacao', 'comentario', 'escalacao']
    },
    detalhes: String,
    ip_origem: String,
    user_agent: String,
    dados_evento: Schema.Types.Mixed
  }]
}, {
  timestamps: true,
  collection: 'processos-aprovacao'
})

// Validadores personalizados
function arrayMinSize(val: any[]) {
  return val.length >= 1
}

// Índices para performance
WorkflowAprovacaoSchema.index({ condominio_id: 1, tipo_documento: 1, ativo: 1 })
WorkflowAprovacaoSchema.index({ master_id: 1, categoria: 1 })
WorkflowAprovacaoSchema.index({ data_inicio_vigencia: 1, data_fim_vigencia: 1 })

ProcessoAprovacaoSchema.index({ workflow_id: 1, status_processo: 1 })
ProcessoAprovacaoSchema.index({ condominio_id: 1, nivel_atual: 1 })
ProcessoAprovacaoSchema.index({ 'pendencias_atuais.aprovador_id': 1, 'pendencias_atuais.status_pendencia': 1 })
ProcessoAprovacaoSchema.index({ prazo_final: 1, status_processo: 1 })

// Middleware para atualizar timestamps
WorkflowAprovacaoSchema.pre('save', function(next) {
  this.data_atualizacao = new Date()
  next()
})

// Métodos do WorkflowAprovacao
WorkflowAprovacaoSchema.methods.verificaSeAplica = function(documento: any) {
  const trigger = this.triggers
  
  switch (trigger.tipo_trigger) {
    case 'valor_minimo':
      return documento.valor_total >= trigger.condicoes.valor_minimo
      
    case 'categoria_especifica':
      return trigger.condicoes.categorias?.includes(documento.categoria)
      
    case 'usuario_criador':
      return !trigger.condicoes.usuarios_excluidos?.includes(documento.criado_por)
      
    case 'data_limite':
      const prazoLimite = new Date()
      prazoLimite.setDate(prazoLimite.getDate() + trigger.condicoes.prazo_limite)
      return documento.data_vencimento <= prazoLimite
      
    default:
      return true
  }
}

WorkflowAprovacaoSchema.methods.adicionarLogAlteracao = function(
  usuarioId: mongoose.Types.ObjectId,
  tipoAlteracao: string,
  detalhes: string,
  alteracoes: any[] = []
) {
  this.logs_alteracoes.push({
    data_alteracao: new Date(),
    usuario_id: usuarioId,
    tipo_alteracao: tipoAlteracao,
    detalhes,
    alteracoes
  })
  
  // Manter apenas últimos 100 logs
  if (this.logs_alteracoes.length > 100) {
    this.logs_alteracoes = this.logs_alteracoes.slice(-100)
  }
}

// Métodos do ProcessoAprovacao
ProcessoAprovacaoSchema.methods.aprovar = function(
  nivel: number,
  aprovadorId: mongoose.Types.ObjectId,
  aprovadorNome: string,
  justificativa?: string,
  observacoes?: string
) {
  const inicioNivel = this.metricas_processo.tempo_por_nivel.find(t => t.nivel === nivel && !t.data_fim)
  const tempoDecisao = inicioNivel ? (Date.now() - inicioNivel.data_inicio.getTime()) / (1000 * 60 * 60) : 0
  
  // Adicionar ao histórico
  this.historico_aprovacoes.push({
    nivel,
    nome_nivel: `Nível ${nivel}`,
    aprovador_id: aprovadorId,
    aprovador_nome: aprovadorNome,
    acao: 'aprovado',
    data_acao: new Date(),
    justificativa,
    observacoes,
    tempo_decisao_horas: tempoDecisao
  })
  
  // Atualizar tempo do nível
  if (inicioNivel) {
    inicioNivel.data_fim = new Date()
    inicioNivel.tempo_horas = tempoDecisao
  }
  
  // Remover pendência
  this.pendencias_atuais = this.pendencias_atuais.filter(p => p.nivel !== nivel || p.aprovador_id.toString() !== aprovadorId.toString())
  
  // Verificar se pode avançar para próximo nível ou finalizar
  this.verificarProximoNivel()
  
  // Log de auditoria
  this.adicionarLogAuditoria(aprovadorId, 'aprovacao', `Aprovação no nível ${nivel}`)
}

ProcessoAprovacaoSchema.methods.rejeitar = function(
  nivel: number,
  aprovadorId: mongoose.Types.ObjectId,
  aprovadorNome: string,
  justificativa: string,
  observacoes?: string
) {
  const inicioNivel = this.metricas_processo.tempo_por_nivel.find(t => t.nivel === nivel && !t.data_fim)
  const tempoDecisao = inicioNivel ? (Date.now() - inicioNivel.data_inicio.getTime()) / (1000 * 60 * 60) : 0
  
  // Adicionar ao histórico
  this.historico_aprovacoes.push({
    nivel,
    nome_nivel: `Nível ${nivel}`,
    aprovador_id: aprovadorId,
    aprovador_nome: aprovadorNome,
    acao: 'rejeitado',
    data_acao: new Date(),
    justificativa,
    observacoes,
    tempo_decisao_horas: tempoDecisao
  })
  
  // Finalizar processo como rejeitado
  this.status_processo = 'rejeitado'
  this.data_fim = new Date()
  this.nivel_atual = -1
  
  // Limpar pendências
  this.pendencias_atuais = []
  
  // Atualizar métricas
  this.metricas_processo.numero_idas_voltas++
  this.calcularTempoTotal()
  
  // Log de auditoria
  this.adicionarLogAuditoria(aprovadorId, 'rejeicao', `Rejeição no nível ${nivel}: ${justificativa}`)
}

ProcessoAprovacaoSchema.methods.verificarProximoNivel = function() {
  // Implementar lógica para verificar se pode avançar para próximo nível
  // Por exemplo, verificar se todos os aprovadores do nível atual aprovaram
  
  const workflow = null // Buscar workflow associado
  if (!workflow) return
  
  const nivelAtual = workflow.niveis_aprovacao.find(n => n.ordem === this.nivel_atual)
  if (!nivelAtual) return
  
  // Verificar se nível está completo
  const aprovacoesNivel = this.historico_aprovacoes.filter(h => h.nivel === this.nivel_atual && h.acao === 'aprovado')
  
  let nivelCompleto = false
  
  if (nivelAtual.configuracoes_nivel.aprovacao_unanime) {
    nivelCompleto = aprovacoesNivel.length === nivelAtual.aprovadores.length
  } else if (nivelAtual.configuracoes_nivel.aprovacao_maioria_simples) {
    nivelCompleto = aprovacoesNivel.length > nivelAtual.aprovadores.length / 2
  } else {
    nivelCompleto = aprovacoesNivel.length >= 1
  }
  
  if (nivelCompleto) {
    // Avançar para próximo nível ou finalizar
    const proximoNivel = workflow.niveis_aprovacao.find(n => n.ordem === this.nivel_atual + 1)
    
    if (proximoNivel) {
      this.avancarParaProximoNivel(proximoNivel.ordem)
    } else {
      // Processo aprovado
      this.status_processo = 'aprovado'
      this.data_fim = new Date()
      this.calcularTempoTotal()
    }
  }
}

ProcessoAprovacaoSchema.methods.avancarParaProximoNivel = function(proximoNivel: number) {
  this.nivel_atual = proximoNivel
  
  // Adicionar tempo do nível
  this.metricas_processo.tempo_por_nivel.push({
    nivel: proximoNivel,
    tempo_horas: 0,
    data_inicio: new Date()
  })
  
  // Criar pendências para o novo nível
  // (Implementar busca de aprovadores do nível)
}

ProcessoAprovacaoSchema.methods.calcularTempoTotal = function() {
  if (this.data_fim) {
    this.metricas_processo.tempo_total_horas = (this.data_fim.getTime() - this.data_inicio.getTime()) / (1000 * 60 * 60)
  }
}

ProcessoAprovacaoSchema.methods.adicionarLogAuditoria = function(
  usuarioId: mongoose.Types.ObjectId,
  tipoEvento: string,
  detalhes: string,
  dadosEvento?: any
) {
  this.logs_auditoria.push({
    data_evento: new Date(),
    usuario_id: usuarioId,
    tipo_evento: tipoEvento,
    detalhes,
    dados_evento: dadosEvento
  })
  
  // Manter apenas últimos 500 logs
  if (this.logs_auditoria.length > 500) {
    this.logs_auditoria = this.logs_auditoria.slice(-500)
  }
}

ProcessoAprovacaoSchema.methods.adicionarComentario = function(
  usuarioId: mongoose.Types.ObjectId,
  usuarioNome: string,
  texto: string,
  tipoComentario: string = 'observacao',
  nivelComentario?: number
) {
  this.comentarios.push({
    usuario_id: usuarioId,
    usuario_nome: usuarioNome,
    data_comentario: new Date(),
    texto,
    tipo_comentario: tipoComentario,
    nivel_comentario: nivelComentario
  })
  
  this.metricas_processo.numero_comentarios++
  
  this.adicionarLogAuditoria(usuarioId, 'comentario', `Comentário adicionado: ${texto.substring(0, 100)}...`)
}

export const WorkflowAprovacao = mongoose.models.WorkflowAprovacao || mongoose.model<IWorkflowAprovacao>('WorkflowAprovacao', WorkflowAprovacaoSchema)
export const ProcessoAprovacao = mongoose.models.ProcessoAprovacao || mongoose.model<IProcessoAprovacao>('ProcessoAprovacao', ProcessoAprovacaoSchema)

export default { WorkflowAprovacao, ProcessoAprovacao }

// Funções utilitárias para criação de workflows padrão
export const criarWorkflowOrcamento = (
  condominioId: mongoose.Types.ObjectId,
  masterId: mongoose.Types.ObjectId,
  usuarioId: mongoose.Types.ObjectId
) => {
  return new WorkflowAprovacao({
    condominio_id: condominioId,
    master_id: masterId,
    nome: 'Aprovação de Orçamento Anual',
    descricao: 'Workflow para aprovação do orçamento anual do condomínio',
    tipo_documento: 'orcamento',
    categoria: 'financeiro',
    triggers: {
      tipo_trigger: 'valor_minimo',
      condicoes: {
        valor_minimo: 0 // Todos os orçamentos passam por aprovação
      }
    },
    niveis_aprovacao: [
      {
        ordem: 1,
        nome_nivel: 'Aprovação Sindical',
        descricao: 'Aprovação inicial pelo síndico',
        tipo_aprovador: 'sindico',
        aprovadores: [],
        configuracoes_nivel: {
          aprovacao_obrigatoria: true,
          permite_delegacao: false,
          aprovacao_unanime: false,
          aprovacao_maioria_simples: true,
          prazo_aprovacao_dias: 7,
          escalacao_automatica: true,
          nivel_escalacao: 2,
          permite_aprovacao_condicional: true
        },
        acoes_permitidas: ['aprovar', 'rejeitar', 'solicitar_alteracao'],
        campos_editaveis: ['observacoes'],
        notificacoes: {
          enviar_email: true,
          enviar_sms: false,
          notificar_sistema: true,
          lembrete_dias: [3, 1]
        }
      },
      {
        ordem: 2,
        nome_nivel: 'Aprovação do Conselho',
        descricao: 'Aprovação pelo conselho fiscal',
        tipo_aprovador: 'conselho',
        aprovadores: [],
        configuracoes_nivel: {
          aprovacao_obrigatoria: true,
          permite_delegacao: false,
          aprovacao_unanime: false,
          aprovacao_maioria_simples: true,
          prazo_aprovacao_dias: 10,
          escalacao_automatica: false,
          permite_aprovacao_condicional: false
        },
        acoes_permitidas: ['aprovar', 'rejeitar', 'solicitar_alteracao'],
        campos_editaveis: [],
        notificacoes: {
          enviar_email: true,
          enviar_sms: true,
          notificar_sistema: true,
          lembrete_dias: [5, 2]
        }
      }
    ],
    configuracoes_gerais: {
      permite_aprovacao_paralela: false,
      revoga_aprovacoes_anteriores_se_editado: true,
      requer_justificativa_aprovacao: false,
      requer_justificativa_rejeicao: true,
      permite_anexos: true,
      historico_completo_obrigatorio: true,
      prazo_total_workflow: 30,
      acao_prazo_vencido: 'escalar'
    },
    criado_por: usuarioId
  })
}

export const criarWorkflowDespesaAlta = (
  condominioId: mongoose.Types.ObjectId,
  masterId: mongoose.Types.ObjectId,
  usuarioId: mongoose.Types.ObjectId,
  valorMinimo: number = 5000
) => {
  return new WorkflowAprovacao({
    condominio_id: condominioId,
    master_id: masterId,
    nome: 'Aprovação de Despesas Altas',
    descricao: `Workflow para aprovação de despesas acima de R$ ${valorMinimo.toLocaleString('pt-BR')}`,
    tipo_documento: 'despesa_extra',
    categoria: 'financeiro',
    triggers: {
      tipo_trigger: 'valor_minimo',
      condicoes: {
        valor_minimo: valorMinimo
      }
    },
    niveis_aprovacao: [
      {
        ordem: 1,
        nome_nivel: 'Aprovação Administrativa',
        descricao: 'Verificação administrativa inicial',
        tipo_aprovador: 'sindico',
        aprovadores: [],
        configuracoes_nivel: {
          aprovacao_obrigatoria: true,
          permite_delegacao: true,
          aprovacao_unanime: false,
          aprovacao_maioria_simples: true,
          prazo_aprovacao_dias: 3,
          escalacao_automatica: true,
          nivel_escalacao: 2,
          permite_aprovacao_condicional: false
        },
        acoes_permitidas: ['aprovar', 'rejeitar', 'solicitar_alteracao', 'delegar'],
        campos_editaveis: ['observacoes', 'valor_total'],
        notificacoes: {
          enviar_email: true,
          enviar_sms: false,
          notificar_sistema: true,
          lembrete_dias: [1]
        }
      }
    ],
    configuracoes_gerais: {
      permite_aprovacao_paralela: false,
      revoga_aprovacoes_anteriores_se_editado: true,
      requer_justificativa_aprovacao: true,
      requer_justificativa_rejeicao: true,
      permite_anexos: true,
      historico_completo_obrigatorio: true,
      prazo_total_workflow: 7,
      acao_prazo_vencido: 'rejeitar_automatico'
    },
    criado_por: usuarioId
  })
}