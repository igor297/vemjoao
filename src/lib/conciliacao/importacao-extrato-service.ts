import { parse as parseCsv } from 'csv-parse';
import { parse as parseOfx } from 'ofx';
import ExtratoBancario from '@/models/ExtratoBancario';
import dbConnect from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export class ImportacaoExtratoService {

  /**
   * Importa dados de um arquivo OFX.
   * @param fileContent Conteúdo do arquivo OFX como string.
   * @param condominioId ID do condomínio.
   * @param contaBancariaId ID da conta bancária.
   * @param userId ID do usuário que está importando.
   * @returns Lista de extratos bancários importados.
   */
  static async importarOfx(fileContent: string, condominioId: ObjectId, contaBancariaId: ObjectId, userId: ObjectId): Promise<any[]> {
    await dbConnect();
    const extratosImportados: any[] = [];

    try {
      const data = parseOfx(fileContent);
      const transactions = data.OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS.BANKTRANLIST.STMTTRN;

      if (!Array.isArray(transactions)) {
        // Handle single transaction case
        const transaction = transactions;
        const extrato = await this.processarTransacaoOfx(transaction, condominioId, contaBancariaId, userId);
        if (extrato) extratosImportados.push(extrato);
      } else {
        for (const transaction of transactions) {
          const extrato = await this.processarTransacaoOfx(transaction, condominioId, contaBancariaId, userId);
          if (extrato) extratosImportados.push(extrato);
        }
      }

      return extratosImportados;
    } catch (error: any) {
      console.error('Erro ao parsear OFX:', error);
      throw new Error(`Erro ao importar OFX: ${error.message}`);
    }
  }

  private static async processarTransacaoOfx(transaction: any, condominioId: ObjectId, contaBancariaId: ObjectId, userId: ObjectId): Promise<any | null> {
    const dataMovimento = new Date(transaction.DTPOSTED);
    const valor = parseFloat(transaction.TRNAMT);
    const tipoMovimento = valor > 0 ? 'credito' : 'debito';
    const historico = transaction.MEMO || transaction.NAME || 'Sem histórico';
    const documento = transaction.FITID; // Unique transaction ID

    // Check for duplicate using document ID
    const existingExtrato = await ExtratoBancario.findOne({ condominio_id: condominioId, conta_bancaria_id: contaBancariaId, documento: documento });
    if (existingExtrato) {
      console.log(`Extrato duplicado encontrado e ignorado: ${documento}`);
      return null;
    }

    const extrato = new ExtratoBancario({
      condominio_id: condominioId,
      conta_bancaria_id: contaBancariaId,
      data_movimento: dataMovimento,
      data_processamento: new Date(),
      tipo_movimento: tipoMovimento,
      valor: Math.abs(valor),
      saldo_anterior: 0, // OFX usually doesn't provide this per transaction
      saldo_atual: 0, // OFX usually doesn't provide this per transaction
      documento: documento,
      historico: historico,
      codigo_movimento: transaction.TRNTYPE,
      origem_importacao: 'ofx',
      created_by: userId,
    });

    extrato.categorizarAutomaticamente();
    extrato.processado = true;
    await extrato.save();
    return extrato;
  }

  /**
   * Importa dados de um arquivo CSV.
   * Assume um formato CSV com colunas: Data, Histórico, Valor, Tipo (C/D ou +/-), Saldo (opcional).
   * @param fileContent Conteúdo do arquivo CSV como string.
   * @param condominioId ID do condomínio.
   * @param contaBancariaId ID da conta bancária.
   * @param userId ID do usuário que está importando.
   * @returns Lista de extratos bancários importados.
   */
  static async importarCsv(fileContent: string, condominioId: ObjectId, contaBancariaId: ObjectId, userId: ObjectId): Promise<any[]> {
    await dbConnect();
    const extratosImportados: any[] = [];

    return new Promise((resolve, reject) => {
      parseCsv(fileContent, { columns: true, skip_empty_lines: true }, async (err, records) => {
        if (err) {
          console.error('Erro ao parsear CSV:', err);
          return reject(new Error(`Erro ao importar CSV: ${err.message}`));
        }

        for (const record of records) {
          try {
            const dataMovimento = new Date(record.Data);
            let valor = parseFloat(record.Valor.replace(',', '.'));
            let tipoMovimento: 'credito' | 'debito';

            // Determine tipo_movimento based on 'Tipo' column or value sign
            if (record.Tipo) {
              tipoMovimento = record.Tipo.toLowerCase() === 'c' ? 'credito' : 'debito';
            } else {
              tipoMovimento = valor >= 0 ? 'credito' : 'debito';
              valor = Math.abs(valor); // Ensure positive value if sign was used for type
            }

            const historico = record.Historico || 'Sem histórico';
            const documento = `CSV-${dataMovimento.getTime()}-${valor}-${Math.random().toString(36).substring(7)}`; // Simple unique ID

            // Check for duplicate using a generated document ID (less robust than OFX FITID)
            const existingExtrato = await ExtratoBancario.findOne({ condominio_id: condominioId, conta_bancaria_id: contaBancariaId, documento: documento });
            if (existingExtrato) {
              console.log(`Extrato duplicado (CSV) encontrado e ignorado: ${documento}`);
              continue;
            }

            const extrato = new ExtratoBancario({
              condominio_id: condominioId,
              conta_bancaria_id: contaBancariaId,
              data_movimento: dataMovimento,
              data_processamento: new Date(),
              tipo_movimento: tipoMovimento,
              valor: valor,
              saldo_anterior: parseFloat(record.SaldoAnterior?.replace(',', '.')) || 0,
              saldo_atual: parseFloat(record.SaldoAtual?.replace(',', '.')) || 0,
              documento: documento,
              historico: historico,
              origem_importacao: 'csv',
              created_by: userId,
            });

            extrato.categorizarAutomaticamente();
            extrato.processado = true;
            await extrato.save();
            extratosImportados.push(extrato);
          } catch (innerError: any) {
            console.error(`Erro ao processar linha CSV: ${JSON.stringify(record)} - ${innerError.message}`);
            // Continue to next record even if one fails
          }
        }
        resolve(extratosImportados);
      });
    });
  }
}