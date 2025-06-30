import LancamentoRecorrente, { ILancamentoRecorrente } from '@/models/LancamentoRecorrente';
import LancamentoContabil from '@/models/LancamentoContabil';
import dbConnect from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export class LancamentoRecorrenteService {

  /**
   * Processa lançamentos recorrentes para um condomínio em uma data específica.
   * @param condominioId O ID do condomínio.
   * @param dataProcessamento A data para a qual os lançamentos devem ser gerados (geralmente o final do mês).
   * @param userId O ID do usuário que está executando o processo (ou ID do sistema).
   */
  static async processarLancamentosRecorrentes(condominioId: ObjectId, dataProcessamento: Date, userId: ObjectId): Promise<void> {
    await dbConnect();

    const lancamentosRecorrentes = await LancamentoRecorrente.find({
      condominio_id: condominioId,
      status: 'ativo',
      data_inicio_recorrencia: { $lte: dataProcessamento }
    });

    for (const lr of lancamentosRecorrentes) {
      let deveGerar = false;
      let dataParaGerar = new Date(lr.data_inicio_recorrencia);

      if (lr.ultimo_lancamento_gerado) {
        dataParaGerar = new Date(lr.ultimo_lancamento_gerado);
        // Avança para a próxima data de recorrência
        switch (lr.tipo_recorrencia) {
          case 'mensal':
            dataParaGerar.setMonth(dataParaGerar.getMonth() + 1);
            break;
          case 'trimestral':
            dataParaGerar.setMonth(dataParaGerar.getMonth() + 3);
            break;
          case 'anual':
            dataParaGerar.setFullYear(dataParaGerar.getFullYear() + 1);
            break;
          case 'personalizado':
            if (lr.frequencia_personalizada_dias) {
              dataParaGerar.setDate(dataParaGerar.getDate() + lr.frequencia_personalizada_dias);
            }
            break;
        }
      }

      // Verifica se a data para gerar está dentro do período e é anterior ou igual à data de processamento
      if (dataParaGerar <= dataProcessamento && (!lr.data_fim_recorrencia || dataParaGerar <= lr.data_fim_recorrencia)) {
        deveGerar = true;
      }

      if (deveGerar) {
        await this.gerarLancamentoContabil(lr, dataParaGerar, userId);
        lr.ultimo_lancamento_gerado = dataParaGerar;
        // Se a recorrência tiver data fim e a data gerada for igual ou posterior, marca como concluído
        if (lr.data_fim_recorrencia && dataParaGerar >= lr.data_fim_recorrencia) {
          lr.status = 'concluido';
        }
        await lr.save();
      }
    }
    console.log(`Processamento de lançamentos recorrentes concluído para o condomínio ${condominioId} na data ${dataProcessamento.toISOString().split('T')[0]}.`);
  }

  /**
   * Gera um lançamento contábil a partir de um lançamento recorrente.
   * @param lr O documento do lançamento recorrente.
   * @param dataLancamento A data para o lançamento contábil.
   * @param userId O ID do usuário que está executando o processo.
   */
  static async gerarLancamentoContabil(
    lr: ILancamentoRecorrente,
    dataLancamento: Date,
    userId: ObjectId
  ): Promise<any> {
    const lancamento = new LancamentoContabil({
      condominio_id: lr.condominio_id,
      data_lancamento: dataLancamento,
      historico: lr.historico_lancamento,
      valor_total: lr.valor,
      tipo_lancamento: 'automatico',
      origem_lancamento: lr.origem_lancamento, // 'apropriacao' ou 'diferimento'
      documento_origem_id: lr._id,
      status: 'confirmado',
      data_confirmacao: new Date(),
      created_by: userId,
      partidas: [
        {
          conta_id: lr.conta_debito_id,
          valor_debito: lr.valor,
          valor_credito: 0
        },
        {
          conta_id: lr.conta_credito_id,
          valor_debito: 0,
          valor_credito: lr.valor
        }
      ]
    });

    await lancamento.save();
    console.log(`Lançamento recorrente gerado: ${lr.nome} - R$ ${lr.valor.toFixed(2)}`);
    return lancamento;
  }
}