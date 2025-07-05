# Configuração de Webhooks para Produção

## 1. Configure o webhook no MercadoPago:

**URL do Webhook:** `https://your-domain.com/api/webhooks/mercado-pago`

**Eventos para escutar:**
- `payment` (pagamentos)
- `plan` (assinaturas, se aplicável)
- `invoice` (faturas, se aplicável)

## 2. Teste o webhook:

```bash
curl -X POST https://your-domain.com/api/webhooks/mercado-pago \
  -H "Content-Type: application/json" \
  -d '{
    "action": "payment.updated",
    "api_version": "v1",
    "data": {
      "id": "123456789"
    },
    "date_created": "2024-01-01T00:00:00Z",
    "id": 123456789,
    "live_mode": true,
    "type": "payment",
    "user_id": "USER_ID"
  }'
```

## 3. Monitoramento:

- Verifique os logs do webhook em `/var/log/webhook.log`
- Monitor de status em tempo real via dashboard
- Alertas por email em caso de falhas