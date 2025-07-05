import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Transacao from '@/models/Transacao'
import FinanceiroMorador from '@/models/FinanceiroMorador'

export async function POST(request: NextRequest) {
  try {
    await connectDB()
    
    console.log('🔍 Verificando pagamentos pendentes...')
    
    // Buscar transações pendentes (PIX e Boleto) dos últimos 30 minutos
    const transacoesPendentes = await Transacao.find({
      gateway_provider: 'mercado_pago',
      metodo_pagamento: { $in: ['pix', 'boleto'] },
      status: 'pendente',
      data_processamento: {
        $gte: new Date(Date.now() - 30 * 60 * 1000) // 30 minutos
      }
    })

    console.log(`📊 Encontradas ${transacoesPendentes.length} transações pendentes`)

    const resultados = []

    for (const transacao of transacoesPendentes) {
      try {
        const paymentDetails = await getPaymentDetails(transacao.payment_id)
        
        if (paymentDetails) {
          console.log(`💰 Verificando pagamento ${transacao.payment_id}:`, {
            status: paymentDetails.status,
            status_detail: paymentDetails.status_detail
          })

          // Se foi aprovado, atualizar
          if (paymentDetails.status === 'approved') {
            console.log(`✅ Pagamento aprovado: ${transacao.payment_id}`)
            
            // Atualizar transação
            transacao.status = 'aprovado'
            transacao.status_detalhado = paymentDetails.status_detail
            transacao.data_confirmacao = new Date()
            
            // Adicionar log
            if (!transacao.webhook_data) {
              transacao.webhook_data = []
            }
            
            transacao.webhook_data.push({
              timestamp: new Date(),
              provider: 'mercado_pago',
              event_type: 'payment_verification',
              action: 'payment.approved',
              data: paymentDetails
            })

            await transacao.save()

            // Atualizar FinanceiroMorador
            const financeiro = await FinanceiroMorador.findById(transacao.origem_id)
            if (financeiro) {
              financeiro.status = 'pago'
              financeiro.data_pagamento = new Date()
              financeiro.data_atualizacao = new Date()
              financeiro.transacao_id = transacao._id
              financeiro.metodo_pagamento = transacao.metodo_pagamento
              
              await financeiro.save()
              
              console.log(`✅ FinanceiroMorador atualizado: ${financeiro._id}`)
              
              resultados.push({
                transacao_id: transacao.id_transacao,
                payment_id: transacao.payment_id,
                status: 'aprovado',
                financeiro_atualizado: true
              })
            }
          }
        }
      } catch (error) {
        console.error(`❌ Erro ao verificar pagamento ${transacao.payment_id}:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      verificadas: transacoesPendentes.length,
      aprovadas: resultados.length,
      resultados: resultados
    })

  } catch (error) {
    console.error('❌ Erro ao verificar pagamentos:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
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