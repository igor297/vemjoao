import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import FinanceiroColaborador from '@/models/FinanceiroColaborador'
import FinanceiroMorador from '@/models/FinanceiroMorador'
import { SincronizacaoFinanceira } from '@/services/sincronizacaoFinanceira'

export async function POST(request: NextRequest) {
  try {
    await connectDB()
    
    const data = await request.json()
    const { master_id, condominio_id, tipo_usuario } = data

    if (!master_id || !condominio_id || !tipo_usuario) {
      return NextResponse.json({
        success: false,
        error: 'master_id, condominio_id e tipo_usuario são obrigatórios'
      }, { status: 400 })
    }

    // Verificar permissão
    if (!['master', 'sindico', 'subsindico'].includes(tipo_usuario)) {
      return NextResponse.json({
        success: false,
        error: 'Você não tem permissão para sincronizar dados financeiros'
      }, { status: 403 })
    }

    console.log('🔄 Iniciando sincronização de dados financeiros existentes...')

    // Buscar lançamentos de colaboradores existentes
    const colaboradores = await FinanceiroColaborador.find({
      master_id,
      condominio_id,
      ativo: true
    }).lean()

    // Buscar lançamentos de moradores existentes
    const moradores = await FinanceiroMorador.find({
      master_id,
      condominio_id,
      ativo: true
    }).lean()

    let resultados = {
      colaboradores: { sucesso: 0, erros: 0, detalhes: [] as string[] },
      moradores: { sucesso: 0, erros: 0, detalhes: [] as string[] }
    }

    // Sincronizar colaboradores
    if (colaboradores.length > 0) {
      console.log(`📋 Sincronizando ${colaboradores.length} lançamentos de colaboradores...`)
      
      const dadosColaboradores = colaboradores.map(lanc => ({
        _id: lanc._id.toString(),
        tipo: 'despesa' as const,
        categoria: lanc.tipo,
        descricao: lanc.descricao,
        valor: lanc.valor,
        data_vencimento: lanc.data_vencimento,
        data_pagamento: lanc.data_pagamento,
        status: lanc.status,
        condominio_id: lanc.condominio_id.toString(),
        master_id: lanc.master_id.toString(),
        criado_por_tipo: lanc.criado_por_tipo,
        criado_por_id: lanc.criado_por_id.toString(),
        criado_por_nome: lanc.criado_por_nome,
        observacoes: lanc.observacoes,
        recorrente: lanc.recorrente || false,
        periodicidade: lanc.periodicidade,
        mes_referencia: lanc.mes_referencia,
        origem_nome: lanc.colaborador_nome,
        origem_identificacao: ''
      }))

      resultados.colaboradores = await SincronizacaoFinanceira.sincronizarLote(dadosColaboradores, 'colaborador')
    }

    // Sincronizar moradores
    if (moradores.length > 0) {
      console.log(`🏠 Sincronizando ${moradores.length} lançamentos de moradores...`)
      
      const dadosMoradores = moradores.map(lanc => ({
        _id: lanc._id.toString(),
        tipo: 'receita' as const,
        categoria: lanc.categoria,
        descricao: lanc.descricao,
        valor: lanc.valor,
        data_vencimento: lanc.data_vencimento,
        data_pagamento: lanc.data_pagamento,
        status: lanc.status,
        condominio_id: lanc.condominio_id.toString(),
        master_id: lanc.master_id.toString(),
        criado_por_tipo: lanc.criado_por_tipo,
        criado_por_id: lanc.criado_por_id.toString(),
        criado_por_nome: lanc.criado_por_nome,
        observacoes: lanc.observacoes,
        recorrente: lanc.recorrente || false,
        periodicidade: lanc.periodicidade,
        mes_referencia: lanc.mes_referencia,
        origem_nome: lanc.morador_nome,
        origem_identificacao: '',
        bloco: lanc.bloco,
        unidade: lanc.apartamento || lanc.unidade
      }))

      resultados.moradores = await SincronizacaoFinanceira.sincronizarLote(dadosMoradores, 'morador')
    }

    const totalSucesso = resultados.colaboradores.sucesso + resultados.moradores.sucesso
    const totalErros = resultados.colaboradores.erros + resultados.moradores.erros

    console.log(`✅ Sincronização financeira concluída: ${totalSucesso} sucessos, ${totalErros} erros`)

    return NextResponse.json({
      success: true,
      message: 'Sincronização de dados financeiros concluída',
      resumo: {
        total_processados: colaboradores.length + moradores.length,
        total_sucesso: totalSucesso,
        total_erros: totalErros
      },
      detalhes: resultados
    })

  } catch (error) {
    console.error('Erro na sincronização de dados financeiros:', error)
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}