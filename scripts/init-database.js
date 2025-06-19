#!/usr/bin/env node

/**
 * Script de Inicialização do Banco de Dados
 * 
 * Este script cria toda a estrutura inicial do MongoDB com:
 * - 2 usuários master com senhas específicas
 * - 2 condomínios para cada master
 * - Moradores de exemplo
 * - Colaboradores de exemplo
 * - Dados financeiros de exemplo
 */

const mongoose = require('mongoose')

// Configuração do MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/condominiosistema'

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

// Definir schemas (versão simplificada para o script)
const MasterSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  senha: { type: String, required: true },
  celular1: { type: String, required: true },
  celular2: { type: String, required: true },
  data_criacao: { type: Date, default: Date.now }
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
  data_criacao: { type: Date, default: Date.now }
}, { timestamps: true, collection: 'condominios' })

const MoradorSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  cpf: { type: String, required: true, unique: true },
  data_nasc: { type: Date, required: true },
  celular1: { type: String, required: true },
  celular2: { type: String, required: false },
  email: { type: String, required: true, unique: true },
  senha: { type: String, required: true },
  tipo: { type: String, required: true, enum: ['proprietario', 'inquilino', 'dependente'] },
  unidade: { type: String, required: true },
  bloco: { type: String, required: false },
  data_inicio: { type: Date, required: true },
  data_fim: { type: Date, required: false },
  responsavel_id: { type: mongoose.Schema.Types.ObjectId, required: false, ref: 'Morador' },
  proprietario_id: { type: mongoose.Schema.Types.ObjectId, required: false, ref: 'Morador' },
  imobiliaria_id: { type: mongoose.Schema.Types.ObjectId, required: false, ref: 'Imobiliaria' },
  condominio_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Condominio' },
  master_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Master' },
  data_criacao: { type: Date, default: Date.now },
  ativo: { type: Boolean, default: true },
  observacoes: { type: String, required: false }
}, { timestamps: true, collection: 'moradores' })

const ColaboradorSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  cpf: { type: String, required: true },
  data_nasc: { type: Date, required: true },
  celular1: { type: String, required: true },
  celular2: { type: String, required: false },
  email: { type: String, required: true, unique: true },
  senha: { type: String, required: true },
  data_inicio: { type: Date, required: true },
  data_fim: { type: Date, required: false },
  condominio_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Condominio' },
  cargo: { type: String, required: false },
  salario: { type: Number, required: false },
  tipo_contrato: { type: String, required: false },
  master_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Master' },
  data_criacao: { type: Date, default: Date.now },
  ativo: { type: Boolean, default: true }
}, { timestamps: true, collection: 'colaboradores' })

const FinanceiroMoradorSchema = new mongoose.Schema({
  tipo: { type: String, required: true, enum: ['receita', 'despesa', 'transferencia'], default: 'despesa' },
  categoria: { type: String, required: true },
  descricao: { type: String, required: true },
  valor: { type: Number, required: true },
  data_vencimento: { type: Date, required: true },
  data_pagamento: { type: Date, required: false },
  status: { type: String, required: true, enum: ['pendente', 'pago', 'atrasado', 'cancelado'], default: 'pendente' },
  morador_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Morador' },
  morador_nome: { type: String, required: true },
  apartamento: { type: String, required: true },
  bloco: { type: String, required: false },
  condominio_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Condominio' },
  master_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Master' },
  criado_por_tipo: { type: String, required: true, enum: ['master', 'sindico', 'subsindico'] },
  criado_por_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  criado_por_nome: { type: String, required: true },
  recorrente: { type: Boolean, default: false },
  mes_referencia: { type: String, required: false },
  data_criacao: { type: Date, default: Date.now },
  data_atualizacao: { type: Date, default: Date.now },
  ativo: { type: Boolean, default: true }
}, { timestamps: true, collection: 'financeiro-moradores' })

// Criar modelos
const Master = mongoose.model('Master', MasterSchema)
const Condominio = mongoose.model('Condominio', CondominioSchema)
const Morador = mongoose.model('Morador', MoradorSchema)
const Colaborador = mongoose.model('Colaborador', ColaboradorSchema)
const FinanceiroMorador = mongoose.model('FinanceiroMorador', FinanceiroMoradorSchema)

// Limpar banco de dados
async function limparBanco() {
  console.log('🧹 Limpando banco de dados...')
  
  try {
    await FinanceiroMorador.deleteMany({})
    await Colaborador.deleteMany({})
    await Morador.deleteMany({})
    await Condominio.deleteMany({})
    await Master.deleteMany({})
    
    console.log('✅ Banco de dados limpo')
  } catch (error) {
    console.error('❌ Erro ao limpar banco:', error)
    throw error
  }
}

// Criar masters
async function criarMasters() {
  console.log('👤 Criando usuários master...')
  
  const masters = [
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
  
  const mastersCreated = await Master.insertMany(masters)
  console.log(`✅ ${mastersCreated.length} masters criados`)
  
  return mastersCreated
}

// Criar condomínios
async function criarCondominios(masters) {
  console.log('🏢 Criando condomínios...')
  
  const condominios = []
  
  // Condomínios para Master 1
  condominios.push({
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
  })
  
  condominios.push({
    nome: 'Edifício Solar dos Jardins',
    cep: '04567-890',
    estado: 'SP',
    cidade: 'São Paulo',
    bairro: 'Jardins',
    rua: 'Alameda dos Anjos',
    numero: '456',
    complemento: 'Esquina com Rua Augusta',
    master_id: masters[0]._id,
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
  })
  
  // Condomínios para Master 2
  condominios.push({
    nome: 'Condomínio Parque Verde',
    cep: '12345-678',
    estado: 'RJ',
    cidade: 'Rio de Janeiro',
    bairro: 'Barra da Tijuca',
    rua: 'Avenida das Américas',
    numero: '789',
    complemento: 'Bloco Principal',
    master_id: masters[1]._id,
    valor_taxa_condominio: 520.00,
    dia_vencimento: 5,
    aceita_pagamento_automatico: false,
    razao_social: 'Condomínio Parque Verde',
    cnpj: '34.567.890/0001-12',
    banco: 'Caixa Econômica Federal',
    agencia: '3456',
    conta: '34567-8',
    chave_pix: 'parqueverde@gmail.com',
    multa_atraso: 3.0,
    juros_mes: 1.5,
    dias_aviso_vencimento: 7
  })
  
  condominios.push({
    nome: 'Residencial Águas Claras',
    cep: '56789-012',
    estado: 'RJ',
    cidade: 'Rio de Janeiro',
    bairro: 'Copacabana',
    rua: 'Rua Barata Ribeiro',
    numero: '321',
    complemento: 'Próximo ao metrô',
    master_id: masters[1]._id,
    valor_taxa_condominio: 390.00,
    dia_vencimento: 20,
    aceita_pagamento_automatico: true,
    razao_social: 'Residencial Águas Claras Ltda',
    cnpj: '45.678.901/0001-23',
    banco: 'Santander',
    agencia: '4567',
    conta: '45678-9',
    chave_pix: '(21) 99888-7766',
    multa_atraso: 2.0,
    juros_mes: 1.0,
    dias_aviso_vencimento: 5
  })
  
  const condominiosCreated = await Condominio.insertMany(condominios)
  console.log(`✅ ${condominiosCreated.length} condomínios criados`)
  
  return condominiosCreated
}

// Criar moradores
async function criarMoradores(masters, condominios) {
  console.log('👥 Criando moradores...')
  
  const moradores = []
  
  // Moradores para Villa Bela (Master 1)
  const villaBela = condominios[0]
  moradores.push(
    {
      nome: 'João Silva Santos',
      cpf: '12345678901',
      data_nasc: new Date('1985-03-15'),
      celular1: '(11) 99111-2233',
      celular2: '(11) 3333-4444',
      email: 'joao.silva@email.com',
      senha: '123456',
      tipo: 'proprietario',
      unidade: '101',
      bloco: 'A',
      data_inicio: new Date('2020-01-01'),
      condominio_id: villaBela._id,
      master_id: masters[0]._id,
      observacoes: 'Síndico do condomínio'
    },
    {
      nome: 'Maria Oliveira Costa',
      cpf: '23456789012',
      data_nasc: new Date('1990-07-22'),
      celular1: '(11) 99222-3344',
      email: 'maria.oliveira@email.com',
      senha: '123456',
      tipo: 'inquilino',
      unidade: '102',
      bloco: 'A',
      data_inicio: new Date('2022-03-01'),
      condominio_id: villaBela._id,
      master_id: masters[0]._id
    },
    {
      nome: 'Pedro Fernandes Lima',
      cpf: '34567890123',
      data_nasc: new Date('1978-11-05'),
      celular1: '(11) 99333-4455',
      celular2: '(11) 2222-1111',
      email: 'pedro.fernandes@email.com',
      senha: '123456',
      tipo: 'proprietario',
      unidade: '201',
      bloco: 'B',
      data_inicio: new Date('2019-06-15'),
      condominio_id: villaBela._id,
      master_id: masters[0]._id
    },
    {
      nome: 'Ana Paula Rodrigues',
      cpf: '45678901234',
      data_nasc: new Date('1992-02-28'),
      celular1: '(11) 99444-5566',
      email: 'ana.paula@email.com',
      senha: '123456',
      tipo: 'proprietario',
      unidade: '202',
      bloco: 'B',
      data_inicio: new Date('2021-08-10'),
      condominio_id: villaBela._id,
      master_id: masters[0]._id
    }
  )
  
  // Moradores para Solar dos Jardins (Master 1)
  const solarJardins = condominios[1]
  moradores.push(
    {
      nome: 'Carlos Eduardo Mendes',
      cpf: '56789012345',
      data_nasc: new Date('1975-09-12'),
      celular1: '(11) 99555-6677',
      celular2: '(11) 4444-3333',
      email: 'carlos.mendes@email.com',
      senha: '123456',
      tipo: 'proprietario',
      unidade: '1501',
      data_inicio: new Date('2018-04-01'),
      condominio_id: solarJardins._id,
      master_id: masters[0]._id
    },
    {
      nome: 'Fernanda Santos Almeida',
      cpf: '67890123456',
      data_nasc: new Date('1987-12-03'),
      celular1: '(11) 99666-7788',
      email: 'fernanda.almeida@email.com',
      senha: '123456',
      tipo: 'inquilino',
      unidade: '1502',
      data_inicio: new Date('2023-01-15'),
      condominio_id: solarJardins._id,
      master_id: masters[0]._id
    }
  )
  
  // Moradores para Parque Verde (Master 2)
  const parqueVerde = condominios[2]
  moradores.push(
    {
      nome: 'Roberto Silva Pereira',
      cpf: '78901234567',
      data_nasc: new Date('1982-05-18'),
      celular1: '(21) 99777-8899',
      celular2: '(21) 2555-4444',
      email: 'roberto.pereira@email.com',
      senha: '123456',
      tipo: 'proprietario',
      unidade: '301',
      bloco: 'Torre 1',
      data_inicio: new Date('2020-07-01'),
      condominio_id: parqueVerde._id,
      master_id: masters[1]._id
    },
    {
      nome: 'Juliana Costa Martins',
      cpf: '89012345678',
      data_nasc: new Date('1995-01-25'),
      celular1: '(21) 99888-9900',
      email: 'juliana.martins@email.com',
      senha: '123456',
      tipo: 'proprietario',
      unidade: '302',
      bloco: 'Torre 1',
      data_inicio: new Date('2021-12-01'),
      condominio_id: parqueVerde._id,
      master_id: masters[1]._id
    }
  )
  
  // Moradores para Águas Claras (Master 2)
  const aguasClaras = condominios[3]
  moradores.push(
    {
      nome: 'Marcos Antonio Souza',
      cpf: '90123456789',
      data_nasc: new Date('1970-08-14'),
      celular1: '(21) 99999-0011',
      celular2: '(21) 3777-6666',
      email: 'marcos.souza@email.com',
      senha: '123456',
      tipo: 'proprietario',
      unidade: '801',
      data_inicio: new Date('2017-03-01'),
      condominio_id: aguasClaras._id,
      master_id: masters[1]._id,
      observacoes: 'Subsíndico'
    },
    {
      nome: 'Patrícia Lima Santos',
      cpf: '01234567890',
      data_nasc: new Date('1988-04-07'),
      celular1: '(21) 99000-1122',
      email: 'patricia.santos@email.com',
      senha: '123456',
      tipo: 'inquilino',
      unidade: '802',
      data_inicio: new Date('2022-09-01'),
      condominio_id: aguasClaras._id,
      master_id: masters[1]._id
    }
  )
  
  const moradoresCreated = await Morador.insertMany(moradores)
  console.log(`✅ ${moradoresCreated.length} moradores criados`)
  
  return moradoresCreated
}

// Criar colaboradores
async function criarColaboradores(masters, condominios) {
  console.log('👷 Criando colaboradores...')
  
  const colaboradores = []
  
  // Colaboradores para os condomínios do Master 1
  colaboradores.push(
    {
      nome: 'José da Silva',
      cpf: '11122233344',
      data_nasc: new Date('1980-06-10'),
      celular1: '(11) 98765-4321',
      celular2: '(11) 1234-5678',
      email: 'jose.porteiro@villabela.com',
      senha: 'porteiro123',
      data_inicio: new Date('2020-01-15'),
      condominio_id: condominios[0]._id,
      cargo: 'Porteiro',
      salario: 2500.00,
      tipo_contrato: 'CLT',
      master_id: masters[0]._id
    },
    {
      nome: 'Maria das Dores Limpeza',
      cpf: '22233344455',
      data_nasc: new Date('1975-04-22'),
      celular1: '(11) 98888-7777',
      email: 'maria.limpeza@villabela.com',
      senha: 'limpeza123',
      data_inicio: new Date('2020-02-01'),
      condominio_id: condominios[0]._id,
      cargo: 'Auxiliar de Limpeza',
      salario: 1800.00,
      tipo_contrato: 'CLT',
      master_id: masters[0]._id
    },
    {
      nome: 'Carlos Manutenção',
      cpf: '33344455566',
      data_nasc: new Date('1983-09-15'),
      celular1: '(11) 97777-6666',
      email: 'carlos.manutencao@solardosjardins.com',
      senha: 'manutencao123',
      data_inicio: new Date('2021-01-10'),
      condominio_id: condominios[1]._id,
      cargo: 'Técnico de Manutenção',
      salario: 3200.00,
      tipo_contrato: 'CLT',
      master_id: masters[0]._id
    }
  )
  
  // Colaboradores para os condomínios do Master 2
  colaboradores.push(
    {
      nome: 'Antonio Portaria',
      cpf: '44455566677',
      data_nasc: new Date('1978-12-05'),
      celular1: '(21) 96666-5555',
      celular2: '(21) 2333-4444',
      email: 'antonio.porteiro@parqueverde.com',
      senha: 'porteiro456',
      data_inicio: new Date('2019-08-01'),
      condominio_id: condominios[2]._id,
      cargo: 'Porteiro',
      salario: 2800.00,
      tipo_contrato: 'CLT',
      master_id: masters[1]._id
    },
    {
      nome: 'Rosa Jardim',
      cpf: '55566677788',
      data_nasc: new Date('1972-03-18'),
      celular1: '(21) 95555-4444',
      email: 'rosa.jardim@aguasclaras.com',
      senha: 'jardim789',
      data_inicio: new Date('2020-05-01'),
      condominio_id: condominios[3]._id,
      cargo: 'Jardineira',
      salario: 2200.00,
      tipo_contrato: 'CLT',
      master_id: masters[1]._id
    }
  )
  
  const colaboradoresCreated = await Colaborador.insertMany(colaboradores)
  console.log(`✅ ${colaboradoresCreated.length} colaboradores criados`)
  
  return colaboradoresCreated
}

// Criar dados financeiros
async function criarDadosFinanceiros(masters, condominios, moradores) {
  console.log('💰 Criando dados financeiros...')
  
  const financeiros = []
  const hoje = new Date()
  const mesAtual = hoje.getMonth()
  const anoAtual = hoje.getFullYear()
  
  // Gerar lançamentos financeiros para cada morador
  for (const morador of moradores) {
    const condominio = condominios.find(c => c._id.equals(morador.condominio_id))
    const master = masters.find(m => m._id.equals(morador.master_id))
    
    // Taxa de condomínio dos últimos 3 meses
    for (let i = 0; i < 3; i++) {
      const mesRef = mesAtual - i
      const anoRef = mesRef < 0 ? anoAtual - 1 : anoAtual
      const mesCorrigido = mesRef < 0 ? 12 + mesRef : mesRef
      
      const dataVencimento = new Date(anoRef, mesCorrigido, condominio.dia_vencimento)
      const isPago = Math.random() > 0.3 // 70% de chance de estar pago
      
      financeiros.push({
        tipo: 'despesa',
        categoria: 'taxa_condominio',
        descricao: `Taxa de Condomínio - ${String(mesCorrigido + 1).padStart(2, '0')}/${anoRef}`,
        valor: condominio.valor_taxa_condominio,
        data_vencimento: dataVencimento,
        data_pagamento: isPago ? new Date(dataVencimento.getTime() + Math.random() * 10 * 24 * 60 * 60 * 1000) : null,
        status: isPago ? 'pago' : (dataVencimento < hoje ? 'atrasado' : 'pendente'),
        morador_id: morador._id,
        morador_nome: morador.nome,
        apartamento: morador.unidade,
        bloco: morador.bloco || '',
        condominio_id: condominio._id,
        master_id: master._id,
        criado_por_tipo: 'master',
        criado_por_id: master._id,
        criado_por_nome: master.nome,
        recorrente: true,
        mes_referencia: `${String(mesCorrigido + 1).padStart(2, '0')}/${anoRef}`
      })
    }
    
    // Alguns lançamentos extras aleatórios
    if (Math.random() > 0.7) { // 30% de chance
      financeiros.push({
        tipo: 'despesa',
        categoria: 'taxa_extra',
        descricao: 'Rateio - Reforma do Elevador',
        valor: 150.00,
        data_vencimento: new Date(anoAtual, mesAtual - 1, 15),
        data_pagamento: Math.random() > 0.5 ? new Date(anoAtual, mesAtual - 1, 20) : null,
        status: Math.random() > 0.5 ? 'pago' : 'pendente',
        morador_id: morador._id,
        morador_nome: morador.nome,
        apartamento: morador.unidade,
        bloco: morador.bloco || '',
        condominio_id: condominio._id,
        master_id: master._id,
        criado_por_tipo: 'master',
        criado_por_id: master._id,
        criado_por_nome: master.nome,
        recorrente: false
      })
    }
  }
  
  const financeirosCreated = await FinanceiroMorador.insertMany(financeiros)
  console.log(`✅ ${financeirosCreated.length} lançamentos financeiros criados`)
  
  return financeirosCreated
}

// Função principal
async function inicializarBanco() {
  try {
    console.log('🚀 Iniciando inicialização do banco de dados...')
    
    await conectarMongoDB()
    await limparBanco()
    
    const masters = await criarMasters()
    const condominios = await criarCondominios(masters)
    const moradores = await criarMoradores(masters, condominios)
    const colaboradores = await criarColaboradores(masters, condominios)
    const financeiros = await criarDadosFinanceiros(masters, condominios, moradores)
    
    console.log('\n📊 RESUMO DA INICIALIZAÇÃO:')
    console.log(`👤 Masters: ${masters.length}`)
    console.log(`🏢 Condomínios: ${condominios.length}`)
    console.log(`👥 Moradores: ${moradores.length}`)
    console.log(`👷 Colaboradores: ${colaboradores.length}`)
    console.log(`💰 Lançamentos Financeiros: ${financeiros.length}`)
    
    console.log('\n🔑 CREDENCIAIS DE ACESSO:')
    console.log('Master 1: master@teste.com | Senha: >T8Nn7n_S8-T')
    console.log('Master 2: master2@teste.com | Senha: >T8Nn7n_S8-T')
    
    console.log('\n✅ Inicialização concluída com sucesso!')
    
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
  inicializarBanco()
}

module.exports = { inicializarBanco }