import mongoose, { Document, Schema } from 'mongoose'

export interface IComplianceFiscal extends Document {
  // Identificação
  condominio_id: mongoose.Types.ObjectId
  master_id: mongoose.Types.ObjectId

  // Configurações gerais
  regime_tributario: 'simples_nacional' | 'lucro_presumido' | 'lucro_real' | 'isento'
  cnpj: string
  inscricao_municipal?: string
  inscricao_estadual?: string
  natureza_juridica: string
  
  // Configurações SPED
  sped_configuracao: {
    ativo: boolean
    versao_layout: string
    codigo_finalidade: string // 0=Original, 1=Substituto, 2=Retificador
    perfil_apresentacao: 'A' | 'B' | 'C' // A=Integral, B=Simplificado, C=Empresas Inativas
    forma_tributacao: '1' | '2' | '3' // 1=Lucro Real, 2=Lucro Presumido, 3=Simples Nacional
    
    // Dados do contador
    contador_cpf: string
    contador_nome: string
    contador_crc: string
    contador_email: string
    contador_telefone: string
    
    // Configurações de geração
    gerar_automatico: boolean
    dia_geracao: number // Dia do mês para gerar automaticamente
    enviar_email_contador: boolean
    backup_nuvem: boolean
  }
  
  // Configurações DIMOB
  dimob_configuracao: {
    ativo: boolean
    responsavel_cpf: string
    responsavel_nome: string
    declaracao_retificadora: boolean
    numero_recibo_anterior?: string
    
    // Configurações automáticas
    incluir_receitas_locacao: boolean
    incluir_taxas_condominio: boolean
    incluir_obras_benfeitorias: boolean
    valor_minimo_declaracao: number
  }
  
  // Configurações de Livros Contábeis
  livros_contabeis: {
    livro_diario: {
      ativo: boolean
      numeracao_sequencial: boolean
      ultimo_numero: number
      assinatura_digital: boolean
    }
    livro_razao: {
      ativo: boolean
      gerar_por_conta: boolean
      incluir_saldos_zerados: boolean
    }
    balancete: {
      ativo: boolean
      periodicidade: 'mensal' | 'trimestral' | 'semestral' | 'anual'
      ultimo_periodo_gerado: string
      formato_exportacao: 'pdf' | 'excel' | 'txt'
    }
  }
  
  // Plano de Contas Padrão
  plano_contas_padrao: {
    versao: string
    personalizado: boolean
    contas_customizadas: Array<{
      codigo: string
      nome: string
      tipo: 'ativo' | 'passivo' | 'receita' | 'despesa' | 'patrimonio'
      nivel: number
      conta_pai?: string
      aceita_lancamento: boolean
    }>
  }
  
  // Configurações de Impostos
  configuracao_impostos: {
    pis_cofins: {
      regime: 'cumulativo' | 'nao_cumulativo' | 'isento'
      aliquota_pis: number
      aliquota_cofins: number
    }
    csll: {
      aplicavel: boolean
      aliquota: number
      base_calculo: 'lucro_real' | 'lucro_presumido'
    }
    ir: {
      aplicavel: boolean
      aliquota: number
      base_calculo: 'lucro_real' | 'lucro_presumido'
    }
    iss: {
      aplicavel: boolean
      aliquota: number
      codigo_servico: string
      municipio_prestacao: string
    }
  }
  
  // Obrigações Acessórias
  obrigacoes_acessorias: Array<{
    nome: string
    tipo: 'mensal' | 'trimestral' | 'semestral' | 'anual'
    dia_vencimento: number
    mes_vencimento?: number // Para obrigações anuais
    ativa: boolean
    automatica: boolean
    ultimo_cumprimento?: Date
    proximo_vencimento: Date
    status: 'em_dia' | 'pendente' | 'atrasada'
    observacoes?: string
  }>
  
  // Histórico de Documentos Gerados
  documentos_gerados: Array<{
    tipo: 'sped' | 'dimob' | 'balancete' | 'dre' | 'livro_diario' | 'livro_razao'
    periodo_referencia: string
    data_geracao: Date
    arquivo_nome: string
    arquivo_tamanho: number
    arquivo_hash: string
    url_download: string
    status: 'gerado' | 'transmitido' | 'aceito' | 'rejeitado'
    protocolo_receita?: string
    observacoes?: string
    gerado_por_id: mongoose.Types.ObjectId
    gerado_por_nome: string
  }>
  
  // Configurações de Backup e Segurança
  configuracao_backup: {
    backup_automatico: boolean
    frequencia_backup: 'diario' | 'semanal' | 'mensal'
    local_backup: 'local' | 'nuvem' | 'ambos'
    criptografia_ativa: boolean
    retencao_dias: number
    ultimo_backup?: Date
  }
  
  // Alertas e Notificações
  alertas_fiscal: Array<{
    tipo: 'vencimento_obrigacao' | 'erro_geracao' | 'backup_falhou' | 'inconsistencia_dados'
    ativo: boolean
    dias_antecedencia: number
    destinatarios_email: string[]
    template_mensagem: string
  }>
  
  // Auditoria e Logs
  log_operacoes: Array<{
    data: Date
    operacao: string
    usuario_id: mongoose.Types.ObjectId
    usuario_nome: string
    detalhes: string
    ip_origem?: string
    sucesso: boolean
    tempo_execucao?: number
  }>
  
  // Dados de controle
  data_criacao: Date
  data_atualizacao: Date
  criado_por_id: mongoose.Types.ObjectId
  criado_por_nome: string
  ativo: boolean
}

const ComplianceFiscalSchema: Schema = new Schema({
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
  regime_tributario: {
    type: String,
    enum: ['simples_nacional', 'lucro_presumido', 'lucro_real', 'isento'],
    required: true
  },
  cnpj: {
    type: String,
    required: true,
    trim: true,
    match: /^\d{14}$/
  },
  inscricao_municipal: {
    type: String,
    trim: true
  },
  inscricao_estadual: {
    type: String,
    trim: true
  },
  natureza_juridica: {
    type: String,
    required: true,
    trim: true
  },
  sped_configuracao: {
    ativo: { type: Boolean, default: false },
    versao_layout: { type: String, default: '9.0' },
    codigo_finalidade: { type: String, enum: ['0', '1', '2'], default: '0' },
    perfil_apresentacao: { type: String, enum: ['A', 'B', 'C'], default: 'B' },
    forma_tributacao: { type: String, enum: ['1', '2', '3'], default: '2' },
    contador_cpf: { type: String, trim: true },
    contador_nome: { type: String, trim: true },
    contador_crc: { type: String, trim: true },
    contador_email: { type: String, trim: true },
    contador_telefone: { type: String, trim: true },
    gerar_automatico: { type: Boolean, default: false },
    dia_geracao: { type: Number, min: 1, max: 28, default: 15 },
    enviar_email_contador: { type: Boolean, default: true },
    backup_nuvem: { type: Boolean, default: true }
  },
  dimob_configuracao: {
    ativo: { type: Boolean, default: false },
    responsavel_cpf: { type: String, trim: true },
    responsavel_nome: { type: String, trim: true },
    declaracao_retificadora: { type: Boolean, default: false },
    numero_recibo_anterior: { type: String, trim: true },
    incluir_receitas_locacao: { type: Boolean, default: true },
    incluir_taxas_condominio: { type: Boolean, default: true },
    incluir_obras_benfeitorias: { type: Boolean, default: true },
    valor_minimo_declaracao: { type: Number, default: 0 }
  },
  livros_contabeis: {
    livro_diario: {
      ativo: { type: Boolean, default: true },
      numeracao_sequencial: { type: Boolean, default: true },
      ultimo_numero: { type: Number, default: 0 },
      assinatura_digital: { type: Boolean, default: false }
    },
    livro_razao: {
      ativo: { type: Boolean, default: true },
      gerar_por_conta: { type: Boolean, default: true },
      incluir_saldos_zerados: { type: Boolean, default: false }
    },
    balancete: {
      ativo: { type: Boolean, default: true },
      periodicidade: {
        type: String,
        enum: ['mensal', 'trimestral', 'semestral', 'anual'],
        default: 'mensal'
      },
      ultimo_periodo_gerado: { type: String },
      formato_exportacao: {
        type: String,
        enum: ['pdf', 'excel', 'txt'],
        default: 'pdf'
      }
    }
  },
  plano_contas_padrao: {
    versao: { type: String, default: '2023' },
    personalizado: { type: Boolean, default: false },
    contas_customizadas: [{
      codigo: { type: String, required: true, trim: true },
      nome: { type: String, required: true, trim: true },
      tipo: {
        type: String,
        enum: ['ativo', 'passivo', 'receita', 'despesa', 'patrimonio'],
        required: true
      },
      nivel: { type: Number, required: true, min: 1, max: 6 },
      conta_pai: { type: String, trim: true },
      aceita_lancamento: { type: Boolean, default: true }
    }]
  },
  configuracao_impostos: {
    pis_cofins: {
      regime: {
        type: String,
        enum: ['cumulativo', 'nao_cumulativo', 'isento'],
        default: 'cumulativo'
      },
      aliquota_pis: { type: Number, default: 0.65 },
      aliquota_cofins: { type: Number, default: 3.0 }
    },
    csll: {
      aplicavel: { type: Boolean, default: false },
      aliquota: { type: Number, default: 9.0 },
      base_calculo: {
        type: String,
        enum: ['lucro_real', 'lucro_presumido'],
        default: 'lucro_presumido'
      }
    },
    ir: {
      aplicavel: { type: Boolean, default: false },
      aliquota: { type: Number, default: 15.0 },
      base_calculo: {
        type: String,
        enum: ['lucro_real', 'lucro_presumido'],
        default: 'lucro_presumido'
      }
    },
    iss: {
      aplicavel: { type: Boolean, default: false },
      aliquota: { type: Number, default: 5.0 },
      codigo_servico: { type: String, trim: true },
      municipio_prestacao: { type: String, trim: true }
    }
  },
  obrigacoes_acessorias: [{
    nome: { type: String, required: true, trim: true },
    tipo: {
      type: String,
      enum: ['mensal', 'trimestral', 'semestral', 'anual'],
      required: true
    },
    dia_vencimento: { type: Number, required: true, min: 1, max: 31 },
    mes_vencimento: { type: Number, min: 1, max: 12 },
    ativa: { type: Boolean, default: true },
    automatica: { type: Boolean, default: false },
    ultimo_cumprimento: { type: Date },
    proximo_vencimento: { type: Date, required: true },
    status: {
      type: String,
      enum: ['em_dia', 'pendente', 'atrasada'],
      default: 'pendente'
    },
    observacoes: { type: String, trim: true }
  }],
  documentos_gerados: [{
    tipo: {
      type: String,
      enum: ['sped', 'dimob', 'balancete', 'dre', 'livro_diario', 'livro_razao'],
      required: true
    },
    periodo_referencia: { type: String, required: true },
    data_geracao: { type: Date, default: Date.now },
    arquivo_nome: { type: String, required: true },
    arquivo_tamanho: { type: Number, min: 0 },
    arquivo_hash: { type: String, trim: true },
    url_download: { type: String, required: true },
    status: {
      type: String,
      enum: ['gerado', 'transmitido', 'aceito', 'rejeitado'],
      default: 'gerado'
    },
    protocolo_receita: { type: String, trim: true },
    observacoes: { type: String, trim: true },
    gerado_por_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    gerado_por_nome: { type: String, required: true }
  }],
  configuracao_backup: {
    backup_automatico: { type: Boolean, default: true },
    frequencia_backup: {
      type: String,
      enum: ['diario', 'semanal', 'mensal'],
      default: 'semanal'
    },
    local_backup: {
      type: String,
      enum: ['local', 'nuvem', 'ambos'],
      default: 'nuvem'
    },
    criptografia_ativa: { type: Boolean, default: true },
    retencao_dias: { type: Number, default: 2555 }, // 7 anos
    ultimo_backup: { type: Date }
  },
  alertas_fiscal: [{
    tipo: {
      type: String,
      enum: ['vencimento_obrigacao', 'erro_geracao', 'backup_falhou', 'inconsistencia_dados'],
      required: true
    },
    ativo: { type: Boolean, default: true },
    dias_antecedencia: { type: Number, default: 5, min: 1, max: 30 },
    destinatarios_email: [{ type: String, trim: true }],
    template_mensagem: { type: String, trim: true }
  }],
  log_operacoes: [{
    data: { type: Date, default: Date.now },
    operacao: { type: String, required: true, trim: true },
    usuario_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    usuario_nome: { type: String, required: true, trim: true },
    detalhes: { type: String, trim: true },
    ip_origem: { type: String, trim: true },
    sucesso: { type: Boolean, default: true },
    tempo_execucao: { type: Number, min: 0 }
  }],
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
  collection: 'compliance-fiscal'
})

// Índices
ComplianceFiscalSchema.index({ condominio_id: 1 }, { unique: true })
ComplianceFiscalSchema.index({ cnpj: 1 })
ComplianceFiscalSchema.index({ 'obrigacoes_acessorias.proximo_vencimento': 1 })

export default mongoose.models.ComplianceFiscal || mongoose.model<IComplianceFiscal>('ComplianceFiscal', ComplianceFiscalSchema)

// Plano de Contas Padrão para Condomínios
export const PLANO_CONTAS_CONDOMINIO = {
  '1': 'ATIVO',
  '1.1': 'ATIVO CIRCULANTE',
  '1.1.1': 'Disponibilidades',
  '1.1.1.001': 'Caixa',
  '1.1.1.002': 'Bancos Conta Movimento',
  '1.1.1.003': 'Aplicações Financeiras',
  '1.1.2': 'Direitos Realizáveis',
  '1.1.2.001': 'Contas a Receber de Condôminos',
  '1.1.2.002': 'Multas a Receber',
  '1.1.2.003': 'Juros a Receber',
  '2': 'PASSIVO',
  '2.1': 'PASSIVO CIRCULANTE',
  '2.1.1': 'Obrigações Trabalhistas',
  '2.1.2': 'Obrigações Fiscais',
  '2.1.3': 'Fornecedores',
  '2.1.4': 'Contas a Pagar',
  '3': 'PATRIMÔNIO LÍQUIDO',
  '3.1': 'Patrimônio Social',
  '4': 'RECEITAS',
  '4.1': 'Receitas de Contribuições',
  '4.1.1': 'Taxa de Condomínio',
  '4.1.2': 'Taxa Extra',
  '4.1.3': 'Multas',
  '4.1.4': 'Juros',
  '5': 'DESPESAS',
  '5.1': 'Despesas Administrativas',
  '5.2': 'Despesas de Conservação',
  '5.3': 'Despesas de Pessoal'
}

// Função para validar configuração fiscal
export const validarConfiguracaoFiscal = (config: Partial<IComplianceFiscal>): { valida: boolean, erros: string[] } => {
  const erros: string[] = []

  if (!config.cnpj?.match(/^\d{14}$/)) {
    erros.push('CNPJ deve conter exatamente 14 dígitos')
  }

  if (!config.regime_tributario) {
    erros.push('Regime tributário é obrigatório')
  }

  if (config.sped_configuracao?.ativo) {
    if (!config.sped_configuracao.contador_cpf?.trim()) {
      erros.push('CPF do contador é obrigatório para SPED')
    }
    if (!config.sped_configuracao.contador_nome?.trim()) {
      erros.push('Nome do contador é obrigatório para SPED')
    }
    if (!config.sped_configuracao.contador_crc?.trim()) {
      erros.push('CRC do contador é obrigatório para SPED')
    }
  }

  return {
    valida: erros.length === 0,
    erros
  }
}