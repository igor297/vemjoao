const { MongoClient } = require('mongodb');

async function migrateColaboradorCollection() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/condominio-sistema');
  
  try {
    await client.connect();
    console.log('✅ Conectado ao MongoDB');
    
    const db = client.db();
    
    // 1. Verificar situação atual
    console.log('\n=== SITUAÇÃO ATUAL ===');
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    const oldCollectionName = 'financeirocolaboradors';
    const newCollectionName = 'financeiro-colaboradores';
    
    const oldExists = collectionNames.includes(oldCollectionName);
    const newExists = collectionNames.includes(newCollectionName);
    
    console.log(`📋 Coleção antiga "${oldCollectionName}": ${oldExists ? '✅ EXISTE' : '❌ NÃO EXISTE'}`);
    console.log(`📋 Coleção nova "${newCollectionName}": ${newExists ? '✅ EXISTE' : '❌ NÃO EXISTE'}`);
    
    if (oldExists) {
      const oldCount = await db.collection(oldCollectionName).countDocuments();
      console.log(`📊 Documentos na coleção antiga: ${oldCount}`);
    }
    
    if (newExists) {
      const newCount = await db.collection(newCollectionName).countDocuments();
      console.log(`📊 Documentos na coleção nova: ${newCount}`);
    }
    
    // 2. Executar migração se necessário
    if (oldExists && !newExists) {
      console.log('\n=== INICIANDO MIGRAÇÃO ===');
      console.log(`🔄 Renomeando "${oldCollectionName}" para "${newCollectionName}"`);
      
      try {
        await db.collection(oldCollectionName).rename(newCollectionName);
        console.log('✅ Migração concluída com sucesso!');
        
        // Verificar resultado
        const finalCount = await db.collection(newCollectionName).countDocuments();
        console.log(`📊 Documentos na nova coleção: ${finalCount}`);
        
        // Verificar índices
        const indexes = await db.collection(newCollectionName).listIndexes().toArray();
        console.log(`📊 Índices preservados: ${indexes.length}`);
        indexes.forEach(index => {
          console.log(`   - ${index.name}: ${JSON.stringify(index.key)}`);
        });
        
      } catch (error) {
        console.error('❌ Erro durante a migração:', error.message);
        return;
      }
      
    } else if (!oldExists && newExists) {
      console.log('\n✅ MIGRAÇÃO JÁ CONCLUÍDA');
      console.log('A coleção já está com o nome correto.');
      
    } else if (oldExists && newExists) {
      console.log('\n⚠️  SITUAÇÃO AMBÍGUA');
      console.log('Ambas as coleções existem. Ação manual necessária.');
      
      const oldCount = await db.collection(oldCollectionName).countDocuments();
      const newCount = await db.collection(newCollectionName).countDocuments();
      
      console.log(`📊 Antiga: ${oldCount} documentos`);
      console.log(`📊 Nova: ${newCount} documentos`);
      
      if (oldCount > 0 && newCount === 0) {
        console.log('💡 Sugestão: A coleção antiga tem dados, a nova está vazia.');
        console.log('   Considere fazer a migração manual dos dados.');
      } else if (oldCount === 0 && newCount > 0) {
        console.log('💡 Sugestão: A coleção nova tem dados, a antiga está vazia.');
        console.log('   Considere remover a coleção antiga vazia.');
      } else if (oldCount > 0 && newCount > 0) {
        console.log('💡 Sugestão: Ambas têm dados. Verificação manual necessária.');
      }
      
    } else {
      console.log('\n❌ NENHUMA COLEÇÃO ENCONTRADA');
      console.log('Nem a coleção antiga nem a nova existem.');
      console.log('💡 Isso é normal se ainda não foram criados dados de colaboradores.');
    }
    
    // 3. Verificar configuração do modelo
    console.log('\n=== VERIFICAÇÃO DO MODELO ===');
    console.log('🔍 Verificando se o modelo Mongoose está configurado corretamente...');
    
    // Ler o arquivo do modelo para verificar a configuração
    const fs = require('fs');
    const path = require('path');
    
    try {
      const modelPath = path.join(__dirname, 'src', 'models', 'FinanceiroColaborador.ts');
      const modelContent = fs.readFileSync(modelPath, 'utf8');
      
      if (modelContent.includes("collection: 'financeiro-colaboradores'")) {
        console.log('✅ Modelo configurado para usar: "financeiro-colaboradores"');
      } else if (modelContent.includes("collection: 'financeirocolaboradors'")) {
        console.log('⚠️  Modelo ainda configurado para usar: "financeirocolaboradors"');
        console.log('💡 Considere atualizar o modelo para usar "financeiro-colaboradores"');
      } else {
        console.log('🔍 Configuração de coleção não encontrada no modelo (usando padrão)');
      }
    } catch (error) {
      console.log('❌ Erro ao ler arquivo do modelo:', error.message);
    }
    
    // 4. Resumo final
    console.log('\n=== RESUMO FINAL ===');
    const finalCollections = await db.listCollections().toArray();
    const finalNames = finalCollections.map(c => c.name);
    
    const finalOldExists = finalNames.includes(oldCollectionName);
    const finalNewExists = finalNames.includes(newCollectionName);
    
    console.log(`📋 Status final:`);
    console.log(`   - "${oldCollectionName}": ${finalOldExists ? '✅ EXISTE' : '❌ NÃO EXISTE'}`);
    console.log(`   - "${newCollectionName}": ${finalNewExists ? '✅ EXISTE' : '❌ NÃO EXISTE'}`);
    
    if (finalNewExists) {
      const finalCount = await db.collection(newCollectionName).countDocuments();
      console.log(`📊 Documentos na coleção final: ${finalCount}`);
    }
    
    // Recomendações
    console.log('\n=== RECOMENDAÇÕES ===');
    if (finalNewExists && !finalOldExists) {
      console.log('✅ Migração bem-sucedida!');
      console.log('💡 O modelo Mongoose já está configurado para usar a coleção correta.');
      console.log('💡 Testes podem ser executados para validar a funcionalidade.');
    } else if (finalOldExists && !finalNewExists) {
      console.log('⚠️  Migração necessária!');
      console.log('💡 Execute este script novamente para fazer a migração.');
    } else if (finalOldExists && finalNewExists) {
      console.log('⚠️  Verificação manual necessária!');
      console.log('💡 Ambas as coleções existem - determine qual deve ser usada.');
    }
    
  } catch (error) {
    console.error('❌ Erro durante a verificação/migração:', error);
  } finally {
    await client.close();
    console.log('\n✅ Conexão fechada');
  }
}

// Execute apenas se for chamado diretamente
if (require.main === module) {
  migrateColaboradorCollection();
}

module.exports = migrateColaboradorCollection;