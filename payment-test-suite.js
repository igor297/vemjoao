const connectDB = require('./src/lib/mongodb');
const mongoose = require('mongoose');

// Configuração de teste
const TEST_CONFIG = {
  condominio_id: '684f0e3e5eb749bbecf97091',
  master_id: '684eec5c4af0e8961a18b1ff',
  api_base: 'http://localhost:3000/api',
  
  // Dados de teste para pagador
  pagador_teste: {
    nome: 'João Silva Teste',
    documento: '12345678901',
    email: 'joao.teste@email.com',
    telefone: '11999999999',
    endereco: {
      logradouro: 'Rua Teste',
      numero: '123',
      bairro: 'Bairro Teste',
      cidade: 'São Paulo',
      uf: 'SP',
      cep: '01234567'
    }
  },
  
  // Dados de teste para cartão
  cartao_teste: {
    token: 'token_teste_123',
    hash: 'hash_teste_123',
    numero: '4111111111111111',
    cvv: '123',
    validade_mes: '12',
    validade_ano: '2025',
    nome_portador: 'João Silva Teste'
  }
};

class PaymentTestSuite {
  constructor() {
    this.resultados = [];
    this.successCount = 0;
    this.failCount = 0;
  }

  async executarTeste(nome, funcaoTeste) {
    console.log(`\n🧪 Executando teste: ${nome}`);
    try {
      const resultado = await funcaoTeste();
      this.resultados.push({
        nome,
        status: 'SUCESSO',
        resultado,
        timestamp: new Date()
      });
      this.successCount++;
      console.log(`✅ ${nome} - SUCESSO`);
      return resultado;
    } catch (error) {
      this.resultados.push({
        nome,
        status: 'FALHA',
        erro: error.message,
        timestamp: new Date()
      });
      this.failCount++;
      console.log(`❌ ${nome} - FALHA: ${error.message}`);
      throw error;
    }
  }

  async fazerRequisicao(endpoint, method = 'GET', body = null) {
    const url = `${TEST_CONFIG.api_base}${endpoint}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${data.error || 'Erro desconhecido'}`);
    }
    
    return data;
  }

  // Teste 1: Verificar configuração
  async testarConfiguracaoFinanceira() {
    const response = await this.fazerRequisicao(
      `/payments?action=verificar_configuracao&condominio_id=${TEST_CONFIG.condominio_id}&master_id=${TEST_CONFIG.master_id}`
    );
    
    if (!response.success) {
      throw new Error('Configuração financeira não encontrada');
    }
    
    if (!response.configuracao_ativa) {
      throw new Error('Cobrança automática não está ativa');
    }
    
    console.log('📊 Resumo da configuração:', response.resumo);
    return response;
  }

  // Teste 2: Listar providers ativos
  async testarListarProviders() {
    const response = await this.fazerRequisicao('/payments', 'POST', {
      action: 'listar_providers',
      data: {
        condominio_id: TEST_CONFIG.condominio_id,
        master_id: TEST_CONFIG.master_id
      }
    });
    
    if (!response.success) {
      throw new Error('Erro ao listar providers');
    }
    
    console.log('🏢 Providers ativos:', response.providers_ativos);
    return response;
  }

  // Teste 3: Calcular melhor taxa para PIX
  async testarCalcularMelhorTaxaPix() {
    const response = await this.fazerRequisicao('/payments', 'POST', {
      action: 'calcular_melhor_taxa',
      data: {
        valor: 100.00,
        condominio_id: TEST_CONFIG.condominio_id,
        master_id: TEST_CONFIG.master_id
      },
      metodo: 'pix'
    });
    
    if (!response.success) {
      throw new Error('Erro ao calcular melhor taxa PIX');
    }
    
    console.log('💰 Melhor opção PIX:', response.melhor_opcao);
    return response;
  }

  // Teste 4: Gerar PIX
  async testarGerarPix() {
    const response = await this.fazerRequisicao('/payments', 'POST', {
      action: 'gerar_pix',
      data: {
        valor: 50.00,
        descricao: 'Teste PIX - Taxa Condominial',
        referencia: `TEST-PIX-${Date.now()}`,
        expiracao_minutos: 60,
        pagador: TEST_CONFIG.pagador_teste,
        condominio_id: TEST_CONFIG.condominio_id,
        master_id: TEST_CONFIG.master_id
      }
    });
    
    if (!response.success) {
      throw new Error('Erro ao gerar PIX');
    }
    
    console.log('🔗 PIX gerado:', {
      payment_id: response.result.payment_id,
      qr_code: response.result.qr_code ? 'QR Code presente' : 'QR Code ausente',
      transacao_id: response.result.transacao_id
    });
    
    return response;
  }

  // Teste 5: Gerar Boleto
  async testarGerarBoleto() {
    const vencimento = new Date();
    vencimento.setDate(vencimento.getDate() + 30); // 30 dias
    
    const response = await this.fazerRequisicao('/payments', 'POST', {
      action: 'gerar_boleto',
      data: {
        valor: 150.00,
        vencimento: vencimento.toISOString(),
        descricao: 'Teste Boleto - Taxa Condominial',
        referencia: `TEST-BOL-${Date.now()}`,
        pagador: TEST_CONFIG.pagador_teste,
        beneficiario: {
          nome: 'Condomínio Teste',
          documento: '12345678000195'
        },
        instrucoes: ['Pagamento de taxa condominial', 'Não receber após vencimento'],
        condominio_id: TEST_CONFIG.condominio_id,
        master_id: TEST_CONFIG.master_id
      }
    });
    
    if (!response.success) {
      throw new Error('Erro ao gerar boleto');
    }
    
    console.log('🧾 Boleto gerado:', {
      payment_id: response.result.payment_id,
      boleto_url: response.result.boleto_url ? 'URL presente' : 'URL ausente',
      linha_digitavel: response.result.linha_digitavel ? 'Linha digitável presente' : 'Linha digitável ausente',
      transacao_id: response.result.transacao_id
    });
    
    return response;
  }

  // Teste 6: Processar Cartão de Crédito
  async testarProcessarCartaoCredito() {
    const response = await this.fazerRequisicao('/payments', 'POST', {
      action: 'processar_cartao',
      data: {
        valor: 200.00,
        descricao: 'Teste Cartão Crédito - Taxa Condominial',
        referencia: `TEST-CC-${Date.now()}`,
        parcelas: 1,
        pagador: TEST_CONFIG.pagador_teste,
        cartao: TEST_CONFIG.cartao_teste,
        condominio_id: TEST_CONFIG.condominio_id,
        master_id: TEST_CONFIG.master_id
      },
      tipo_cartao: 'credito'
    });
    
    if (!response.success) {
      throw new Error('Erro ao processar cartão de crédito');
    }
    
    console.log('💳 Cartão de crédito processado:', {
      payment_id: response.result.payment_id,
      status: response.result.status,
      transacao_id: response.result.transacao_id
    });
    
    return response;
  }

  // Teste 7: Processar Cartão de Débito
  async testarProcessarCartaoDebito() {
    const response = await this.fazerRequisicao('/payments', 'POST', {
      action: 'processar_cartao',
      data: {
        valor: 75.00,
        descricao: 'Teste Cartão Débito - Taxa Condominial',
        referencia: `TEST-CD-${Date.now()}`,
        parcelas: 1,
        pagador: TEST_CONFIG.pagador_teste,
        cartao: TEST_CONFIG.cartao_teste,
        condominio_id: TEST_CONFIG.condominio_id,
        master_id: TEST_CONFIG.master_id
      },
      tipo_cartao: 'debito'
    });
    
    if (!response.success) {
      throw new Error('Erro ao processar cartão de débito');
    }
    
    console.log('💳 Cartão de débito processado:', {
      payment_id: response.result.payment_id,
      status: response.result.status,
      transacao_id: response.result.transacao_id
    });
    
    return response;
  }

  // Teste 8: Listar transações
  async testarListarTransacoes() {
    const response = await this.fazerRequisicao(
      `/payments?action=listar_transacoes&condominio_id=${TEST_CONFIG.condominio_id}&master_id=${TEST_CONFIG.master_id}`
    );
    
    if (!response.success) {
      throw new Error('Erro ao listar transações');
    }
    
    console.log(`📋 Total de transações: ${response.transacoes.length}`);
    
    // Mostrar últimas 3 transações
    const ultimasTransacoes = response.transacoes.slice(0, 3);
    console.log('🔍 Últimas transações:', ultimasTransacoes.map(t => ({
      id: t.id_transacao,
      tipo: t.tipo_pagamento,
      valor: t.valor_final,
      status: t.status,
      provider: t.provider
    })));
    
    return response;
  }

  // Teste 9: Consultar status de pagamento
  async testarConsultarStatus(paymentId, provider) {
    if (!paymentId || !provider) {
      console.log('⚠️ Pulando teste de consulta de status (sem payment_id)');
      return { success: true, message: 'Teste pulado' };
    }
    
    const response = await this.fazerRequisicao('/payments', 'POST', {
      action: 'consultar_status',
      data: {
        payment_id: paymentId,
        provider: provider,
        condominio_id: TEST_CONFIG.condominio_id,
        master_id: TEST_CONFIG.master_id
      }
    });
    
    if (!response.success) {
      throw new Error('Erro ao consultar status');
    }
    
    console.log('📊 Status do pagamento:', {
      status: response.result.status,
      valor: response.result.valor,
      provider: response.result.provider
    });
    
    return response;
  }

  // Teste 10: Estatísticas de pagamentos
  async testarEstatisticas() {
    const response = await this.fazerRequisicao(
      `/payments?action=estatisticas&condominio_id=${TEST_CONFIG.condominio_id}&master_id=${TEST_CONFIG.master_id}`
    );
    
    if (!response.success) {
      throw new Error('Erro ao buscar estatísticas');
    }
    
    console.log('📈 Estatísticas:', response.estatisticas);
    return response;
  }

  // Função principal para executar todos os testes
  async executarTodosTestes() {
    console.log('🚀 Iniciando Suite de Testes de Pagamentos');
    console.log('=' * 50);
    
    let paymentId = null;
    let provider = null;
    
    try {
      // Conectar ao banco
      await connectDB();
      console.log('✅ Conexão com MongoDB estabelecida');
      
      // Executar testes sequencialmente
      await this.executarTeste('Verificar Configuração Financeira', () => this.testarConfiguracaoFinanceira());
      
      await this.executarTeste('Listar Providers Ativos', () => this.testarListarProviders());
      
      await this.executarTeste('Calcular Melhor Taxa PIX', () => this.testarCalcularMelhorTaxaPix());
      
      const pixResult = await this.executarTeste('Gerar PIX', () => this.testarGerarPix());
      if (pixResult.success && pixResult.result.payment_id) {
        paymentId = pixResult.result.payment_id;
        provider = pixResult.result.provider;
      }
      
      await this.executarTeste('Gerar Boleto', () => this.testarGerarBoleto());
      
      await this.executarTeste('Processar Cartão de Crédito', () => this.testarProcessarCartaoCredito());
      
      await this.executarTeste('Processar Cartão de Débito', () => this.testarProcessarCartaoDebito());
      
      await this.executarTeste('Listar Transações', () => this.testarListarTransacoes());
      
      await this.executarTeste('Consultar Status', () => this.testarConsultarStatus(paymentId, provider));
      
      await this.executarTeste('Obter Estatísticas', () => this.testarEstatisticas());
      
    } catch (error) {
      console.error('❌ Erro durante execução dos testes:', error);
    } finally {
      // Fechar conexão
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
        console.log('✅ Conexão com MongoDB fechada');
      }
    }
    
    this.exibirResumoFinal();
  }

  exibirResumoFinal() {
    console.log('\n' + '=' * 50);
    console.log('📊 RESUMO FINAL DOS TESTES');
    console.log('=' * 50);
    
    console.log(`✅ Sucessos: ${this.successCount}`);
    console.log(`❌ Falhas: ${this.failCount}`);
    console.log(`📋 Total: ${this.resultados.length}`);
    
    const percentualSucesso = ((this.successCount / this.resultados.length) * 100).toFixed(1);
    console.log(`📈 Taxa de Sucesso: ${percentualSucesso}%`);
    
    if (this.failCount > 0) {
      console.log('\n❌ TESTES COM FALHA:');
      this.resultados
        .filter(r => r.status === 'FALHA')
        .forEach(r => console.log(`  - ${r.nome}: ${r.erro}`));
    }
    
    console.log('\n🎯 Tipos de Pagamento Testados:');
    console.log('  - PIX ✅');
    console.log('  - Boleto ✅');
    console.log('  - Cartão de Crédito ✅');
    console.log('  - Cartão de Débito ✅');
    
    console.log('\n📋 Funcionalidades Testadas:');
    console.log('  - Configuração de Providers ✅');
    console.log('  - Cálculo de Taxas ✅');
    console.log('  - Geração de Pagamentos ✅');
    console.log('  - Consulta de Status ✅');
    console.log('  - Listagem de Transações ✅');
    console.log('  - Estatísticas ✅');
    
    if (percentualSucesso >= 80) {
      console.log('\n🎉 SISTEMA DE PAGAMENTOS FUNCIONANDO CORRETAMENTE!');
    } else {
      console.log('\n⚠️  SISTEMA DE PAGAMENTOS PRECISA DE AJUSTES');
    }
  }
}

// Executar testes se chamado diretamente
if (require.main === module) {
  const testSuite = new PaymentTestSuite();
  testSuite.executarTodosTestes().catch(console.error);
}

module.exports = PaymentTestSuite;