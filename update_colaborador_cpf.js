// Script para atualizar registros existentes com o campo colaborador_cpf
// Execute este script uma vez para corrigir os dados existentes

const { MongoClient } = require('mongodb');

async function updateColaboradorCPF() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/vemjoao');
  
  try {
    await client.connect();
    console.log('Conectado ao MongoDB');
    
    const db = client.db();
    const financeiroColecao = db.collection('financeiro_colaboradors');
    const colaboradoresColecao = db.collection('colaboradores');
    
    // Buscar todos os lançamentos que não têm o campo colaborador_cpf
    const lancamentosSemCPF = await financeiroColecao.find({
      colaborador_cpf: { $exists: false }
    }).toArray();
    
    console.log(`Encontrados ${lancamentosSemCPF.length} lançamentos sem CPF`);
    
    let atualizados = 0;
    
    for (const lancamento of lancamentosSemCPF) {
      // Buscar o colaborador correspondente
      const colaborador = await colaboradoresColecao.findOne({
        _id: lancamento.colaborador_id
      });
      
      if (colaborador && colaborador.cpf) {
        // Atualizar o lançamento com o CPF
        await financeiroColecao.updateOne(
          { _id: lancamento._id },
          { 
            $set: { 
              colaborador_cpf: colaborador.cpf
            } 
          }
        );
        atualizados++;
        console.log(`Atualizado: ${lancamento.colaborador_nome} -> CPF: ${colaborador.cpf}`);
      }
    }
    
    console.log(`✅ Processo concluído! ${atualizados} registros atualizados com CPF`);
    
    // Também atualizar registros no financeiro-condominio
    console.log('\n=== Atualizando registros sincronizados ===');
    const condominioColecao = db.collection('financeiro-condominios');
    
    const lancamentosCondSemCPF = await condominioColecao.find({
      origem_sistema: 'colaborador',
      origem_identificacao: { $exists: false }
    }).toArray();
    
    console.log(`Encontrados ${lancamentosCondSemCPF.length} registros sincronizados sem CPF`);
    
    let atualizadosCond = 0;
    
    for (const lancamento of lancamentosCondSemCPF) {
      // Buscar o lançamento original
      const lancamentoOriginal = await financeiroColecao.findOne({
        _id: lancamento.origem_id
      });
      
      if (lancamentoOriginal && lancamentoOriginal.colaborador_cpf) {
        // Atualizar com o CPF
        await condominioColecao.updateOne(
          { _id: lancamento._id },
          { 
            $set: { 
              origem_identificacao: lancamentoOriginal.colaborador_cpf
            } 
          }
        );
        atualizadosCond++;
        console.log(`Sincronizado atualizado: ${lancamento.origem_nome} -> CPF: ${lancamentoOriginal.colaborador_cpf}`);
      }
    }
    
    console.log(`✅ Processo de sincronização concluído! ${atualizadosCond} registros sincronizados atualizados`);
    
  } catch (error) {
    console.error('Erro ao atualizar:', error);
  } finally {
    await client.close();
  }
}

// Execute apenas se for chamado diretamente
if (require.main === module) {
  updateColaboradorCPF();
}

module.exports = updateColaboradorCPF;