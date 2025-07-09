const connectDB = require('./src/lib/mongodb');
const mongoose = require('mongoose');

// Configuração rápida
const QUICK_CONFIG = {
  condominio_id: '684f0e3e5eb749bbecf97091',
  master_id: '684eec5c4af0e8961a18b1ff',
  api_base: 'http://localhost:3000/api'
};

// Função para fazer requisições
async function fazerRequisicao(endpoint, method = 'GET', body = null) {
  const url = `${QUICK_CONFIG.api_base}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();
    return { success: response.ok, data, status: response.status };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Testes rápidos por tipo
async function testeRapidoPix() {
  console.log('\n🔗 Teste Rápido PIX');
  
  const result = await fazerRequisicao('/payments', 'POST', {
    action: 'gerar_pix',
    data: {
      valor: 25.00,
      descricao: 'Teste PIX Rápido',
      referencia: `QUICK-PIX-${Date.now()}`,
      expiracao_minutos: 30,
      pagador: {
        nome: 'Teste Rápido',
        documento: '12345678901',
        email: 'teste@email.com'
      },
      condominio_id: QUICK_CONFIG.condominio_id,
      master_id: QUICK_CONFIG.master_id
    }
  });
  
  if (result.success) {
    console.log('✅ PIX gerado com sucesso');
    console.log('📋 ID:', result.data.result.payment_id);
    console.log('🏢 Provider:', result.data.result.provider);
  } else {
    console.log('❌ Erro:', result.data?.error || result.error);
  }
  
  return result;
}

async function testeRapidoBoleto() {
  console.log('\n🧾 Teste Rápido Boleto');
  
  const vencimento = new Date();
  vencimento.setDate(vencimento.getDate() + 15);
  
  const result = await fazerRequisicao('/payments', 'POST', {
    action: 'gerar_boleto',
    data: {
      valor: 100.00,
      vencimento: vencimento.toISOString(),
      descricao: 'Teste Boleto Rápido',
      referencia: `QUICK-BOL-${Date.now()}`,
      pagador: {
        nome: 'Teste Rápido',
        documento: '12345678901',
        email: 'teste@email.com',
        telefone: '11999999999',
        endereco: {
          logradouro: 'Rua Teste',
          numero: '123',
          bairro: 'Centro',
          cidade: 'São Paulo',
          uf: 'SP',
          cep: '01234567'
        }
      },
      beneficiario: {
        nome: 'Condomínio Teste',
        documento: '12345678000195'
      },
      instrucoes: ['Pagamento de taxa condominial'],
      condominio_id: QUICK_CONFIG.condominio_id,
      master_id: QUICK_CONFIG.master_id
    }
  });
  
  if (result.success) {
    console.log('✅ Boleto gerado com sucesso');
    console.log('📋 ID:', result.data.result.payment_id);
    console.log('🏢 Provider:', result.data.result.provider);
  } else {
    console.log('❌ Erro:', result.data?.error || result.error);
  }
  
  return result;
}

async function testeRapidoCartao(tipo = 'credito') {
  console.log(`\n💳 Teste Rápido Cartão ${tipo.toUpperCase()}`);
  
  const result = await fazerRequisicao('/payments', 'POST', {
    action: 'processar_cartao',
    data: {
      valor: 50.00,
      descricao: `Teste Cartão ${tipo} Rápido`,
      referencia: `QUICK-${tipo.toUpperCase()}-${Date.now()}`,
      parcelas: 1,
      pagador: {
        nome: 'Teste Rápido',
        documento: '12345678901',
        email: 'teste@email.com',
        telefone: '11999999999',
        endereco: {
          logradouro: 'Rua Teste',
          numero: '123',
          bairro: 'Centro',
          cidade: 'São Paulo',
          uf: 'SP',
          cep: '01234567'
        }
      },
      cartao: {
        token: 'token_teste_123',
        hash: 'hash_teste_123',
        numero: '4111111111111111',
        cvv: '123',
        validade_mes: '12',
        validade_ano: '2025',
        nome_portador: 'Teste Rápido'
      },
      condominio_id: QUICK_CONFIG.condominio_id,
      master_id: QUICK_CONFIG.master_id
    },
    tipo_cartao: tipo
  });
  
  if (result.success) {
    console.log(`✅ Cartão ${tipo} processado com sucesso`);
    console.log('📋 ID:', result.data.result.payment_id);
    console.log('🏢 Provider:', result.data.result.provider);
  } else {
    console.log('❌ Erro:', result.data?.error || result.error);
  }
  
  return result;
}

async function verificarStatus() {
  console.log('\n📊 Verificando Status dos Providers');
  
  const result = await fazerRequisicao(
    `/payments?action=verificar_configuracao&condominio_id=${QUICK_CONFIG.condominio_id}&master_id=${QUICK_CONFIG.master_id}`
  );
  
  if (result.success) {
    console.log('✅ Configuração ativa:', result.data.configuracao_ativa);
    console.log('🏢 Providers disponíveis:', result.data.resumo?.providers_disponiveis || []);
  } else {
    console.log('❌ Erro ao verificar configuração:', result.data?.error || result.error);
  }
  
  return result;
}

async function listarUltimasTransacoes() {
  console.log('\n📋 Últimas Transações');
  
  const result = await fazerRequisicao(
    `/payments?action=listar_transacoes&condominio_id=${QUICK_CONFIG.condominio_id}&master_id=${QUICK_CONFIG.master_id}`
  );
  
  if (result.success) {
    const transacoes = result.data.transacoes.slice(0, 5);
    console.log(`📊 Total: ${result.data.transacoes.length} transações`);
    
    transacoes.forEach((t, i) => {
      console.log(`${i + 1}. ${t.tipo_pagamento} - R$ ${t.valor_final} - ${t.status} (${t.provider})`);
    });
  } else {
    console.log('❌ Erro ao listar transações:', result.data?.error || result.error);
  }
  
  return result;
}

// Função principal
async function main() {
  const args = process.argv.slice(2);
  const comando = args[0];
  
  console.log('🚀 Teste Rápido de Pagamentos');
  console.log('==============================');
  
  try {
    await connectDB();
    
    switch (comando) {
      case 'pix':
        await testeRapidoPix();
        break;
      case 'boleto':
        await testeRapidoBoleto();
        break;
      case 'credito':
        await testeRapidoCartao('credito');
        break;
      case 'debito':
        await testeRapidoCartao('debito');
        break;
      case 'status':
        await verificarStatus();
        break;
      case 'transacoes':
        await listarUltimasTransacoes();
        break;
      case 'todos':
        await verificarStatus();
        await testeRapidoPix();
        await testeRapidoBoleto();
        await testeRapidoCartao('credito');
        await testeRapidoCartao('debito');
        await listarUltimasTransacoes();
        break;
      default:
        console.log('\n📖 Comandos disponíveis:');
        console.log('  node quick-payment-test.js pix       - Teste PIX');
        console.log('  node quick-payment-test.js boleto    - Teste Boleto');
        console.log('  node quick-payment-test.js credito   - Teste Cartão Crédito');
        console.log('  node quick-payment-test.js debito    - Teste Cartão Débito');
        console.log('  node quick-payment-test.js status    - Verificar Status');
        console.log('  node quick-payment-test.js transacoes - Listar Transações');
        console.log('  node quick-payment-test.js todos     - Executar Todos os Testes');
        break;
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testeRapidoPix, testeRapidoBoleto, testeRapidoCartao, verificarStatus, listarUltimasTransacoes };