#!/bin/bash

# Script específico para configurar onesystemas.com.br com Cloudflare Tunnel
# Usa as configurações existentes do Cloudflare

echo "🚀 Configurando VemJoao para onesystemas.com.br..."

DOMAIN="onesystemas.com.br"
ZONE_ID="d2bbaadd33e4b361d305ead6b22a5a33"
ACCOUNT_ID="edce6eaad250573731833a36a8b2a680"

# Verificar se cloudflared está instalado
if ! command -v cloudflared &> /dev/null; then
    echo "❌ cloudflared não encontrado. Usando o existente em /home/igor/cloudflared"
    CLOUDFLARED="/home/igor/cloudflared"
else
    CLOUDFLARED="cloudflared"
fi

# Verificar se já está logado
if [ ! -f "$HOME/.cloudflared/cert.pem" ]; then
    echo "🔐 Fazendo login no Cloudflare..."
    echo "Um browser irá abrir para você fazer login no Cloudflare"
    $CLOUDFLARED tunnel login
    
    if [ $? -ne 0 ]; then
        echo "❌ Erro no login. Execute manualmente: cloudflared tunnel login"
        exit 1
    fi
    echo "✅ Login realizado com sucesso"
else
    echo "✅ Já logado no Cloudflare"
fi

# Criar tunnel se não existir
TUNNEL_NAME="vemjoao-onesystemas"
TUNNEL_ID=$($CLOUDFLARED tunnel list | grep "$TUNNEL_NAME" | awk '{print $1}')

if [ -z "$TUNNEL_ID" ]; then
    echo "🔧 Criando tunnel '$TUNNEL_NAME'..."
    $CLOUDFLARED tunnel create $TUNNEL_NAME
    TUNNEL_ID=$($CLOUDFLARED tunnel list | grep "$TUNNEL_NAME" | awk '{print $1}')
    echo "✅ Tunnel criado: $TUNNEL_ID"
else
    echo "✅ Tunnel '$TUNNEL_NAME' já existe: $TUNNEL_ID"
fi

# Criar arquivo de configuração
echo "📝 Criando arquivo de configuração..."
mkdir -p ~/.cloudflared

cat > ~/.cloudflared/config.yml << EOF
tunnel: $TUNNEL_ID
credentials-file: $HOME/.cloudflared/$TUNNEL_ID.json

ingress:
  - hostname: $DOMAIN
    service: http://localhost:3000
    originRequest:
      httpHostHeader: $DOMAIN
      
  - hostname: www.$DOMAIN  
    service: http://localhost:3000
    originRequest:
      httpHostHeader: www.$DOMAIN
      
  - service: http_status:404
EOF

echo "✅ Arquivo de configuração criado em ~/.cloudflared/config.yml"

# Configurar DNS (substitui os registros A existentes)
echo "🌐 Configurando DNS para o tunnel..."
$CLOUDFLARED tunnel route dns $TUNNEL_NAME $DOMAIN
$CLOUDFLARED tunnel route dns $TUNNEL_NAME www.$DOMAIN

echo ""
echo "🎉 Configuração concluída!"
echo ""
echo "📋 Status atual:"
echo "  • Domínio: $DOMAIN"
echo "  • Zone ID: $ZONE_ID"
echo "  • Tunnel: $TUNNEL_NAME ($TUNNEL_ID)"
echo ""
echo "📝 Próximos passos:"
echo "1. Os registros DNS serão atualizados automaticamente"
echo "2. Execute: ./start-vemjoao.sh"
echo "3. Acesse: https://onesystemas.com.br"
echo ""
echo "🔍 Para verificar:"
echo "  cloudflared tunnel info $TUNNEL_NAME"