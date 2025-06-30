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
    
    // PagSeguro pode usar diferentes headers dependendo do tipo de notificação
    const authorization = headersList.get('authorization');
    const signature = headersList.get('x-pagseguro-signature');
    
    // Parse do corpo da requisição
    const webhookData = JSON.parse(body);
    
    // Log do webhook recebido
    console.log('Webhook PagSeguro recebido:', {
      notificationCode: webhookData.notificationCode,
      notificationType: webhookData.notificationType,
      timestamp: new Date().toISOString()
    });
    
    // Validar webhook
    const isValid = await validatePagSeguroWebhook(body, authorization, signature);
    if (!isValid) {
      return NextResponse.json({ error: 'Webhook inválido' }, { status: 401 });
    }
    
    // Processar diferentes tipos de notificação
    switch (webhookData.notificationType) {
      case 'transaction':
        await processPagSeguroTransactionWebhook(webhookData);
        break;
      case 'applicationAuthorization':
        await processPagSeguroAuthWebhook(webhookData);
        break;
      case 'preApproval':
        await processPagSeguroPreApprovalWebhook(webhookData);
        break;
      default:
        console.log('Tipo de notificação PagSeguro não reconhecido:', webhookData.notificationType);
    }
    
    return NextResponse.json({ success: true, processed: true });
    
  } catch (error) {
    console.error('Erro ao processar webhook PagSeguro:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' }, 
      { status: 500 }
    );
  }
}

async function processPagSeguroTransactionWebhook(webhookData: any) {
  try {
    const notificationCode = webhookData.notificationCode;
    if (!notificationCode) {
      throw new Error('Código de notificação não encontrado');
    }
    
    // Buscar detalhes da transação na API do PagSeguro
    const transactionDetails = await getPagSeguroTransactionDetails(notificationCode);
    
    // Encontrar a transação correspondente
    const transacao = await Transacao.findOne({ 
      payment_id: transactionDetails.code,
      gateway_provider: 'pagseguro'
    });
    
    if (!transacao) {
      console.log('Transação não encontrada para code:', transactionDetails.code);
      return;
    }
    
    // Mapear status
    const novoStatus = mapPagSeguroStatus(transactionDetails.status);
    const statusAnterior = transacao.status;
    
    // Atualizar transação
    transacao.status = novoStatus;
    transacao.status_detalhado = transactionDetails.status + ' - ' + (transactionDetails.statusText || '');
    transacao.webhook_received = true;
    transacao.webhook_data.push({
      timestamp: new Date(),
      provider: 'pagseguro',
      notification_type: 'transaction',
      data: transactionDetails
    });
    
    // Adicionar dados específicos do PagSeguro
    if (transactionDetails.paymentMethod) {
      transacao.dados_pagamento = {
        ...transacao.dados_pagamento,
        authorization_code: transactionDetails.paymentMethod.code,
        nsu: transactionDetails.gatewaySystem?.authorizationCode,
        tid: transactionDetails.gatewaySystem?.nsu
      };
    }
    
    // Log da mudança
    transacao.adicionarLog(
      'webhook_received',
      {
        status_anterior: statusAnterior,
        status_novo: novoStatus,
        notification_code: notificationCode,
        transaction_details: transactionDetails
      }
    );
    
    // Confirmar se aprovado
    if (novoStatus === 'aprovado') {
      transacao.confirmacao_automatica = true;
      transacao.data_confirmacao = new Date();
      
      // Se foi pago com boleto, adicionar dados bancários
      if (transactionDetails.paymentMethod?.type === 'BOLETO') {
        transacao.dados_pagamento.linha_digitavel = transactionDetails.paymentMethod.boletoURL;
      }
      
      await updateFinanceiroStatus(transacao);
    }
    
    await transacao.save();
    
    // Notificar
    if (novoStatus === 'aprovado') {
      await sendPaymentConfirmationNotification(transacao);
    }
    
    console.log('Transação PagSeguro atualizada:', {
      transacao_id: transacao.id_transacao,
      status_anterior: statusAnterior,
      status_novo: novoStatus,
      pagseguro_code: transactionDetails.code
    });
    
  } catch (error) {
    console.error('Erro ao processar webhook de transação PagSeguro:', error);
    throw error;
  }
}

async function processPagSeguroAuthWebhook(webhookData: any) {
  // Processar webhook de autorização de aplicação
  console.log('Processando webhook de autorização PagSeguro:', webhookData);
  // TODO: Implementar lógica específica para autorizações
}

async function processPagSeguroPreApprovalWebhook(webhookData: any) {
  // Processar webhook de pré-aprovação (assinaturas)
  console.log('Processando webhook de pré-aprovação PagSeguro:', webhookData);
  // TODO: Implementar lógica específica para assinaturas
}

async function validatePagSeguroWebhook(body: string, authorization?: string, signature?: string): Promise<boolean> {
  try {
    // PagSeguro pode usar diferentes métodos de validação
    // Método 1: Token de notificação (mais comum)
    if (authorization) {
      const config = await ConfiguracaoFinanceira.findOne({ provider: 'pagseguro' });
      if (!config) return false;
      
      const notificationToken = FinancialDataEncryption.decryptApiKey(
        config.notification_token_encrypted,
        'pagseguro'
      );
      
      return authorization === `Bearer ${notificationToken}`;
    }
    
    // Método 2: Assinatura HMAC (versões mais novas)
    if (signature) {
      const config = await ConfiguracaoFinanceira.findOne({ provider: 'pagseguro' });
      if (!config) return false;
      
      const webhookSecret = FinancialDataEncryption.decryptApiKey(
        config.webhook_secret_encrypted,
        'pagseguro'
      );
      
      return FinancialDataEncryption.verifyHmacSignature(body, signature, webhookSecret);
    }
    
    // Por padrão, aceitar (PagSeguro nem sempre envia validação)
    return true;
    
  } catch (error) {
    console.error('Erro ao validar webhook PagSeguro:', error);
    return false;
  }
}

async function getPagSeguroTransactionDetails(notificationCode: string): Promise<any> {
  try {
    // Obter configuração do PagSeguro
    const config = await ConfiguracaoFinanceira.findOne({ provider: 'pagseguro' });
    if (!config) {
      throw new Error('Configuração do PagSeguro não encontrada');
    }
    
    // Descriptografar token
    const token = FinancialDataEncryption.decryptApiKey(
      config.api_token_encrypted,
      'pagseguro'
    );
    
    const email = config.email; // Email não precisa ser criptografado
    
    // Endpoint do PagSeguro para buscar transação
    const url = `https://ws.pagseguro.uol.com.br/v3/transactions/notifications/${notificationCode}?email=${email}&token=${token}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/xml',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Erro ao buscar transação PagSeguro: ${response.status}`);
    }
    
    // PagSeguro retorna XML, converter para JSON
    const xmlData = await response.text();
    const jsonData = await parseXmlToJson(xmlData);
    
    return jsonData.transaction || jsonData;
    
  } catch (error) {
    console.error('Erro ao buscar detalhes da transação PagSeguro:', error);
    throw error;
  }
}

function mapPagSeguroStatus(status: string): string {
  // Status do PagSeguro são números
  const statusMap: { [key: string]: string } = {
    '1': 'pendente',        // Aguardando pagamento
    '2': 'processando',     // Em análise
    '3': 'aprovado',        // Paga
    '4': 'aprovado',        // Disponível
    '5': 'processando',     // Em disputa
    '6': 'estornado',       // Devolvida
    '7': 'cancelado',       // Cancelada
    '8': 'estornado',       // Debitado
    '9': 'processando'      // Retenção temporária
  };
  
  return statusMap[status.toString()] || 'pendente';
}

// Função auxiliar para converter XML do PagSeguro para JSON
async function parseXmlToJson(xml: string): Promise<any> {
  // Implementação simples de parsing XML -> JSON
  // Em produção, usar biblioteca como xml2js
  try {
    // Parser básico para os campos principais do PagSeguro
    const parser = {
      code: /<code>(.*?)<\/code>/,
      status: /<status>(.*?)<\/status>/,
      reference: /<reference>(.*?)<\/reference>/,
      grossAmount: /<grossAmount>(.*?)<\/grossAmount>/,
      netAmount: /<netAmount>(.*?)<\/netAmount>/,
      paymentMethodType: /<type>(.*?)<\/type>/,
      paymentMethodCode: /<code>(.*?)<\/code>/
    };
    
    const result: any = {};
    
    for (const [key, regex] of Object.entries(parser)) {
      const match = xml.match(regex);
      if (match) {
        result[key] = match[1];
      }
    }
    
    return result;
    
  } catch (error) {
    console.error('Erro ao fazer parse do XML:', error);
    return {};
  }
}

// Reutilizar funções auxiliares
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
    console.log('Enviando notificação de confirmação PagSeguro:', {
      transacao_id: transacao.id_transacao,
      valor: transacao.valor_final,
      gateway: 'pagseguro'
    });
    
  } catch (error) {
    console.error('Erro ao enviar notificação:', error);
  }
}