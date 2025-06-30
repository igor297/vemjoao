var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const connectDB = require('./src/lib/mongodb');
const FinanceiroColaborador = require('./src/models/FinanceiroColaborador');
const FinanceiroCondominio = require('./src/models/FinanceiroCondominio');
const mongoose = require('mongoose');
function checkCounts() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield connectDB();
            const masterId = new mongoose.Types.ObjectId('684eec5c4af0e8961a18b1ff');
            const condominioId = new mongoose.Types.ObjectId('684f0e3e5eb749bbecf97091');
            const countColaborador = yield FinanceiroColaborador.countDocuments({
                master_id: masterId,
                condominio_id: condominioId,
                ativo: true
            });
            console.log(`Lançamentos em FinanceiroColaborador: ${countColaborador}`);
            const countCondominio = yield FinanceiroCondominio.countDocuments({
                master_id: masterId,
                condominio_id: condominioId,
                origem_sistema: 'colaborador',
                ativo: true
            });
            console.log(`Lançamentos em FinanceiroCondominio (origem colaborador): ${countCondominio}`);
        }
        catch (error) {
            console.error('Error checking counts:', error);
        }
        finally {
            if (mongoose.connection.readyState === 1) {
                yield mongoose.connection.close();
            }
        }
    });
}
checkCounts();
