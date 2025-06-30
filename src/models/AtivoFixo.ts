import mongoose, { Document, Schema } from 'mongoose';
import { ObjectId } from 'mongodb';

export interface IAtivoFixo extends Document {
  condominio_id: ObjectId;
  nome: string;
  descricao?: string;
  data_aquisicao: Date;
  valor_aquisicao: number;
  vida_util_anos: number; // Vida útil em anos
  metodo_depreciacao: 'linear' | 'soma_digitos' | 'unidades_produzidas'; // Métodos comuns
  valor_residual: number; // Valor que se espera obter ao final da vida útil
  conta_ativo_id: ObjectId; // Conta do Ativo Imobilizado (Plano de Contas)
  conta_depreciacao_acumulada_id: ObjectId; // Conta de Depreciação Acumulada (Plano de Contas)
  conta_despesa_depreciacao_id: ObjectId; // Conta de Despesa de Depreciação (Plano de Contas)
  depreciacao_acumulada_total: number; // Valor total já depreciado
  data_ultima_depreciacao?: Date; // Data do último lançamento de depreciação
  ativo: boolean; // Se o ativo ainda está em uso/depreciando
  created_at: Date;
  updated_at: Date;
  created_by: ObjectId;
  updated_by?: ObjectId;
}

const AtivoFixoSchema = new Schema<IAtivoFixo>({
  condominio_id: { type: Schema.Types.ObjectId, ref: 'Condominio', required: true },
  nome: { type: String, required: true, maxlength: 100 },
  descricao: { type: String, maxlength: 500 },
  data_aquisicao: { type: Date, required: true },
  valor_aquisicao: { type: Number, required: true, min: 0 },
  vida_util_anos: { type: Number, required: true, min: 1 },
  metodo_depreciacao: {
    type: String,
    enum: ['linear', 'soma_digitos', 'unidades_produzidas'],
    default: 'linear'
  },
  valor_residual: { type: Number, default: 0, min: 0 },
  conta_ativo_id: { type: Schema.Types.ObjectId, ref: 'PlanoContas', required: true },
  conta_depreciacao_acumulada_id: { type: Schema.Types.ObjectId, ref: 'PlanoContas', required: true },
  conta_despesa_depreciacao_id: { type: Schema.Types.ObjectId, ref: 'PlanoContas', required: true },
  depreciacao_acumulada_total: { type: Number, default: 0, min: 0 },
  data_ultima_depreciacao: { type: Date },
  ativo: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  created_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updated_by: { type: Schema.Types.ObjectId, ref: 'User' }
});

AtivoFixoSchema.index({ condominio_id: 1, ativo: 1 });
AtivoFixoSchema.index({ conta_ativo_id: 1 });

AtivoFixoSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

export default mongoose.models.AtivoFixo || mongoose.model<IAtivoFixo>('AtivoFixo', AtivoFixoSchema);