const { MongoClient } = require('mongodb');

async function checkCollections() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/condominio-sistema');
  
  try {
    await client.connect();
    console.log('✅ Conectado ao MongoDB');
    
    const db = client.db();
    
    // 1. Listar todas as coleções
    console.log('\n=== TODAS AS COLEÇÕES ===');
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name).sort();
    
    console.log(`📋 Total de coleções: ${collectionNames.length}`);
    collectionNames.forEach((name, index) => {
      console.log(`${(index + 1).toString().padStart(2, '0')}. ${name}`);
    });
    
    // 2. Foco nas coleções relacionadas a "financeiro"
    console.log('\n=== COLEÇÕES RELACIONADAS A "FINANCEIRO" ===');
    const financeiroCollections = collectionNames.filter(name => 
      name.toLowerCase().includes('financeiro')
    );
    
    if (financeiroCollections.length === 0) {
      console.log('❌ Nenhuma coleção com "financeiro" encontrada');
    } else {
      console.log(`💰 Encontradas ${financeiroCollections.length} coleções relacionadas a financeiro:`);
      financeiroCollections.forEach(name => {
        console.log(`   - ${name}`);
      });
    }
    
    // 3. Verificar especificamente "financeirocolaboradors" e variantes
    console.log('\n=== VERIFICAÇÃO ESPECÍFICA - COLABORADORES ===');
    const colaboradorVariants = [
      'financeirocolaboradors',
      'financeiro_colaboradors',
      'financeiro-colaboradors',
      'financeiro-colaboradores',
      'financeiroColaboradors',
      'FinanceiroColaboradors'
    ];
    
    for (const variant of colaboradorVariants) {
      const exists = collectionNames.includes(variant);
      const status = exists ? '✅ EXISTE' : '❌ NÃO EXISTE';
      console.log(`${status} - ${variant}`);
      
      if (exists) {
        try {
          const count = await db.collection(variant).countDocuments();
          console.log(`   📊 Total de documentos: ${count}`);
          
          // Mostrar alguns documentos de exemplo
          if (count > 0) {
            const sample = await db.collection(variant).findOne();
            console.log(`   📄 Estrutura do documento (amostra):`);
            console.log(`   ${JSON.stringify(sample, null, 4)}`);
          }
        } catch (error) {
          console.log(`   ❌ Erro ao acessar coleção: ${error.message}`);
        }
      }
    }
    
    // 4. Verificar outras coleções financeiras para contexto
    console.log('\n=== OUTRAS COLEÇÕES FINANCEIRAS - DADOS RESUMIDOS ===');
    const otherFinanceiroCollections = financeiroCollections.filter(name => 
      !colaboradorVariants.includes(name)
    );
    
    for (const collectionName of otherFinanceiroCollections) {
      try {
        const count = await db.collection(collectionName).countDocuments();
        console.log(`📊 ${collectionName}: ${count} documentos`);
        
        if (count > 0) {
          // Verificar se há dados relacionados a colaboradores
          const colaboradorRelated = await db.collection(collectionName).countDocuments({
            $or: [
              { origem_sistema: 'colaborador' },
              { tipo: { $regex: /colaborador/i } },
              { colaborador_id: { $exists: true } },
              { colaborador_nome: { $exists: true } }
            ]
          });
          
          if (colaboradorRelated > 0) {
            console.log(`   👥 ${colaboradorRelated} documentos relacionados a colaboradores`);
          }
        }
      } catch (error) {
        console.log(`   ❌ Erro ao acessar ${collectionName}: ${error.message}`);
      }
    }
    
    // 5. Verificar coleção de colaboradores base
    console.log('\n=== COLEÇÃO DE COLABORADORES BASE ===');
    const colaboradorCollections = ['colaboradores', 'colaborador', 'Colaboradores', 'Colaborador'];
    
    for (const colName of colaboradorCollections) {
      if (collectionNames.includes(colName)) {
        const count = await db.collection(colName).countDocuments();
        console.log(`✅ ${colName}: ${count} documentos`);
        
        if (count > 0) {
          const sample = await db.collection(colName).findOne();
          console.log(`   📄 Campos disponíveis: ${Object.keys(sample).join(', ')}`);
        }
      } else {
        console.log(`❌ ${colName}: não existe`);
      }
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar coleções:', error);
  } finally {
    await client.close();
    console.log('\n✅ Conexão fechada');
  }
}

// Execute apenas se for chamado diretamente
if (require.main === module) {
  checkCollections();
}

module.exports = checkCollections;