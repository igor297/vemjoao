// Script para testar e verificar dados do colaborador
const { MongoClient } = require('mongodb');

async function testarDadosColaborador() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/vemjoao');
  
  try {
    await client.connect();
    console.log('Conectado ao MongoDB');
    
    const db = client.db();
    
    // 1. Verificar colaboradores e seus cargos
    console.log('\n=== COLABORADORES E CARGOS ===');
    const colaboradores = await db.collection('colaboradores').find({
      ativo: true
    }).limit(5).toArray();
    
    colaboradores.forEach(col => {
      console.log(`👤 ${col.nome} - Cargo: ${col.cargo || 'N/A'} - Depto: ${col.departamento || 'N/A'}`);
    });
    
    // 2. Verificar lançamentos de colaboradores
    console.log('\n=== LANÇAMENTOS FINANCEIRO-COLABORADOR ===');
    const lancamentosColab = await db.collection('financeiro_colaboradors').find({
      ativo: true
    }).limit(5).toArray();
    
    lancamentosColab.forEach(lanc => {
      console.log(`💼 ${lanc.colaborador_nome} - Cargo: ${lanc.colaborador_cargo || 'N/A'} - Desc: ${lanc.descricao}`);
    });
    
    // 3. Verificar sincronização no financeiro-condominio
    console.log('\n=== LANÇAMENTOS FINANCEIRO-CONDOMINIO (COLABORADORES) ===');
    const lancamentosCond = await db.collection('financeiro-condominios').find({
      origem_sistema: 'colaborador',
      ativo: true
    }).limit(5).toArray();
    
    lancamentosCond.forEach(lanc => {
      console.log(`🏢 ${lanc.origem_nome} - Cargo: ${lanc.cargo || 'N/A'} - Depto: ${lanc.departamento || 'N/A'} - Desc: ${lanc.descricao}`);
    });
    
    // 4. Estatísticas
    console.log('\n=== ESTATÍSTICAS ===');
    const totalColaboradores = await db.collection('colaboradores').countDocuments({ ativo: true });
    const colaboradoresComCargo = await db.collection('colaboradores').countDocuments({ ativo: true, cargo: { $exists: true, $ne: '' } });
    const lancamentosComCargo = await db.collection('financeiro_colaboradors').countDocuments({ ativo: true, colaborador_cargo: { $exists: true, $ne: '' } });
    const sincronizadosComCargo = await db.collection('financeiro-condominios').countDocuments({ origem_sistema: 'colaborador', ativo: true, cargo: { $exists: true, $ne: '' } });
    
    console.log(`📊 Total colaboradores: ${totalColaboradores}`);
    console.log(`📊 Colaboradores com cargo: ${colaboradoresComCargo}`);
    console.log(`📊 Lançamentos com cargo: ${lancamentosComCargo}`);
    console.log(`📊 Sincronizados com cargo: ${sincronizadosComCargo}`);
    
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await client.close();
  }
}

// Execute apenas se for chamado diretamente
if (require.main === module) {
  testarDadosColaborador();
}

module.exports = testarDadosColaborador;