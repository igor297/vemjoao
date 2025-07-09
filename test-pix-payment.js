const connectDB = require('./src/lib/mongodb').default;
const mongoose = require('mongoose');

async function testPixPayment() {
  try {
    console.log('🔍 Conectando ao banco de dados...');
    await connectDB();
    
    console.log('✅ Conectado! Buscando transações PIX...');
    
    // Buscar transações recentes (usando require como o sistema)
    const Transacao = require('./src/models/Transacao.ts').default;
    
    // Buscar transações dos últimos 30 minutos
    const ultimasTransacoes = await Transacao.find({
      condominio_id: '684f0e3e5eb749bbecf97091',
      created_at: { $gte: new Date(Date.now() - 30 * 60 * 1000) }
    }).sort({ created_at: -1 }).limit(10);
    
    console.log(`📋 Encontradas ${ultimasTransacoes.length} transações nos últimos 30 minutos:`);
    
    ultimasTransacoes.forEach((transacao, index) => {
      console.log(`\n${index + 1}. ID: ${transacao.id_transacao}`);
      console.log(`   Payment ID: ${transacao.payment_id}`);
      console.log(`   Status: ${transacao.status}`);
      console.log(`   Valor: R$ ${transacao.valor_final}`);
      console.log(`   Método: ${transacao.metodo_pagamento}`);
      console.log(`   Gateway: ${transacao.gateway_provider}`);
      console.log(`   Criado: ${transacao.created_at}`);
      console.log(`   Webhook recebido: ${transacao.webhook_received ? 'Sim' : 'Não'}`);
    });
    
    // Buscar especificamente a transação PIX ID 117726123072
    const pixTransacao = await Transacao.findOne({ payment_id: '117726123072' });
    
    if (pixTransacao) {
      console.log('\n🎯 Transação PIX encontrada:');
      console.log(`   ID: ${pixTransacao.id_transacao}`);
      console.log(`   Payment ID: ${pixTransacao.payment_id}`);
      console.log(`   Status: ${pixTransacao.status}`);
      console.log(`   Valor: R$ ${pixTransacao.valor_final}`);
      console.log(`   Webhook recebido: ${pixTransacao.webhook_received ? 'Sim' : 'Não'}`);
      
      // Verificar se precisa consultar status
      if (pixTransacao.status === 'pendente' || pixTransacao.status === 'pending') {
        console.log('\n🔄 Transação ainda pendente, vou consultar o status no Mercado Pago...');
        
        const statusConsulta = await consultarStatusMercadoPago(pixTransacao.payment_id);
        if (statusConsulta) {
          console.log(`📊 Status atual no Mercado Pago: ${statusConsulta.status}`);
          
          if (statusConsulta.status !== pixTransacao.status) {
            console.log(`🔄 Status mudou de ${pixTransacao.status} para ${statusConsulta.status}`);
            
            // Atualizar no banco
            pixTransacao.status = statusConsulta.status;
            await pixTransacao.save();
            
            console.log('✅ Status atualizado no banco de dados!');
          }
        }
      }
    } else {
      console.log('\n❌ Transação PIX 117726123072 não encontrada no banco');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await mongoose.connection.close();
  }
}

async function consultarStatusMercadoPago(paymentId) {
  try {
    const fetch = (await import('node-fetch')).default;
    
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.log(`❌ Erro HTTP: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    return data;
    
  } catch (error) {
    console.error('❌ Erro ao consultar Mercado Pago:', error);
    return null;
  }
}

// Executar teste
testPixPayment().catch(console.error);