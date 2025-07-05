import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Transacao from '@/models/Transacao'
import FinanceiroMorador from '@/models/FinanceiroMorador'

export async function POST(request: NextRequest) {
  try {
    const { payment_id, status = 'approved' } = await request.json()
    
    await connectDB()
    
    // Buscar a transação mais recente se payment_id não for fornecido
    let transacao
    if (payment_id === 'ultimo_pix_gerado') {
      transacao = await Transacao.findOne({
        gateway_provider: 'mercado_pago',
        metodo_pagamento: 'pix',
        status: 'pendente'
      }).sort({ data_processamento: -1 })
    } else {
      transacao = await Transacao.findOne({
        payment_id: payment_id,
        gateway_provider: 'mercado_pago'
      })
    }
    
    if (!transacao) {
      return NextResponse.json({ error: 'Transação não encontrada' }, { status: 404 })
    }
    
    console.log('🔄 Simulando confirmação de pagamento:', {
      transacao_id: transacao.id_transacao,
      payment_id: transacao.payment_id,
      status_anterior: transacao.status,
      status_novo: status
    })
    
    // Atualizar transação
    transacao.status = status === 'approved' ? 'aprovado' : status
    transacao.status_detalhado = 'accredited'
    transacao.webhook_received = true
    transacao.data_confirmacao = new Date()
    
    // Adicionar log do webhook simulado
    if (!transacao.webhook_data) {
      transacao.webhook_data = []
    }
    
    transacao.webhook_data.push({
      timestamp: new Date(),
      provider: 'mercado_pago',
      event_type: 'payment',
      action: 'payment.updated',
      data: {
        id: transacao.payment_id,
        status: status,
        status_detail: 'accredited',
        transaction_amount: transacao.valor_final,
        simulated: true
      }
    })
    
    await transacao.save()
    
    // Se aprovado, atualizar o financeiro
    if (status === 'approved') {
      const financeiro = await FinanceiroMorador.findById(transacao.origem_id)
      
      if (financeiro) {
        financeiro.status = 'pago'
        financeiro.data_pagamento = new Date()
        financeiro.data_atualizacao = new Date()
        financeiro.transacao_id = transacao._id
        financeiro.metodo_pagamento = transacao.metodo_pagamento
        
        await financeiro.save()
        
        console.log('✅ FinanceiroMorador atualizado para PAGO:', {
          financeiro_id: financeiro._id,
          transacao_id: transacao.id_transacao
        })
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Pagamento confirmado com sucesso',
      transacao_id: transacao.id_transacao,
      status: transacao.status,
      financeiro_atualizado: status === 'approved'
    })
    
  } catch (error) {
    console.error('❌ Erro ao simular confirmação:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    await connectDB()
    
    // Buscar transações PIX pendentes
    const transacoesPendentes = await Transacao.find({
      gateway_provider: 'mercado_pago',
      metodo_pagamento: 'pix',
      status: 'pendente'
    })
    .sort({ data_processamento: -1 })
    .limit(10)
    .select('id_transacao payment_id valor_final data_processamento')
    
    return NextResponse.json({
      success: true,
      transacoes_pendentes: transacoesPendentes,
      total: transacoesPendentes.length
    })
    
  } catch (error) {
    console.error('❌ Erro ao buscar transações:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}