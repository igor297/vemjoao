#!/usr/bin/env node

/**
 * Script de Inicialização com Dados de Teste
 * Sistema VemJoão - Gestão Condominial
 * 
 * Este script cria as collections necessárias e popula com dados de teste:
 * - 2 Masters (master@teste.com e master2@teste.com)
 * - 2 Condomínios (um para cada master)
 * - Collections vazias para o restante do sistema
 */

const mongoose = require('mongoose')
const bcrypt = require('bcrypt')

// Configuração do MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/condominio-sistema'

// Constantes do bcrypt
const SALT_ROUNDS = 12

// Função para hashear senha
async function hashPassword(password) {
  try {
    return await bcrypt.hash(password, SALT_ROUNDS)
  } catch (error) {
    throw new Error(`Erro ao criar hash da senha: ${error.message}`)
  }
}

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

// Definir schemas principais
const MasterSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  senha: { type: String, required: true },
  celular1: { type: String, required: true },
  celular2: { type: String },
  data_criacao: { type: Date, default: Date.now },
  ativo: { type: Boolean, default: true }
}, { timestamps: true })

const CondominioSchema = new mongoose.Schema({
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
}, { timestamps: true, collection: 'condominios' })

// Schemas para outras collections (vazias)
const schemas = {
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
  }, { timestamps: true, collection: 'eventos' })
}

// Criar modelos
function criarModelos() {
  const models = {
    Master: mongoose.model('Master', MasterSchema),
    Condominio: mongoose.model('Condominio', CondominioSchema)
  }
  
  // Criar modelos para outras collections
  Object.keys(schemas).forEach(schemaName => {
    const modelName = schemaName.replace('Schema', '')
    models[modelName] = mongoose.model(modelName, schemas[schemaName])
  })
  
  return models
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

// Criar masters
async function criarMasters() {
  console.log('👤 Criando masters de teste...')
  
  const mastersData = [
    {
      nome: 'Master Teste 1',
      email: 'master@teste.com',
      senha: '>T8Nn7n_S8-T',
      celular1: '(11) 99999-0001',
      celular2: '(11) 99999-0002'
    },
    {
      nome: 'Master Teste 2',
      email: 'master2@teste.com',
      senha: '>T8Nn7n_S8-T',
      celular1: '(11) 99999-0003',
      celular2: '(11) 99999-0004'
    }
  ]
  
  // Hashear as senhas antes de inserir
  const masters = []
  for (const masterData of mastersData) {
    const hashedPassword = await hashPassword(masterData.senha)
    masters.push({
      ...masterData,
      senha: hashedPassword
    })
    console.log(`  🔐 Senha hasheada para: ${masterData.email}`)
  }
  
  const Master = mongoose.model('Master', MasterSchema)
  const mastersCreated = await Master.insertMany(masters)
  console.log(`✅ ${mastersCreated.length} masters criados`)
  
  return mastersCreated
}

// Criar condomínios
async function criarCondominios(masters) {
  console.log('🏢 Criando condomínios de teste...')
  
  const condominios = [
    {
      nome: 'Residencial Villa Bela',
      cep: '01234-567',
      estado: 'SP',
      cidade: 'São Paulo',
      bairro: 'Vila Mariana',
      rua: 'Rua das Flores',
      numero: '123',
      complemento: 'Portão Azul',
      master_id: masters[0]._id,
      valor_taxa_condominio: 450.00,
      dia_vencimento: 10,
      aceita_pagamento_automatico: true,
      razao_social: 'Condomínio Villa Bela Ltda',
      cnpj: '12.345.678/0001-90',
      banco: 'Banco do Brasil',
      agencia: '1234-5',
      conta: '12345-6',
      chave_pix: 'villabela@pix.com.br',
      multa_atraso: 2.0,
      juros_mes: 1.0,
      dias_aviso_vencimento: 5
    },
    {
      nome: 'Edifício Solar dos Jardins',
      cep: '04567-890',
      estado: 'RJ',
      cidade: 'Rio de Janeiro',
      bairro: 'Copacabana',
      rua: 'Rua Barata Ribeiro',
      numero: '456',
      complemento: 'Próximo ao metrô',
      master_id: masters[1]._id,
      valor_taxa_condominio: 680.00,
      dia_vencimento: 15,
      aceita_pagamento_automatico: true,
      razao_social: 'Edifício Solar dos Jardins',
      cnpj: '23.456.789/0001-01',
      banco: 'Itaú',
      agencia: '2345',
      conta: '23456-7',
      chave_pix: '23456789000101',
      multa_atraso: 2.5,
      juros_mes: 1.2,
      dias_aviso_vencimento: 3
    }
  ]
  
  const Condominio = mongoose.model('Condominio', CondominioSchema)
  const condominiosCreated = await Condominio.insertMany(condominios)
  console.log(`✅ ${condominiosCreated.length} condomínios criados`)
  
  return condominiosCreated
}

// Criar collections vazias (forçar criação)
async function criarCollectionsVazias(models) {
  console.log('📦 Criando collections vazias...')
  
  const collectionsToCreate = ['Adm', 'Colaborador', 'Morador', 'FinanceiroMorador', 'Ticket', 'Evento']
  
  for (const modelName of collectionsToCreate) {
    if (models[modelName]) {
      try {
        // Forçar criação da collection através de uma operação
        await models[modelName].createCollection()
        console.log(`  ✅ Collection ${models[modelName].collection.name} criada`)
      } catch (error) {
        // Ignorar erro se collection já existe
        if (!error.message.includes('already exists')) {
          console.log(`  ⚠️ Aviso para ${modelName}: ${error.message}`)
        } else {
          console.log(`  ✅ Collection ${models[modelName].collection.name} já existe`)
        }
      }
    }
  }
}

// Criar índices essenciais
async function criarIndices() {
  console.log('🔍 Criando índices essenciais...')
  
  try {
    const Master = mongoose.model('Master')
    const Condominio = mongoose.model('Condominio')
    
    // Índices únicos críticos
    await Master.collection.createIndex({ email: 1 }, { unique: true })
    await Condominio.collection.createIndex({ master_id: 1 })
    
    console.log('✅ Índices criados com sucesso')
  } catch (error) {
    console.error('❌ Erro ao criar índices:', error.message)
  }
}

// Verificar estrutura criada
async function verificarEstrutura() {
  console.log('📋 Verificando estrutura criada...')
  
  const collections = await mongoose.connection.db.listCollections().toArray()
  const collectionNames = collections.map(c => c.name).sort()
  
  console.log('✅ Collections criadas:')
  collectionNames.forEach((name, index) => {
    console.log(`  ${(index + 1).toString().padStart(2, '0')}. ${name}`)
  })
  
  console.log(`\n📊 Total de collections: ${collectionNames.length}`)
  
  // Verificar dados
  const Master = mongoose.model('Master')
  const Condominio = mongoose.model('Condominio')
  
  const masterCount = await Master.countDocuments()
  const condominioCount = await Condominio.countDocuments()
  
  console.log('\n📊 Dados criados:')
  console.log(`  - Masters: ${masterCount}`)
  console.log(`  - Condomínios: ${condominioCount}`)
}

// Função principal
async function inicializarComDadosTeste() {
  try {
    console.log('🚀 Inicializando banco com dados de teste...')
    console.log('📋 Sistema VemJoão - Gestão Condominial')
    
    await conectarMongoDB()
    await limparBanco()
    
    const models = criarModelos()
    const masters = await criarMasters()
    const condominios = await criarCondominios(masters)
    
    await criarCollectionsVazias(models)
    await criarIndices()
    await verificarEstrutura()
    
    console.log('\n🔑 CREDENCIAIS DE TESTE:')
    console.log('Master 1: master@teste.com | Senha: >T8Nn7n_S8-T')
    console.log('Master 2: master2@teste.com | Senha: >T8Nn7n_S8-T')
    
    console.log('\n🏢 CONDOMÍNIOS CRIADOS:')
    console.log('1. Residencial Villa Bela (São Paulo)')
    console.log('2. Edifício Solar dos Jardins (Rio de Janeiro)')
    
    console.log('\n✅ Inicialização concluída com sucesso!')
    console.log('🎯 Banco pronto para testes do sistema')
    console.log('🔐 Senhas já estão criptografadas com bcrypt')
    
  } catch (error) {
    console.error('❌ Erro durante a inicialização:', error)
    process.exit(1)
  } finally {
    await mongoose.connection.close()
    console.log('🔌 Conexão com MongoDB fechada')
  }
}

// Executar script
if (require.main === module) {
  inicializarComDadosTeste()
}

module.exports = { inicializarComDadosTeste }