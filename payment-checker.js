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

async function checkPayments() {
  try {
    console.log('🔍 Verificando pagamentos PIX...');
    
    const response = await fetch('http://localhost:3000/api/check-payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const result = await response.json();
      
      if (result.aprovadas > 0) {
        console.log(`✅ ${result.aprovadas} pagamentos aprovados!`);
        result.resultados.forEach(r => {
          console.log(`   💰 PIX confirmado: ${r.payment_id}`);
        });
      } else {
        console.log(`📊 ${result.verificadas} pagamentos verificados, nenhum novo aprovado`);
      }
    } else {
      console.log('❌ Erro ao verificar pagamentos:', response.status);
    }
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

async function startMonitoring() {
  console.log('🚀 Iniciando monitoramento automático de pagamentos PIX');
  console.log('⏰ Verificando a cada 10 segundos...');
  console.log('');

  // Verificar imediatamente
  await checkPayments();

  // Depois verificar a cada 10 segundos
  const interval = setInterval(async () => {
    await checkPayments();
  }, 10000); // 10 segundos

  // Capturar Ctrl+C
  process.on('SIGINT', () => {
    console.log('\n🛑 Parando monitoramento...');
    clearInterval(interval);
    process.exit(0);
  });

  console.log('⚠️  Mantenha este processo rodando para verificar pagamentos automaticamente');
  console.log('💡 Pressione Ctrl+C para parar');
}

if (!process.env.MERCADO_PAGO_ACCESS_TOKEN) {
  console.log('❌ MERCADO_PAGO_ACCESS_TOKEN não encontrado no .env.local');
  process.exit(1);
}

startMonitoring();