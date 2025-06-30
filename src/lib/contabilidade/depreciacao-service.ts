import AtivoFixo, { IAtivoFixo } from '@/models/AtivoFixo';
import LancamentoContabil from '@/models/LancamentoContabil';
import PlanoContas from '@/models/PlanoContas';
import dbConnect from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export class DepreciacaoService {

  /**
   * Calcula o valor da depreciação para um ativo fixo em um determinado período.
   * @param ativo O documento do ativo fixo.
   * @param dataReferencia A data para a qual a depreciação está sendo calculada (geralmente o final do mês).
   * @returns O valor da depreciação para o período.
   */
  static calcularDepreciacaoMensal(ativo: IAtivoFixo, dataReferencia: Date): number {
    const valorDepreciavel = ativo.valor_aquisicao - ativo.valor_residual;
    const vidaUtilMeses = ativo.vida_util_anos * 12;

    if (vidaUtilMeses <= 0) {
      return 0; // Não há depreciação se a vida útil for zero ou negativa
    }

    // Calcular depreciação mensal com base no método
    switch (ativo.metodo_depreciacao) {
      case 'linear':
        return valorDepreciavel / vidaUtilMeses;
      case 'soma_digitos':
        // Implementar lógica de soma dos dígitos (mais complexo, pode ser um TODO inicial)
        console.warn('Método de depreciação "soma_digitos" não totalmente implementado. Usando linear por enquanto.');
        return valorDepreciavel / vidaUtilMeses;
      case 'unidades_produzidas':
        // Requer um campo para unidades produzidas e total de unidades esperadas (fora do escopo inicial)
        console.warn('Método de depreciação "unidades_produzidas" não implementado. Usando linear por enquanto.');
        return valorDepreciavel / vidaUtilMeses;
      default:
        return 0;
    }
  }

  /**
   * Gera o lançamento contábil de depreciação para um ativo fixo.
   * @param ativo O documento do ativo fixo.
   * @param valorDepreciacao O valor da depreciação a ser lançado.
   * @param dataLancamento A data do lançamento contábil.
   * @param userId O ID do usuário que está executando o processo (ou ID do sistema).
   * @returns O lançamento contábil criado.
   */
  static async gerarLancamentoDepreciacao(
    ativo: IAtivoFixo,
    valorDepreciacao: number,
    dataLancamento: Date,
    userId: ObjectId
  ): Promise<any> { // Retorna o documento do lançamento contábil
    await dbConnect();

    if (valorDepreciacao <= 0) {
      console.log(`Depreciação para ${ativo.nome} é zero ou negativa. Nenhum lançamento será gerado.`);
      return null;
    }

    // Buscar as contas contábeis
    const contaDespesa = await PlanoContas.findById(ativo.conta_despesa_depreciacao_id);
    const contaDepreciacaoAcumulada = await PlanoContas.findById(ativo.conta_depreciacao_acumulada_id);

    if (!contaDespesa || !contaDepreciacaoAcumulada) {
      throw new Error(`Contas de depreciação não encontradas para o ativo ${ativo.nome}.`);
    }

    const historico = `Depreciação mensal do ativo: ${ativo.nome} (${ativo.data_aquisicao.getFullYear()})`;

    const lancamento = new LancamentoContabil({
      condominio_id: ativo.condominio_id,
      data_lancamento: dataLancamento,
      historico: historico,
      valor_total: valorDepreciacao,
      tipo_lancamento: 'automatico',
      origem_lancamento: 'depreciacao', // Nova origem
      documento_origem_id: ativo._id,
      status: 'confirmado', // Lançamentos automáticos são confirmados
      data_confirmacao: new Date(),
      created_by: userId,
      partidas: [
        {
          conta_id: contaDespesa._id,
          valor_debito: valorDepreciacao,
          valor_credito: 0,
          historico_complementar: `Despesa de depreciação de ${ativo.nome}`
        },
        {
          conta_id: contaDepreciacaoAcumulada._id,
          valor_debito: 0,
          valor_credito: valorDepreciacao,
          historico_complementar: `Depreciação acumulada de ${ativo.nome}`
        }
      ]
    });

    await lancamento.save();

    // Atualizar o ativo fixo com a depreciação acumulada e a data da última depreciação
    ativo.depreciacao_acumulada_total += valorDepreciacao;
    ativo.data_ultima_depreciacao = dataLancamento;
    await ativo.save();

    console.log(`Lançamento de depreciação gerado para ${ativo.nome}: R$ ${valorDepreciacao.toFixed(2)}`);
    return lancamento;
  }

  /**
   * Processa a depreciação para todos os ativos fixos de um condomínio.
   * @param condominioId O ID do condomínio.
   * @param dataReferencia A data para a qual a depreciação deve ser processada (geralmente o final do mês).
   * @param userId O ID do usuário que está executando o processo (ou ID do sistema).
   */
  static async processarDepreciacao(condominioId: ObjectId, dataReferencia: Date, userId: ObjectId): Promise<void> {
    await dbConnect();

    const ativos = await AtivoFixo.find({
      condominio_id: condominioId,
      ativo: true,
      // Apenas ativos que ainda não foram totalmente depreciados
      $expr: { $lt: ['$depreciacao_acumulada_total', { $subtract: ['$valor_aquisicao', '$valor_residual'] }] }
    });

    for (const ativo of ativos) {
      // Verificar se a depreciação para este mês já foi lançada
      if (ativo.data_ultima_depreciacao &&
          ativo.data_ultima_depreciacao.getMonth() === dataReferencia.getMonth() &&
          ativo.data_ultima_depreciacao.getFullYear() === dataReferencia.getFullYear()) {
        console.log(`Depreciação para ${ativo.nome} já foi lançada para ${dataReferencia.getMonth() + 1}/${dataReferencia.getFullYear()}. Pulando.`);
        continue;
      }

      const valorDepreciacao = this.calcularDepreciacaoMensal(ativo, dataReferencia);
      if (valorDepreciacao > 0) {
        await this.gerarLancamentoDepreciacao(ativo, valorDepreciacao, dataReferencia, userId);
      }
    }
    console.log(`Processamento de depreciação concluído para o condomínio ${condominioId} na data ${dataReferencia.toISOString().split('T')[0]}.`);
  }
}