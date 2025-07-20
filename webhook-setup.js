const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Carregar variáveis do .env.local
function loadEnv() {
  const envPath = path.join(__dirname, '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        process.env[key.trim()] = value.trim();
      }
    });
  }
}

loadEnv();

async function setupWebhook() {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  
  if (!accessToken) {
    console.log('❌ Configure MERCADO_PAGO_ACCESS_TOKEN antes de continuar');
    process.exit(1);
  }

  console.log('🚀 Iniciando configuração do webhook...');
  
  // Passo 1: Iniciar o túnel
  console.log('📡 Criando túnel público...');
  const tunnel = spawn('lt', ['--port', '3002', '--subdomain', 'vemjoao-webhook'], {
    stdio: 'pipe'
  });

  let tunnelUrl = '';
  
  tunnel.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('Tunnel output:', output);
    
    if (output.includes('your url is:')) {
      tunnelUrl = output.split('your url is: ')[1].trim();
      console.log('✅ Túnel criado:', tunnelUrl);
      setupMercadoPagoWebhook(tunnelUrl);
    }
  });

  tunnel.stderr.on('data', (data) => {
    console.error('Tunnel error:', data.toString());
  });

  tunnel.on('close', (code) => {
    console.log(`Túnel encerrado com código ${code}`);
  });

  // Aguardar alguns segundos para o túnel se estabelecer
  setTimeout(() => {
    if (!tunnelUrl) {
      console.log('⏳ Aguardando túnel...');
    }
  }, 5000);
}

async function setupMercadoPagoWebhook(tunnelUrl) {
  const webhookUrl = `${tunnelUrl}/api/webhooks/mercado-pago-simple`;
  
  try {
    console.log('🔗 Configurando webhook no Mercado Pago...');
    console.log('URL do webhook:', webhookUrl);
    
    // Primeiro, listar webhooks existentes
    const listResponse = await fetch('https://api.mercadopago.com/v1/webhooks', {
      headers: {
        'Authorization': `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (listResponse.ok) {
      const webhooks = await listResponse.json();
      console.log('Webhooks existentes:', webhooks.length);
      
      // Deletar webhooks antigos
      for (const webhook of webhooks) {
        await fetch(`https://api.mercadopago.com/v1/webhooks/${webhook.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`
          }
        });
        console.log('🗑️ Webhook antigo removido:', webhook.id);
      }
    }

    // Criar novo webhook
    const createResponse = await fetch('https://api.mercadopago.com/v1/webhooks', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: webhookUrl,
        events: ['payment'],
        version: '1'
      })
    });

    if (createResponse.ok) {
      const webhook = await createResponse.json();
      console.log('✅ Webhook criado com sucesso!');
      console.log('Webhook ID:', webhook.id);
      console.log('URL:', webhook.url);
      console.log('');
      console.log('🎉 CONFIGURAÇÃO COMPLETA!');
      console.log('');
      console.log('Agora você pode:');
      console.log('1. Gerar um PIX no sistema');
      console.log('2. Pagar com seu banco');
      console.log('3. Ver o status mudar automaticamente para "pago"');
      console.log('');
      console.log('⚠️  IMPORTANTE: Mantenha este processo rodando para receber webhooks');
    } else {
      const error = await createResponse.json();
      console.error('❌ Erro ao criar webhook:', error);
    }
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

// Verificar se o access token está configurado
if (!process.env.MERCADO_PAGO_ACCESS_TOKEN) {
  console.log('❌ MERCADO_PAGO_ACCESS_TOKEN não encontrado');
  console.log('Configure no arquivo .env.local:');
  console.log('MERCADO_PAGO_ACCESS_TOKEN=seu-token-aqui');
  process.exit(1);
}

setupWebhook();

// Manter o processo rodando
process.on('SIGINT', () => {
  console.log('\n🛑 Encerrando webhook...');
  process.exit(0);
});