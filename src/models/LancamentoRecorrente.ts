import mongoose, { Document, Schema } from 'mongoose';
import { ObjectId } from 'mongodb';

export interface ILancamentoRecorrente extends Document {
  condominio_id: ObjectId;
  nome: string;
  descricao?: string;
  tipo_recorrencia: 'mensal' | 'trimestral' | 'anual' | 'personalizado';
  frequencia_personalizada_dias?: number; // Para tipo_recorrencia 'personalizado'
  data_inicio_recorrencia: Date;
  data_fim_recorrencia?: Date; // Opcional, para recorrências com fim definido
  valor: number;
  conta_debito_id: ObjectId; // Conta a ser debitada
  conta_credito_id: ObjectId; // Conta a ser creditada
  historico_lancamento: string;
  ultimo_lancamento_gerado?: Date; // Data do último lançamento contábil gerado
  status: 'ativo' | 'inativo' | 'concluido';
  origem_lancamento: 'apropriacao' | 'diferimento' | 'outros_recorrentes';
  created_at: Date;
  updated_at: Date;
  created_by: ObjectId;
  updated_by?: ObjectId;
}

const LancamentoRecorrenteSchema = new Schema<ILancamentoRecorrente>({
  condominio_id: { type: Schema.Types.ObjectId, ref: 'Condominio', required: true },
  nome: { type: String, required: true, maxlength: 100 },
  descricao: { type: String, maxlength: 500 },
  tipo_recorrencia: {
    type: String,
    enum: ['mensal', 'trimestral', 'anual', 'personalizado'],
    required: true
  },
  frequencia_personalizada_dias: { type: Number, min: 1 },
  data_inicio_recorrencia: { type: Date, required: true },
  data_fim_recorrencia: { type: Date },
  valor: { type: Number, required: true, min: 0.01 },
  conta_debito_id: { type: Schema.Types.ObjectId, ref: 'PlanoContas', required: true },
  conta_credito_id: { type: Schema.Types.ObjectId, ref: 'PlanoContas', required: true },
  historico_lancamento: { type: String, required: true, maxlength: 200 },
  ultimo_lancamento_gerado: { type: Date },
  status: {
    type: String,
    enum: ['ativo', 'inativo', 'concluido'],
    default: 'ativo'
  },
  origem_lancamento: {
    type: String,
    enum: ['apropriacao', 'diferimento', 'outros_recorrentes'],
    required: true
  },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  created_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updated_by: { type: Schema.Types.ObjectId, ref: 'User' }
});

LancamentoRecorrenteSchema.index({ condominio_id: 1, status: 1 });
LancamentoRecorrenteSchema.index({ data_inicio_recorrencia: 1, data_fim_recorrencia: 1 });

LancamentoRecorrenteSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

export default mongoose.models.LancamentoRecorrente || mongoose.model<ILancamentoRecorrente>('LancamentoRecorrente', LancamentoRecorrenteSchema);