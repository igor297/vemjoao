# 🚀 Como Ativar PIX Real no Sistema

## 📋 Pré-requisitos

Você precisa de uma conta no **Mercado Pago** (recomendado) ou outro provedor de pagamentos.

## 🔧 Passo a Passo

### 1. Criar Conta no Mercado Pago

1. Acesse: https://www.mercadopago.com.br/
2. Crie uma conta empresarial
3. Complete a verificação da conta

### 2. Obter Credenciais

1. Acesse: https://www.mercadopago.com.br/developers/panel/app
2. Clique em "Criar aplicação"
3. Escolha "Pagamentos online e marketplace"
4. Copie as credenciais de **PRODUÇÃO** (não sandbox)

### 3. Configurar no Sistema

Edite o arquivo `.env.local` e adicione:

```bash
# PIX Real - Mercado Pago
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-seu-access-token-aqui
MERCADO_PAGO_PUBLIC_KEY=APP_USR-sua-public-key-aqui
PIX_USE_REAL=true
```

### 4. Reiniciar Servidor

```bash
npm run dev
```

## ✅ Verificar se Funcionou

1. Acesse: http://localhost:3000/admin/pix-config
2. Veja se aparece "PIX Real: ATIVADO"
3. Teste gerando um pagamento PIX

## 🧪 Testar PIX Real

```bash
# Fazer um pagamento de teste
curl -X POST http://localhost:3000/api/portal-pagamento \
  -H "Content-Type: application/json" \
  -d '{
    "financeiro_id": "6864123bba26060fe47399f8",
    "morador_id": "6850d4039f51319e5bfc3036", 
    "condominio_id": "684f0e3e5eb749bbecf97091",
    "master_id": "684eec5c4af0e8961a18b1ff",
    "valor": 10,
    "metodo_pagamento": "pix",
    "descricao": "Teste PIX Real"
  }'
```

## 📱 QR Code Real

Com PIX real ativado, o sistema vai:

1. **Gerar QR Code real** - escaneável pelos bancos
2. **Receber notificações** - quando o pagamento for confirmado
3. **Atualizar status** - automaticamente no sistema

## 🔒 Segurança

- **Nunca** commite as credenciais no Git
- Use apenas credenciais de **produção** em ambiente real
- Mantenha o `.env.local` no `.gitignore`

## 🆘 Problemas Comuns

### PIX não gera
- Verifique se `PIX_USE_REAL=true`
- Confirme se o access token está correto
- Veja os logs do servidor

### QR Code inválido
- Teste as credenciais em: http://localhost:3000/admin/pix-config
- Verifique se a conta Mercado Pago está ativa

### Pagamento não confirma
- Configure webhooks no painel do Mercado Pago
- Aponte para: `https://seudominio.com/api/webhooks/mercado-pago`

## 💡 Alternativas

### OpenPix (Simples)
```bash
OPENPIX_APP_ID=seu-app-id
PIX_DEFAULT_PROVIDER=openpix
PIX_USE_REAL=true
```

### Stone
```bash
STONE_API_KEY=sua-api-key
STONE_SECRET_KEY=sua-secret-key
PIX_DEFAULT_PROVIDER=stone
PIX_USE_REAL=true
```

## 📞 Suporte

Se precisar de ajuda:
1. Verifique os logs do servidor
2. Teste na página: `/admin/pix-config`
3. Consulte a documentação do Mercado Pago