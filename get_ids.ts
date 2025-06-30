const connectDB = require('./src/lib/mongodb').default;
const Master = require('./src/models/Master').default;
const Condominio = require('./src/models/condominios').default;
const mongoose = require('mongoose');

async function getIds() {
  try {
    await connectDB();

    const master = await Master.findOne({ email: 'master@teste.com' });
    if (!master) {
      console.log('Master not found for email: master@teste.com');
      return;
    }
    console.log(`Master ID: ${master._id}`);

    const condominio = await Condominio.findOne({ nome: 'alvoro' });
    if (!condominio) {
      console.log('Condominio not found for name: alvoro');
      return;
    }
    console.log(`Condominio ID: ${condominio._id}`);

  } catch (error) {
    console.error('Error fetching IDs:', error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
  }
}

getIds();
