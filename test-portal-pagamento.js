const connectDB = require('./src/lib/mongodb');
const mongoose = require('mongoose');

// Configuração para teste do portal
const PORTAL_CONFIG = {
  api_base: 'http://localhost:3000',
  test_data: {
    morador_id: '68540f83d501ababd9bc48ec',
    condominio_id: '684f0e3e5eb749bbecf97091',
    master_id: '684eec5c4af0e8961a18b1ff'
  }
};

class PortalPagamentoTester {
  constructor() {
    this.testResults = [];
  }

  async runTest(name, testFunction) {
    console.log(`\n🧪 Testando: ${name}`);
    try {
      const result = await testFunction();
      this.testResults.push({ name, status: 'SUCESSO', result });
      console.log(`✅ ${name} - SUCESSO`);
      return result;
    } catch (error) {
      this.testResults.push({ name, status: 'ERRO', error: error.message });
      console.log(`❌ ${name} - ERRO: ${error.message}`);
      throw error;
    }
  }

  async fazerRequisicao(endpoint, method = 'GET', body = null) {
    const url = `${PORTAL_CONFIG.api_base}${endpoint}`;
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json();
    
    return { success: response.ok, data, status: response.status };
  }

  async testarListarPendencias() {
    const endpoint = `/api/portal-pagamento?morador_id=${PORTAL_CONFIG.test_data.morador_id}&condominio_id=${PORTAL_CONFIG.test_data.condominio_id}&status=pendente,atrasado`;
    
    const result = await this.fazerRequisicao(endpoint);
    
    if (!result.success) {
      throw new Error(`Erro ao listar pendências: ${result.data.error}`);
    }

    console.log(`📋 Pendências encontradas: ${result.data.financeiros?.length || 0}`);
    
    return {
      total_pendencias: result.data.financeiros?.length || 0,
      financeiros: result.data.financeiros
    };
  }

  async testarListarHistorico() {
    const endpoint = `/api/portal-pagamento?morador_id=${PORTAL_CONFIG.test_data.morador_id}&condominio_id=${PORTAL_CONFIG.test_data.condominio_id}&status=pago&limit=20`;
    
    const result = await this.fazerRequisicao(endpoint);
    
    if (!result.success) {
      throw new Error(`Erro ao listar histórico: ${result.data.error}`);
    }

    console.log(`📊 Pagamentos no histórico: ${result.data.financeiros?.length || 0}`);
    
    return {
      total_historico: result.data.financeiros?.length || 0,
      financeiros: result.data.financeiros
    };
  }

  async criarFinanceiroTeste() {
    try {
      await connectDB();
      
      const { default: FinanceiroMorador } = await import('./src/models/FinanceiroMorador.js');
      
      const financeiroTeste = new FinanceiroMorador({
        id_financeiro: `TEST_${Date.now()}`,
        tipo: 'taxa_condominio',
        descricao: 'Taxa Condominial - Teste Portal',
        valor: 350.00,
        data_vencimento: new Date(Date.now() + 24 * 60 * 60 * 1000), // Amanhã
        status: 'pendente',
        morador_id: PORTAL_CONFIG.test_data.morador_id,
        condominio_id: PORTAL_CONFIG.test_data.condominio_id,
        master_id: PORTAL_CONFIG.test_data.master_id,
        mes_referencia: new Date().toLocaleDateString('pt-BR', { year: 'numeric', month: 'long' }),
        observacoes: 'Teste criado automaticamente',
        created_at: new Date(),
        updated_at: new Date(),
        ativo: true
      });

      const saved = await financeiroTeste.save();
      console.log(`💰 Financeiro teste criado: ${saved.id_financeiro}`);
      
      return saved;
    } catch (error) {
      console.error('❌ Erro ao criar financeiro teste:', error);
      throw error;
    }
  }

  async testarPagamentoPix(financeiroId) {
    const paymentData = {
      financeiro_id: financeiroId,
      morador_id: PORTAL_CONFIG.test_data.morador_id,
      condominio_id: PORTAL_CONFIG.test_data.condominio_id,
      master_id: PORTAL_CONFIG.test_data.master_id,
      valor: 350.00,
      metodo_pagamento: 'pix',
      descricao: 'Taxa Condominial - Teste PIX'
    };

    const result = await this.fazerRequisicao('/api/portal-pagamento', 'POST', paymentData);
    
    console.log('📤 Dados enviados:', paymentData);
    console.log('📥 Resposta recebida:', result);
    
    if (!result.success) {
      throw new Error(`Erro no pagamento PIX: ${result.data.error || 'Erro desconhecido'}`);
    }

    return {
      transacao_id: result.data.transacao_id,
      payment_id: result.data.payment_id,
      qr_code: result.data.qr_code ? 'Presente' : 'Ausente',
      status: result.data.status,
      provider: result.data.provider
    };
  }

  async testarPagamentoBoleto(financeiroId) {
    const paymentData = {
      financeiro_id: financeiroId,
      morador_id: PORTAL_CONFIG.test_data.morador_id,
      condominio_id: PORTAL_CONFIG.test_data.condominio_id,
      master_id: PORTAL_CONFIG.test_data.master_id,
      valor: 350.00,
      metodo_pagamento: 'boleto',
      descricao: 'Taxa Condominial - Teste Boleto'
    };

    const result = await this.fazerRequisicao('/api/portal-pagamento', 'POST', paymentData);
    
    if (!result.success) {
      throw new Error(`Erro no pagamento Boleto: ${result.data.error || 'Erro desconhecido'}`);
    }

    return {
      transacao_id: result.data.transacao_id,
      payment_id: result.data.payment_id,
      boleto_url: result.data.boleto_url ? 'Presente' : 'Ausente',
      linha_digitavel: result.data.linha_digitavel ? 'Presente' : 'Ausente',
      status: result.data.status,
      provider: result.data.provider
    };
  }

  async verificarConfiguracaoFinanceira() {
    try {
      await connectDB();
      
      const { default: ConfiguracaoFinanceira } = await import('./src/models/ConfiguracaoFinanceira.js');
      
      const config = await ConfiguracaoFinanceira.findOne({
        condominio_id: PORTAL_CONFIG.test_data.condominio_id,
        master_id: PORTAL_CONFIG.test_data.master_id,
        ativo: true
      });

      if (!config) {
        throw new Error('Configuração financeira não encontrada');
      }

      const providersAtivos = [];
      if (config.mercado_pago?.ativo) providersAtivos.push('mercado_pago');
      if (config.stone?.ativo) providersAtivos.push('stone');
      if (config.pagseguro?.ativo) providersAtivos.push('pagseguro');

      return {
        existe: true,
        cobranca_ativa: config.cobranca_automatica_ativa,
        providers_ativos: providersAtivos,
        total_providers: providersAtivos.length
      };

    } catch (error) {
      throw new Error(`Erro na configuração: ${error.message}`);
    }
  }

  async verificarMorador() {
    try {
      await connectDB();
      
      const { default: Morador } = await import('./src/models/Morador.js');
      
      const morador = await Morador.findOne({
        _id: PORTAL_CONFIG.test_data.morador_id,
        ativo: true
      });

      if (!morador) {
        throw new Error('Morador não encontrado');
      }

      return {
        nome: morador.nome,
        apartamento: morador.apartamento,
        email: morador.email || 'Não informado',
        cpf: morador.cpf || 'Não informado',
        dados_completos: !!(morador.nome && morador.email && morador.cpf)
      };

    } catch (error) {
      throw new Error(`Erro no morador: ${error.message}`);
    }
  }

  async executarTodosTestes() {
    console.log('🚀 Testando Portal de Pagamento');
    console.log('=================================');

    let financeiroTeste = null;

    try {
      // Conectar ao banco
      await connectDB();
      console.log('✅ Conexão com MongoDB estabelecida');

      // Testes básicos
      await this.runTest('Verificar Configuração Financeira', () => this.verificarConfiguracaoFinanceira());
      await this.runTest('Verificar Dados do Morador', () => this.verificarMorador());
      await this.runTest('Listar Pendências', () => this.testarListarPendencias());
      await this.runTest('Listar Histórico', () => this.testarListarHistorico());

      // Criar financeiro para teste
      financeiroTeste = await this.runTest('Criar Financeiro Teste', () => this.criarFinanceiroTeste());

      // Testes de pagamento
      if (financeiroTeste) {
        await this.runTest('Pagamento PIX', () => this.testarPagamentoPix(financeiroTeste._id.toString()));
        // await this.runTest('Pagamento Boleto', () => this.testarPagamentoBoleto(financeiroTeste._id.toString()));
      }

    } catch (error) {
      console.error('❌ Erro durante os testes:', error);
    } finally {
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
        console.log('✅ Conexão com MongoDB fechada');
      }
    }

    this.exibirResumo();
  }

  exibirResumo() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 RESUMO DOS TESTES DO PORTAL');
    console.log('='.repeat(50));

    const sucessos = this.testResults.filter(r => r.status === 'SUCESSO').length;
    const erros = this.testResults.filter(r => r.status === 'ERRO').length;

    console.log(`✅ Sucessos: ${sucessos}`);
    console.log(`❌ Erros: ${erros}`);
    console.log(`📋 Total: ${this.testResults.length}`);

    if (erros > 0) {
      console.log('\n❌ ERROS ENCONTRADOS:');
      this.testResults
        .filter(r => r.status === 'ERRO')
        .forEach(r => console.log(`  - ${r.name}: ${r.error}`));
    }

    const percentualSucesso = ((sucessos / this.testResults.length) * 100).toFixed(1);
    console.log(`📈 Taxa de Sucesso: ${percentualSucesso}%`);

    if (percentualSucesso >= 80) {
      console.log('\n🎉 PORTAL DE PAGAMENTO FUNCIONANDO!');
    } else {
      console.log('\n⚠️  PORTAL PRECISA DE AJUSTES');
    }

    console.log('\n💡 PRÓXIMOS PASSOS:');
    console.log('  1. Acesse: http://localhost:3000/portal-pagamento');
    console.log('  2. Faça login como morador');
    console.log('  3. Teste os pagamentos PIX/Boleto/Cartão');
    console.log('  4. Verifique se status atualiza automaticamente');
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  const tester = new PortalPagamentoTester();
  tester.executarTodosTestes().catch(console.error);
}

module.exports = PortalPagamentoTester;