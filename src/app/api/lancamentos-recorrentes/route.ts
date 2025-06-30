import { NextResponse } from 'next/server';
import { LancamentoRecorrenteService } from '@/lib/contabilidade/lancamento-recorrente-service';
import { ObjectId } from 'mongodb';

export async function POST(request: Request) {
  try {
    const { condominio_id, dataProcessamento, userId } = await request.json();

    if (!condominio_id || !dataProcessamento || !userId) {
      return NextResponse.json({ message: 'Missing required fields: condominio_id, dataProcessamento, userId' }, { status: 400 });
    }

    const dataProc = new Date(dataProcessamento);
    const condominioObjectId = new ObjectId(condominio_id);
    const userObjectId = new ObjectId(userId);

    await LancamentoRecorrenteService.processarLancamentosRecorrentes(condominioObjectId, dataProc, userObjectId);

    return NextResponse.json({ message: 'Lançamentos recorrentes processados com sucesso.' }, { status: 200 });
  } catch (error: any) {
    console.error('Erro ao processar lançamentos recorrentes:', error);
    return NextResponse.json({ message: 'Erro interno do servidor', error: error.message }, { status: 500 });
  }
}