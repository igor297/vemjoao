# 🚀 Configuração Cloudflare para VemJoao

Este guia te ajudará a conectar o VemJoao com Cloudflare usando Cloudflare Tunnel.

## 📋 Pré-requisitos

- [ ] Conta no Cloudflare (gratuita)
- [ ] Domínio próprio
- [ ] Node.js instalado
- [ ] MongoDB rodando

## 🛠️ O que você precisa fazer no Cloudflare

### 1. Adicionar seu domínio no Cloudflare

1. Acesse [dash.cloudflare.com](https://dash.cloudflare.com)
2. Clique em **"Add a Site"**
3. Digite seu domínio (ex: `meusite.com`)
4. Escolha o plano **Free**
5. Cloudflare irá escanear seus DNS records

### 2. Configurar Nameservers

1. Cloudflare mostrará 2 nameservers (ex: `nina.ns.cloudflare.com`)
2. Vá no painel do seu registrador de domínio
3. Substitua os nameservers pelos do Cloudflare
4. Aguarde propagação (pode levar até 24h, geralmente 1-2h)

### 3. Configurar DNS Records

No painel do Cloudflare, vá em **DNS > Records**:

- **Tipo A**: `@` → `192.0.2.1` (IP temporário, será substituído pelo tunnel)
- **Tipo A**: `www` → `192.0.2.1` (IP temporário)
- **Proxy Status**: 🟠 Proxied (nuvem laranja ativa)

## 🔧 Configuração Local

### 1. Executar o setup automático

```bash
cd /home/igor/vemjoao

# Dar permissão aos scripts
chmod +x setup-cloudflare.sh
chmod +x start-vemjoao.sh

# Executar configuração
./setup-cloudflare.sh
```

O script irá:
- ✅ Instalar cloudflared (se necessário)
- ✅ Fazer login no Cloudflare (abrirá browser)
- ✅ Criar tunnel "vemjoao"
- ✅ Configurar DNS automaticamente
- ✅ Criar arquivo de configuração

### 2. Iniciar a aplicação

```bash
./start-vemjoao.sh
```

## 🌐 Configurações Opcionais no Cloudflare

### SSL/TLS
- Vá em **SSL/TLS > Overview**
- Modo: **Full (strict)** (recomendado)

### Security
- **Security > Settings**:
  - Security Level: **Medium**
  - Challenge Passage: **30 minutes**

### Speed
- **Speed > Optimization**:
  - Auto Minify: ✅ HTML, CSS, JS
  - Brotli: ✅ Enable

### Page Rules (opcional)
Crie regras para otimizar:
- `*.seudominio.com/*` → Cache Level: Standard

## 🔍 Verificação

### 1. Teste local
```bash
curl http://localhost:3000/api/health
```

### 2. Teste domínio
```bash
curl https://seudominio.com/api/health
```

### 3. Logs
```bash
# Logs do Next.js
tail -f logs/nextjs.log

# Logs do Tunnel
tail -f logs/tunnel.log
```

## 🆘 Resolução de Problemas

### Erro: "Tunnel not found"
```bash
cloudflared tunnel delete vemjoao
./setup-cloudflare.sh
```

### Erro: "Port 3000 already in use"
```bash
lsof -ti:3000 | xargs kill -9
./start-vemjoao.sh
```

### DNS não resolve
- Verifique se nameservers foram alterados
- Aguarde propagação DNS (1-24h)
- Teste: `nslookup seudominio.com`

### Tunnel não conecta
```bash
# Verificar status
cloudflared tunnel info vemjoao

# Testar conexão
cloudflared tunnel run --url http://localhost:3000
```

## 📊 Monitoramento

### Logs em tempo real
```bash
# Terminal 1: Next.js
tail -f logs/nextjs.log

# Terminal 2: Tunnel
tail -f logs/tunnel.log

# Terminal 3: Erros
tail -f logs/*-error.log
```

### Status dos serviços
```bash
# Verificar se Next.js está rodando
curl http://localhost:3000/api/health

# Verificar processos
ps aux | grep -E "(next|cloudflared)"
```

## 🎯 Comandos Úteis

```bash
# Parar todos os serviços
pkill -f "next\|cloudflared"

# Reiniciar apenas o tunnel
cloudflared tunnel run &

# Ver todos os tunnels
cloudflared tunnel list

# Deletar tunnel
cloudflared tunnel delete vemjoao

# Ver configuração atual
cat ~/.cloudflared/config.yml
```

## ✅ Checklist Final

- [ ] Domínio adicionado no Cloudflare
- [ ] Nameservers configurados
- [ ] DNS records criados
- [ ] SSL configurado como "Full (strict)"
- [ ] Setup local executado
- [ ] Aplicação rodando com `./start-vemjoao.sh`
- [ ] Site acessível via HTTPS
- [ ] API funcionando corretamente

## 🎉 Pronto!

Seu VemJoao agora está rodando com Cloudflare:
- 🔒 HTTPS automático
- 🚀 Cache global
- 🛡️ Proteção DDoS
- 📊 Analytics
- 🌍 CDN mundial

Acesse: `https://seudominio.com`