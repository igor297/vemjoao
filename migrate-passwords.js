#!/usr/bin/env node

/**
 * Script de Migração de Senhas para bcrypt
 * 
 * Este script migra todas as senhas em texto puro para bcrypt
 * permitindo que os usuários existentes continuem funcionando
 */

const mongoose = require('mongoose')
const bcrypt = require('bcrypt')

// Configuração do MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/condominio-sistema'

// Constantes do bcrypt
const SALT_ROUNDS = 12

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

// Definir schemas
const MasterSchema = new mongoose.Schema({
  nome: String,
  email: String,
  senha: String,
  celular1: String,
  celular2: String,
  data_criacao: { type: Date, default: Date.now }
}, { timestamps: true })

const AdmSchema = new mongoose.Schema({
  nome: String,
  email: String,
  senha: String,
  tipo: String,
  condominio_id: mongoose.Schema.Types.ObjectId,
  master_id: mongoose.Schema.Types.ObjectId,
  data_criacao: { type: Date, default: Date.now }
}, { timestamps: true, collection: 'adms' })

const MoradorSchema = new mongoose.Schema({
  nome: String,
  cpf: String,
  data_nasc: Date,
  celular1: String,
  celular2: String,
  email: String,
  senha: String,
  tipo: String,
  unidade: String,
  bloco: String,
  data_inicio: Date,
  data_fim: Date,
  responsavel_id: mongoose.Schema.Types.ObjectId,
  proprietario_id: mongoose.Schema.Types.ObjectId,
  imobiliaria_id: mongoose.Schema.Types.ObjectId,
  condominio_id: mongoose.Schema.Types.ObjectId,
  master_id: mongoose.Schema.Types.ObjectId,
  data_criacao: { type: Date, default: Date.now },
  ativo: { type: Boolean, default: true },
  observacoes: String
}, { timestamps: true, collection: 'moradores' })

const ColaboradorSchema = new mongoose.Schema({
  nome: String,
  cpf: String,
  data_nasc: Date,
  celular1: String,
  celular2: String,
  email: String,
  senha: String,
  data_inicio: Date,
  data_fim: Date,
  condominio_id: mongoose.Schema.Types.ObjectId,
  cargo: String,
  salario: Number,
  tipo_contrato: String,
  master_id: mongoose.Schema.Types.ObjectId,
  data_criacao: { type: Date, default: Date.now },
  ativo: { type: Boolean, default: true }
}, { timestamps: true, collection: 'colaboradores' })

// Criar modelos
const Master = mongoose.model('Master', MasterSchema)
const Adm = mongoose.model('Adm', AdmSchema)
const Morador = mongoose.model('Morador', MoradorSchema)
const Colaborador = mongoose.model('Colaborador', ColaboradorSchema)

// Função para verificar se uma senha já está hasheada
function isAlreadyHashed(password) {
  // Senhas bcrypt começam com $2b$, $2a$ ou $2y$
  return password && password.startsWith('$2')
}

// Função para hashear senha
async function hashPassword(password) {
  try {
    return await bcrypt.hash(password, SALT_ROUNDS)
  } catch (error) {
    throw new Error(`Erro ao criar hash da senha: ${error.message}`)
  }
}

// Migrar Masters
async function migrarMasters() {
  console.log('👤 Migrando senhas dos Masters...')
  
  const masters = await Master.find({})
  let migradosCount = 0
  let jaHasheadosCount = 0
  
  for (const master of masters) {
    if (isAlreadyHashed(master.senha)) {
      console.log(`  ✅ ${master.email} - Senha já hasheada`)
      jaHasheadosCount++
      continue
    }
    
    try {
      const hashedPassword = await hashPassword(master.senha)
      await Master.findByIdAndUpdate(master._id, { senha: hashedPassword })
      console.log(`  ✅ ${master.email} - Senha migrada com sucesso`)
      migradosCount++
    } catch (error) {
      console.error(`  ❌ ${master.email} - Erro ao migrar:`, error.message)
    }
  }
  
  console.log(`📊 Masters: ${migradosCount} migrados, ${jaHasheadosCount} já hasheados`)
  return { migrados: migradosCount, jaHasheados: jaHasheadosCount }
}

// Migrar ADMs
async function migrarAdms() {
  console.log('👮 Migrando senhas dos ADMs...')
  
  const adms = await Adm.find({})
  let migradosCount = 0
  let jaHasheadosCount = 0
  
  for (const adm of adms) {
    if (isAlreadyHashed(adm.senha)) {
      console.log(`  ✅ ${adm.email} - Senha já hasheada`)
      jaHasheadosCount++
      continue
    }
    
    try {
      const hashedPassword = await hashPassword(adm.senha)
      await Adm.findByIdAndUpdate(adm._id, { senha: hashedPassword })
      console.log(`  ✅ ${adm.email} - Senha migrada com sucesso`)
      migradosCount++
    } catch (error) {
      console.error(`  ❌ ${adm.email} - Erro ao migrar:`, error.message)
    }
  }
  
  console.log(`📊 ADMs: ${migradosCount} migrados, ${jaHasheadosCount} já hasheados`)
  return { migrados: migradosCount, jaHasheados: jaHasheadosCount }
}

// Migrar Moradores
async function migrarMoradores() {
  console.log('👥 Migrando senhas dos Moradores...')
  
  const moradores = await Morador.find({})
  let migradosCount = 0
  let jaHasheadosCount = 0
  
  for (const morador of moradores) {
    if (isAlreadyHashed(morador.senha)) {
      console.log(`  ✅ ${morador.email} - Senha já hasheada`)
      jaHasheadosCount++
      continue
    }
    
    try {
      const hashedPassword = await hashPassword(morador.senha)
      await Morador.findByIdAndUpdate(morador._id, { senha: hashedPassword })
      console.log(`  ✅ ${morador.email} - Senha migrada com sucesso`)
      migradosCount++
    } catch (error) {
      console.error(`  ❌ ${morador.email} - Erro ao migrar:`, error.message)
    }
  }
  
  console.log(`📊 Moradores: ${migradosCount} migrados, ${jaHasheadosCount} já hasheados`)
  return { migrados: migradosCount, jaHasheados: jaHasheadosCount }
}

// Migrar Colaboradores
async function migrarColaboradores() {
  console.log('👷 Migrando senhas dos Colaboradores...')
  
  const colaboradores = await Colaborador.find({})
  let migradosCount = 0
  let jaHasheadosCount = 0
  
  for (const colaborador of colaboradores) {
    if (isAlreadyHashed(colaborador.senha)) {
      console.log(`  ✅ ${colaborador.email} - Senha já hasheada`)
      jaHasheadosCount++
      continue
    }
    
    try {
      const hashedPassword = await hashPassword(colaborador.senha)
      await Colaborador.findByIdAndUpdate(colaborador._id, { senha: hashedPassword })
      console.log(`  ✅ ${colaborador.email} - Senha migrada com sucesso`)
      migradosCount++
    } catch (error) {
      console.error(`  ❌ ${colaborador.email} - Erro ao migrar:`, error.message)
    }
  }
  
  console.log(`📊 Colaboradores: ${migradosCount} migrados, ${jaHasheadosCount} já hasheados`)
  return { migrados: migradosCount, jaHasheados: jaHasheadosCount }
}

// Função principal
async function migrarSenhas() {
  try {
    console.log('🔄 Iniciando migração de senhas para bcrypt...')
    
    await conectarMongoDB()
    
    const resultados = {
      masters: await migrarMasters(),
      adms: await migrarAdms(),
      moradores: await migrarMoradores(),
      colaboradores: await migrarColaboradores()
    }
    
    console.log('\n📊 RESUMO DA MIGRAÇÃO:')
    console.log(`👤 Masters: ${resultados.masters.migrados} migrados, ${resultados.masters.jaHasheados} já hasheados`)
    console.log(`👮 ADMs: ${resultados.adms.migrados} migrados, ${resultados.adms.jaHasheados} já hasheados`)
    console.log(`👥 Moradores: ${resultados.moradores.migrados} migrados, ${resultados.moradores.jaHasheados} já hasheados`)
    console.log(`👷 Colaboradores: ${resultados.colaboradores.migrados} migrados, ${resultados.colaboradores.jaHasheados} já hasheados`)
    
    const totalMigrados = resultados.masters.migrados + resultados.adms.migrados + 
                         resultados.moradores.migrados + resultados.colaboradores.migrados
    const totalJaHasheados = resultados.masters.jaHasheados + resultados.adms.jaHasheados + 
                            resultados.moradores.jaHasheados + resultados.colaboradores.jaHasheados
    
    console.log(`\n🎯 TOTAL: ${totalMigrados} migrados, ${totalJaHasheados} já hasheados`)
    
    if (totalMigrados > 0) {
      console.log('\n✅ Migração concluída com sucesso!')
      console.log('🔑 Agora todos os usuários podem fazer login com suas senhas originais')
    } else {
      console.log('\n⚠️ Nenhuma senha precisou ser migrada (todas já estavam hasheadas)')
    }
    
  } catch (error) {
    console.error('❌ Erro durante a migração:', error)
    process.exit(1)
  } finally {
    await mongoose.connection.close()
    console.log('🔌 Conexão com MongoDB fechada')
  }
}

// Executar script
if (require.main === module) {
  migrarSenhas()
}

module.exports = { migrarSenhas }