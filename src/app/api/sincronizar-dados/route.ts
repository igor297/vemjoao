import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import StatusPagamentoMorador from '@/models/StatusPagamentoMorador'
import FinanceiroMorador from '@/models/FinanceiroMorador'
import Morador from '@/models/Morador'
import mongoose from 'mongoose'

export async function POST(request: NextRequest) {
  try {
    const { condominio_id, master_id, morador_id } = await request.json()
    
    if (!condominio_id || !master_id) {
      return NextResponse.json(
        { error: 'condominio_id e master_id são obrigatórios' },
        { status: 400 }
      )
    }

    await connectDB()
    let syncResults = {
      moradores_processados: 0,
      registros_financeiros_atualizados: 0,
      status_pagamento_atualizados: 0,
      transacoes_atualizadas: 0,
      erros: []
    }
    
    // Filtro para moradores a serem sincronizados
    const filtroMoradores: any = {
      condominio_id: condominio_id,
      master_id: master_id,
      ativo: true
    }
    
    if (morador_id) {
      filtroMoradores._id = morador_id
    }
    
    // Buscar moradores
    const moradores = await Morador.find(filtroMoradores).lean()
    
    for (const morador of moradores) {
      try {
        syncResults.moradores_processados++
        
        // Sincronizar registros financeiros
        const financeiroUpdate = await FinanceiroMorador.updateMany(
          { morador_id: new mongoose.Types.ObjectId(morador._id) },
          {
            $set: {
              morador_nome: morador.nome,
              apartamento: morador.unidade,
              bloco: morador.bloco || '',
              data_atualizacao: new Date()
            }
          }
        )
        syncResults.registros_financeiros_atualizados += financeiroUpdate.modifiedCount
        
        // Sincronizar status de pagamento
        const statusUpdate = await StatusPagamentoMorador.updateMany(
          { morador_id: new mongoose.Types.ObjectId(morador._id) },
          {
            $set: {
              nome_morador: morador.nome,
              apartamento: morador.unidade,
              bloco: morador.bloco || '',
              email: morador.email,
              telefone: morador.celular1,
              data_atualizacao: new Date()
            }
          }
        )
        syncResults.status_pagamento_atualizados += statusUpdate.modifiedCount
        
        // Sincronizar transações (comentado até criar modelo Transacao)
        // const transacoesUpdate = await TransacaoModel.updateMany(
        //   { morador_id: new mongoose.Types.ObjectId(morador._id) },
        //   {
        //     $set: {
        //       apartamento: morador.unidade,
        //       bloco: morador.bloco || '',
        //       'dados_pagador.nome': morador.nome,
        //       'dados_pagador.email': morador.email,
        //       'dados_pagador.telefone': morador.celular1,
        //       data_atualizacao: new Date()
        //     }
        //   }
        // )
        // syncResults.transacoes_atualizadas += transacoesUpdate.modifiedCount
        
      } catch (error) {
        syncResults.erros.push(`Erro ao sincronizar morador ${morador._id}: ${error}`)
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Sincronização concluída',
      resultados: syncResults,
      detalhes: {
        moradores_encontrados: moradores.length,
        condominio_id: condominio_id,
        master_id: master_id,
        morador_especifico: morador_id || 'todos'
      }
    })
    
  } catch (error) {
    console.error('Error synchronizing data:', error)
    return NextResponse.json(
      { error: 'Erro ao sincronizar dados' },
      { status: 500 }
    )
  }

}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const condominioId = url.searchParams.get('condominio_id')
    const masterId = url.searchParams.get('master_id')
    
    if (!condominioId || !masterId) {
      return NextResponse.json(
        { error: 'condominio_id e master_id são obrigatórios' },
        { status: 400 }
      )
    }

    await connectDB()
    // Analisar inconsistências
    const filtroConsulta = {
      condominio_id: new mongoose.Types.ObjectId(condominioId),
      master_id: new mongoose.Types.ObjectId(masterId),
      ativo: true
    }
    const moradores = await Morador.find(filtroConsulta).lean()
    
    let inconsistencias = []
    
    for (const morador of moradores) {
      // Verificar registros financeiros
      const registrosFinanceiros = await FinanceiroMorador.find({
        morador_id: morador._id
      }).lean()
      
      const financeiroInconsistente = registrosFinanceiros.filter(r => 
        r.morador_nome !== morador.nome || 
        r.apartamento !== morador.unidade ||
        r.bloco !== (morador.bloco || '')
      )
      
      // Verificar status de pagamento
      const statusPagamento = await StatusPagamentoMorador.findOne({
        morador_id: morador._id
      })
      
      const statusInconsistente = statusPagamento && (
        statusPagamento.nome_morador !== morador.nome ||
        statusPagamento.apartamento !== morador.unidade ||
        statusPagamento.bloco !== (morador.bloco || '')
      )
      
      if (financeiroInconsistente.length > 0 || statusInconsistente) {
        inconsistencias.push({
          morador: {
            _id: morador._id.toString(),
            nome: morador.nome,
            apartamento: morador.unidade,
            bloco: morador.bloco || ''
          },
          problemas: {
            financeiro_inconsistente: financeiroInconsistente.length,
            status_inconsistente: statusInconsistente,
            detalhes_financeiro: financeiroInconsistente.map(r => ({
              id: r._id.toString(),
              nome_atual: r.morador_nome,
              apartamento_atual: r.apartamento,
              bloco_atual: r.bloco
            })),
            detalhes_status: statusInconsistente ? {
              nome_atual: statusPagamento.nome_morador,
              apartamento_atual: statusPagamento.apartamento,
              bloco_atual: statusPagamento.bloco
            } : null
          }
        })
      }
    }
    
    return NextResponse.json({
      success: true,
      total_moradores: moradores.length,
      inconsistencias_encontradas: inconsistencias.length,
      necessita_sincronizacao: inconsistencias.length > 0,
      inconsistencias: inconsistencias,
      recomendacao: inconsistencias.length > 0 
        ? 'Execute POST /api/sincronizar-dados para corrigir as inconsistências'
        : 'Todos os dados estão sincronizados'
    })
    
  } catch (error) {
    console.error('Error checking data consistency:', error)
    return NextResponse.json(
      { error: 'Erro ao verificar consistência dos dados' },
      { status: 500 }
    )
  }
}