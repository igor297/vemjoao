import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import dbConnect from '@/lib/mongodb';
import Transacao from '@/models/Transacao';
import ConfiguracaoFinanceira from '@/models/ConfiguracaoFinanceira';
import FinancialDataEncryption from '@/lib/encryption';

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const body = await request.text();
    const headersList = headers();
    
    // Validação da assinatura do webhook
    const signature = headersList.get('x-signature');
    const requestId = headersList.get('x-request-id');
    
    if (!signature) {
      return NextResponse.json({ error: 'Assinatura não encontrada' }, { status: 401 });
    }
    
    // Parse do corpo da requisição
    const webhookData = JSON.parse(body);
    
    // Log do webhook recebido
    console.log('Webhook Mercado Pago recebido:', {
      id: webhookData.id,
      type: webhookData.type,
      action: webhookData.action,
      timestamp: new Date().toISOString()
    });
    
    // Processa diferentes tipos de notificação
    switch (webhookData.type) {
      case 'payment':
        await processPaymentWebhook(webhookData, body, signature);
        break;
      case 'merchant_order':
        await processMerchantOrderWebhook(webhookData);
        break;
      case 'point_integration_wh':
        await processPointIntegrationWebhook(webhookData);
        break;
      default:
        console.log('Tipo de webhook não reconhecido:', webhookData.type);
    }
    
    return NextResponse.json({ success: true, processed: true });
    
  } catch (error) {
    console.error('Erro ao processar webhook Mercado Pago:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' }, 
      { status: 500 }
    );
  }
}

async function processPaymentWebhook(webhookData: any, body: string, signature: string) {
  try {
    // Validar assinatura
    const isValidSignature = await validateMercadoPagoSignature(body, signature);
    if (!isValidSignature) {
      throw new Error('Assinatura inválida');
    }
    
    const paymentId = webhookData.data?.id;
    if (!paymentId) {
      throw new Error('ID do pagamento não encontrado');
    }
    
    // Buscar detalhes do pagamento na API do Mercado Pago
    const paymentDetails = await getMercadoPagoPaymentDetails(paymentId);
    
    // Encontrar a transação correspondente
    const transacao = await Transacao.findOne({ 
      payment_id: paymentId.toString(),
      gateway_provider: 'mercado_pago'
    });
    
    if (!transacao) {
      console.log('Transação não encontrada para payment_id:', paymentId);
      return;
    }
    
    // Atualizar status da transação
    const novoStatus = mapMercadoPagoStatus(paymentDetails.status);
    const statusAnterior = transacao.status;
    
    transacao.status = novoStatus;
    transacao.status_detalhado = paymentDetails.status_detail;
    transacao.webhook_received = true;
    transacao.webhook_data.push({
      timestamp: new Date(),
      provider: 'mercado_pago',
      event_type: webhookData.type,
      action: webhookData.action,
      data: paymentDetails
    });
    
    // Adicionar dados específicos do pagamento
    if (paymentDetails.transaction_details) {
      transacao.dados_pagamento = {
        ...transacao.dados_pagamento,
        nsu: paymentDetails.transaction_details.acquirer_reference,
        tid: paymentDetails.transaction_details.financial_institution,
        authorization_code: paymentDetails.authorization_code
      };
    }
    
    // Log da mudança de status
    transacao.adicionarLog(
      'webhook_received',
      {
        status_anterior: statusAnterior,
        status_novo: novoStatus,
        payment_details: paymentDetails,
        webhook_data: webhookData
      }
    );
    
    // Confirmar automaticamente se aprovado
    if (novoStatus === 'aprovado') {
      transacao.confirmacao_automatica = true;
      transacao.data_confirmacao = new Date();
      
      // Atualizar o financeiro original
      await updateFinanceiroStatus(transacao);
    }
    
    await transacao.save();
    
    // Enviar notificação ao morador
    if (novoStatus === 'aprovado') {
      await sendPaymentConfirmationNotification(transacao);
    }
    
    console.log('Transação atualizada via webhook:', {
      transacao_id: transacao.id_transacao,
      status_anterior: statusAnterior,
      status_novo: novoStatus,
      payment_id: paymentId
    });
    
  } catch (error) {
    console.error('Erro ao processar webhook de pagamento:', error);
    throw error;
  }
}

async function processMerchantOrderWebhook(webhookData: any) {
  // Processar webhook de merchant order
  console.log('Processando merchant order webhook:', webhookData);
  // TODO: Implementar lógica específica para merchant orders
}

async function processPointIntegrationWebhook(webhookData: any) {
  // Processar webhook de integração de ponto
  console.log('Processando point integration webhook:', webhookData);
  // TODO: Implementar lógica específica para point integration
}

async function validateMercadoPagoSignature(body: string, signature: string): Promise<boolean> {
  try {
    // Obter configuração do Mercado Pago
    const config = await ConfiguracaoFinanceira.findOne({ provider: 'mercado_pago' });
    if (!config) {
      throw new Error('Configuração do Mercado Pago não encontrada');
    }
    
    // Descriptografar webhook secret
    const webhookSecret = FinancialDataEncryption.decryptApiKey(
      config.webhook_secret_encrypted,
      'mercado_pago'
    );
    
    // Validar assinatura
    return FinancialDataEncryption.verifyHmacSignature(body, signature, webhookSecret);
    
  } catch (error) {
    console.error('Erro ao validar assinatura:', error);
    return false;
  }
}

async function getMercadoPagoPaymentDetails(paymentId: string): Promise<any> {
  try {
    // Obter configuração do Mercado Pago
    const config = await ConfiguracaoFinanceira.findOne({ provider: 'mercado_pago' });
    if (!config) {
      throw new Error('Configuração do Mercado Pago não encontrada');
    }
    
    // Descriptografar access token
    const accessToken = FinancialDataEncryption.decryptApiKey(
      config.access_token_encrypted,
      'mercado_pago'
    );
    
    // Fazer requisição para API do Mercado Pago
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Erro ao buscar detalhes do pagamento: ${response.status}`);
    }
    
    return await response.json();
    
  } catch (error) {
    console.error('Erro ao buscar detalhes do pagamento:', error);
    throw error;
  }
}

function mapMercadoPagoStatus(mpStatus: string): string {
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
  };
  
  return statusMap[mpStatus] || 'pendente';
}

async function updateFinanceiroStatus(transacao: any) {
  try {
    // Determinar o modelo correto com base no tipo de origem
    let FinanceiroModel;
    switch (transacao.tipo_origem) {
      case 'financeiro_morador':
        FinanceiroModel = (await import('@/models/FinanceiroMorador')).default;
        break;
      case 'financeiro_condominio':
        FinanceiroModel = (await import('@/models/FinanceiroCondominio')).default;
        break;
      case 'financeiro_colaborador':
        FinanceiroModel = (await import('@/models/FinanceiroColaborador')).default;
        break;
      default:
        throw new Error('Tipo de origem não reconhecido');
    }
    
    // Atualizar status do financeiro original
    const financeiro = await FinanceiroModel.findById(transacao.origem_id);
    if (financeiro) {
      financeiro.status = 'pago';
      financeiro.data_pagamento = new Date();
      financeiro.transacao_id = transacao._id;
      await financeiro.save();
      
      console.log('Status do financeiro atualizado:', {
        financeiro_id: financeiro._id,
        tipo: transacao.tipo_origem,
        transacao_id: transacao.id_transacao
      });
    }
    
  } catch (error) {
    console.error('Erro ao atualizar status do financeiro:', error);
  }
}

async function sendPaymentConfirmationNotification(transacao: any) {
  try {
    // TODO: Implementar serviço de notificações
    console.log('Enviando notificação de confirmação de pagamento:', {
      transacao_id: transacao.id_transacao,
      valor: transacao.valor_final,
      condominio_id: transacao.condominio_id
    });
    
    // Aqui seria integrado com serviço de email/SMS/push notification
    
  } catch (error) {
    console.error('Erro ao enviar notificação:', error);
  }
}