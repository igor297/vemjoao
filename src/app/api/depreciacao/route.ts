import { NextResponse } from 'next/server';
import { DepreciacaoService } from '@/lib/contabilidade/depreciacao-service';
import { ObjectId } from 'mongodb';

export async function POST(request: Request) {
  try {
    const { condominio_id, dataReferencia, userId } = await request.json();

    if (!condominio_id || !dataReferencia || !userId) {
      return NextResponse.json({ message: 'Missing required fields: condominio_id, dataReferencia, userId' }, { status: 400 });
    }

    // Convert dataReferencia to Date object
    const dataRef = new Date(dataReferencia);

    // Convert IDs to ObjectId
    const condominioObjectId = new ObjectId(condominio_id);
    const userObjectId = new ObjectId(userId);

    await DepreciacaoService.processarDepreciacao(condominioObjectId, dataRef, userObjectId);

    return NextResponse.json({ message: 'Depreciação processada com sucesso.' }, { status: 200 });
  } catch (error: any) {
    console.error('Erro ao processar depreciação:', error);
    return NextResponse.json({ message: 'Erro interno do servidor', error: error.message }, { status: 500 });
  }
}