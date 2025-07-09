const connectDB = require('./src/lib/mongodb');
const mongoose = require('mongoose');

// Verificação completa do sistema
class SystemChecker {
  constructor() {
    this.checks = [];
    this.errors = [];
    this.warnings = [];
  }

  async runCheck(name, checkFunction) {
    console.log(`🔍 Verificando: ${name}`);
    try {
      const result = await checkFunction();
      this.checks.push({ name, status: 'OK', result });
      console.log(`✅ ${name} - OK`);
      return result;
    } catch (error) {
      this.checks.push({ name, status: 'ERRO', error: error.message });
      this.errors.push({ name, error: error.message });
      console.log(`❌ ${name} - ERRO: ${error.message}`);
      throw error;
    }
  }

  async runWarning(name, checkFunction) {
    console.log(`⚠️  Verificando: ${name}`);
    try {
      const result = await checkFunction();
      this.checks.push({ name, status: 'OK', result });
      console.log(`✅ ${name} - OK`);
      return result;
    } catch (error) {
      this.checks.push({ name, status: 'AVISO', warning: error.message });
      this.warnings.push({ name, warning: error.message });
      console.log(`⚠️  ${name} - AVISO: ${error.message}`);
      return null;
    }
  }

  async checkDatabaseConnection() {
    await connectDB();
    const state = mongoose.connection.readyState;
    if (state !== 1) {
      throw new Error('Conexão com MongoDB não estabelecida');
    }
    return { status: 'connected', state };
  }

  async checkModels() {
    try {
      const { default: Transacao } = await import('./src/models/Transacao.js');
      const { default: ConfiguracaoFinanceira } = await import('./src/models/ConfiguracaoFinanceira.js');
      
      // Tentar criar instâncias dos modelos
      const transacaoTest = new Transacao({
        id_transacao: 'TEST_MODEL',
        tipo_origem: 'financeiro_morador',
        origem_id: new mongoose.Types.ObjectId(),
        condominio_id: new mongoose.Types.ObjectId(),
        valor_original: 10,
        valor_final: 10,
        gateway_provider: 'mercado_pago',
        metodo_pagamento: 'pix',
        data_vencimento: new Date(),
        categoria_contabil: 'Test'
      });

      await transacaoTest.validate();
      
      return { transacao: 'valid', configuracao: 'loaded' };
    } catch (error) {
      throw new Error(`Erro nos modelos: ${error.message}`);
    }
  }

  async checkNextJSServer() {
    try {
      const response = await fetch('http://localhost:3000/api/health');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      return { status: 'running', health: data };
    } catch (error) {
      throw new Error('Servidor Next.js não está rodando na porta 3000');
    }
  }

  async checkPaymentAPI() {
    try {
      const response = await fetch('http://localhost:3000/api/payments?action=listar_providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: {
            condominio_id: '684f0e3e5eb749bbecf97091',
            master_id: '684eec5c4af0e8961a18b1ff'
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      return { providers: data.providers_ativos || [], api_working: true };
    } catch (error) {
      throw new Error(`API de pagamentos com problema: ${error.message}`);
    }
  }

  async checkWebhooks() {
    const webhooks = [
      'http://localhost:3000/api/webhooks/mercado-pago',
      'http://localhost:3000/api/webhooks/stone',
      'http://localhost:3000/api/webhooks/pagseguro'
    ];

    const results = {};
    
    for (const webhook of webhooks) {
      try {
        const response = await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: 'ping' })
        });
        
        // Esperamos erro 401 ou 400 (webhook inválido), não 404
        if (response.status === 404) {
          throw new Error('Endpoint não encontrado');
        }
        
        const provider = webhook.split('/').pop();
        results[provider] = { status: response.status, accessible: true };
      } catch (error) {
        const provider = webhook.split('/').pop();
        results[provider] = { error: error.message, accessible: false };
      }
    }
    
    return results;
  }

  async checkMonitor() {
    try {
      const response = await fetch('http://localhost:3001/status');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      return { monitor_running: true, stats: data };
    } catch (error) {
      throw new Error('Monitor não está rodando na porta 3001');
    }
  }

  async checkFileStructure() {
    const fs = require('fs');
    const requiredFiles = [
      'payment-test-suite.js',
      'quick-payment-test.js',
      'payment-monitor.js',
      'start-with-monitor.js',
      'webhook-test.js',
      'test-config.json',
      'src/app/api/payments/route.ts',
      'src/app/api/webhooks/mercado-pago/route.ts',
      'src/app/api/webhooks/stone/route.ts',
      'src/app/api/webhooks/pagseguro/route.ts',
      'src/models/Transacao.ts',
      'src/lib/payment-services/payment-manager.ts'
    ];

    const missing = [];
    const existing = [];

    for (const file of requiredFiles) {
      if (fs.existsSync(file)) {
        existing.push(file);
      } else {
        missing.push(file);
      }
    }

    if (missing.length > 0) {
      throw new Error(`Arquivos ausentes: ${missing.join(', ')}`);
    }

    return { total_files: requiredFiles.length, existing: existing.length };
  }

  async checkDependencies() {
    const packageJson = require('./package.json');
    const dependencies = packageJson.dependencies || {};
    
    const required = ['mongoose', 'next'];
    const missing = required.filter(dep => !dependencies[dep]);
    
    if (missing.length > 0) {
      throw new Error(`Dependências ausentes: ${missing.join(', ')}`);
    }

    return { dependencies_ok: true, total: Object.keys(dependencies).length };
  }

  async checkConfiguration() {
    try {
      const { default: ConfiguracaoFinanceira } = await import('./src/models/ConfiguracaoFinanceira.js');
      
      const config = await ConfiguracaoFinanceira.findOne({
        condominio_id: '684f0e3e5eb749bbecf97091',
        cobranca_automatica_ativa: true
      });

      if (!config) {
        throw new Error('Configuração financeira não encontrada ou inativa');
      }

      const activeProviders = [];
      if (config.mercado_pago?.ativo) activeProviders.push('mercado_pago');
      if (config.stone?.ativo) activeProviders.push('stone');
      if (config.pagseguro?.ativo) activeProviders.push('pagseguro');

      return {
        config_exists: true,
        active_providers: activeProviders,
        cobranca_ativa: config.cobranca_automatica_ativa
      };
    } catch (error) {
      throw new Error(`Erro na configuração: ${error.message}`);
    }
  }

  async runAllChecks() {
    console.log('🚀 Verificação Completa do Sistema de Pagamentos');
    console.log('================================================');

    try {
      // Verificações críticas (devem passar)
      await this.runCheck('Estrutura de Arquivos', () => this.checkFileStructure());
      await this.runCheck('Dependências Node.js', () => this.checkDependencies());
      await this.runCheck('Conexão com Banco', () => this.checkDatabaseConnection());
      await this.runCheck('Modelos do Mongoose', () => this.checkModels());
      
      // Verificações do servidor (podem ter avisos)
      await this.runWarning('Servidor Next.js', () => this.checkNextJSServer());
      await this.runWarning('API de Pagamentos', () => this.checkPaymentAPI());
      await this.runWarning('Endpoints de Webhook', () => this.checkWebhooks());
      await this.runWarning('Monitor de Pagamentos', () => this.checkMonitor());
      await this.runWarning('Configuração Financeira', () => this.checkConfiguration());

    } catch (error) {
      console.error('\n❌ Verificação interrompida devido a erro crítico');
    } finally {
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
      }
    }

    this.showSummary();
  }

  showSummary() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 RESUMO DA VERIFICAÇÃO');
    console.log('='.repeat(50));

    const totalChecks = this.checks.length;
    const okChecks = this.checks.filter(c => c.status === 'OK').length;
    const errorChecks = this.checks.filter(c => c.status === 'ERRO').length;
    const warningChecks = this.checks.filter(c => c.status === 'AVISO').length;

    console.log(`✅ Passou: ${okChecks}`);
    console.log(`❌ Erro: ${errorChecks}`);
    console.log(`⚠️  Aviso: ${warningChecks}`);
    console.log(`📋 Total: ${totalChecks}`);

    const healthScore = ((okChecks / totalChecks) * 100).toFixed(1);
    console.log(`🏥 Saúde do Sistema: ${healthScore}%`);

    if (this.errors.length > 0) {
      console.log('\n❌ ERROS CRÍTICOS:');
      this.errors.forEach(e => console.log(`  - ${e.name}: ${e.error}`));
    }

    if (this.warnings.length > 0) {
      console.log('\n⚠️  AVISOS:');
      this.warnings.forEach(w => console.log(`  - ${w.name}: ${w.warning}`));
    }

    console.log('\n📋 STATUS DOS COMPONENTES:');
    console.log('  📁 Arquivos: ' + (this.checks.find(c => c.name === 'Estrutura de Arquivos')?.status === 'OK' ? '✅' : '❌'));
    console.log('  📦 Dependências: ' + (this.checks.find(c => c.name === 'Dependências Node.js')?.status === 'OK' ? '✅' : '❌'));
    console.log('  🗄️  Banco de Dados: ' + (this.checks.find(c => c.name === 'Conexão com Banco')?.status === 'OK' ? '✅' : '❌'));
    console.log('  🏗️  Modelos: ' + (this.checks.find(c => c.name === 'Modelos do Mongoose')?.status === 'OK' ? '✅' : '❌'));
    console.log('  🌐 Servidor: ' + (this.checks.find(c => c.name === 'Servidor Next.js')?.status === 'OK' ? '✅' : '⚠️'));
    console.log('  💳 API Pagamentos: ' + (this.checks.find(c => c.name === 'API de Pagamentos')?.status === 'OK' ? '✅' : '⚠️'));
    console.log('  🔔 Webhooks: ' + (this.checks.find(c => c.name === 'Endpoints de Webhook')?.status === 'OK' ? '✅' : '⚠️'));
    console.log('  📊 Monitor: ' + (this.checks.find(c => c.name === 'Monitor de Pagamentos')?.status === 'OK' ? '✅' : '⚠️'));
    console.log('  ⚙️  Configuração: ' + (this.checks.find(c => c.name === 'Configuração Financeira')?.status === 'OK' ? '✅' : '⚠️'));

    console.log('\n🎯 PRÓXIMOS PASSOS:');
    
    if (errorChecks === 0) {
      console.log('  ✅ Sistema base está funcionando!');
      
      if (warningChecks > 0) {
        console.log('  🚀 Para funcionalidade completa:');
        console.log('     1. Execute: node start-with-monitor.js');
        console.log('     2. Configure providers de pagamento');
        console.log('     3. Teste com: node payment-test-suite.js');
      } else {
        console.log('  🎉 SISTEMA COMPLETAMENTE FUNCIONAL!');
        console.log('     Execute testes: node payment-test-suite.js');
      }
    } else {
      console.log('  ❌ Corrija os erros críticos antes de prosseguir');
      console.log('  📖 Consulte PAYMENT-TESTS-README.md para ajuda');
    }
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  const checker = new SystemChecker();
  checker.runAllChecks().catch(console.error);
}

module.exports = SystemChecker;