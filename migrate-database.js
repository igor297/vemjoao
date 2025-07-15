#!/usr/bin/env node

/**
 * Script de Migração de Banco de Dados
 * 
 * Este script migra todos os dados do banco 'condominiosistema' 
 * para o novo banco 'condominio-sistema'
 */

const mongoose = require('mongoose')

// Configuração dos bancos
const OLD_DB_URI = 'mongodb://localhost:27017/condominiosistema'
const NEW_DB_URI = 'mongodb://localhost:27017/condominio-sistema'

// Função para conectar aos bancos
async function connectToDatabases() {
  try {
    console.log('🔗 Conectando aos bancos de dados...')
    
    // Criar conexões separadas
    const oldConnection = await mongoose.createConnection(OLD_DB_URI)
    const newConnection = await mongoose.createConnection(NEW_DB_URI)
    
    console.log('✅ Conectado ao banco antigo:', OLD_DB_URI)
    console.log('✅ Conectado ao banco novo:', NEW_DB_URI)
    
    return { oldConnection, newConnection }
  } catch (error) {
    console.error('❌ Erro ao conectar:', error)
    process.exit(1)
  }
}

// Função para migrar uma collection
async function migrateCollection(collectionName, oldConnection, newConnection) {
  try {
    console.log(`📦 Migrando collection: ${collectionName}`)
    
    // Obter a collection do banco antigo
    const oldCollection = oldConnection.collection(collectionName)
    
    // Contar documentos
    const count = await oldCollection.countDocuments()
    console.log(`  📊 Encontrados ${count} documentos`)
    
    if (count === 0) {
      console.log('  ⚠️ Collection vazia, pulando...')
      return { migrated: 0, skipped: 0 }
    }
    
    // Buscar todos os documentos
    const documents = await oldCollection.find({}).toArray()
    
    // Obter a collection do banco novo
    const newCollection = newConnection.collection(collectionName)
    
    // Limpar a collection no banco novo (se existir)
    await newCollection.deleteMany({})
    
    // Inserir todos os documentos no banco novo
    const result = await newCollection.insertMany(documents)
    
    console.log(`  ✅ Migrados ${result.insertedCount} documentos`)
    
    return { migrated: result.insertedCount, skipped: 0 }
  } catch (error) {
    console.error(`  ❌ Erro ao migrar ${collectionName}:`, error.message)
    return { migrated: 0, skipped: 1 }
  }
}

// Função principal
async function migrateDatabases() {
  try {
    console.log('🚀 Iniciando migração de banco de dados...')
    
    const { oldConnection, newConnection } = await connectToDatabases()
    
    // Listar todas as collections do banco antigo
    const collections = await oldConnection.db.listCollections().toArray()
    console.log('📋 Collections encontradas:', collections.length)
    
    const results = {
      totalMigrated: 0,
      totalSkipped: 0,
      collections: []
    }
    
    // Migrar cada collection
    for (const collection of collections) {
      const collectionName = collection.name
      const result = await migrateCollection(collectionName, oldConnection, newConnection)
      
      results.collections.push({
        name: collectionName,
        migrated: result.migrated,
        skipped: result.skipped
      })
      
      results.totalMigrated += result.migrated
      results.totalSkipped += result.skipped
    }
    
    console.log('\n📊 RESUMO DA MIGRAÇÃO:')
    console.log('Collections migradas:')
    results.collections.forEach(col => {
      if (col.migrated > 0) {
        console.log(`  ✅ ${col.name}: ${col.migrated} documentos`)
      } else if (col.skipped > 0) {
        console.log(`  ⚠️ ${col.name}: erro na migração`)
      }
    })
    
    console.log(`\n🎯 TOTAL: ${results.totalMigrated} documentos migrados`)
    
    if (results.totalMigrated > 0) {
      console.log('\n✅ Migração concluída com sucesso!')
      console.log('🔄 O sistema agora usará o banco: condominio-sistema')
      console.log('🗑️ Você pode excluir o banco antigo quando confirmar que tudo está funcionando')
    } else {
      console.log('\n⚠️ Nenhum documento foi migrado')
    }
    
  } catch (error) {
    console.error('❌ Erro durante a migração:', error)
    process.exit(1)
  } finally {
    // Fechar conexões
    await mongoose.connection.close()
    console.log('🔌 Conexões fechadas')
  }
}

// Verificar se deve executar a migração
async function confirmMigration() {
  console.log('⚠️ ATENÇÃO: Esta operação irá:')
  console.log('1. Copiar todos os dados de "condominiosistema" para "condominio-sistema"')
  console.log('2. Sobrescrever dados existentes no banco novo')
  console.log('3. Não modificar o banco antigo')
  console.log('')
  console.log('🚀 Iniciando migração em 3 segundos...')
  
  // Aguardar 3 segundos
  await new Promise(resolve => setTimeout(resolve, 3000))
  
  // Executar migração
  await migrateDatabases()
}

// Executar script
if (require.main === module) {
  confirmMigration()
}

module.exports = { migrateDatabases }