import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Morador from '@/models/Morador'
import FinanceiroMorador from '@/models/FinanceiroMorador'
import StatusPagamentoMorador from '@/models/StatusPagamentoMorador'
import mongoose from 'mongoose'
import { calcularStatusPagamento } from '@/models/StatusPagamentoMorador'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const condominioId = url.searchParams.get('condominio_id')
    const masterId = url.searchParams.get('master_id')
    const action = url.searchParams.get('action')
    
    if (!condominioId || !masterId) {
      return NextResponse.json(
        { error: 'Condomínio ID e Master ID são obrigatórios' },
        { status: 400 }
      )
    }

    await connectDB()
    if (action === 'atualizar_todos') {
      // Atualizar status de todos os moradores baseado nos dados financeiros
      // Buscar todos os moradores
      const filtroMoradores = {
        condominio_id: new mongoose.Types.ObjectId(condominioId),
        master_id: new mongoose.Types.ObjectId(masterId),
        ativo: true
      }
      const moradores = await Morador.find(filtroMoradores).lean()
      
      let atualizados = 0
      
      for (const morador of moradores) {
        // Buscar dados financeiros pendentes do morador
        const financeirosPendentes = await FinanceiroMorador.find({
          morador_id: morador._id,
          condominio_id: new mongoose.Types.ObjectId(condominioId),
          master_id: new mongoose.Types.ObjectId(masterId),
          status: { $in: ['pendente', 'atrasado'] },
          ativo: true
        }).lean()
        
        const valorPendente = financeirosPendentes.reduce((total, item) => total + item.valor, 0)
        const proximoVencimento = financeirosPendentes.length > 0 
          ? new Date(Math.min(...financeirosPendentes.map(f => new Date(f.data_vencimento).getTime())))
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 dias no futuro se não há pendências
        
        const { status, diasAtraso, descricao } = calcularStatusPagamento(proximoVencimento, valorPendente)
        
        // Gerar ID único
        const existingStatus = await StatusPagamentoMorador.findOne({
          morador_id: morador._id,
          condominio_id: new mongoose.Types.ObjectId(condominioId)
        })
        
        const statusData = {
          id_status: existingStatus?.id_status || `SPM${Date.now()}${Math.random().toString(36).substr(2, 4)}`,
          condominio_id: condominioId,
          master_id: masterId,
          morador_id: morador._id,
          apartamento: morador.apartamento,
          bloco: morador.bloco || '',
          nome_morador: morador.nome,
          tipo_morador: morador.tipo || 'morador',
          email: morador.email || '',
          telefone: morador.telefone || '',
          status_pagamento: status,
          valor_pendente: valorPendente,
          valor_total_mes: valorPendente, // Pode ser ajustado conforme lógica de negócio
          data_proximo_vencimento: proximoVencimento,
          dias_atraso: diasAtraso,
          descricao_situacao: descricao,
          pagamento_automatico_ativo: false,
          notificacoes_enviadas: existingStatus?.notificacoes_enviadas || 0,
          data_atualizacao: new Date(),
          atualizado_por_id: masterId,
          atualizado_por_nome: 'Sistema Automático',
          ativo: true
        }
        
        if (existingStatus) {
          await StatusPagamentoMorador.updateOne(
            { _id: existingStatus._id },
            { $set: statusData }
          )
        } else {
          await StatusPagamentoMorador.create(statusData)
        }
        
        atualizados++
      }
      
      return NextResponse.json({
        success: true,
        message: `Status atualizado para ${atualizados} morador(es)`,
        atualizados
      })
    }
    
    // Buscar status de pagamento
    const statusList = await StatusPagamentoMorador.find({
      condominio_id: new mongoose.Types.ObjectId(condominioId),
      master_id: new mongoose.Types.ObjectId(masterId),
      ativo: true
    }).sort({ apartamento: 1, nome_morador: 1 }).lean()
    
    return NextResponse.json({
      success: true,
      status_pagamentos: statusList
    })
    
  } catch (error) {
    console.error('Error fetching status pagamento:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar status de pagamento' },
      { status: 500 }
    )
  }

}

export async function POST(request: NextRequest) {
  try {
    const statusData = await request.json()
    
    // Validação básica
    const requiredFields = [
      'condominio_id', 'master_id', 'morador_id', 'apartamento', 'nome_morador'
    ]
    
    for (const field of requiredFields) {
      if (!statusData[field]) {
        return NextResponse.json(
          { error: `Campo ${field} é obrigatório` },
          { status: 400 }
        )
      }
    }

    await connectDB()
    // Verificar se já existe status para este morador
    const existingStatus = await StatusPagamentoMorador.findOne({
      morador_id: new mongoose.Types.ObjectId(statusData.morador_id),
      condominio_id: new mongoose.Types.ObjectId(statusData.condominio_id),
      ativo: true
    })
    
    if (existingStatus) {
      return NextResponse.json(
        { error: 'Já existe status de pagamento para este morador' },
        { status: 400 }
      )
    }
    
    // Gerar ID único
    const lastStatus = await StatusPagamentoMorador.findOne(
      {},
      null,
      { sort: { data_atualizacao: -1 } }
    )
    
    let nextId = 1
    if (lastStatus && lastStatus.id_status) {
      const lastIdNumber = parseInt(lastStatus.id_status.replace('SPM', ''))
      if (!isNaN(lastIdNumber)) {
        nextId = lastIdNumber + 1
      }
    }
    
    const newStatus = {
      ...statusData,
      id_status: `SPM${nextId.toString().padStart(6, '0')}`,
      data_atualizacao: new Date(),
      ativo: true
    }

    const result = await StatusPagamentoMorador.create(newStatus)
    
    return NextResponse.json({
      success: true,
      status_pagamento: result
    })
    
  } catch (error) {
    console.error('Error creating status pagamento:', error)
    return NextResponse.json(
      { error: 'Erro ao criar status de pagamento' },
      { status: 500 }
    )
  }

}

export async function PUT(request: NextRequest) {
  try {
    const { _id, ...statusData } = await request.json()
    
    if (!_id) {
      return NextResponse.json(
        { error: 'ID do status é obrigatório' },
        { status: 400 }
      )
    }

    await connectDB()
    const updateData = {
      ...statusData,
      data_atualizacao: new Date()
    }

    const result = await StatusPagamentoMorador.updateOne(
      { _id: new mongoose.Types.ObjectId(_id) },
      { $set: updateData }
    )
    
    if (!result) {
      return NextResponse.json(
        { error: 'Status de pagamento não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Status de pagamento atualizado com sucesso'
    })
    
  } catch (error) {
    console.error('Error updating status pagamento:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar status de pagamento' },
      { status: 500 }
    )
  }
}