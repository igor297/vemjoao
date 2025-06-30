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
    
    // Validação da assinatura do webhook Stone
    const signature = headersList.get('stone-signature');
    const timestamp = headersList.get('stone-timestamp');
    
    if (!signature || !timestamp) {
      return NextResponse.json({ error: 'Headers de validação não encontrados' }, { status: 401 });
    }
    
    // Verificar se o timestamp não é muito antigo (5 minutos)
    const webhookTime = parseInt(timestamp);
    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime - webhookTime > 300) {
      return NextResponse.json({ error: 'Webhook expirado' }, { status: 401 });
    }
    
    // Validar assinatura
    const isValidSignature = await validateStoneSignature(body, signature, timestamp);
    if (!isValidSignature) {
      return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 });
    }
    
    // Parse do corpo da requisição
    const webhookData = JSON.parse(body);
    
    // Log do webhook recebido
    console.log('Webhook Stone recebido:', {
      event_type: webhookData.event_type,
      resource_id: webhookData.resource?.id,
      timestamp: new Date().toISOString()
    });
    
    // Processar diferentes tipos de evento
    switch (webhookData.event_type) {
      case 'payment.approved':
      case 'payment.declined':
      case 'payment.refunded':
      case 'payment.chargeback':
        await processStonePaymentWebhook(webhookData);
        break;
      case 'pix.received':
        await processStonePixWebhook(webhookData);
        break;
      case 'boleto.paid':
      case 'boleto.expired':
        await processStoneBoletoWebhook(webhookData);
        break;
      default:
        console.log('Tipo de evento Stone não reconhecido:', webhookData.event_type);
    }
    
    return NextResponse.json({ success: true, processed: true });
    
  } catch (error) {
    console.error('Erro ao processar webhook Stone:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' }, 
      { status: 500 }
    );
  }
}

async function processStonePaymentWebhook(webhookData: any) {
  try {
    const paymentId = webhookData.resource?.id;
    if (!paymentId) {
      throw new Error('ID do pagamento não encontrado');
    }
    
    // Buscar a transação correspondente
    const transacao = await Transacao.findOne({ 
      payment_id: paymentId.toString(),
      gateway_provider: 'stone'
    });
    
    if (!transacao) {
      console.log('Transação não encontrada para payment_id:', paymentId);
      return;
    }
    
    // Mapear status
    const novoStatus = mapStoneEventToStatus(webhookData.event_type);
    const statusAnterior = transacao.status;
    
    // Atualizar transação
    transacao.status = novoStatus;
    transacao.status_detalhado = webhookData.resource?.status_reason || webhookData.event_type;
    transacao.webhook_received = true;
    transacao.webhook_data.push({
      timestamp: new Date(),
      provider: 'stone',
      event_type: webhookData.event_type,
      data: webhookData.resource
    });
    
    // Adicionar dados específicos do Stone
    if (webhookData.resource) {
      const resource = webhookData.resource;
      transacao.dados_pagamento = {
        ...transacao.dados_pagamento,
        nsu: resource.nsu,
        tid: resource.tid,
        authorization_code: resource.authorization_code,
        acquirer_response_code: resource.acquirer_response_code
      };
    }
    
    // Log da mudança
    transacao.adicionarLog(
      'webhook_received',
      {
        status_anterior: statusAnterior,
        status_novo: novoStatus,
        event_type: webhookData.event_type,
        resource: webhookData.resource
      }
    );
    
    // Confirmar se aprovado
    if (novoStatus === 'aprovado') {
      transacao.confirmacao_automatica = true;
      transacao.data_confirmacao = new Date();
      await updateFinanceiroStatus(transacao);
    }
    
    await transacao.save();
    
    // Notificar se aprovado
    if (novoStatus === 'aprovado') {
      await sendPaymentConfirmationNotification(transacao);
    }
    
    console.log('Transação Stone atualizada:', {
      transacao_id: transacao.id_transacao,
      status_anterior: statusAnterior,
      status_novo: novoStatus,
      event_type: webhookData.event_type
    });
    
  } catch (error) {
    console.error('Erro ao processar webhook de pagamento Stone:', error);
    throw error;
  }
}

async function processStonePixWebhook(webhookData: any) {
  try {
    const pixId = webhookData.resource?.id;
    if (!pixId) {
      throw new Error('ID do PIX não encontrado');
    }
    
    // Buscar transação por dados PIX
    const transacao = await Transacao.findOne({ 
      'dados_pagamento.qr_code': { $exists: true },
      gateway_provider: 'stone',
      status: { $in: ['pendente', 'processando'] }
    });
    
    if (!transacao) {
      console.log('Transação PIX não encontrada:', pixId);
      return;
    }
    
    // Verificar se o valor confere
    const valorRecebido = webhookData.resource?.amount;
    if (valorRecebido && Math.abs(valorRecebido - transacao.valor_final) > 0.01) {
      console.warn('Valor PIX divergente:', {
        esperado: transacao.valor_final,
        recebido: valorRecebido
      });
    }
    
    // Atualizar transação
    transacao.status = 'aprovado';
    transacao.webhook_received = true;
    transacao.confirmacao_automatica = true;
    transacao.data_confirmacao = new Date();
    
    transacao.webhook_data.push({
      timestamp: new Date(),
      provider: 'stone',
      event_type: 'pix.received',
      data: webhookData.resource
    });
    
    transacao.adicionarLog('pix_received', {
      pix_id: pixId,
      valor_recebido: valorRecebido,
      resource: webhookData.resource
    });
    
    await transacao.save();
    await updateFinanceiroStatus(transacao);
    await sendPaymentConfirmationNotification(transacao);
    
    console.log('PIX Stone confirmado:', {
      transacao_id: transacao.id_transacao,
      pix_id: pixId,
      valor: valorRecebido
    });
    
  } catch (error) {
    console.error('Erro ao processar webhook PIX Stone:', error);
    throw error;
  }
}

async function processStoneBoletoWebhook(webhookData: any) {
  try {
    const boletoId = webhookData.resource?.id;
    if (!boletoId) {
      throw new Error('ID do boleto não encontrado');
    }
    
    // Buscar transação por boleto
    const transacao = await Transacao.findOne({ 
      payment_id: boletoId.toString(),
      gateway_provider: 'stone',
      metodo_pagamento: 'boleto'
    });
    
    if (!transacao) {
      console.log('Transação de boleto não encontrada:', boletoId);
      return;
    }
    
    const novoStatus = webhookData.event_type === 'boleto.paid' ? 'aprovado' : 'expirado';
    const statusAnterior = transacao.status;
    
    transacao.status = novoStatus;
    transacao.webhook_received = true;
    
    if (novoStatus === 'aprovado') {
      transacao.confirmacao_automatica = true;
      transacao.data_confirmacao = new Date();
    }
    
    transacao.webhook_data.push({
      timestamp: new Date(),
      provider: 'stone',
      event_type: webhookData.event_type,
      data: webhookData.resource
    });
    
    transacao.adicionarLog('boleto_webhook', {
      status_anterior: statusAnterior,
      status_novo: novoStatus,
      event_type: webhookData.event_type,
      resource: webhookData.resource
    });
    
    await transacao.save();
    
    if (novoStatus === 'aprovado') {
      await updateFinanceiroStatus(transacao);
      await sendPaymentConfirmationNotification(transacao);
    }
    
    console.log('Boleto Stone atualizado:', {
      transacao_id: transacao.id_transacao,
      status_anterior: statusAnterior,
      status_novo: novoStatus
    });
    
  } catch (error) {
    console.error('Erro ao processar webhook de boleto Stone:', error);
    throw error;
  }
}

async function validateStoneSignature(body: string, signature: string, timestamp: string): Promise<boolean> {
  try {
    // Obter configuração do Stone
    const config = await ConfiguracaoFinanceira.findOne({ provider: 'stone' });
    if (!config) {
      throw new Error('Configuração do Stone não encontrada');
    }
    
    // Descriptografar webhook secret
    const webhookSecret = FinancialDataEncryption.decryptApiKey(
      config.webhook_secret_encrypted,
      'stone'
    );
    
    // Criar payload para validação (timestamp + body)
    const payload = timestamp + '.' + body;
    
    // Validar assinatura
    return FinancialDataEncryption.verifyHmacSignature(payload, signature, webhookSecret);
    
  } catch (error) {
    console.error('Erro ao validar assinatura Stone:', error);
    return false;
  }
}

function mapStoneEventToStatus(eventType: string): string {
  const statusMap: { [key: string]: string } = {
    'payment.approved': 'aprovado',
    'payment.declined': 'rejeitado',
    'payment.refunded': 'estornado',
    'payment.chargeback': 'estornado',
    'pix.received': 'aprovado',
    'boleto.paid': 'aprovado',
    'boleto.expired': 'expirado'
  };
  
  return statusMap[eventType] || 'pendente';
}

// Reutilizar funções auxiliares do webhook do Mercado Pago
async function updateFinanceiroStatus(transacao: any) {
  try {
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
    
    const financeiro = await FinanceiroModel.findById(transacao.origem_id);
    if (financeiro) {
      financeiro.status = 'pago';
      financeiro.data_pagamento = new Date();
      financeiro.transacao_id = transacao._id;
      await financeiro.save();
    }
    
  } catch (error) {
    console.error('Erro ao atualizar status do financeiro:', error);
  }
}

async function sendPaymentConfirmationNotification(transacao: any) {
  try {
    console.log('Enviando notificação de confirmação Stone:', {
      transacao_id: transacao.id_transacao,
      valor: transacao.valor_final,
      gateway: 'stone'
    });
    
  } catch (error) {
    console.error('Erro ao enviar notificação:', error);
  }
}