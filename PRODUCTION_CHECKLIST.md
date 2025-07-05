# Lista de Verificação para Produção

## ✅ Credenciais e Configuração

- [ ] Tokens de produção do MercadoPago configurados
- [ ] Variável `PIX_USE_REAL=true` ativada
- [ ] `NODE_ENV=production` configurado
- [ ] SSL/HTTPS ativo no domínio
- [ ] Webhook URL pública acessível

## ✅ Testes Obrigatórios

- [ ] Teste de PIX com valor pequeno (R$ 0,01)
- [ ] Teste de boleto com vencimento real
- [ ] Verificação de webhook funcionando
- [ ] Confirmação de recebimento real na conta

## ✅ Segurança

- [ ] Secrets e tokens não expostos no código
- [ ] Validação de assinatura do webhook
- [ ] Rate limiting ativo
- [ ] Logs de auditoria funcionando

## ✅ Monitoramento

- [ ] Dashboard de transações funcionando
- [ ] Alertas de falha configurados
- [ ] Backup de dados ativo
- [ ] Logs estruturados salvos

## ⚠️ Avisos Importantes

1. **Primeira transação:** Teste com valor baixo (R$ 0,01)
2. **Conta bancária:** Confirme dados da conta que recebe
3. **Taxas:** Verifique taxas do MercadoPago em produção
4. **Compliance:** Certifique-se que está em compliance com LGPD

## 🚀 Deploy para Produção

```bash
# 1. Backup do banco atual
npm run backup:database

# 2. Deploy com variáveis de produção
npm run build:production
npm run deploy:production

# 3. Verificar saúde do sistema
npm run health:check
```