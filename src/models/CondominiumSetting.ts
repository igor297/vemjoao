import mongoose, { Document, Schema } from 'mongoose';

export interface ICondominiumSetting extends Document {
  condominio_id: mongoose.Types.ObjectId;
  use_ticketing_system: boolean;
  master_id: mongoose.Types.ObjectId;
}

const CondominiumSettingSchema: Schema = new Schema({
  condominio_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Condominio',
    unique: true,
  },
  use_ticketing_system: {
    type: Boolean,
    default: false,
  },
  master_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Master',
  },
}, {
  timestamps: true,
  collection: 'condominium_settings',
});

export default mongoose.models.CondominiumSetting || mongoose.model<ICondominiumSetting>('CondominiumSetting', CondominiumSettingSchema);
