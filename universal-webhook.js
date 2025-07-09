const express = require('express');
const app = express();
const port = 3002;

app.use(express.json());

// Função para processar o pagamento (simulação)
function processPayment(gateway, paymentId, status) {
  console.log(`Processando pagamento do ${gateway}: ID ${paymentId}, Status ${status}`);
  // TODO: Adicionar lógica de negócios real aqui
  // Ex: Atualizar o banco de dados, notificar o usuário, etc.
  console.log(`Pagamento ${paymentId} atualizado com sucesso.`);
}

// Endpoint para receber webhooks do Mercado Pago
app.post('/webhooks/mercado-pago', (req, res) => {
  console.log('\n--- Webhook Mercado Pago Recebido ---');
  console.log('Corpo da requisição:', JSON.stringify(req.body, null, 2));

  const { type, data } = req.body;

  if (type === 'payment') {
    const paymentId = data.id;
    console.log(`Evento de pagamento recebido para o ID: ${paymentId}`);
    // TODO: Buscar o status real do pagamento na API do Mercado Pago
    // const payment = await mercadopago.payment.findById(paymentId);
    // const status = payment.body.status;
    const status = 'approved'; // Simulação
    processPayment('Mercado Pago', paymentId, status);
  } else {
    console.log(`Evento do tipo '${type}' recebido. Não é um evento de pagamento.`);
  }

  res.status(200).send('Webhook recebido com sucesso!');
  console.log('--- Fim do Webhook Mercado Pago ---\n');
});

// Endpoint para receber webhooks da Stone
app.post('/webhooks/stone', (req, res) => {
  console.log('\n--- Webhook Stone Recebido ---');
  console.log('Corpo da requisição:', JSON.stringify(req.body, null, 2));

  // TODO: Adaptar à estrutura real do webhook da Stone
  const { id, status } = req.body;
  if (id && status) {
    processPayment('Stone', id, status);
  } else {
    console.log('Webhook da Stone com formato inesperado.');
  }

  res.status(200).send('Webhook recebido com sucesso!');
  console.log('--- Fim do Webhook Stone ---\n');
});

// Endpoint para receber webhooks do PagSeguro
app.post('/webhooks/pagseguro', (req, res) => {
  console.log('\n--- Webhook PagSeguro Recebido ---');
  console.log('Corpo da requisição:', JSON.stringify(req.body, null, 2));

  // TODO: Adaptar à estrutura real do webhook do PagSeguro
  const { transaction_id, status } = req.body;
  if (transaction_id && status) {
    processPayment('PagSeguro', transaction_id, status);
  } else {
    console.log('Webhook do PagSeguro com formato inesperado.');
  }

  res.status(200).send('Webhook recebido com sucesso!');
  console.log('--- Fim do Webhook PagSeguro ---\n');
});

app.listen(port, () => {
  console.log(`Servidor de webhooks rodando em http://localhost:${port}`);
});