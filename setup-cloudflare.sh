#!/bin/bash

# Script para configurar Cloudflare Tunnel para o VemJoao
# Execute este script para configurar o tunnel automaticamente

echo "🚀 Configurando Cloudflare Tunnel para VemJoao..."

# Verificar se cloudflared está instalado
if ! command -v cloudflared &> /dev/null; then
    echo "❌ cloudflared não encontrado. Instalando..."
    
    # Detectar arquitetura
    ARCH=$(uname -m)
    if [[ "$ARCH" == "x86_64" ]]; then
        ARCH="amd64"
    elif [[ "$ARCH" == "aarch64" ]]; then
        ARCH="arm64"
    fi
    
    # Baixar e instalar cloudflared
    wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${ARCH}.deb
    sudo dpkg -i cloudflared-linux-${ARCH}.deb
    rm cloudflared-linux-${ARCH}.deb
    
    echo "✅ cloudflared instalado"
fi

# Verificar se já está logado
if [ ! -f "$HOME/.cloudflared/cert.pem" ]; then
    echo "🔐 Fazendo login no Cloudflare..."
    echo "Um browser irá abrir para você fazer login no Cloudflare"
    cloudflared tunnel login
    
    if [ $? -ne 0 ]; then
        echo "❌ Erro no login. Execute manualmente: cloudflared tunnel login"
        exit 1
    fi
    echo "✅ Login realizado com sucesso"
else
    echo "✅ Já logado no Cloudflare"
fi

# Usar domínio já configurado no Cloudflare
DOMAIN="onesystemas.com.br"
echo "🌐 Usando domínio: $DOMAIN"

# Criar tunnel se não existir
TUNNEL_NAME="vemjoao"
TUNNEL_ID=$(cloudflared tunnel list | grep "$TUNNEL_NAME" | awk '{print $1}')

if [ -z "$TUNNEL_ID" ]; then
    echo "🔧 Criando tunnel '$TUNNEL_NAME'..."
    cloudflared tunnel create $TUNNEL_NAME
    TUNNEL_ID=$(cloudflared tunnel list | grep "$TUNNEL_NAME" | awk '{print $1}')
    echo "✅ Tunnel criado: $TUNNEL_ID"
else
    echo "✅ Tunnel '$TUNNEL_NAME' já existe: $TUNNEL_ID"
fi

# Criar arquivo de configuração
echo "📝 Criando arquivo de configuração..."
cat > ~/.cloudflared/config.yml << EOF
tunnel: $TUNNEL_ID
credentials-file: $HOME/.cloudflared/$TUNNEL_ID.json

ingress:
  - hostname: $DOMAIN
    service: http://localhost:3000
  - hostname: www.$DOMAIN  
    service: http://localhost:3000
  - service: http_status:404
EOF

echo "✅ Arquivo de configuração criado em ~/.cloudflared/config.yml"

# Configurar DNS
echo "🌐 Configurando DNS..."
cloudflared tunnel route dns $TUNNEL_NAME $DOMAIN
cloudflared tunnel route dns $TUNNEL_NAME www.$DOMAIN

echo ""
echo "🎉 Configuração concluída!"
echo ""
echo "📋 Próximos passos:"
echo "1. No painel do Cloudflare (dash.cloudflare.com):"
echo "   - Adicione seu domínio $DOMAIN"
echo "   - Configure os nameservers"
echo "   - Ative o proxy (nuvem laranja)"
echo ""
echo "2. Para iniciar o tunnel:"
echo "   ./start-vemjoao.sh"
echo ""
echo "3. Seu site estará disponível em:"
echo "   https://$DOMAIN (https://onesystemas.com.br)"
echo "   https://www.$DOMAIN (https://www.onesystemas.com.br)"