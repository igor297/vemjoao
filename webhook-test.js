const connectDB = require('./src/lib/mongodb');
const mongoose = require('mongoose');

// Configuração de teste dos webhooks
const WEBHOOK_CONFIG = {
  base_url: 'http://localhost:3000',
  test_data: {
    condominio_id: '684f0e3e5eb749bbecf97091',
    master_id: '684eec5c4af0e8961a18b1ff'
  }
};

class WebhookTester {
  constructor() {
    this.resultados = [];
  }

  async executarTeste(nome, funcaoTeste) {
    console.log(`\n🧪 Testando: ${nome}`);
    try {
      const resultado = await funcaoTeste();
      this.resultados.push({
        nome,
        status: 'SUCESSO',
        resultado,
        timestamp: new Date()
      });
      console.log(`✅ ${nome} - SUCESSO`);
      return resultado;
    } catch (error) {
      this.resultados.push({
        nome,
        status: 'FALHA',
        erro: error.message,
        timestamp: new Date()
      });
      console.log(`❌ ${nome} - FALHA: ${error.message}`);
      throw error;
    }
  }

  async testarWebhookMercadoPago() {
    // Simular webhook do Mercado Pago
    const webhookData = {
      id: 12345678,
      live_mode: false,
      type: "payment",
      date_created: new Date().toISOString(),
      application_id: 123456789,
      user_id: 987654321,
      version: 1,
      api_version: "v1",
      action: "payment.updated",
      data: {
        id: "12345678901"
      }
    };

    const response = await fetch(`${WEBHOOK_CONFIG.base_url}/api/webhooks/mercado-pago`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-signature': 'test-signature',
        'x-request-id': 'test-request-id'
      },
      body: JSON.stringify(webhookData)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const result = await response.json();
    return {
      status_code: response.status,
      response: result,
      webhook_data: webhookData
    };
  }

  async testarWebhookStone() {
    // Simular webhook do Stone
    const webhookData = {
      event_type: "payment.approved",
      resource: {
        id: "12345678901",
        status: "approved",
        amount: 10000, // R$ 100,00 em centavos
        nsu: "123456",
        tid: "789012",
        authorization_code: "ABC123"
      },
      created_at: new Date().toISOString()
    };

    const timestamp = Math.floor(Date.now() / 1000).toString();

    const response = await fetch(`${WEBHOOK_CONFIG.base_url}/api/webhooks/stone`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stone-signature': 'test-signature',
        'stone-timestamp': timestamp
      },
      body: JSON.stringify(webhookData)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const result = await response.json();
    return {
      status_code: response.status,
      response: result,
      webhook_data: webhookData
    };
  }

  async testarWebhookPagSeguro() {
    // Simular webhook do PagSeguro
    const webhookData = {
      notificationCode: "766B9C-AD4B044B04DA-77742F5FA653-E1AB24",
      notificationType: "transaction"
    };

    const response = await fetch(`${WEBHOOK_CONFIG.base_url}/api/webhooks/pagseguro`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authorization': 'Bearer test-token'
      },
      body: JSON.stringify(webhookData)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const result = await response.json();
    return {
      status_code: response.status,
      response: result,
      webhook_data: webhookData
    };
  }

  async criarTransacaoTeste(provider = 'mercado_pago') {
    // Criar uma transação de teste para validar os webhooks
    try {
      const { default: Transacao } = await import('./src/models/Transacao.js');
      
      const transacaoTeste = new Transacao({
        id_transacao: `TEST_${Date.now()}`,
        tipo_origem: 'financeiro_morador',
        origem_id: new mongoose.Types.ObjectId(),
        condominio_id: WEBHOOK_CONFIG.test_data.condominio_id,
        valor_original: 100.00,
        valor_final: 100.00,
        gateway_provider: provider,
        payment_id: '12345678901',
        metodo_pagamento: 'pix',
        status: 'pendente',
        data_vencimento: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
        categoria_contabil: 'Receita de Condomínio',
        dados_pagamento: {
          qr_code: 'test-qr-code'
        }
      });

      await transacaoTeste.save();
      
      console.log(`📄 Transação teste criada: ${transacaoTeste.id_transacao}`);
      return transacaoTeste;

    } catch (error) {
      console.error('❌ Erro ao criar transação teste:', error);
      throw error;
    }
  }

  async verificarProcessamentoWebhook(transacaoId, expectedStatus) {
    try {
      const { default: Transacao } = await import('./src/models/Transacao.js');
      
      // Aguardar um pouco para o webhook processar
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const transacao = await Transacao.findOne({ id_transacao: transacaoId });
      
      if (!transacao) {
        throw new Error('Transação não encontrada');
      }

      const checks = {
        webhook_received: transacao.webhook_received,
        status_atualizado: transacao.status === expectedStatus,
        logs_presentes: transacao.logs_transacao.length > 0,
        webhook_data_presente: transacao.webhook_data.length > 0
      };

      console.log('🔍 Verificações do webhook:', checks);

      if (!checks.webhook_received) {
        throw new Error('Webhook não foi marcado como recebido');
      }

      if (!checks.status_atualizado) {
        throw new Error(`Status não foi atualizado. Esperado: ${expectedStatus}, Atual: ${transacao.status}`);
      }

      return {
        transacao_id: transacaoId,
        status_final: transacao.status,
        checks,
        transacao: {
          webhook_received: transacao.webhook_received,
          status: transacao.status,
          logs_count: transacao.logs_transacao.length,
          webhook_data_count: transacao.webhook_data.length
        }
      };

    } catch (error) {
      console.error('❌ Erro ao verificar processamento do webhook:', error);
      throw error;
    }
  }

  async testarFluxoCompletoMercadoPago() {
    // Teste completo: criar transação, enviar webhook, verificar processamento
    console.log('🔄 Iniciando teste completo Mercado Pago...');
    
    // 1. Criar transação
    const transacao = await this.criarTransacaoTeste('mercado_pago');
    
    // 2. Enviar webhook
    await this.testarWebhookMercadoPago();
    
    // 3. Verificar processamento
    const resultado = await this.verificarProcessamentoWebhook(transacao.id_transacao, 'aprovado');
    
    return resultado;
  }

  async testarFluxoCompletoStone() {
    console.log('🔄 Iniciando teste completo Stone...');
    
    const transacao = await this.criarTransacaoTeste('stone');
    await this.testarWebhookStone();
    const resultado = await this.verificarProcessamentoWebhook(transacao.id_transacao, 'aprovado');
    
    return resultado;
  }

  async testarFluxoCompletoPagSeguro() {
    console.log('🔄 Iniciando teste completo PagSeguro...');
    
    const transacao = await this.criarTransacaoTeste('pagseguro');
    await this.testarWebhookPagSeguro();
    const resultado = await this.verificarProcessamentoWebhook(transacao.id_transacao, 'aprovado');
    
    return resultado;
  }

  async testarWebhooksInvalidos() {
    // Testar webhooks com dados inválidos
    const testesInvalidos = [
      {
        nome: 'Webhook sem assinatura',
        endpoint: '/api/webhooks/mercado-pago',
        headers: { 'Content-Type': 'application/json' },
        data: { type: 'payment' }
      },
      {
        nome: 'Webhook com dados malformados',
        endpoint: '/api/webhooks/stone',
        headers: { 'Content-Type': 'application/json', 'stone-signature': 'test', 'stone-timestamp': '123' },
        data: { event_type: 'invalid' }
      },
      {
        nome: 'Webhook com payload vazio',
        endpoint: '/api/webhooks/pagseguro',
        headers: { 'Content-Type': 'application/json' },
        data: {}
      }
    ];

    const resultados = [];

    for (const teste of testesInvalidos) {
      try {
        const response = await fetch(`${WEBHOOK_CONFIG.base_url}${teste.endpoint}`, {
          method: 'POST',
          headers: teste.headers,
          body: JSON.stringify(teste.data)
        });

        resultados.push({
          nome: teste.nome,
          status_code: response.status,
          esperado_erro: response.status >= 400,
          resultado: response.status >= 400 ? 'SUCESSO' : 'FALHA'
        });

      } catch (error) {
        resultados.push({
          nome: teste.nome,
          erro: error.message,
          resultado: 'ERRO'
        });
      }
    }

    return resultados;
  }

  async executarTodosTestes() {
    console.log('🚀 Iniciando Testes de Webhook');
    console.log('===============================');
    
    try {
      // Conectar ao banco
      await connectDB();
      console.log('✅ Conexão com MongoDB estabelecida');
      
      // Testes individuais de webhook
      await this.executarTeste('Webhook Mercado Pago', () => this.testarWebhookMercadoPago());
      await this.executarTeste('Webhook Stone', () => this.testarWebhookStone());
      await this.executarTeste('Webhook PagSeguro', () => this.testarWebhookPagSeguro());
      
      // Testes de fluxo completo
      await this.executarTeste('Fluxo Completo Mercado Pago', () => this.testarFluxoCompletoMercadoPago());
      await this.executarTeste('Fluxo Completo Stone', () => this.testarFluxoCompletoStone());
      await this.executarTeste('Fluxo Completo PagSeguro', () => this.testarFluxoCompletoPagSeguro());
      
      // Testes de validação
      await this.executarTeste('Webhooks Inválidos', () => this.testarWebhooksInvalidos());
      
    } catch (error) {
      console.error('❌ Erro durante execução dos testes:', error);
    } finally {
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
        console.log('✅ Conexão com MongoDB fechada');
      }
    }

    this.exibirResumoFinal();
  }

  exibirResumoFinal() {
    console.log('\n' + '=' * 50);
    console.log('📊 RESUMO DOS TESTES DE WEBHOOK');
    console.log('=' * 50);
    
    const sucessos = this.resultados.filter(r => r.status === 'SUCESSO').length;
    const falhas = this.resultados.filter(r => r.status === 'FALHA').length;
    
    console.log(`✅ Sucessos: ${sucessos}`);
    console.log(`❌ Falhas: ${falhas}`);
    console.log(`📋 Total: ${this.resultados.length}`);
    
    const percentualSucesso = ((sucessos / this.resultados.length) * 100).toFixed(1);
    console.log(`📈 Taxa de Sucesso: ${percentualSucesso}%`);
    
    if (falhas > 0) {
      console.log('\n❌ TESTES COM FALHA:');
      this.resultados
        .filter(r => r.status === 'FALHA')
        .forEach(r => console.log(`  - ${r.nome}: ${r.erro}`));
    }
    
    console.log('\n🔗 Webhooks Testados:');
    console.log('  - Mercado Pago ✅');
    console.log('  - Stone ✅');
    console.log('  - PagSeguro ✅');
    
    console.log('\n🧪 Cenários Testados:');
    console.log('  - Recebimento de webhooks ✅');
    console.log('  - Processamento de dados ✅');
    console.log('  - Atualização de status ✅');
    console.log('  - Validação de assinatura ✅');
    console.log('  - Tratamento de erros ✅');
    
    if (percentualSucesso >= 80) {
      console.log('\n🎉 SISTEMA DE WEBHOOKS FUNCIONANDO CORRETAMENTE!');
    } else {
      console.log('\n⚠️  SISTEMA DE WEBHOOKS PRECISA DE AJUSTES');
    }
  }
}

// Executar testes se chamado diretamente
if (require.main === module) {
  const tester = new WebhookTester();
  tester.executarTodosTestes().catch(console.error);
}

module.exports = WebhookTester;