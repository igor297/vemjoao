import WebhookRetry, { IWebhookRetry } from '@/models/WebhookRetry';
import Transacao from '@/models/Transacao';
import connectDB from '@/lib/mongodb';

export interface WebhookRetryData {
  webhook_id: string;
  provider: 'mercado_pago' | 'stone' | 'pagseguro';
  webhook_type: string;
  payload: any;
  headers: Record<string, string>;
  signature?: string;
  request_id?: string;
  condominio_id?: string;
  transacao_id?: string;
  metadata?: any;
}

export class WebhookRetryService {
  
  /**
   * Cria uma nova entrada para retry de webhook
   */
  static async criarRetry(data: WebhookRetryData): Promise<IWebhookRetry> {
    await connectDB();
    
    const webhookRetry = new WebhookRetry({
      webhook_id: data.webhook_id,
      provider: data.provider,
      webhook_type: data.webhook_type,
      payload: data.payload,
      headers: data.headers,
      signature: data.signature,
      request_id: data.request_id,
      condominio_id: data.condominio_id,
      transacao_id: data.transacao_id,
      metadata: data.metadata || {}
    });
    
    // Calcular primeira tentativa (imediata)
    webhookRetry.proxima_tentativa = new Date();
    
    return await webhookRetry.save();
  }
  
  /**
   * Processa um webhook com sistema de retry
   */
  static async processarWebhook(
    webhookData: WebhookRetryData,
    processFunction: (payload: any, headers: Record<string, string>) => Promise<any>
  ): Promise<{ sucesso: boolean; retry_id?: string; erro?: string }> {
    
    let webhookRetry: IWebhookRetry | null = null;
    const startTime = Date.now();
    
    try {
      // Tentar processar diretamente primeiro
      const resultado = await processFunction(webhookData.payload, webhookData.headers);
      
      console.log('Webhook processado com sucesso:', {
        webhook_id: webhookData.webhook_id,
        provider: webhookData.provider,
        duracao_ms: Date.now() - startTime
      });
      
      return { sucesso: true };
      
    } catch (error: any) {
      console.error('Erro ao processar webhook:', {
        webhook_id: webhookData.webhook_id,
        provider: webhookData.provider,
        erro: error.message,
        duracao_ms: Date.now() - startTime
      });
      
      // Criar entrada para retry
      webhookRetry = await this.criarRetry(webhookData);
      
      // Adicionar log da primeira tentativa
      webhookRetry.adicionarLogTentativa(
        false, 
        error.message, 
        Date.now() - startTime
      );
      
      webhookRetry.tentativas = 1;
      webhookRetry.ultimo_erro = error.message;
      webhookRetry.stack_trace = error.stack;
      webhookRetry.ultimo_processamento = new Date();
      
      // Calcular próxima tentativa
      webhookRetry.calcularProximaTentativa();
      
      await webhookRetry.save();
      
      return { 
        sucesso: false, 
        retry_id: webhookRetry._id.toString(),
        erro: error.message 
      };
    }
  }
  
  /**
   * Busca webhooks prontos para retry
   */
  static async buscarWebhooksParaRetry(limite: number = 50): Promise<IWebhookRetry[]> {
    await connectDB();
    
    return await WebhookRetry.find({
      status: 'pendente',
      proxima_tentativa: { $lte: new Date() },
      tentativas: { $lt: 5 } // Max 5 tentativas por padrão
    })
    .sort({ proxima_tentativa: 1 })
    .limit(limite);
  }
  
  /**
   * Executa retry de um webhook específico
   */
  static async executarRetry(
    webhookRetry: IWebhookRetry,
    processFunction: (payload: any, headers: Record<string, string>) => Promise<any>
  ): Promise<boolean> {
    
    const startTime = Date.now();
    
    try {
      // Marcar como processando
      webhookRetry.status = 'processando';
      await webhookRetry.save();
      
      // Tentar processar
      const resultado = await processFunction(webhookRetry.payload, webhookRetry.headers);
      
      // Sucesso - marcar como concluído
      webhookRetry.marcarSucesso();
      webhookRetry.adicionarLogTentativa(
        true, 
        undefined, 
        Date.now() - startTime
      );
      
      await webhookRetry.save();
      
      console.log('Webhook retry bem sucedido:', {
        webhook_id: webhookRetry.webhook_id,
        tentativa: webhookRetry.tentativas + 1,
        duracao_ms: Date.now() - startTime
      });
      
      return true;
      
    } catch (error: any) {
      // Incrementar tentativas
      webhookRetry.tentativas += 1;
      webhookRetry.ultimo_erro = error.message;
      webhookRetry.stack_trace = error.stack;
      webhookRetry.ultimo_processamento = new Date();
      webhookRetry.status = 'pendente';
      
      // Adicionar log da tentativa
      webhookRetry.adicionarLogTentativa(
        false, 
        error.message, 
        Date.now() - startTime
      );
      
      // Verificar se atingiu máximo de tentativas
      if (webhookRetry.tentativas >= webhookRetry.max_tentativas) {
        webhookRetry.marcarFalhaPermanente(error.message);
        
        console.error('Webhook atingiu máximo de tentativas:', {
          webhook_id: webhookRetry.webhook_id,
          tentativas: webhookRetry.tentativas,
          ultimo_erro: error.message
        });
        
        // Enviar alerta para administradores
        await this.enviarAlertaFalhaPermanente(webhookRetry);
        
      } else {
        // Calcular próxima tentativa com backoff exponencial
        webhookRetry.calcularProximaTentativa();
        
        console.log('Webhook agendado para retry:', {
          webhook_id: webhookRetry.webhook_id,
          tentativa: webhookRetry.tentativas,
          proxima_tentativa: webhookRetry.proxima_tentativa
        });
      }
      
      await webhookRetry.save();
      return false;
    }
  }
  
  /**
   * Executa batch de retries pendentes
   */
  static async executarBatchRetries(
    processFunction: (payload: any, headers: Record<string, string>, provider: string) => Promise<any>
  ): Promise<{ processados: number; sucessos: number; falhas: number }> {
    
    const webhooks = await this.buscarWebhooksParaRetry();
    let sucessos = 0;
    let falhas = 0;
    
    console.log(`Iniciando batch de ${webhooks.length} webhook retries`);
    
    for (const webhook of webhooks) {
      try {
        const sucesso = await this.executarRetry(
          webhook, 
          (payload, headers) => processFunction(payload, headers, webhook.provider)
        );
        
        if (sucesso) {
          sucessos++;
        } else {
          falhas++;
        }
        
        // Pequena pausa entre processamentos para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error('Erro no batch retry:', error);
        falhas++;
      }
    }
    
    console.log(`Batch concluído: ${sucessos} sucessos, ${falhas} falhas`);
    
    return {
      processados: webhooks.length,
      sucessos,
      falhas
    };
  }
  
  /**
   * Envia alerta para administradores sobre falha permanente
   */
  private static async enviarAlertaFalhaPermanente(webhookRetry: IWebhookRetry): Promise<void> {
    try {
      // Aqui você pode integrar com seu sistema de notificações
      // Email, Slack, Discord, etc.
      
      console.error('ALERTA: Webhook falha permanente:', {
        webhook_id: webhookRetry.webhook_id,
        provider: webhookRetry.provider,
        webhook_type: webhookRetry.webhook_type,
        tentativas: webhookRetry.tentativas,
        ultimo_erro: webhookRetry.ultimo_erro,
        condominio_id: webhookRetry.condominio_id,
        transacao_id: webhookRetry.transacao_id
      });
      
      // TODO: Implementar notificação real para administradores
      
    } catch (error) {
      console.error('Erro ao enviar alerta de falha permanente:', error);
    }
  }
  
  /**
   * Limpa webhooks antigos já processados
   */
  static async limparWebhooksAntigos(diasRetencao: number = 30): Promise<number> {
    await connectDB();
    
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - diasRetencao);
    
    const resultado = await WebhookRetry.deleteMany({
      $or: [
        { status: 'sucesso', data_sucesso: { $lt: dataLimite } },
        { status: 'falha_permanente', ultimo_processamento: { $lt: dataLimite } }
      ]
    });
    
    console.log(`Webhooks antigos removidos: ${resultado.deletedCount}`);
    return resultado.deletedCount;
  }
  
  /**
   * Obtém estatísticas de webhooks
   */
  static async obterEstatisticas(): Promise<{
    total: number;
    pendentes: number;
    sucessos: number;
    falhas_permanentes: number;
    taxa_sucesso: number;
  }> {
    await connectDB();
    
    const stats = await WebhookRetry.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const estatisticas = {
      total: 0,
      pendentes: 0,
      sucessos: 0,
      falhas_permanentes: 0,
      taxa_sucesso: 0
    };
    
    stats.forEach(stat => {
      estatisticas.total += stat.count;
      
      switch (stat._id) {
        case 'pendente':
        case 'processando':
          estatisticas.pendentes += stat.count;
          break;
        case 'sucesso':
          estatisticas.sucessos += stat.count;
          break;
        case 'falha_permanente':
          estatisticas.falhas_permanentes += stat.count;
          break;
      }
    });
    
    if (estatisticas.total > 0) {
      estatisticas.taxa_sucesso = (estatisticas.sucessos / estatisticas.total) * 100;
    }
    
    return estatisticas;
  }
}