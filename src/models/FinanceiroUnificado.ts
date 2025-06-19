import mongoose, { Document, Schema } from 'mongoose'

export interface IFinanceiroUnificado extends Document {
  // Identificação única do sistema unificado
  codigo_lancamento: string // Código único: FIN-YYYY-NNNNNN
  
  // Classificação principal
  tipo_operacao: 'receita' | 'despesa' | 'transferencia'
  categoria_origem: 'condominio' | 'colaborador' | 'morador' | 'adm' | 'fornecedor' | 'banco'
  
  // Subcategorias unificadas de todos os módulos
  subcategoria: 
    // Condomínio
    | 'taxa_condominio' | 'fundo_reserva' | 'manutencao' | 'limpeza' | 'seguranca' 
    | 'agua' | 'energia' | 'gas' | 'internet' | 'elevador' | 'jardinagem' | 'administracao'
    // Colaboradores  
    | 'salario' | 'bonus' | 'desconto' | 'vale' | 'comissao' | 'hora_extra' | 'ferias' | 'decimo_terceiro'
    // Moradores
    | 'taxa_condominio_morador' | 'multa' | 'servico_extra' | 'fundo_obras' | 'taxa_extraordinaria' 
    | 'agua_individual' | 'gas_individual'
    // Administrativo
    | 'contabilidade' | 'juridico' | 'marketing' | 'tecnologia' | 'seguros' | 'impostos'
    // Fornecedores
    | 'material_construcao' | 'equipamentos' | 'servicos_terceirizados' | 'manutencao_preventiva'
    // Bancário
    | 'tarifas_bancarias' | 'juros_recebidos' | 'juros_pagos' | 'transferencias'
    | 'outros'

  // Dados básicos
  descricao: string
  valor: number
  data_vencimento: Date
  data_pagamento?: Date
  status: 'pendente' | 'pago' | 'atrasado' | 'cancelado' | 'agendado' | 'processando'

  // Vinculação (quando aplicável)
  vinculo_id?: mongoose.Types.ObjectId // ID do colaborador/morador/fornecedor
  vinculo_nome?: string
  vinculo_tipo?: 'colaborador' | 'morador' | 'fornecedor' | 'conta_bancaria'
  apartamento?: string
  bloco?: string

  // Dados financeiros avançados
  forma_pagamento?: 'dinheiro' | 'transferencia' | 'boleto' | 'pix' | 'cartao_debito' | 'cartao_credito' | 'cheque'
  conta_bancaria_id?: mongoose.Types.ObjectId
  conta_bancaria_nome?: string
  
  // Controle de juros e multas
  multa_atraso?: number
  juros_atraso?: number
  valor_original?: number // Valor sem juros/multas
  dias_atraso?: number

  // Dados de controle
  condominio_id: mongoose.Types.ObjectId
  master_id: mongoose.Types.ObjectId
  criado_por_tipo: 'master' | 'adm' | 'sindico' | 'subsindico' | 'conselheiro' | 'sistema'
  criado_por_id: mongoose.Types.ObjectId
  criado_por_nome: string
  
  // Auditoria e documentação
  observacoes?: string
  documento?: string // URL do documento anexo
  comprovante_pagamento?: string // URL do comprovante
  codigo_barras?: string
  chave_pix?: string
  
  // Controle de recorrência
  recorrente: boolean
  periodicidade?: 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual'
  lancamento_pai_id?: mongoose.Types.ObjectId // Para lançamentos recorrentes
  mes_referencia?: string // MM/YYYY
  
  // Centros de custo e orçamento
  centro_custo?: 'operacional' | 'administrativo' | 'manutencao' | 'obras' | 'reserva_emergencia'
  orcamento_id?: mongoose.Types.ObjectId
  orcamento_categoria?: string
  
  // Dados de pagamento automático
  pagamento_automatico?: boolean
  gateway_pagamento?: 'mercado_pago' | 'stone' | 'pagseguro'
  transaction_id?: string
  payment_status?: string
  
  // Controle de sistema
  data_criacao: Date
  data_atualizacao: Date
  ativo: boolean
  sincronizado: boolean // Para integração com sistemas externos
  hash_integracao?: string // Para evitar duplicações em integrações
}

const FinanceiroUnificadoSchema: Schema = new Schema({
  codigo_lancamento: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    match: [/^FIN-\d{4}-\d{6}$/, 'Código deve seguir o padrão FIN-YYYY-NNNNNN']
  },
  tipo_operacao: {
    type: String,
    required: true,
    enum: ['receita', 'despesa', 'transferencia'],
    lowercase: true
  },
  categoria_origem: {
    type: String,
    required: true,
    enum: ['condominio', 'colaborador', 'morador', 'adm', 'fornecedor', 'banco'],
    lowercase: true
  },
  subcategoria: {
    type: String,
    required: true,
    enum: [
      // Condomínio
      'taxa_condominio', 'fundo_reserva', 'manutencao', 'limpeza', 'seguranca',
      'agua', 'energia', 'gas', 'internet', 'elevador', 'jardinagem', 'administracao',
      // Colaboradores
      'salario', 'bonus', 'desconto', 'vale', 'comissao', 'hora_extra', 'ferias', 'decimo_terceiro',
      // Moradores
      'taxa_condominio_morador', 'multa', 'servico_extra', 'fundo_obras', 'taxa_extraordinaria',
      'agua_individual', 'gas_individual',
      // Administrativo
      'contabilidade', 'juridico', 'marketing', 'tecnologia', 'seguros', 'impostos',
      // Fornecedores
      'material_construcao', 'equipamentos', 'servicos_terceirizados', 'manutencao_preventiva',
      // Bancário
      'tarifas_bancarias', 'juros_recebidos', 'juros_pagos', 'transferencias',
      'outros'
    ],
    lowercase: true
  },
  descricao: {
    type: String,
    required: true,
    trim: true,
    minlength: [5, 'Descrição deve ter pelo menos 5 caracteres'],
    maxlength: [300, 'Descrição deve ter no máximo 300 caracteres']
  },
  valor: {
    type: Number,
    required: true,
    min: [0, 'Valor deve ser maior ou igual a 0']
  },
  data_vencimento: {
    type: Date,
    required: true
  },
  data_pagamento: {
    type: Date,
    required: false
  },
  status: {
    type: String,
    required: true,
    enum: ['pendente', 'pago', 'atrasado', 'cancelado', 'agendado', 'processando'],
    default: 'pendente',
    lowercase: true
  },
  vinculo_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: false
  },
  vinculo_nome: {
    type: String,
    required: false,
    trim: true
  },
  vinculo_tipo: {
    type: String,
    required: false,
    enum: ['colaborador', 'morador', 'fornecedor', 'conta_bancaria'],
    lowercase: true
  },
  apartamento: {
    type: String,
    required: false,
    trim: true
  },
  bloco: {
    type: String,
    required: false,
    trim: true
  },
  forma_pagamento: {
    type: String,
    required: false,
    enum: ['dinheiro', 'transferencia', 'boleto', 'pix', 'cartao_debito', 'cartao_credito', 'cheque'],
    lowercase: true
  },
  conta_bancaria_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
    ref: 'ContaBancaria'
  },
  conta_bancaria_nome: {
    type: String,
    required: false,
    trim: true
  },
  multa_atraso: {
    type: Number,
    required: false,
    min: [0, 'Multa deve ser maior ou igual a 0']
  },
  juros_atraso: {
    type: Number,
    required: false,
    min: [0, 'Juros deve ser maior ou igual a 0']
  },
  valor_original: {
    type: Number,
    required: false,
    min: [0, 'Valor original deve ser maior ou igual a 0']
  },
  dias_atraso: {
    type: Number,
    required: false,
    min: [0, 'Dias de atraso deve ser maior ou igual a 0']
  },
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
  criado_por_tipo: {
    type: String,
    required: true,
    enum: ['master', 'adm', 'sindico', 'subsindico', 'conselheiro', 'sistema'],
    lowercase: true
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
  observacoes: {
    type: String,
    required: false,
    trim: true,
    maxlength: [1000, 'Observações devem ter no máximo 1000 caracteres']
  },
  documento: {
    type: String,
    required: false,
    trim: true
  },
  comprovante_pagamento: {
    type: String,
    required: false,
    trim: true
  },
  codigo_barras: {
    type: String,
    required: false,
    trim: true
  },
  chave_pix: {
    type: String,
    required: false,
    trim: true
  },
  recorrente: {
    type: Boolean,
    default: false
  },
  periodicidade: {
    type: String,
    required: false,
    enum: ['mensal', 'bimestral', 'trimestral', 'semestral', 'anual'],
    lowercase: true
  },
  lancamento_pai_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
    ref: 'FinanceiroUnificado'
  },
  mes_referencia: {
    type: String,
    required: false,
    trim: true,
    match: [/^\d{2}\/\d{4}$/, 'Mês de referência deve estar no formato MM/YYYY']
  },
  centro_custo: {
    type: String,
    required: false,
    enum: ['operacional', 'administrativo', 'manutencao', 'obras', 'reserva_emergencia'],
    lowercase: true
  },
  orcamento_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: false
  },
  orcamento_categoria: {
    type: String,
    required: false,
    trim: true
  },
  pagamento_automatico: {
    type: Boolean,
    default: false
  },
  gateway_pagamento: {
    type: String,
    required: false,
    enum: ['mercado_pago', 'stone', 'pagseguro'],
    lowercase: true
  },
  transaction_id: {
    type: String,
    required: false,
    trim: true
  },
  payment_status: {
    type: String,
    required: false,
    trim: true
  },
  data_criacao: {
    type: Date,
    default: Date.now
  },
  data_atualizacao: {
    type: Date,
    default: Date.now
  },
  ativo: {
    type: Boolean,
    default: true
  },
  sincronizado: {
    type: Boolean,
    default: true
  },
  hash_integracao: {
    type: String,
    required: false,
    trim: true,
    unique: true,
    sparse: true
  }
}, {
  timestamps: true,
  collection: 'financeiro-unificado'
})

// Índices otimizados para consultas financeiras
FinanceiroUnificadoSchema.index({ condominio_id: 1, categoria_origem: 1, data_vencimento: -1 })
FinanceiroUnificadoSchema.index({ master_id: 1, tipo_operacao: 1, status: 1 })
FinanceiroUnificadoSchema.index({ codigo_lancamento: 1 }, { unique: true })
FinanceiroUnificadoSchema.index({ vinculo_id: 1, categoria_origem: 1 })
FinanceiroUnificadoSchema.index({ status: 1, data_vencimento: 1 })
FinanceiroUnificadoSchema.index({ mes_referencia: 1, condominio_id: 1 })
FinanceiroUnificadoSchema.index({ centro_custo: 1, condominio_id: 1 })
FinanceiroUnificadoSchema.index({ data_criacao: -1 })
FinanceiroUnificadoSchema.index({ sincronizado: 1, ativo: 1 })

// Middleware para gerar código automático
FinanceiroUnificadoSchema.pre('save', async function(next) {
  if (this.isNew && !this.codigo_lancamento) {
    const year = new Date().getFullYear()
    const count = await mongoose.model('FinanceiroUnificado').countDocuments({
      codigo_lancamento: new RegExp(`^FIN-${year}-`)
    })
    this.codigo_lancamento = `FIN-${year}-${String(count + 1).padStart(6, '0')}`
  }
  this.data_atualizacao = new Date()
  next()
})

export default mongoose.models.FinanceiroUnificado || mongoose.model<IFinanceiroUnificado>('FinanceiroUnificado', FinanceiroUnificadoSchema)

// Funções de permissão unificadas
export const verificarPermissaoFinanceiroUnificado = (
  acao: 'criar' | 'editar' | 'excluir' | 'ver' | 'relatorios' | 'configurar',
  tipoUsuario: string,
  categoriaOrigem?: string,
  isProprioVinculo: boolean = false
) => {
  // Master tem acesso total
  if (tipoUsuario === 'master') {
    return true
  }
  
  // Adm, Síndico e Subsíndico podem tudo exceto configurações
  if (['adm', 'sindico', 'subsindico'].includes(tipoUsuario)) {
    return acao !== 'configurar'
  }
  
  // Conselheiro só pode ver relatórios
  if (tipoUsuario === 'conselheiro') {
    return acao === 'ver' || acao === 'relatorios'
  }
  
  // Colaborador só pode ver seus próprios dados
  if (tipoUsuario === 'colaborador') {
    return acao === 'ver' && categoriaOrigem === 'colaborador' && isProprioVinculo
  }
  
  // Morador/Inquilino só pode ver seus próprios dados
  if (['morador', 'inquilino', 'conjuge', 'dependente'].includes(tipoUsuario)) {
    return acao === 'ver' && categoriaOrigem === 'morador' && isProprioVinculo
  }
  
  return false
}

// Funções auxiliares para relatórios contábeis
export const getCategoriaContabil = (subcategoria: string) => {
  const mapeamento = {
    // Receitas
    'taxa_condominio': { grupo: 'RECEITAS', conta: '3.1.1.001', nome: 'Taxa Condominial' },
    'taxa_condominio_morador': { grupo: 'RECEITAS', conta: '3.1.1.001', nome: 'Taxa Condominial' },
    'multa': { grupo: 'RECEITAS', conta: '3.1.2.001', nome: 'Multas e Juros' },
    'fundo_reserva': { grupo: 'RECEITAS', conta: '3.1.3.001', nome: 'Fundo de Reserva' },
    'fundo_obras': { grupo: 'RECEITAS', conta: '3.1.3.002', nome: 'Fundo de Obras' },
    'taxa_extraordinaria': { grupo: 'RECEITAS', conta: '3.1.4.001', nome: 'Taxa Extraordinária' },
    'juros_recebidos': { grupo: 'RECEITAS', conta: '3.2.1.001', nome: 'Receitas Financeiras' },
    
    // Despesas Operacionais
    'limpeza': { grupo: 'DESPESAS', conta: '4.1.1.001', nome: 'Serviços de Limpeza' },
    'seguranca': { grupo: 'DESPESAS', conta: '4.1.1.002', nome: 'Serviços de Segurança' },
    'manutencao': { grupo: 'DESPESAS', conta: '4.1.1.003', nome: 'Manutenção e Conservação' },
    'elevador': { grupo: 'DESPESAS', conta: '4.1.1.004', nome: 'Manutenção de Elevadores' },
    'jardinagem': { grupo: 'DESPESAS', conta: '4.1.1.005', nome: 'Jardinagem e Paisagismo' },
    
    // Utilidades
    'agua': { grupo: 'DESPESAS', conta: '4.1.2.001', nome: 'Água e Esgoto' },
    'energia': { grupo: 'DESPESAS', conta: '4.1.2.002', nome: 'Energia Elétrica' },
    'gas': { grupo: 'DESPESAS', conta: '4.1.2.003', nome: 'Gás' },
    'internet': { grupo: 'DESPESAS', conta: '4.1.2.004', nome: 'Internet e Telefonia' },
    
    // Pessoal
    'salario': { grupo: 'DESPESAS', conta: '4.2.1.001', nome: 'Salários e Ordenados' },
    'bonus': { grupo: 'DESPESAS', conta: '4.2.1.002', nome: 'Gratificações' },
    'decimo_terceiro': { grupo: 'DESPESAS', conta: '4.2.1.003', nome: '13º Salário' },
    'ferias': { grupo: 'DESPESAS', conta: '4.2.1.004', nome: 'Férias' },
    
    // Administrativas
    'administracao': { grupo: 'DESPESAS', conta: '4.3.1.001', nome: 'Despesas Administrativas' },
    'contabilidade': { grupo: 'DESPESAS', conta: '4.3.1.002', nome: 'Serviços Contábeis' },
    'juridico': { grupo: 'DESPESAS', conta: '4.3.1.003', nome: 'Serviços Jurídicos' },
    'seguros': { grupo: 'DESPESAS', conta: '4.3.1.004', nome: 'Seguros' },
    'impostos': { grupo: 'DESPESAS', conta: '4.3.1.005', nome: 'Impostos e Taxas' },
    
    // Financeiras
    'tarifas_bancarias': { grupo: 'DESPESAS', conta: '4.4.1.001', nome: 'Tarifas Bancárias' },
    'juros_pagos': { grupo: 'DESPESAS', conta: '4.4.1.002', nome: 'Despesas Financeiras' },
    
    'outros': { grupo: 'DIVERSOS', conta: '9.9.9.999', nome: 'Outras Receitas/Despesas' }
  }
  
  return mapeamento[subcategoria as keyof typeof mapeamento] || mapeamento.outros
}