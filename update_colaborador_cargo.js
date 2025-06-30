// Script para atualizar registros existentes com o campo colaborador_cargo
// Execute este script uma vez para corrigir os dados existentes

const { MongoClient } = require('mongodb');

async function updateColaboradorCargo() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/vemjoao');
  
  try {
    await client.connect();
    console.log('Conectado ao MongoDB');
    
    const db = client.db();
    const financeiroColecao = db.collection('financeiro_colaboradors');
    const colaboradoresColecao = db.collection('colaboradores');
    
    // Buscar todos os lançamentos que não têm o campo colaborador_cargo
    const lancamentosSemCargo = await financeiroColecao.find({
      colaborador_cargo: { $exists: false }
    }).toArray();
    
    console.log(`Encontrados ${lancamentosSemCargo.length} lançamentos sem cargo`);
    
    let atualizados = 0;
    
    for (const lancamento of lancamentosSemCargo) {
      // Buscar o colaborador correspondente
      const colaborador = await colaboradoresColecao.findOne({
        _id: lancamento.colaborador_id
      });
      
      if (colaborador && colaborador.cargo) {
        // Atualizar o lançamento com o cargo
        await financeiroColecao.updateOne(
          { _id: lancamento._id },
          { 
            $set: { 
              colaborador_cargo: colaborador.cargo,
              colaborador_departamento: colaborador.departamento || null
            } 
          }
        );
        atualizados++;
        console.log(`Atualizado: ${lancamento.colaborador_nome} -> ${colaborador.cargo}`);
      }
    }
    
    console.log(`✅ Processo concluído! ${atualizados} registros atualizados`);
    
  } catch (error) {
    console.error('Erro ao atualizar:', error);
  } finally {
    await client.close();
  }
}

// Execute apenas se for chamado diretamente
if (require.main === module) {
  updateColaboradorCargo();
}

module.exports = updateColaboradorCargo;