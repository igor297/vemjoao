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

async function configureWebhook() {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  const webhookUrl = 'https://cyan-trees-work.loca.lt/api/webhooks/mercado-pago-simple';
  
  if (!accessToken) {
    console.log('❌ MERCADO_PAGO_ACCESS_TOKEN não encontrado');
    return;
  }

  try {
    console.log('🔗 Configurando webhook no Mercado Pago...');
    console.log('URL do webhook:', webhookUrl);
    
    // Listar webhooks existentes
    console.log('📋 Verificando webhooks existentes...');
    const listResponse = await fetch('https://api.mercadopago.com/v1/webhooks', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (listResponse.ok) {
      const webhooks = await listResponse.json();
      console.log(`📊 Encontrados ${webhooks.length} webhooks existentes`);
      
      // Remover webhooks antigos
      for (const webhook of webhooks) {
        console.log(`🗑️ Removendo webhook antigo: ${webhook.id}`);
        await fetch(`https://api.mercadopago.com/v1/webhooks/${webhook.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
      }
    }

    // Criar novo webhook
    console.log('➕ Criando novo webhook...');
    const createResponse = await fetch('https://api.mercadopago.com/v1/webhooks', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: webhookUrl,
        events: ['payment']
      })
    });

    const responseText = await createResponse.text();
    console.log('📋 Resposta do Mercado Pago:', responseText);

    if (createResponse.ok) {
      const webhook = JSON.parse(responseText);
      console.log('');
      console.log('✅ WEBHOOK CONFIGURADO COM SUCESSO!');
      console.log('');
      console.log('📋 Detalhes:');
      console.log('   ID:', webhook.id);
      console.log('   URL:', webhook.url);
      console.log('   Eventos:', webhook.events);
      console.log('');
      console.log('🎉 INTEGRAÇÃO COMPLETA!');
      console.log('');
      console.log('Agora quando você:');
      console.log('1. 💳 Gerar um PIX no sistema');
      console.log('2. 📱 Pagar com seu banco/app');
      console.log('3. ⚡ O status mudará automaticamente para "pago"');
      console.log('');
      console.log('⚠️  IMPORTANTE: Mantenha o túnel (webhook-simple.js) rodando!');
    } else {
      console.log('❌ Erro ao criar webhook:', responseText);
      
      // Tentar método alternativo via aplicação
      console.log('🔄 Tentando método alternativo...');
      await configureViaApplication();
    }
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

async function configureViaApplication() {
  try {
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    const webhookUrl = 'https://cyan-trees-work.loca.lt/api/webhooks/mercado-pago-simple';
    
    // Buscar aplicações
    const appsResponse = await fetch('https://api.mercadopago.com/applications', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (appsResponse.ok) {
      const apps = await appsResponse.json();
      console.log('📱 Aplicações encontradas:', apps.length);
      
      if (apps.length > 0) {
        const appId = apps[0].id;
        
        // Configurar webhook na aplicação
        const webhookResponse = await fetch(`https://api.mercadopago.com/applications/${appId}/notifications`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            url: webhookUrl,
            events: ['payment']
          })
        });

        const webhookResult = await webhookResponse.text();
        console.log('📋 Resultado:', webhookResult);
        
        if (webhookResponse.ok) {
          console.log('✅ Webhook configurado via aplicação!');
        }
      }
    }
  } catch (error) {
    console.error('❌ Erro no método alternativo:', error.message);
  }
}

configureWebhook();