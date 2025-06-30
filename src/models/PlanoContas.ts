import mongoose, { Document, Schema } from 'mongoose';
import { ObjectId } from 'mongodb';

export interface IPlanoContas extends Document {
  // Identificação
  codigo: string;
  nome: string;
  descricao?: string;
  
  // Hierarquia
  conta_pai_id?: ObjectId;
  nivel: number;
  caminho_completo: string;
  codigo_completo: string;
  
  // Classificação contábil
  tipo_conta: 'ativo' | 'passivo' | 'patrimonio_liquido' | 'receita' | 'despesa';
  subtipo: string;
  natureza: 'debito' | 'credito';
  
  // Características
  aceita_lancamento: boolean;
  conta_sintetica: boolean;
  conta_analitica: boolean;
  
  // Configurações
  centro_custo_obrigatorio: boolean;
  historico_padrao?: string;
  
  // Integração fiscal
  codigo_ecd?: string; // SPED ECD
  codigo_ecf?: string; // SPED ECF
  codigo_csll?: string;
  codigo_irpj?: string;
  
  // DRE
  grupo_dre?: 'receita_bruta' | 'deducoes_receita' | 'receita_liquida' | 
              'custo_produtos_vendidos' | 'lucro_bruto' | 'despesas_operacionais' |
              'resultado_operacional' | 'resultado_nao_operacional' | 
              'resultado_antes_ir_csll' | 'provisao_ir_csll' | 'lucro_liquido';
  ordem_dre?: number;
  
  // Fluxo de Caixa
  grupo_fluxo_caixa?: 'atividades_operacionais' | 'atividades_investimento' | 'atividades_financiamento';
  metodo_fluxo?: 'direto' | 'indireto';
  
  // Balancete
  grupo_balancete?: string;
  ordem_balancete?: number;
  
  // Status
  ativo: boolean;
  data_inativacao?: Date;
  motivo_inativacao?: string;
  
  // Auditoria
  condominio_id?: ObjectId; // null = conta padrão do sistema
  created_by: ObjectId;
  updated_by?: ObjectId;
  
  // Timestamps
  created_at: Date;
  updated_at: Date;
}

const PlanoContasSchema = new Schema<IPlanoContas>({
  // Identificação
  codigo: { 
    type: String, 
    required: true,
    validate: {
      validator: function(v: string) {
        return /^[0-9]{1,10}$/.test(v);
      },
      message: 'Código deve conter apenas números'
    }
  },
  nome: { type: String, required: true, maxlength: 100 },
  descricao: { type: String, maxlength: 500 },
  
  // Hierarquia
  conta_pai_id: { type: Schema.Types.ObjectId, ref: 'PlanoContas' },
  nivel: { type: Number, required: true, min: 1, max: 10 },
  caminho_completo: { type: String, required: true },
  codigo_completo: { type: String, required: true },
  
  // Classificação contábil
  tipo_conta: { 
    type: String, 
    enum: ['ativo', 'passivo', 'patrimonio_liquido', 'receita', 'despesa'],
    required: true 
  },
  subtipo: { type: String, required: true },
  natureza: { 
    type: String, 
    enum: ['debito', 'credito'],
    required: true 
  },
  
  // Características
  aceita_lancamento: { type: Boolean, default: true },
  conta_sintetica: { type: Boolean, default: false },
  conta_analitica: { type: Boolean, default: true },
  
  // Configurações
  centro_custo_obrigatorio: { type: Boolean, default: false },
  historico_padrao: String,
  
  // Integração fiscal
  codigo_ecd: String,
  codigo_ecf: String,
  codigo_csll: String,
  codigo_irpj: String,
  
  // DRE
  grupo_dre: { 
    type: String,
    enum: [
      'receita_bruta', 'deducoes_receita', 'receita_liquida',
      'custo_produtos_vendidos', 'lucro_bruto', 'despesas_operacionais',
      'resultado_operacional', 'resultado_nao_operacional',
      'resultado_antes_ir_csll', 'provisao_ir_csll', 'lucro_liquido'
    ]
  },
  ordem_dre: Number,
  
  // Fluxo de Caixa
  grupo_fluxo_caixa: { 
    type: String,
    enum: ['atividades_operacionais', 'atividades_investimento', 'atividades_financiamento']
  },
  metodo_fluxo: { 
    type: String,
    enum: ['direto', 'indireto']
  },
  
  // Balancete
  grupo_balancete: String,
  ordem_balancete: Number,
  
  // Status
  ativo: { type: Boolean, default: true },
  data_inativacao: Date,
  motivo_inativacao: String,
  
  // Auditoria
  condominio_id: { type: Schema.Types.ObjectId, ref: 'Condominio' },
  created_by: { type: Schema.Types.ObjectId, required: true },
  updated_by: { type: Schema.Types.ObjectId },
  
  // Timestamps
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

// Índices compostos
PlanoContasSchema.index({ condominio_id: 1, codigo: 1 }, { unique: true });
PlanoContasSchema.index({ condominio_id: 1, codigo_completo: 1 });
PlanoContasSchema.index({ tipo_conta: 1, ativo: 1 });
PlanoContasSchema.index({ grupo_dre: 1, ordem_dre: 1 });
PlanoContasSchema.index({ conta_pai_id: 1 });

// Middleware para atualizar campos calculados
PlanoContasSchema.pre('save', async function(next) {
  this.updated_at = new Date();
  
  // Calcular caminho completo e código completo
  if (this.conta_pai_id) {
    const contaPai = await mongoose.model('PlanoContas').findById(this.conta_pai_id);
    if (contaPai) {
      this.caminho_completo = `${contaPai.caminho_completo} > ${this.nome}`;
      this.codigo_completo = `${contaPai.codigo_completo}.${this.codigo}`;
      this.nivel = contaPai.nivel + 1;
    }
  } else {
    this.caminho_completo = this.nome;
    this.codigo_completo = this.codigo;
    this.nivel = 1;
  }
  
  // Definir natureza automaticamente baseada no tipo
  if (!this.natureza) {
    if (['ativo', 'despesa'].includes(this.tipo_conta)) {
      this.natureza = 'debito';
    } else {
      this.natureza = 'credito';
    }
  }
  
  next();
});

// Método para buscar contas filhas
PlanoContasSchema.methods.getContasFilhas = function() {
  return mongoose.model('PlanoContas').find({ conta_pai_id: this._id, ativo: true });
};

// Método para verificar se tem filhas
PlanoContasSchema.methods.temContasFilhas = async function() {
  const count = await mongoose.model('PlanoContas').countDocuments({ 
    conta_pai_id: this._id, 
    ativo: true 
  });
  return count > 0;
};

// Método para buscar saldo da conta
PlanoContasSchema.methods.getSaldo = async function(dataInicio: Date, dataFim: Date) {
  const LancamentoContabil = mongoose.model('LancamentoContabil');
  
  const pipeline = [
    {
      $match: {
        conta_id: this._id,
        data_lancamento: { $gte: dataInicio, $lte: dataFim },
        status: 'confirmado'
      }
    },
    {
      $group: {
        _id: null,
        total_debito: { $sum: '$valor_debito' },
        total_credito: { $sum: '$valor_credito' }
      }
    }
  ];
  
  const resultado = await LancamentoContabil.aggregate(pipeline);
  
  if (resultado.length === 0) {
    return { saldo: 0, debito: 0, credito: 0 };
  }
  
  const { total_debito, total_credito } = resultado[0];
  const saldo = this.natureza === 'debito' 
    ? total_debito - total_credito 
    : total_credito - total_debito;
  
  return {
    saldo,
    debito: total_debito,
    credito: total_credito
  };
};

// Método estático para criar plano de contas padrão
PlanoContasSchema.statics.criarPlanoContasPadrao = async function(condominioId: ObjectId, userId: ObjectId) {
  const contasPadrao = [
    // ATIVO
    { codigo: '1', nome: 'ATIVO', tipo_conta: 'ativo', subtipo: 'ativo_total' },
    { codigo: '11', nome: 'ATIVO CIRCULANTE', tipo_conta: 'ativo', subtipo: 'ativo_circulante', pai: '1' },
    { codigo: '111', nome: 'DISPONÍVEL', tipo_conta: 'ativo', subtipo: 'disponivel', pai: '11' },
    { codigo: '1111', nome: 'Caixa', tipo_conta: 'ativo', subtipo: 'caixa', pai: '111', aceita_lancamento: true },
    { codigo: '1112', nome: 'Bancos Conta Movimento', tipo_conta: 'ativo', subtipo: 'banco', pai: '111', aceita_lancamento: true },
    { codigo: '112', nome: 'DIREITOS REALIZÁVEIS', tipo_conta: 'ativo', subtipo: 'direitos', pai: '11' },
    { codigo: '1121', nome: 'Contas a Receber', tipo_conta: 'ativo', subtipo: 'contas_receber', pai: '112', aceita_lancamento: true },
    
    // PASSIVO
    { codigo: '2', nome: 'PASSIVO', tipo_conta: 'passivo', subtipo: 'passivo_total' },
    { codigo: '21', nome: 'PASSIVO CIRCULANTE', tipo_conta: 'passivo', subtipo: 'passivo_circulante', pai: '2' },
    { codigo: '211', nome: 'OBRIGAÇÕES', tipo_conta: 'passivo', subtipo: 'obrigacoes', pai: '21' },
    { codigo: '2111', nome: 'Fornecedores', tipo_conta: 'passivo', subtipo: 'fornecedores', pai: '211', aceita_lancamento: true },
    { codigo: '2112', nome: 'Contas a Pagar', tipo_conta: 'passivo', subtipo: 'contas_pagar', pai: '211', aceita_lancamento: true },
    
    // PATRIMÔNIO LÍQUIDO
    { codigo: '3', nome: 'PATRIMÔNIO LÍQUIDO', tipo_conta: 'patrimonio_liquido', subtipo: 'patrimonio_total' },
    { codigo: '31', nome: 'FUNDOS', tipo_conta: 'patrimonio_liquido', subtipo: 'fundos', pai: '3' },
    { codigo: '311', nome: 'Fundo de Reserva', tipo_conta: 'patrimonio_liquido', subtipo: 'fundo_reserva', pai: '31', aceita_lancamento: true },
    
    // RECEITAS
    { codigo: '4', nome: 'RECEITAS', tipo_conta: 'receita', subtipo: 'receita_total', grupo_dre: 'receita_bruta' },
    { codigo: '41', nome: 'RECEITAS OPERACIONAIS', tipo_conta: 'receita', subtipo: 'receita_operacional', pai: '4' },
    { codigo: '411', nome: 'Taxa Condominial', tipo_conta: 'receita', subtipo: 'taxa_condominial', pai: '41', aceita_lancamento: true },
    { codigo: '412', nome: 'Fundo de Reserva', tipo_conta: 'receita', subtipo: 'fundo_reserva_receita', pai: '41', aceita_lancamento: true },
    
    // DESPESAS
    { codigo: '5', nome: 'DESPESAS', tipo_conta: 'despesa', subtipo: 'despesa_total', grupo_dre: 'despesas_operacionais' },
    { codigo: '51', nome: 'DESPESAS OPERACIONAIS', tipo_conta: 'despesa', subtipo: 'despesa_operacional', pai: '5' },
    { codigo: '511', nome: 'Pessoal', tipo_conta: 'despesa', subtipo: 'pessoal', pai: '51' },
    { codigo: '5111', nome: 'Salários', tipo_conta: 'despesa', subtipo: 'salarios', pai: '511', aceita_lancamento: true },
    { codigo: '512', nome: 'Manutenção', tipo_conta: 'despesa', subtipo: 'manutencao', pai: '51' },
    { codigo: '5121', nome: 'Manutenção Predial', tipo_conta: 'despesa', subtipo: 'manutencao_predial', pai: '512', aceita_lancamento: true },
    { codigo: '513', nome: 'Utilidades', tipo_conta: 'despesa', subtipo: 'utilidades', pai: '51' },
    { codigo: '5131', nome: 'Energia Elétrica', tipo_conta: 'despesa', subtipo: 'energia', pai: '513', aceita_lancamento: true },
    { codigo: '5132', nome: 'Água e Esgoto', tipo_conta: 'despesa', subtipo: 'agua', pai: '513', aceita_lancamento: true }
  ];
  
  // Criar mapa de IDs das contas criadas
  const contaIds: { [key: string]: ObjectId } = {};
  
  // Criar contas na ordem hierárquica
  for (const conta of contasPadrao) {
    const novaConta: any = {
      codigo: conta.codigo,
      nome: conta.nome,
      tipo_conta: conta.tipo_conta,
      subtipo: conta.subtipo,
      condominio_id: condominioId,
      created_by: userId,
      aceita_lancamento: conta.aceita_lancamento || false,
      conta_sintetica: !conta.aceita_lancamento,
      conta_analitica: conta.aceita_lancamento || false
    };
    
    if (conta.pai) {
      novaConta.conta_pai_id = contaIds[conta.pai];
    }
    
    if (conta.grupo_dre) {
      novaConta.grupo_dre = conta.grupo_dre;
    }
    
    const contaCriada = await this.create(novaConta);
    contaIds[conta.codigo] = contaCriada._id;
  }
  
  return contaIds;
};

export default mongoose.models.PlanoContas || mongoose.model<IPlanoContas>('PlanoContas', PlanoContasSchema);