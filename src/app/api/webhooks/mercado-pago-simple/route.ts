import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Transacao from '@/models/Transacao'
import FinanceiroMorador from '@/models/FinanceiroMorador'
import mongoose from 'mongoose'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log('🔔 Webhook Mercado Pago recebido:', {
      type: body.type,
      action: body.action,
      data: body.data,
      timestamp: new Date().toISOString()
    })

    // Processar apenas notificações de pagamento
    if (body.type === 'payment') {
      await processPaymentNotification(body.data?.id)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ Erro no webhook:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

async function processPaymentNotification(paymentId: string) {
  if (!paymentId) {
    console.log('❌ Payment ID não fornecido')
    return
  }

  try {
    await connectDB()
    
    // Buscar detalhes do pagamento no Mercado Pago
    const paymentDetails = await getPaymentDetails(paymentId)
    
    if (!paymentDetails) {
      console.log('❌ Detalhes do pagamento não encontrados:', paymentId)
      return
    }

    console.log('💰 Detalhes do pagamento:', {
      id: paymentDetails.id,
      status: paymentDetails.status,
      transaction_amount: paymentDetails.transaction_amount,
      payer_email: paymentDetails.payer?.email
    })

    // Buscar transação no banco
    const transacao = await Transacao.findOne({
      payment_id: paymentId.toString(),
      gateway_provider: 'mercado_pago'
    })

    if (!transacao) {
      console.log('❌ Transação não encontrada para payment_id:', paymentId)
      return
    }

    // Atualizar status da transação
    const statusAnterior = transacao.status
    const novoStatus = mapStatus(paymentDetails.status)

    transacao.status = novoStatus
    transacao.status_detalhado = paymentDetails.status_detail
    transacao.webhook_received = true
    
    // Adicionar dados do webhook
    if (!transacao.webhook_data) {
      transacao.webhook_data = []
    }
    
    transacao.webhook_data.push({
      timestamp: new Date(),
      provider: 'mercado_pago',
      event_type: 'payment',
      action: 'updated',
      data: paymentDetails
    })

    await transacao.save()

    console.log('✅ Transação atualizada:', {
      transacao_id: transacao.id_transacao,
      status_anterior: statusAnterior,
      status_novo: novoStatus
    })

    // Se aprovado, atualizar o financeiro
    if (novoStatus === 'aprovado') {
      await updateFinanceiroStatus(transacao)
    }

  } catch (error) {
    console.error('❌ Erro ao processar notificação:', error)
  }
}

async function getPaymentDetails(paymentId: string) {
  try {
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN
    
    if (!accessToken) {
      console.log('❌ Access token não configurado')
      return null
    }

    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      console.log('❌ Erro ao buscar pagamento:', response.status)
      return null
    }

    return await response.json()
  } catch (error) {
    console.error('❌ Erro ao buscar detalhes:', error)
    return null
  }
}

function mapStatus(mpStatus: string): string {
  const statusMap: { [key: string]: string } = {
    'pending': 'pendente',
    'approved': 'aprovado',
    'authorized': 'aprovado',
    'in_process': 'processando',
    'in_mediation': 'processando',
    'rejected': 'rejeitado',
    'cancelled': 'cancelado',
    'refunded': 'estornado',
    'charged_back': 'estornado'
  }
  
  return statusMap[mpStatus] || 'pendente'
}

async function updateFinanceiroStatus(transacao: any) {
  try {
    // Atualizar o FinanceiroMorador
    const financeiro = await FinanceiroMorador.findById(transacao.origem_id)
    
    if (financeiro) {
      financeiro.status = 'pago'
      financeiro.data_pagamento = new Date()
      financeiro.data_atualizacao = new Date()
      financeiro.transacao_id = transacao._id
      financeiro.metodo_pagamento = transacao.metodo_pagamento
      
      await financeiro.save()
      
      console.log('✅ FinanceiroMorador atualizado:', {
        financeiro_id: financeiro._id,
        transacao_id: transacao.id_transacao,
        status: 'pago'
      })
    } else {
      console.log('❌ FinanceiroMorador não encontrado:', transacao.origem_id)
    }
  } catch (error) {
    console.error('❌ Erro ao atualizar financeiro:', error)
  }
}