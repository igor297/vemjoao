# 🧪 Sistema Completo de Pagamentos - Condominial

Este diretório contém scripts de teste, monitoramento e verificação para a funcionalidade de pagamentos do sistema condominial, incluindo PIX, Boleto, Cartão de Crédito e Cartão de Débito, com suporte completo a webhooks e atualizações automáticas.

## 📁 Arquivos de Teste

### 1. `payment-test-suite.js`
**Suite completa de testes automatizados**
- Executa todos os tipos de pagamento
- Verifica configurações e providers
- Testa cálculo de taxas
- Consulta status de transações
- Gera relatório detalhado

### 2. `quick-payment-test.js`
**Testes rápidos e específicos**
- Testa tipos individuais de pagamento
- Execução rápida para validações pontuais
- Ideal para debug e desenvolvimento

### 3. `test-config.json`
**Configurações de teste**
- Dados de teste padronizados
- Configurações de ambiente
- Cenários de teste predefinidos

### 4. `payment-monitor.js`
**Monitor de pagamentos em tempo real**
- Monitora transações pendentes
- Verifica status automaticamente
- API para consulta de dados
- Sistema de notificações

### 5. `start-with-monitor.js`
**Inicializador completo do sistema**
- Inicia Next.js + Monitor simultaneamente
- Gerenciamento automático de processos
- Logs centralizados
- Restart automático em caso de crash

### 6. `webhook-test.js`
**Testes específicos de webhooks**
- Simula webhooks dos providers
- Verifica processamento automático
- Testa validação de assinatura
- Fluxo completo de atualização

## 🚀 Como Executar

### 🎯 Sistema Completo (Recomendado)
```bash
# Iniciar servidor + monitor de pagamentos
node start-with-monitor.js
```

### Suite Completa de Testes
```bash
# Executar todos os testes
node payment-test-suite.js
```

### Monitor de Pagamentos
```bash
# Apenas o monitor (servidor deve estar rodando)
node payment-monitor.js
```

### Testes de Webhook
```bash
# Testar funcionamento dos webhooks
node webhook-test.js
```

### Testes Rápidos
```bash
# Verificar status dos providers
node quick-payment-test.js status

# Testar PIX
node quick-payment-test.js pix

# Testar Boleto
node quick-payment-test.js boleto

# Testar Cartão de Crédito
node quick-payment-test.js credito

# Testar Cartão de Débito
node quick-payment-test.js debito

# Listar últimas transações
node quick-payment-test.js transacoes

# Executar todos os testes rápidos
node quick-payment-test.js todos
```

## 📊 Tipos de Teste Incluídos

### ✅ Testes de Configuração
- Verificação de configuração financeira
- Validação de providers ativos
- Teste de conectividade com APIs

### 💰 Testes de Cálculo
- Cálculo de melhor taxa por provider
- Comparação de custos entre métodos
- Validação de taxas aplicadas

### 🔗 Testes de PIX
- Geração de QR Code
- Configuração de expiração
- Validação de chave PIX

### 🧾 Testes de Boleto
- Geração de código de barras
- Linha digitável
- Configuração de vencimento
- Instruções de pagamento

### 💳 Testes de Cartão
- Cartão de crédito (com parcelamento)
- Cartão de débito (à vista)
- Validação de tokens/hash
- Processamento de transações

### 📋 Testes de Transação
- Listagem de transações
- Consulta de status
- Histórico de pagamentos
- Estatísticas de uso

### 🔔 Sistema de Webhooks (Automático)
- **Mercado Pago**: Recebe notificações de pagamento
- **Stone**: Processa eventos de transação
- **PagSeguro**: Atualiza status via XML
- **Validação**: Assinatura HMAC para segurança
- **Processamento**: Atualização automática no banco
- **Notificações**: Sistema de alertas configurável

### 📊 Monitor em Tempo Real
- Verifica transações pendentes a cada 5 segundos
- API REST para consultas (`http://localhost:3001`)
- Dashboard de estatísticas
- Logs detalhados de atividade
- Restart automático em caso de falha

## 🔧 Configuração Necessária

### Pré-requisitos
1. **Servidor em execução**: `npm run dev`
2. **MongoDB conectado**: Banco de dados ativo
3. **Configuração financeira**: Providers configurados no sistema

### Variáveis de Ambiente
```bash
# Configuração padrão no test-config.json
API_BASE=http://localhost:3000/api
CONDOMINIO_ID=684f0e3e5eb749bbecf97091
MASTER_ID=684eec5c4af0e8961a18b1ff
```

## 📈 Resultados Esperados

### ✅ Teste Bem-Sucedido
```
🧪 Executando teste: Gerar PIX
✅ Gerar PIX - SUCESSO
🔗 PIX gerado: {
  payment_id: 'mp_12345',
  qr_code: 'QR Code presente',
  transacao_id: 'TXN1234567890'
}
```

### ❌ Teste com Falha
```
🧪 Executando teste: Gerar Boleto
❌ Gerar Boleto - FALHA: Provider não configurado
```

### 📊 Resumo Final
```
📊 RESUMO FINAL DOS TESTES
✅ Sucessos: 8
❌ Falhas: 2
📋 Total: 10
📈 Taxa de Sucesso: 80.0%
```

## 🛠️ Troubleshooting

### Problemas Comuns

#### 1. **Erro de Conexão**
```
Error: Cannot find module '/root/vemjoao/payment-checker.js'
```
**Solução**: Use os novos scripts:
- `payment-test-suite.js` para testes completos
- `quick-payment-test.js` para testes rápidos

#### 2. **Configuração Não Encontrada**
```
❌ Erro: Configuração financeira não encontrada
```
**Solução**: 
- Verifique se o condomínio_id e master_id estão corretos
- Confirme se existe configuração financeira no banco
- Execute: `node quick-payment-test.js status`

#### 3. **Provider Não Ativo**
```
❌ Erro: Nenhum provedor disponível para PIX
```
**Solução**:
- Verifique configuração dos providers (Mercado Pago, Stone, PagSeguro)
- Confirme credenciais dos providers
- Execute: `node quick-payment-test.js status`

#### 4. **Servidor Não Rodando**
```
❌ Erro: fetch failed
```
**Solução**: Inicie o servidor com `npm run dev`

## 📋 Checklist de Validação

### Antes de Executar
- [ ] Servidor Next.js rodando (`npm run dev`)
- [ ] MongoDB conectado
- [ ] Configuração financeira criada
- [ ] Pelo menos um provider ativo

### Durante os Testes
- [ ] PIX gera QR Code
- [ ] Boleto gera linha digitável
- [ ] Cartões processam transações
- [ ] Status das transações é consultado
- [ ] Estatísticas são geradas

### Após os Testes
- [ ] Taxa de sucesso > 80%
- [ ] Transações aparecem no banco
- [ ] Logs não mostram erros críticos
- [ ] Providers respondem corretamente

## 🔍 Análise de Performance

### Métricas Importantes
- **Tempo de resposta**: < 5 segundos por transação
- **Taxa de sucesso**: > 80% dos testes
- **Providers ativos**: Pelo menos 1 ativo
- **Transações salvas**: Todas as transações no banco

### Logs de Debug
```bash
# Para logs detalhados, adicione:
DEBUG=payment* node payment-test-suite.js
```

## 🚨 Importante

- **Não usar em produção**: Estes são dados de teste
- **Ambiente seguro**: Execute apenas em desenvolvimento
- **Backup**: Sempre faça backup antes de testar
- **Monitoramento**: Monitore logs durante os testes

## 📞 Suporte

Se encontrar problemas:
1. Verifique logs do servidor
2. Confirme configuração do banco
3. Valide credenciais dos providers
4. Execute testes individuais para isolar problemas