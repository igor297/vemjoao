const { spawn } = require('child_process');
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

async function createTunnel() {
  console.log('🚀 Criando túnel para receber webhooks reais...');
  console.log('');
  
  const tunnel = spawn('lt', ['--port', '3000'], {
    stdio: 'inherit'
  });

  console.log('⚠️  INSTRUÇÕES IMPORTANTES:');
  console.log('');
  console.log('1. 📋 COPIE a URL que apareceu acima (exemplo: https://xyz.loca.lt)');
  console.log('2. 🌐 Acesse: https://www.mercadopago.com.br/developers/panel/notifications/webhooks');
  console.log('3. ➕ Clique em "Criar webhook"');
  console.log('4. 📝 Cole a URL + "/api/webhooks/mercado-pago-simple"');
  console.log('   Exemplo: https://xyz.loca.lt/api/webhooks/mercado-pago-simple');
  console.log('5. ✅ Selecione evento "Pagamentos"');
  console.log('6. 💾 Salve o webhook');
  console.log('');
  console.log('🎯 Depois disso:');
  console.log('- Gere um PIX no sistema');
  console.log('- Pague com seu banco');
  console.log('- Veja o status mudar para "pago" automaticamente!');
  console.log('');
  console.log('⚠️  Mantenha este terminal aberto para receber as notificações');
  console.log('');

  tunnel.on('close', (code) => {
    console.log(`\n🛑 Túnel encerrado com código ${code}`);
  });

  // Capturar Ctrl+C
  process.on('SIGINT', () => {
    console.log('\n🛑 Encerrando túnel...');
    tunnel.kill();
    process.exit(0);
  });
}

if (!process.env.MERCADO_PAGO_ACCESS_TOKEN) {
  console.log('❌ MERCADO_PAGO_ACCESS_TOKEN não encontrado no .env.local');
  console.log('Configure suas credenciais primeiro!');
  process.exit(1);
}

createTunnel();