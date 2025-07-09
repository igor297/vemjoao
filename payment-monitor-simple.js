const connectDB = require('./src/lib/mongodb').default;
const mongoose = require('mongoose');
const { EventEmitter } = require('events');

// Configuração do monitor
const MONITOR_CONFIG = {
  condominio_id: '684f0e3e5eb749bbecf97091',
  master_id: '684eec5c4af0e8961a18b1ff',
  interval_check: 10000, // 10 segundos
  webhook_timeout: 30000, // 30 segundos para timeout de webhook
  max_retries: 3
};

class PaymentMonitorSimple extends EventEmitter {
  constructor() {
    super();
    this.isRunning = false;
    this.intervalId = null;
    this.stats = {
      total_verificacoes: 0,
      pagamentos_processados: 0,
      webhooks_recebidos: 0,
      erros_encontrados: 0,
      ultima_verificacao: null
    };
    this.transacoesPendentes = new Map();
  }

  async iniciar() {
    if (this.isRunning) {
      console.log('⚠️  Monitor já está rodando');
      return;
    }

    console.log('🚀 Iniciando Payment Monitor Simple...');
    
    try {
      // Conectar ao banco
      await connectDB();
      console.log('✅ Conexão com MongoDB estabelecida');

      // Carregar transações pendentes
      await this.carregarTransacoesPendentes();

      // Iniciar monitoramento
      this.isRunning = true;
      this.intervalId = setInterval(() => {
        this.verificarPagamentos().catch(console.error);
      }, MONITOR_CONFIG.interval_check);

      console.log(`✅ Monitor iniciado - Verificando a cada ${MONITOR_CONFIG.interval_check}ms`);
      
      // Emitir evento de início
      this.emit('monitor_started');

    } catch (error) {
      console.error('❌ Erro ao iniciar monitor:', error);
      throw error;
    }
  }

  async parar() {
    if (!this.isRunning) {
      console.log('⚠️  Monitor já está parado');
      return;
    }

    console.log('🛑 Parando Payment Monitor...');
    
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('✅ Conexão com MongoDB fechada');
    }

    this.emit('monitor_stopped');
    console.log('✅ Monitor parado');
  }

  async carregarTransacoesPendentes() {
    try {
      const { default: Transacao } = await import('./src/models/Transacao.js');
      
      const transacoesPendentes = await Transacao.find({
        condominio_id: MONITOR_CONFIG.condominio_id,
        status: { $in: ['pendente', 'processando'] },
        data_vencimento: { $gte: new Date() }, // Não vencidas
        created_at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Últimas 24h
      }).sort({ created_at: -1 });

      this.transacoesPendentes.clear();
      transacoesPendentes.forEach(transacao => {
        this.transacoesPendentes.set(transacao.id_transacao, {
          id_transacao: transacao.id_transacao,
          payment_id: transacao.payment_id,
          gateway_provider: transacao.gateway_provider,
          metodo_pagamento: transacao.metodo_pagamento,
          valor_final: transacao.valor_final,
          status: transacao.status,
          data_criacao: transacao.data_criacao,
          data_vencimento: transacao.data_vencimento,
          tentativas_verificacao: 0,
          ultima_verificacao: null,
          webhook_received: transacao.webhook_received
        });
      });

      console.log(`📋 ${this.transacoesPendentes.size} transações pendentes carregadas`);
      
    } catch (error) {
      console.error('❌ Erro ao carregar transações pendentes:', error);
    }
  }

  async verificarPagamentos() {
    if (!this.isRunning) return;

    this.stats.total_verificacoes++;
    this.stats.ultima_verificacao = new Date();

    try {
      console.log(`🔍 Verificando ${this.transacoesPendentes.size} transações pendentes... (${new Date().toLocaleTimeString()})`);

      const verificacoes = [];
      
      for (const [transacaoId, transacao] of this.transacoesPendentes) {
        // Pular se já recebeu webhook
        if (transacao.webhook_received) continue;

        // Verificar se não passou do limite de tentativas
        if (transacao.tentativas_verificacao >= MONITOR_CONFIG.max_retries) {
          console.log(`⚠️  Transação ${transacaoId} excedeu limite de tentativas`);
          continue;
        }

        verificacoes.push(this.verificarTransacao(transacao));
      }

      if (verificacoes.length > 0) {
        await Promise.allSettled(verificacoes);
      }

      // Limpar transações antigas
      await this.limparTransacoesAntigas();

      // Mostrar estatísticas
      this.mostrarEstatisticas();

    } catch (error) {
      console.error('❌ Erro durante verificação:', error);
      this.stats.erros_encontrados++;
    }
  }

  async verificarTransacao(transacao) {
    try {
      transacao.tentativas_verificacao++;
      transacao.ultima_verificacao = new Date();

      console.log(`🔍 Verificando transação ${transacao.id_transacao} (${transacao.gateway_provider})`);

      // Consultar status na API do gateway
      const statusAtual = await this.consultarStatusGateway(transacao);

      if (statusAtual && statusAtual !== transacao.status) {
        console.log(`📈 Status atualizado: ${transacao.id_transacao} - ${transacao.status} → ${statusAtual}`);
        
        // Atualizar no banco
        await this.atualizarStatusTransacao(transacao.id_transacao, statusAtual);
        
        // Emitir evento
        this.emit('status_changed', {
          transacao_id: transacao.id_transacao,
          status_anterior: transacao.status,
          status_novo: statusAtual,
          gateway: transacao.gateway_provider
        });

        // Remover das pendentes se foi finalizada
        if (['aprovado', 'rejeitado', 'cancelado', 'estornado'].includes(statusAtual)) {
          this.transacoesPendentes.delete(transacao.id_transacao);
          this.stats.pagamentos_processados++;
        }
      }

    } catch (error) {
      console.error(`❌ Erro ao verificar transação ${transacao.id_transacao}:`, error);
      this.stats.erros_encontrados++;
    }
  }

  async consultarStatusGateway(transacao) {
    try {
      const fetch = (await import('node-fetch')).default;
      
      const response = await fetch('http://localhost:3000/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'consultar_status',
          data: {
            payment_id: transacao.payment_id,
            provider: transacao.gateway_provider,
            condominio_id: MONITOR_CONFIG.condominio_id,
            master_id: MONITOR_CONFIG.master_id
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success && result.result) {
        return result.result.status;
      }

      return null;

    } catch (error) {
      console.error(`❌ Erro ao consultar gateway para ${transacao.id_transacao}:`, error);
      return null;
    }
  }

  async atualizarStatusTransacao(transacaoId, novoStatus) {
    try {
      const { default: Transacao } = await import('./src/models/Transacao.js');
      
      const transacao = await Transacao.findOne({ id_transacao: transacaoId });
      if (!transacao) {
        throw new Error('Transação não encontrada');
      }

      const statusAnterior = transacao.status;
      transacao.status = novoStatus;
      transacao.data_processamento = new Date();

      // Adicionar log
      transacao.adicionarLog('status_updated_by_monitor', {
        status_anterior: statusAnterior,
        status_novo: novoStatus,
        verificacao_automatica: true
      });

      // Se foi aprovado, marcar como confirmado
      if (novoStatus === 'aprovado') {
        transacao.confirmacao_automatica = true;
        transacao.data_confirmacao = new Date();
      }

      await transacao.save();

      console.log(`✅ Status atualizado no banco: ${transacaoId} - ${statusAnterior} → ${novoStatus}`);

    } catch (error) {
      console.error(`❌ Erro ao atualizar status no banco:`, error);
    }
  }

  async limparTransacoesAntigas() {
    try {
      const agora = new Date();
      const limite = new Date(agora.getTime() - 24 * 60 * 60 * 1000); // 24 horas

      for (const [transacaoId, transacao] of this.transacoesPendentes) {
        if (transacao.data_criacao < limite) {
          this.transacoesPendentes.delete(transacaoId);
          console.log(`🗑️  Transação antiga removida do monitor: ${transacaoId}`);
        }
      }

    } catch (error) {
      console.error('❌ Erro ao limpar transações antigas:', error);
    }
  }

  mostrarEstatisticas() {
    console.log('\n📊 === ESTATÍSTICAS DO MONITOR ===');
    console.log(`🔢 Total de verificações: ${this.stats.total_verificacoes}`);
    console.log(`✅ Pagamentos processados: ${this.stats.pagamentos_processados}`);
    console.log(`📡 Webhooks recebidos: ${this.stats.webhooks_recebidos}`);
    console.log(`❌ Erros encontrados: ${this.stats.erros_encontrados}`);
    console.log(`📋 Transações pendentes: ${this.transacoesPendentes.size}`);
    console.log(`⏰ Última verificação: ${this.stats.ultima_verificacao?.toLocaleString()}`);
    console.log('=====================================\n');
  }

  // Método para obter estatísticas
  getStats() {
    return {
      ...this.stats,
      transacoes_pendentes: this.transacoesPendentes.size,
      is_running: this.isRunning,
      uptime: process.uptime()
    };
  }
}

// Função para iniciar o monitor
async function iniciarMonitor() {
  const monitor = new PaymentMonitorSimple();

  // Configurar eventos
  monitor.on('monitor_started', () => {
    console.log('📡 Monitor de pagamentos iniciado com sucesso');
  });

  monitor.on('monitor_stopped', () => {
    console.log('📡 Monitor de pagamentos parado');
  });

  monitor.on('status_changed', (data) => {
    console.log(`🎉 PAGAMENTO ATUALIZADO: ${data.transacao_id} - ${data.status_anterior} → ${data.status_novo}`);
  });

  // Tratar sinais do sistema
  process.on('SIGINT', async () => {
    console.log('\n🛑 Recebido SIGINT, parando monitor...');
    await monitor.parar();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Recebido SIGTERM, parando monitor...');
    await monitor.parar();
    process.exit(0);
  });

  // Iniciar monitor
  await monitor.iniciar();

  return monitor;
}

// Executar se chamado diretamente
if (require.main === module) {
  iniciarMonitor().catch(console.error);
}

module.exports = { PaymentMonitorSimple, iniciarMonitor };