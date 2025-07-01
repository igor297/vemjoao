const { MongoClient } = require('mongodb');

async function renameCollection() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/vemjoao');

  try {
    await client.connect();
    console.log('Conectado ao MongoDB.');

    const db = client.db();
    const oldName = 'financeiro_colaboradors';
    const newName = 'financeiro_colaboradores';

    const collections = await db.listCollections().toArray();
    const collectionExists = collections.some(c => c.name === oldName);

    if (collectionExists) {
      await db.collection(oldName).rename(newName);
      console.log(`Coleção '${oldName}' renomeada para '${newName}' com sucesso.`);
    } else {
      console.log(`Coleção '${oldName}' não encontrada. Nenhuma ação necessária.`);
    }
  } catch (error) {
    console.error('Erro ao renomear coleção:', error);
  } finally {
    await client.close();
  }
}

renameCollection();