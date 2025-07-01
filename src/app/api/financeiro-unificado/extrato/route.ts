import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import FinanceiroCondominio from '@/models/FinanceiroCondominio';
import mongoose from 'mongoose';

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const url = new URL(request.url);
    const masterId = url.searchParams.get('master_id');
    const condominioId = url.searchParams.get('condominio_id');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20'); // 20 itens por página
    const status = url.searchParams.get('status');
    const tipo = url.searchParams.get('tipo');
    const categoria = url.searchParams.get('categoria');
    const dataInicio = url.searchParams.get('data_inicio');
    const dataFim = url.searchParams.get('data_fim');

    if (!masterId || !condominioId) {
      return NextResponse.json({
        success: false,
        error: 'Master ID e Condomínio ID são obrigatórios para o extrato financeiro'
      }, { status: 400 });
    }

    const filter: any = {
      master_id: new mongoose.Types.ObjectId(masterId),
      condominio_id: new mongoose.Types.ObjectId(condominioId),
      ativo: true,
    };

    if (status) filter.status = status;
    if (tipo) filter.tipo = tipo;
    if (categoria) filter.categoria = categoria;
    if (dataInicio || dataFim) {
      filter.data_vencimento = {};
      if (dataInicio) filter.data_vencimento.$gte = new Date(dataInicio);
      if (dataFim) filter.data_vencimento.$lte = new Date(dataFim);
    }

    const skip = (page - 1) * limit;

    const lancamentos = await FinanceiroCondominio.find(filter)
      .sort({ data_vencimento: -1, data_criacao: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await FinanceiroCondominio.countDocuments(filter);

    return NextResponse.json({
      success: true,
      lancamentos,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(total / limit),
        total_items: total,
        items_per_page: limit,
      },
    });

  } catch (error) {
    console.error('Erro ao buscar extrato financeiro unificado:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor ao buscar extrato'
    }, { status: 500 });
  }
}
