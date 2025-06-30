const connectDB = require('./src/lib/mongodb');
const FinanceiroColaborador = require('./src/models/FinanceiroColaborador');
const FinanceiroCondominio = require('./src/models/FinanceiroCondominio');
const mongoose = require('mongoose');

async function checkCounts() {
  try {
    await connectDB();

    const masterId = new mongoose.Types.ObjectId('684eec5c4af0e8961a18b1ff');
    const condominioId = new mongoose.Types.ObjectId('684f0e3e5eb749bbecf97091');

    const countColaborador = await FinanceiroColaborador.countDocuments({
      master_id: masterId,
      condominio_id: condominioId,
      ativo: true
    });
    console.log(`Lançamentos em FinanceiroColaborador: ${countColaborador}`);

    const countCondominio = await FinanceiroCondominio.countDocuments({
      master_id: masterId,
      condominio_id: condominioId,
      origem_sistema: 'colaborador',
      ativo: true
    });
    console.log(`Lançamentos em FinanceiroCondominio (origem colaborador): ${countCondominio}`);

  } catch (error) {
    console.error('Error checking counts:', error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
  }
}

checkCounts();