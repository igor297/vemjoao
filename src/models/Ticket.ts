import mongoose, { Document, Schema } from 'mongoose'

export interface ITicket extends Document {
  // Using MongoDB's default _id as primary identifier
  // id_ticket kept for backward compatibility
  id_ticket?: string
  titulo: string
  descricao: string
  categoria: 'financeiro' | 'manutencao' | 'administrativo' | 'outros'
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente'
  status: 'aberto' | 'em_andamento' | 'aguardando_resposta' | 'resolvido' | 'fechado'
  
  // Dados do solicitante
  solicitante_tipo: 'colaborador' | 'morador' | 'inquilino' | 'conjuge' | 'dependente'
  solicitante_id: mongoose.Types.ObjectId // Reference to user._id
  solicitante_nome: string
  solicitante_cpf?: string
  solicitante_apartamento?: string
  solicitante_bloco?: string
  
  // Dados de controle
  condominio_id: mongoose.Types.ObjectId // Reference to Condominio._id
  master_id: mongoose.Types.ObjectId // Reference to Master._id
  data_abertura: Date
  data_fechamento?: Date
  data_atualizacao: Date
  
  // Atendimento
  atendido_por_tipo?: 'master' | 'sindico' | 'subsindico'
  atendido_por_id?: mongoose.Types.ObjectId // Reference to user._id
  atendido_por_nome?: string
  
  // Histórico de mensagens
  mensagens: {
    id: string
    remetente_tipo: string
    remetente_id: mongoose.Types.ObjectId
    remetente_nome: string
    mensagem: string
    data: Date
    anexo?: string
  }[]
  
  ativo: boolean
}

const TicketSchema: Schema = new Schema({
  // Keep id_ticket for backward compatibility but make it optional
  id_ticket: {
    type: String,
    required: false,
    unique: true,
    sparse: true, // Allows multiple null values
    default: () => new mongoose.Types.ObjectId().toString()
  },
  titulo: {
    type: String,
    required: true,
    trim: true,
    minlength: [5, 'Título deve ter pelo menos 5 caracteres'],
    maxlength: [100, 'Título deve ter no máximo 100 caracteres']
  },
  descricao: {
    type: String,
    required: true,
    trim: true,
    minlength: [10, 'Descrição deve ter pelo menos 10 caracteres'],
    maxlength: [1000, 'Descrição deve ter no máximo 1000 caracteres']
  },
  categoria: {
    type: String,
    required: true,
    enum: ['financeiro', 'manutencao', 'administrativo', 'outros'],
    lowercase: true
  },
  prioridade: {
    type: String,
    required: true,
    enum: ['baixa', 'media', 'alta', 'urgente'],
    default: 'media',
    lowercase: true
  },
  status: {
    type: String,
    required: true,
    enum: ['aberto', 'em_andamento', 'aguardando_resposta', 'resolvido', 'fechado'],
    default: 'aberto',
    lowercase: true
  },
  solicitante_tipo: {
    type: String,
    required: true,
    enum: ['colaborador', 'morador', 'inquilino', 'conjuge', 'dependente'],
    lowercase: true
  },
  solicitante_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  solicitante_nome: {
    type: String,
    required: true,
    trim: true
  },
  solicitante_cpf: {
    type: String,
    required: false,
    trim: true
  },
  solicitante_apartamento: {
    type: String,
    required: false,
    trim: true
  },
  solicitante_bloco: {
    type: String,
    required: false,
    trim: true
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
  data_abertura: {
    type: Date,
    default: Date.now
  },
  data_fechamento: {
    type: Date,
    required: false
  },
  data_atualizacao: {
    type: Date,
    default: Date.now
  },
  atendido_por_tipo: {
    type: String,
    required: false,
    enum: ['master', 'sindico', 'subsindico'],
    lowercase: true
  },
  atendido_por_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: false
  },
  atendido_por_nome: {
    type: String,
    required: false,
    trim: true
  },
  mensagens: [{
    id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString()
    },
    remetente_tipo: {
      type: String,
      required: true
    },
    remetente_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    remetente_nome: {
      type: String,
      required: true,
      trim: true
    },
    mensagem: {
      type: String,
      required: true,
      trim: true
    },
    data: {
      type: Date,
      default: Date.now
    },
    anexo: {
      type: String,
      required: false,
      trim: true
    }
  }],
  ativo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
})

// Índices para otimização
TicketSchema.index({ condominio_id: 1, status: 1, data_abertura: -1 })
TicketSchema.index({ solicitante_id: 1, solicitante_tipo: 1 })
TicketSchema.index({ categoria: 1, prioridade: 1 })

export default mongoose.models.Ticket || mongoose.model<ITicket>('Ticket', TicketSchema)

// Função para verificar permissões do sistema de tickets
export const verificarPermissaoTicket = (
  acao: 'criar' | 'responder' | 'fechar' | 'ver',
  tipoUsuario: string,
  isProprioTicket: boolean = false
) => {
  // Master, Admin, Síndico e Subsíndico podem ver, responder e fechar
  if (['master', 'adm', 'sindico', 'subsindico'].includes(tipoUsuario)) {
    if (acao === 'criar') return false; // Não podem criar
    return true; // Podem ver, responder e fechar
  }
  
  // Colaborador, Morador, Inquilino, Cônjuge e Dependente podem criar e ver seus próprios tickets
  if (['colaborador', 'morador', 'inquilino', 'conjuge', 'dependente'].includes(tipoUsuario)) {
    if (acao === 'criar') return true; // Podem criar
    if (acao === 'ver' && isProprioTicket) return true; // Podem ver seus próprios
    if (acao === 'responder') return false; // Não podem responder
    if (acao === 'fechar') return false; // Não podem fechar
  }
  
  // Outros não têm acesso
  return false;
}