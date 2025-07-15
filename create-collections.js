#!/usr/bin/env node

/**
 * Script para Criar Collections do Sistema VemJoão
 * 
 * Este script cria todas as 39 collections necessárias para o sistema
 * com seus schemas, índices e validações, mas SEM dados de exemplo.
 */

const mongoose = require('mongoose')

// Configuração do MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/condominio-sistema'

// Conectar ao MongoDB
async function conectarMongoDB() {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log('✅ Conectado ao MongoDB:', MONGODB_URI)
  } catch (error) {
    console.error('❌ Erro ao conectar ao MongoDB:', error)
    process.exit(1)
  }
}

// Definir todos os schemas
const schemas = {
  // 1. USUÁRIOS E HIERARQUIA (8 collections)
  MasterSchema: new mongoose.Schema({
    nome: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    senha: { type: String, required: true },
    celular1: { type: String, required: true },
    celular2: { type: String },
    data_criacao: { type: Date, default: Date.now },
    ativo: { type: Boolean, default: true }
  }, { timestamps: true }),

  CondominioSchema: new mongoose.Schema({
    nome: { type: String, required: true },
    cep: { type: String, default: '' },
    estado: { type: String, default: '' },
    cidade: { type: String, default: '' },
    bairro: { type: String, default: '' },
    rua: { type: String, default: '' },
    numero: { type: String, required: true },
    complemento: { type: String, default: '' },
    master_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Master' },
    valor_taxa_condominio: { type: Number, default: 0 },
    dia_vencimento: { type: Number, default: 10 },
    aceita_pagamento_automatico: { type: Boolean, default: false },
    razao_social: { type: String, default: '' },
    cnpj: { type: String, default: '' },
    banco: { type: String, default: '' },
    agencia: { type: String, default: '' },
    conta: { type: String, default: '' },
    chave_pix: { type: String, default: '' },
    multa_atraso: { type: Number, default: 2.0 },
    juros_mes: { type: Number, default: 1.0 },
    dias_aviso_vencimento: { type: Number, default: 5 },
    observacoes_cobranca: { type: String, default: '' },
    data_criacao: { type: Date, default: Date.now },
    ativo: { type: Boolean, default: true }
  }, { timestamps: true, collection: 'condominios' }),

  AdmSchema: new mongoose.Schema({
    nome: { type: String, required: true },
    cpf: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    senha: { type: String, required: true },
    tipo: { type: String, required: true, enum: ['sindico', 'subsindico', 'conselheiro'] },
    condominio_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Condominio' },
    master_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Master' },
    data_inicio: { type: Date, default: Date.now },
    data_fim: { type: Date },
    celular1: { type: String },
    celular2: { type: String },
    data_criacao: { type: Date, default: Date.now },
    ativo: { type: Boolean, default: true }
  }, { timestamps: true, collection: 'adms' }),

  ColaboradorSchema: new mongoose.Schema({
    nome: { type: String, required: true },
    cpf: { type: String, required: true, unique: true },
    data_nasc: { type: Date, required: true },
    celular1: { type: String, required: true },
    celular2: { type: String },
    email: { type: String, required: true, unique: true, lowercase: true },
    senha: { type: String, required: true },
    data_inicio: { type: Date, required: true },
    data_fim: { type: Date },
    condominio_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Condominio' },
    cargo: { type: String },
    salario: { type: Number },
    tipo_contrato: { type: String },
    master_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Master' },
    data_criacao: { type: Date, default: Date.now },
    ativo: { type: Boolean, default: true }
  }, { timestamps: true, collection: 'colaboradores' }),

  MoradorSchema: new mongoose.Schema({
    nome: { type: String, required: true },
    cpf: { type: String, required: true, unique: true },
    data_nasc: { type: Date, required: true },
    celular1: { type: String, required: true },
    celular2: { type: String },
    email: { type: String, required: true, unique: true, lowercase: true },
    senha: { type: String, required: true },
    tipo: { type: String, required: true, enum: ['proprietario', 'inquilino', 'dependente'] },
    unidade: { type: String, required: true },
    bloco: { type: String },
    data_inicio: { type: Date, required: true },
    data_fim: { type: Date },
    responsavel_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Morador' },
    proprietario_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Morador' },
    imobiliaria_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Imobiliaria' },
    condominio_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Condominio' },
    master_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Master' },
    data_criacao: { type: Date, default: Date.now },
    ativo: { type: Boolean, default: true },
    observacoes: { type: String }
  }, { timestamps: true, collection: 'moradores' }),

  ConjugeSchema: new mongoose.Schema({
    nome: { type: String, required: true },
    cpf: { type: String, required: true },
    data_nasc: { type: Date, required: true },
    celular1: { type: String },
    celular2: { type: String },
    email: { type: String, lowercase: true },
    senha: { type: String },
    morador_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Morador' },
    inquilino_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Morador' },
    condominio_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Condominio' },
    master_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Master' },
    data_criacao: { type: Date, default: Date.now },
    ativo: { type: Boolean, default: true }
  }, { timestamps: true, collection: 'conjuges' }),

  DependenteSchema: new mongoose.Schema({
    nome: { type: String, required: true },
    cpf: { type: String },
    data_nasc: { type: Date, required: true },
    celular1: { type: String },
    email: { type: String, lowercase: true },
    senha: { type: String },
    morador_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Morador' },
    inquilino_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Morador' },
    condominio_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Condominio' },
    master_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Master' },
    data_criacao: { type: Date, default: Date.now },
    ativo: { type: Boolean, default: true }
  }, { timestamps: true, collection: 'dependentes' }),

  ImobiliariaSchema: new mongoose.Schema({
    nome: { type: String, required: true },
    cnpj: { type: String, required: true },
    email: { type: String, required: true, lowercase: true },
    telefone: { type: String },
    endereco: { type: String },
    responsavel_nome: { type: String },
    responsavel_telefone: { type: String },
    condominio_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Condominio' },
    master_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Master' },
    data_criacao: { type: Date, default: Date.now },
    ativo: { type: Boolean, default: true }
  }, { timestamps: true, collection: 'imobiliarias' }),

  // 2. GESTÃO FINANCEIRA (5 collections)
  FinanceiroMoradorSchema: new mongoose.Schema({
    tipo: { type: String, required: true, enum: ['receita', 'despesa', 'transferencia'], default: 'despesa' },
    categoria: { type: String, required: true },
    descricao: { type: String, required: true },
    valor: { type: Number, required: true },
    data_vencimento: { type: Date, required: true },
    data_pagamento: { type: Date },
    status: { type: String, required: true, enum: ['pendente', 'pago', 'atrasado', 'cancelado'], default: 'pendente' },
    morador_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Morador' },
    morador_nome: { type: String, required: true },
    apartamento: { type: String, required: true },
    bloco: { type: String },
    condominio_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Condominio' },
    master_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Master' },
    criado_por_tipo: { type: String, required: true, enum: ['master', 'sindico', 'subsindico'] },
    criado_por_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    criado_por_nome: { type: String, required: true },
    recorrente: { type: Boolean, default: false },
    mes_referencia: { type: String },
    data_criacao: { type: Date, default: Date.now },
    data_atualizacao: { type: Date, default: Date.now },
    ativo: { type: Boolean, default: true }
  }, { timestamps: true, collection: 'financeiro-moradores' }),

  FinanceiroCondominioSchema: new mongoose.Schema({
    tipo: { type: String, required: true, enum: ['receita', 'despesa', 'transferencia'], default: 'despesa' },
    categoria: { type: String, required: true },
    descricao: { type: String, required: true },
    valor: { type: Number, required: true },
    data_vencimento: { type: Date, required: true },
    data_pagamento: { type: Date },
    status: { type: String, required: true, enum: ['pendente', 'pago', 'atrasado', 'cancelado'], default: 'pendente' },
    origem_sistema: { type: String, enum: ['manual', 'morador', 'colaborador', 'importacao'], default: 'manual' },
    condominio_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Condominio' },
    master_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Master' },
    criado_por_tipo: { type: String, required: true, enum: ['master', 'sindico', 'subsindico'] },
    criado_por_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    criado_por_nome: { type: String, required: true },
    recorrente: { type: Boolean, default: false },
    mes_referencia: { type: String },
    data_criacao: { type: Date, default: Date.now },
    data_atualizacao: { type: Date, default: Date.now },
    ativo: { type: Boolean, default: true }
  }, { timestamps: true, collection: 'financeiro-condominios' }),

  FinanceiroColaboradorSchema: new mongoose.Schema({
    tipo: { type: String, required: true, enum: ['salario', 'bonus', 'desconto', 'vale'], default: 'salario' },
    descricao: { type: String, required: true },
    valor: { type: Number, required: true },
    data_vencimento: { type: Date, required: true },
    data_pagamento: { type: Date },
    status: { type: String, required: true, enum: ['pendente', 'pago', 'atrasado', 'cancelado'], default: 'pendente' },
    colaborador_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Colaborador' },
    colaborador_nome: { type: String, required: true },
    condominio_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Condominio' },
    master_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Master' },
    criado_por_tipo: { type: String, required: true, enum: ['master', 'sindico', 'subsindico'] },
    criado_por_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    criado_por_nome: { type: String, required: true },
    recorrente: { type: Boolean, default: false },
    mes_referencia: { type: String },
    data_criacao: { type: Date, default: Date.now },
    data_atualizacao: { type: Date, default: Date.now },
    ativo: { type: Boolean, default: true }
  }, { timestamps: true, collection: 'financeiro-colaboradores' }),

  FinanceiroUnificadoSchema: new mongoose.Schema({
    codigo_lancamento: { type: String, unique: true, required: true },
    tipo_operacao: { type: String, required: true, enum: ['receita', 'despesa', 'transferencia'] },
    categoria_origem: { type: String, required: true, enum: ['condominio', 'colaborador', 'morador', 'fornecedor'] },
    subcategoria: { type: String, required: true },
    descricao: { type: String, required: true },
    valor: { type: Number, required: true },
    data_vencimento: { type: Date, required: true },
    data_pagamento: { type: Date },
    status: { type: String, required: true, enum: ['pendente', 'pago', 'atrasado', 'cancelado', 'agendado'], default: 'pendente' },
    vinculo_id: { type: mongoose.Schema.Types.ObjectId },
    condominio_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Condominio' },
    master_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Master' },
    data_criacao: { type: Date, default: Date.now },
    data_atualizacao: { type: Date, default: Date.now },
    ativo: { type: Boolean, default: true }
  }, { timestamps: true, collection: 'financeiro-unificado' }),

  StatusPagamentoMoradorSchema: new mongoose.Schema({
    morador_id: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true, ref: 'Morador' },
    status_pagamento: { type: String, required: true, enum: ['em_dia', 'proximo_vencimento', 'atrasado', 'isento'], default: 'em_dia' },
    valor_pendente: { type: Number, default: 0 },
    valor_total_mes: { type: Number, default: 0 },
    dias_atraso: { type: Number, default: 0 },
    data_proximo_vencimento: { type: Date },
    pagamento_automatico_ativo: { type: Boolean, default: false },
    condominio_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Condominio' },
    master_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Master' },
    ultima_atualizacao: { type: Date, default: Date.now }
  }, { timestamps: true, collection: 'status-pagamento-moradores' }),

  // 3. SISTEMA DE PAGAMENTOS (2 collections)
  TransacaoSchema: new mongoose.Schema({
    id_transacao: { type: String, unique: true, required: true },
    tipo_origem: { type: String, required: true, enum: ['financeiro_morador', 'financeiro_condominio', 'financeiro_colaborador'] },
    origem_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    valor_original: { type: Number, required: true },
    valor_final: { type: Number, required: true },
    valor_taxas: { type: Number, default: 0 },
    gateway_provider: { type: String, required: true, enum: ['mercado_pago', 'stone', 'pagseguro', 'pix_manual'] },
    metodo_pagamento: { type: String, required: true, enum: ['pix', 'boleto', 'cartao_credito', 'cartao_debito'] },
    status: { type: String, required: true, enum: ['pendente', 'processando', 'aprovado', 'rejeitado', 'cancelado'], default: 'pendente' },
    dados_pagamento: { type: mongoose.Schema.Types.Mixed },
    webhook_received: { type: Boolean, default: false },
    logs_transacao: [{ type: mongoose.Schema.Types.Mixed }],
    condominio_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Condominio' },
    data_criacao: { type: Date, default: Date.now }
  }, { timestamps: true, collection: 'transacoes' }),

  ContaBancariaSchema: new mongoose.Schema({
    nome_conta: { type: String, required: true },
    banco: { type: String, required: true },
    agencia: { type: String, required: true },
    numero_conta: { type: String, required: true },
    tipo_conta: { type: String, required: true, enum: ['corrente', 'poupanca'], default: 'corrente' },
    titular_nome: { type: String, required: true },
    titular_documento: { type: String, required: true },
    chave_pix: { type: String },
    conta_principal: { type: Boolean, default: false },
    condominio_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Condominio' },
    master_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Master' },
    data_criacao: { type: Date, default: Date.now },
    ativo: { type: Boolean, default: true }
  }, { timestamps: true, collection: 'contas-bancarias' }),

  // 4. CONTABILIDADE (3 collections)
  PlanoContasSchema: new mongoose.Schema({
    codigo: { type: String, required: true },
    nome: { type: String, required: true },
    conta_pai_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PlanoContas' },
    tipo_conta: { type: String, required: true, enum: ['ativo', 'passivo', 'patrimonio_liquido', 'receita', 'despesa'] },
    natureza: { type: String, required: true, enum: ['debito', 'credito'] },
    aceita_lancamento: { type: Boolean, default: true },
    grupo_dre: { type: String },
    condominio_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Condominio' },
    data_criacao: { type: Date, default: Date.now },
    ativo: { type: Boolean, default: true }
  }, { timestamps: true, collection: 'plano-contas' }),

  LancamentoContabilSchema: new mongoose.Schema({
    numero_lancamento: { type: String, unique: true, required: true },
    data_lancamento: { type: Date, required: true },
    historico: { type: String, required: true },
    valor_total: { type: Number, required: true },
    status: { type: String, required: true, enum: ['rascunho', 'confirmado', 'cancelado'], default: 'rascunho' },
    partidas: [{ type: mongoose.Schema.Types.Mixed }],
    origem_lancamento: { type: String, enum: ['financeiro_morador', 'transacao', 'manual'], default: 'manual' },
    origem_id: { type: mongoose.Schema.Types.ObjectId },
    condominio_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Condominio' },
    data_criacao: { type: Date, default: Date.now }
  }, { timestamps: true, collection: 'lancamentos-contabeis' }),

  ExtratoBancarioSchema: new mongoose.Schema({
    conta_bancaria_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'ContaBancaria' },
    data_movimento: { type: Date, required: true },
    valor: { type: Number, required: true },
    tipo_movimento: { type: String, required: true, enum: ['credito', 'debito'] },
    historico: { type: String, required: true },
    saldo: { type: Number, required: true },
    conciliado: { type: Boolean, default: false },
    lancamento_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LancamentoContabil' },
    condominio_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Condominio' },
    data_criacao: { type: Date, default: Date.now }
  }, { timestamps: true, collection: 'extratos-bancarios' }),

  // 5. AUTOMAÇÃO E ALERTAS (3 collections)
  AlertaFinanceiroSchema: new mongoose.Schema({
    tipo_alerta: { type: String, required: true, enum: ['vencimento_proximo', 'inadimplencia_alta', 'saldo_baixo', 'meta_atingida'] },
    titulo: { type: String, required: true },
    descricao: { type: String, required: true },
    severidade: { type: String, required: true, enum: ['info', 'warning', 'danger', 'success'], default: 'info' },
    status: { type: String, required: true, enum: ['ativo', 'resolvido', 'ignorado'], default: 'ativo' },
    condicoes: { type: mongoose.Schema.Types.Mixed },
    contexto: { type: mongoose.Schema.Types.Mixed },
    condominio_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Condominio' },
    master_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Master' },
    data_criacao: { type: Date, default: Date.now }
  }, { timestamps: true, collection: 'alertas-financeiros' }),

  AutomacaoFinanceiraSchema: new mongoose.Schema({
    nome: { type: String, required: true },
    tipo_automacao: { type: String, required: true, enum: ['cobranca_automatica', 'aplicacao_juros_multa', 'gerar_recibo'] },
    trigger: { type: mongoose.Schema.Types.Mixed, required: true },
    acoes: [{ type: mongoose.Schema.Types.Mixed }],
    ativo: { type: Boolean, default: true },
    logs_execucao: [{ type: mongoose.Schema.Types.Mixed }],
    condominio_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Condominio' },
    master_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Master' },
    data_criacao: { type: Date, default: Date.now }
  }, { timestamps: true, collection: 'automacoes-financeiras' }),

  CobrancaAutomatizadaSchema: new mongoose.Schema({
    nome: { type: String, required: true },
    tipo_cobranca: { type: String, required: true, enum: ['taxa_condominio', 'multa', 'juros', 'aviso_vencimento'] },
    regras_disparo: { type: mongoose.Schema.Types.Mixed, required: true },
    canais: { type: mongoose.Schema.Types.Mixed },
    templates: { type: mongoose.Schema.Types.Mixed },
    estatisticas: { type: mongoose.Schema.Types.Mixed },
    ativo: { type: Boolean, default: true },
    condominio_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Condominio' },
    master_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Master' },
    data_criacao: { type: Date, default: Date.now }
  }, { timestamps: true, collection: 'cobrancas-automatizadas' }),

  // 6. RECURSOS GERAIS (4 collections)
  TicketSchema: new mongoose.Schema({
    titulo: { type: String, required: true },
    descricao: { type: String, required: true },
    categoria: { type: String, required: true, enum: ['financeiro', 'manutencao', 'administrativo', 'outros'] },
    prioridade: { type: String, required: true, enum: ['baixa', 'media', 'alta', 'urgente'], default: 'media' },
    status: { type: String, required: true, enum: ['aberto', 'em_andamento', 'resolvido', 'fechado'], default: 'aberto' },
    solicitante_tipo: { type: String, required: true, enum: ['colaborador', 'morador', 'inquilino', 'adm'] },
    solicitante_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    mensagens: [{ type: mongoose.Schema.Types.Mixed }],
    condominio_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Condominio' },
    master_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Master' },
    data_criacao: { type: Date, default: Date.now }
  }, { timestamps: true, collection: 'tickets' }),

  EventoSchema: new mongoose.Schema({
    nome: { type: String, required: true },
    descricao: { type: String, required: true },
    tipo: { type: String, required: true, enum: ['retirada_entrega', 'visita', 'reserva', 'reuniao', 'avisos'] },
    data_inicio: { type: Date, required: true },
    data_fim: { type: Date, required: true },
    criado_por_tipo: { type: String, required: true, enum: ['master', 'adm', 'colaborador', 'morador'] },
    criado_por_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    condominio_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Condominio' },
    master_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Master' },
    data_criacao: { type: Date, default: Date.now },
    ativo: { type: Boolean, default: true }
  }, { timestamps: true, collection: 'eventos' }),

  AnimalSchema: new mongoose.Schema({
    tipo: { type: String, required: true, enum: ['cao', 'gato', 'passaro', 'peixe', 'outro'] },
    nome: { type: String, required: true },
    raca: { type: String },
    morador_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Morador' },
    inquilino_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Morador' },
    condominio_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Condominio' },
    master_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Master' },
    data_criacao: { type: Date, default: Date.now },
    ativo: { type: Boolean, default: true }
  }, { timestamps: true, collection: 'animais' }),

  VeiculoSchema: new mongoose.Schema({
    tipo: { type: String, required: true, enum: ['carro', 'moto', 'bicicleta', 'outro'] },
    placa: { type: String, required: true },
    modelo: { type: String },
    cor: { type: String },
    morador_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Morador' },
    inquilino_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Morador' },
    condominio_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Condominio' },
    master_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Master' },
    data_criacao: { type: Date, default: Date.now },
    ativo: { type: Boolean, default: true }
  }, { timestamps: true, collection: 'veiculos' }),

  // 7. MODELOS AVANÇADOS (3 collections)
  AtivoFixoSchema: new mongoose.Schema({
    nome: { type: String, required: true },
    descricao: { type: String },
    valor_aquisicao: { type: Number, required: true },
    data_aquisicao: { type: Date, required: true },
    vida_util_anos: { type: Number, required: true },
    metodo_depreciacao: { type: String, required: true, enum: ['linear', 'soma_digitos', 'unidades_produzidas'], default: 'linear' },
    valor_residual: { type: Number, default: 0 },
    depreciacao_acumulada_total: { type: Number, default: 0 },
    condominio_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Condominio' },
    master_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Master' },
    data_criacao: { type: Date, default: Date.now },
    ativo: { type: Boolean, default: true }
  }, { timestamps: true, collection: 'ativos-fixos' }),

  LancamentoRecorrenteSchema: new mongoose.Schema({
    nome: { type: String, required: true },
    tipo_operacao: { type: String, required: true, enum: ['receita', 'despesa'] },
    valor: { type: Number, required: true },
    frequencia: { type: String, required: true, enum: ['mensal', 'bimestral', 'trimestral', 'semestral', 'anual'] },
    data_inicio: { type: Date, required: true },
    data_fim: { type: Date },
    proximo_processamento: { type: Date },
    condominio_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Condominio' },
    master_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Master' },
    data_criacao: { type: Date, default: Date.now },
    ativo: { type: Boolean, default: true }
  }, { timestamps: true, collection: 'lancamentos-recorrentes' }),

  WebhookRetrySchema: new mongoose.Schema({
    webhook_url: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    tentativas: { type: Number, default: 0 },
    max_tentativas: { type: Number, default: 5 },
    sucesso: { type: Boolean, default: false },
    proximo_retry: { type: Date },
    logs_tentativas: [{ type: mongoose.Schema.Types.Mixed }],
    condominio_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Condominio' },
    data_criacao: { type: Date, default: Date.now }
  }, { timestamps: true, collection: 'webhook-retries' }),

  // 8. CONFIGURAÇÕES E INTEGRAÇÕES (2 collections)
  CondominiumSettingSchema: new mongoose.Schema({
    chave: { type: String, required: true },
    valor: { type: mongoose.Schema.Types.Mixed, required: true },
    tipo: { type: String, required: true, enum: ['string', 'number', 'boolean', 'object', 'array'] },
    descricao: { type: String },
    categoria: { type: String, required: true, enum: ['financeiro', 'pagamento', 'notificacao', 'sistema'] },
    condominio_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Condominio' },
    master_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Master' },
    data_criacao: { type: Date, default: Date.now }
  }, { timestamps: true, collection: 'condominium-settings' }),

  OpenBankingIntegracaoSchema: new mongoose.Schema({
    banco: { type: String, required: true },
    conta_bancaria_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'ContaBancaria' },
    client_id: { type: String, required: true },
    client_secret: { type: String, required: true },
    access_token: { type: String },
    refresh_token: { type: String },
    expires_at: { type: Date },
    status: { type: String, required: true, enum: ['ativo', 'inativo', 'erro'], default: 'ativo' },
    ultima_sincronizacao: { type: Date },
    condominio_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Condominio' },
    master_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Master' },
    data_criacao: { type: Date, default: Date.now }
  }, { timestamps: true, collection: 'open-banking-integracoes' })
}

// Criar modelos
function criarModelos() {
  const models = {}
  
  Object.keys(schemas).forEach(schemaName => {
    const modelName = schemaName.replace('Schema', '')
    models[modelName] = mongoose.model(modelName, schemas[schemaName])
  })
  
  return models
}

// Criar índices essenciais
async function criarIndices(models) {
  console.log('🔍 Criando índices essenciais...')
  
  try {
    // Índices únicos críticos
    await models.Master.createIndex({ email: 1 }, { unique: true })
    await models.Adm.createIndex({ email: 1 }, { unique: true })
    await models.Colaborador.createIndex({ email: 1 }, { unique: true })
    await models.Morador.createIndex({ email: 1 }, { unique: true })
    await models.Colaborador.createIndex({ cpf: 1 }, { unique: true })
    await models.Morador.createIndex({ cpf: 1 }, { unique: true })
    await models.FinanceiroUnificado.createIndex({ codigo_lancamento: 1 }, { unique: true })
    await models.StatusPagamentoMorador.createIndex({ morador_id: 1 }, { unique: true })
    await models.Transacao.createIndex({ id_transacao: 1 }, { unique: true })
    await models.LancamentoContabil.createIndex({ numero_lancamento: 1 }, { unique: true })
    
    // Índices de performance
    await models.Condominio.createIndex({ master_id: 1 })
    await models.Adm.createIndex({ condominio_id: 1, master_id: 1 })
    await models.Colaborador.createIndex({ condominio_id: 1, master_id: 1 })
    await models.Morador.createIndex({ condominio_id: 1, master_id: 1 })
    await models.FinanceiroMorador.createIndex({ condominio_id: 1, status: 1, data_vencimento: 1 })
    await models.FinanceiroCondominio.createIndex({ condominio_id: 1, status: 1, data_vencimento: 1 })
    await models.FinanceiroColaborador.createIndex({ condominio_id: 1, status: 1, data_vencimento: 1 })
    await models.FinanceiroUnificado.createIndex({ condominio_id: 1, status: 1, data_vencimento: 1 })
    await models.Transacao.createIndex({ condominio_id: 1, status: 1 })
    await models.Ticket.createIndex({ condominio_id: 1, status: 1 })
    await models.Evento.createIndex({ condominio_id: 1, data_inicio: 1 })
    
    console.log('✅ Índices criados com sucesso')
  } catch (error) {
    console.error('❌ Erro ao criar índices:', error.message)
  }
}

// Limpar banco
async function limparBanco() {
  console.log('🧹 Limpando banco de dados...')
  
  try {
    // Limpar todas as collections
    const collections = await mongoose.connection.db.listCollections().toArray()
    
    for (const collection of collections) {
      await mongoose.connection.db.collection(collection.name).deleteMany({})
    }
    
    console.log('✅ Banco de dados limpo')
  } catch (error) {
    console.error('❌ Erro ao limpar banco:', error)
    throw error
  }
}

// Verificar collections criadas
async function verificarCollections() {
  console.log('📋 Verificando collections criadas...')
  
  const collections = await mongoose.connection.db.listCollections().toArray()
  const collectionNames = collections.map(c => c.name).sort()
  
  console.log('✅ Collections criadas:')
  collectionNames.forEach((name, index) => {
    console.log(`  ${(index + 1).toString().padStart(2, '0')}. ${name}`)
  })
  
  console.log(`\n📊 Total de collections: ${collectionNames.length}`)
  
  // Verificar se todas as collections esperadas foram criadas
  const expectedCollections = [
    'masters', 'condominios', 'adms', 'colaboradores', 'moradores', 'conjuges', 'dependentes', 'imobiliarias',
    'financeiro-moradores', 'financeiro-condominios', 'financeiro-colaboradores', 'financeiro-unificado', 'status-pagamento-moradores',
    'transacoes', 'contas-bancarias',
    'plano-contas', 'lancamentos-contabeis', 'extratos-bancarios',
    'alertas-financeiros', 'automacoes-financeiras', 'cobrancas-automatizadas',
    'tickets', 'eventos', 'animais', 'veiculos',
    'ativos-fixos', 'lancamentos-recorrentes', 'webhook-retries',
    'condominium-settings', 'open-banking-integracoes'
  ]
  
  const missing = expectedCollections.filter(name => !collectionNames.includes(name))
  
  if (missing.length > 0) {
    console.log(`\n⚠️ Collections não criadas: ${missing.join(', ')}`)
  } else {
    console.log('\n✅ Todas as collections esperadas foram criadas!')
  }
}

// Função principal
async function criarCollections() {
  try {
    console.log('🚀 Criando collections do Sistema VemJoão...')
    console.log('📋 Total de collections: 39')
    
    await conectarMongoDB()
    await limparBanco()
    const models = criarModelos()
    await criarIndices(models)
    await verificarCollections()
    
    console.log('\n✅ Collections criadas com sucesso!')
    console.log('🎯 Estrutura completa do banco configurada')
    console.log('📝 Pronto para receber dados via APIs')
    
  } catch (error) {
    console.error('❌ Erro durante a criação:', error)
    process.exit(1)
  } finally {
    await mongoose.connection.close()
    console.log('🔌 Conexão com MongoDB fechada')
  }
}

// Executar script
if (require.main === module) {
  criarCollections()
}

module.exports = { criarCollections }