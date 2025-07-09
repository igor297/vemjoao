import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import FinanceiroCondominio from '@/models/FinanceiroCondominio';
import FinanceiroMorador from '@/models/FinanceiroMorador';
import FinanceiroColaborador from '@/models/FinanceiroColaborador';
import mongoose from 'mongoose';

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const url = new URL(request.url);
    const masterId = url.searchParams.get('master_id');
    const condominioId = url.searchParams.get('condominio_id');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const status = url.searchParams.get('status');
    const tipo = url.searchParams.get('tipo'); // receita, despesa
    const origem = url.searchParams.get('origem'); // morador, colaborador, condominio
    const dataInicio = url.searchParams.get('data_inicio');
    const dataFim = url.searchParams.get('data_fim');

    if (!masterId || !condominioId) {
      return NextResponse.json({
        success: false,
        error: 'Master ID e Condomínio ID são obrigatórios'
      }, { status: 400 });
    }

    const baseFilter = {
      master_id: new mongoose.Types.ObjectId(masterId),
      condominio_id: new mongoose.Types.ObjectId(condominioId),
      ativo: true,
    };

    // Buscar lançamentos do condomínio
    let condominioFilter: any = { ...baseFilter };
    if (status) condominioFilter.status = status;
    if (tipo) condominioFilter.tipo = tipo;
    if (dataInicio || dataFim) {
      condominioFilter.data_vencimento = {};
      if (dataInicio) condominioFilter.data_vencimento.$gte = new Date(dataInicio);
      if (dataFim) condominioFilter.data_vencimento.$lte = new Date(dataFim);
    }

    // Buscar lançamentos de moradores
    let moradorFilter: any = { ...baseFilter };
    if (status) moradorFilter.status = status;
    if (dataInicio || dataFim) {
      moradorFilter.data_vencimento = {};
      if (dataInicio) moradorFilter.data_vencimento.$gte = new Date(dataInicio);
      if (dataFim) moradorFilter.data_vencimento.$lte = new Date(dataFim);
    }

    // Buscar lançamentos de colaboradores
    let colaboradorFilter: any = { ...baseFilter };
    if (status) colaboradorFilter.status = status;
    if (dataInicio || dataFim) {
      colaboradorFilter.data_vencimento = {};
      if (dataInicio) colaboradorFilter.data_vencimento.$gte = new Date(dataInicio);
      if (dataFim) colaboradorFilter.data_vencimento.$lte = new Date(dataFim);
    }

    let allLancamentos = [];

    // Buscar dados baseado no filtro de origem
    if (!origem || origem === 'condominio') {
      // Filtrar apenas lançamentos genuínos do condomínio (não originados de morador/colaborador)
      const condominioFilterFiltrado = {
        ...condominioFilter,
        origem_sistema: { $nin: ['morador', 'colaborador'] } // Excluir os que vieram de morador/colaborador
      };
      
      const lancamentosCondominio = await FinanceiroCondominio.find(condominioFilterFiltrado)
        .lean()
        .exec();

      allLancamentos.push(...lancamentosCondominio.map(l => ({
        ...l,
        origem_sistema: 'condominio',
        origem_nome: 'Condomínio',
        categoria_display: l.categoria,
        pessoa_nome: 'Condomínio',
        bloco: l.bloco || '',
        unidade: l.unidade || '',
        cargo: ''
      })));
    }

    if (!origem || origem === 'morador') {
      const lancamentosMoradores = await FinanceiroMorador.aggregate([
        { $match: moradorFilter },
        {
          $lookup: {
            from: 'moradors',
            localField: 'morador_id',
            foreignField: '_id',
            as: 'morador_info'
          }
        },
        { $unwind: { path: '$morador_info', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'moradors',
            let: { 
              bloco: '$bloco', 
              unidade: '$apartamento',
              condominio_id: '$condominio_id'
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$bloco', '$bloco'] },
                      { $eq: ['$unidade', '$unidade'] },
                      { $eq: ['$condominio_id', '$condominio_id'] },
                      { $eq: ['$ativo', true] }
                    ]
                  }
                }
              }
            ],
            as: 'todos_moradores_unidade'
          }
        }
      ]);

      allLancamentos.push(...lancamentosMoradores.map(l => ({
        ...l,
        origem_sistema: 'morador',
        origem_nome: 'Morador',
        categoria_display: l.categoria,
        pessoa_nome: l.morador_info?.nome || l.morador_nome || 'Morador não encontrado',
        bloco: l.morador_info?.bloco || l.bloco || '',
        unidade: l.morador_info?.unidade || l.apartamento || '',
        cargo: '',
        tipo_morador: l.morador_info?.tipo || 'proprietario',
        cpf_morador: l.morador_info?.cpf || '',
        email_morador: l.morador_info?.email || '',
        telefone_morador: l.morador_info?.telefone || '',
        todos_moradores_unidade: l.todos_moradores_unidade || [],
        tipo: 'receita' // Lançamentos de moradores são sempre receitas
      })));
    }

    if (!origem || origem === 'colaborador') {
      const lancamentosColaboradores = await FinanceiroColaborador.find(colaboradorFilter)
        .lean()
        .exec();

      allLancamentos.push(...lancamentosColaboradores.map(l => ({
        ...l,
        origem_sistema: 'colaborador',
        origem_nome: 'Colaborador',
        categoria_display: l.categoria || 'salario',
        pessoa_nome: l.colaborador_nome || 'Colaborador',
        bloco: '',
        unidade: '',
        cargo: l.colaborador_cargo || '',
        tipo: 'despesa' // Lançamentos de colaboradores são sempre despesas
      })));
    }

    // Filtrar por tipo após unificar os dados (se especificado)
    if (tipo) {
      allLancamentos = allLancamentos.filter(l => l.tipo === tipo);
    }

    console.log('🔍 DEBUG: Total de lançamentos encontrados antes da ordenação:', allLancamentos.length)
    console.log('🔍 DEBUG: Por origem:', {
      condominio: allLancamentos.filter(l => l.origem_sistema === 'condominio').length,
      morador: allLancamentos.filter(l => l.origem_sistema === 'morador').length,
      colaborador: allLancamentos.filter(l => l.origem_sistema === 'colaborador').length
    })

    // Ordenar por data de vencimento (mais recente primeiro)
    allLancamentos.sort((a, b) => {
      const dateA = new Date(a.data_vencimento);
      const dateB = new Date(b.data_vencimento);
      return dateB.getTime() - dateA.getTime();
    });

    // Aplicar paginação
    const total = allLancamentos.length;
    const skip = (page - 1) * limit;
    const paginatedLancamentos = allLancamentos.slice(skip, skip + limit);

    return NextResponse.json({
      success: true,
      lancamentos: paginatedLancamentos,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(total / limit),
        total_items: total,
        items_per_page: limit,
      },
      resumo: {
        total_receitas: allLancamentos
          .filter(l => l.tipo === 'receita')
          .reduce((sum, l) => sum + (l.valor || 0), 0),
        total_despesas: allLancamentos
          .filter(l => l.tipo === 'despesa')
          .reduce((sum, l) => sum + (l.valor || 0), 0),
        total_pendente: allLancamentos
          .filter(l => l.status === 'pendente')
          .reduce((sum, l) => sum + (l.valor || 0), 0),
        total_atrasado: allLancamentos
          .filter(l => l.status === 'atrasado')
          .reduce((sum, l) => sum + (l.valor || 0), 0),
        total_pago: allLancamentos
          .filter(l => l.status === 'pago')
          .reduce((sum, l) => sum + (l.valor || 0), 0),
      }
    });

  } catch (error) {
    console.error('Erro ao buscar lançamentos unificados:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor ao buscar lançamentos'
    }, { status: 500 });
  }
}