const { MongoClient } = require('mongodb');

async function checkCollectionStructure() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/condominio-sistema');
  
  try {
    await client.connect();
    console.log('✅ Conectado ao MongoDB');
    
    const db = client.db();
    
    // 1. Verificar a coleção atual financeirocolaboradors
    console.log('\n=== ESTRUTURA DA COLEÇÃO: financeirocolaboradors ===');
    const currentCollection = 'financeirocolaboradors';
    const count = await db.collection(currentCollection).countDocuments();
    console.log(`📊 Total de documentos: ${count}`);
    
    if (count > 0) {
      // Pegar um documento de exemplo
      const sample = await db.collection(currentCollection).findOne();
      console.log('📄 Estrutura do documento:');
      console.log(JSON.stringify(sample, null, 2));
      
      // Verificar todos os campos únicos na coleção
      const allDocs = await db.collection(currentCollection).find({}).toArray();
      const allFields = new Set();
      
      allDocs.forEach(doc => {
        Object.keys(doc).forEach(key => allFields.add(key));
      });
      
      console.log('\n📋 Todos os campos encontrados na coleção:');
      [...allFields].sort().forEach(field => {
        console.log(`   - ${field}`);
      });
    } else {
      console.log('❌ Coleção vazia - nenhum documento encontrado');
    }
    
    // 2. Verificar qual coleção o modelo atual está usando
    console.log('\n=== VERIFICAÇÃO DO MODELO vs COLEÇÃO ===');
    console.log('🔍 Modelo FinanceiroColaborador está configurado para usar: "financeiro-colaboradores"');
    console.log('🔍 Coleção atual encontrada no DB: "financeirocolaboradors" (sem hífen, sem "es" final)');
    console.log('⚠️  DIVERGÊNCIA IDENTIFICADA!');
    
    // 3. Verificar se existe a coleção com o nome correto do modelo
    const targetCollection = 'financeiro-colaboradores';
    const collections = await db.listCollections().toArray();
    const targetExists = collections.some(c => c.name === targetCollection);
    
    if (targetExists) {
      const targetCount = await db.collection(targetCollection).countDocuments();
      console.log(`✅ Coleção "${targetCollection}" existe com ${targetCount} documentos`);
    } else {
      console.log(`❌ Coleção "${targetCollection}" NÃO existe`);
    }
    
    // 4. Verificar indexação na coleção atual
    console.log('\n=== ÍNDICES NA COLEÇÃO ATUAL ===');
    try {
      const indexes = await db.collection(currentCollection).listIndexes().toArray();
      console.log(`📊 Total de índices: ${indexes.length}`);
      
      indexes.forEach((index, i) => {
        console.log(`${i + 1}. ${index.name}:`);
        console.log(`   Campos: ${JSON.stringify(index.key)}`);
        if (index.unique) console.log('   🔒 Único');
        if (index.sparse) console.log('   🕳️  Esparso');
      });
    } catch (error) {
      console.log(`❌ Erro ao listar índices: ${error.message}`);
    }
    
    // 5. Verificar dados de teste/exemplo
    console.log('\n=== ANÁLISE DE DADOS PARA MIGRAÇÃO ===');
    
    // Verificar se há colaboradores cadastrados
    const colaboradoresCount = await db.collection('colaboradores').countDocuments({ ativo: true });
    console.log(`👥 Colaboradores ativos: ${colaboradoresCount}`);
    
    if (colaboradoresCount > 0) {
      const colaboradorSample = await db.collection('colaboradores').findOne({ ativo: true });
      console.log('📄 Estrutura do colaborador (amostra):');
      console.log(`   Nome: ${colaboradorSample.nome}`);
      console.log(`   Cargo: ${colaboradorSample.cargo || 'N/A'}`);
      console.log(`   CPF: ${colaboradorSample.cpf || 'N/A'}`);
      console.log(`   Condomínio ID: ${colaboradorSample.condominio_id}`);
      console.log(`   Master ID: ${colaboradorSample.master_id}`);
    }
    
    // Verificar se há dados relacionados em outras coleções
    const condominioFinanceiro = await db.collection('financeiro-condominios').countDocuments({
      origem_sistema: 'colaborador'
    });
    console.log(`🏢 Lançamentos financeiros de colaboradores em financeiro-condominios: ${condominioFinanceiro}`);
    
  } catch (error) {
    console.error('❌ Erro ao verificar estrutura:', error);
  } finally {
    await client.close();
    console.log('\n✅ Conexão fechada');
  }
}

// Execute apenas se for chamado diretamente
if (require.main === module) {
  checkCollectionStructure();
}

module.exports = checkCollectionStructure;