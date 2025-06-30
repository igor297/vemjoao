import { NextRequest, NextResponse } from 'next/server';
import { ImportacaoExtratoService } from '@/lib/conciliacao/importacao-extrato-service';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as Blob | null;
    const condominioId = formData.get('condominio_id') as string;
    const contaBancariaId = formData.get('conta_bancaria_id') as string;
    const userId = formData.get('user_id') as string;

    if (!file || !condominioId || !contaBancariaId || !userId) {
      return NextResponse.json({ message: 'Missing required fields: file, condominio_id, conta_bancaria_id, user_id' }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileContent = fileBuffer.toString('utf-8');
    const fileType = file.type;

    let extratosImportados: any[] = [];

    const condominioObjectId = new ObjectId(condominioId);
    const contaBancariaObjectId = new ObjectId(contaBancariaId);
    const userObjectId = new ObjectId(userId);

    if (fileType === 'application/ofx' || file.name.toLowerCase().endsWith('.ofx')) {
      extratosImportados = await ImportacaoExtratoService.importarOfx(fileContent, condominioObjectId, contaBancariaObjectId, userObjectId);
    } else if (fileType === 'text/csv' || file.name.toLowerCase().endsWith('.csv')) {
      extratosImportados = await ImportacaoExtratoService.importarCsv(fileContent, condominioObjectId, contaBancariaObjectId, userObjectId);
    } else {
      return NextResponse.json({ message: 'Tipo de arquivo não suportado. Apenas OFX e CSV são aceitos.' }, { status: 400 });
    }

    return NextResponse.json({ message: 'Extratos importados com sucesso.', count: extratosImportados.length, extratos: extratosImportados.map(e => e._id) }, { status: 200 });
  } catch (error: any) {
    console.error('Erro ao importar extrato:', error);
    return NextResponse.json({ message: 'Erro interno do servidor', error: error.message }, { status: 500 });
  }
}