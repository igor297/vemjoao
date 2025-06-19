import mongoose, { Document, Schema } from 'mongoose'

export interface IEvento extends Document {
  // Using MongoDB's default _id as primary identifier
  nome: string
  descricao: string
  tipo: 'retirada_entrega' | 'visita' | 'reserva' | 'reuniao' | 'avisos' | 'outros'
  data_inicio: Date
  hora_inicio: string
  data_fim: Date
  hora_fim: string
  condominio_evento?: string
  observacoes?: string
  
  // Campos para identificar quem criou (sem dados pessoais)
  criado_por_tipo: 'master' | 'adm' | 'colaborador' | 'morador' | 'inquilino' | 'conjuge' | 'dependente'
  criado_por_id: mongoose.Types.ObjectId // Reference to user._id
  criado_por_nome: string // Nome público para identificação
  
  // Dados de controle
  condominio_id: mongoose.Types.ObjectId // Reference to Condominio._id
  master_id: mongoose.Types.ObjectId // Reference to Master._id
  data_criacao: Date
  ativo: boolean
}

const EventoSchema: Schema = new Schema({
  nome: {
    type: String,
    required: true,
    trim: true,
    minlength: [3, 'Nome deve ter pelo menos 3 caracteres'],
    maxlength: [100, 'Nome deve ter no máximo 100 caracteres']
  },
  descricao: {
    type: String,
    required: true,
    trim: true,
    minlength: [5, 'Descrição deve ter pelo menos 5 caracteres'],
    maxlength: [500, 'Descrição deve ter no máximo 500 caracteres']
  },
  tipo: {
    type: String,
    required: true,
    enum: ['retirada_entrega', 'visita', 'reserva', 'reuniao', 'avisos', 'outros'],
    lowercase: true
  },
  data_inicio: {
    type: Date,
    required: true
  },
  hora_inicio: {
    type: String,
    required: true,
    validate: {
      validator: function(v: string) {
        return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v)
      },
      message: 'Hora deve estar no formato HH:MM'
    }
  },
  data_fim: {
    type: Date,
    required: true
  },
  hora_fim: {
    type: String,
    required: true,
    validate: {
      validator: function(v: string) {
        return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v)
      },
      message: 'Hora deve estar no formato HH:MM'
    }
  },
  condominio_evento: {
    type: String,
    required: false,
    trim: true,
    maxlength: [200, 'Condomínio evento deve ter no máximo 200 caracteres']
  },
  observacoes: {
    type: String,
    required: false,
    trim: true,
    maxlength: [1000, 'Observações devem ter no máximo 1000 caracteres']
  },
  criado_por_tipo: {
    type: String,
    required: true,
    enum: ['master', 'adm', 'colaborador', 'morador', 'inquilino', 'conjuge', 'dependente'],
    lowercase: true
  },
  criado_por_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  criado_por_nome: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Nome do criador deve ter no máximo 100 caracteres']
  },
  condominio_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Condominio'
  },
  master_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Master'
  },
  data_criacao: {
    type: Date,
    default: Date.now
  },
  ativo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
})

// Índices para otimização
EventoSchema.index({ condominio_id: 1, data_inicio: 1, ativo: 1 })
EventoSchema.index({ tipo: 1, data_inicio: 1 })
EventoSchema.index({ criado_por_id: 1, criado_por_tipo: 1 })

export default mongoose.models.Evento || mongoose.model<IEvento>('Evento', EventoSchema)

// Função para verificar permissões baseada no tipo de evento e usuário
export const verificarPermissaoEvento = (
  tipoEvento: string,
  tipoUsuario: string,
  acao: 'criar' | 'editar' | 'excluir' | 'ver',
  isProprioEvento: boolean = false
) => {
  // Master e Síndico podem tudo
  if (tipoUsuario === 'master' || tipoUsuario === 'sindico') {
    return true
  }

  switch (tipoEvento) {
    case 'retirada_entrega':
      if (acao === 'ver') return true
      if (['subsindico', 'morador', 'inquilino', 'conjuge', 'dependente'].includes(tipoUsuario)) {
        return acao !== 'excluir' || isProprioEvento
      }
      if (tipoUsuario === 'colaborador') {
        return acao === 'editar' // Pode apenas editar obs
      }
      if (tipoUsuario === 'conselheiro') {
        return acao === 'ver'
      }
      return false

    case 'visita':
      if (['sindico', 'subsindico', 'morador', 'inquilino', 'conjuge', 'dependente'].includes(tipoUsuario)) {
        return acao !== 'excluir' || isProprioEvento
      }
      if (['conselheiro', 'colaborador'].includes(tipoUsuario)) {
        return acao === 'ver'
      }
      return false

    case 'reserva':
      if (['sindico', 'subsindico', 'morador', 'inquilino', 'conjuge', 'dependente'].includes(tipoUsuario)) {
        return acao !== 'excluir' || isProprioEvento
      }
      if (['conselheiro', 'colaborador'].includes(tipoUsuario)) {
        return acao === 'ver'
      }
      return false

    case 'reuniao':
    case 'avisos':
      if (['sindico', 'subsindico', 'conselheiro'].includes(tipoUsuario)) {
        return acao !== 'excluir' || isProprioEvento
      }
      return acao === 'ver'

    case 'outros':
      if (['sindico', 'subsindico', 'conselheiro', 'colaborador'].includes(tipoUsuario)) {
        if (acao === 'editar') {
          return true // Podem editar apenas obs
        }
        return acao !== 'excluir' || isProprioEvento
      }
      return acao === 'ver'

    default:
      return false
  }
}