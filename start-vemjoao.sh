#!/bin/bash

# Script para iniciar o VemJoao com Cloudflare Tunnel
# Inicia a aplicação Next.js e o tunnel em paralelo

echo "🚀 Iniciando VemJoao com Cloudflare Tunnel..."

# Verificar se as dependências estão instaladas
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install
fi

# Verificar se o tunnel está configurado
if [ ! -f "$HOME/.cloudflared/config.yml" ]; then
    echo "❌ Tunnel não configurado. Execute primeiro:"
    echo "./setup-cloudflare.sh"
    exit 1
fi

# Criar logs directory se não existir
mkdir -p logs

# Função para cleanup ao sair
cleanup() {
    echo ""
    echo "🛑 Parando serviços..."
    kill $NEXTJS_PID 2>/dev/null
    kill $TUNNEL_PID 2>/dev/null
    echo "✅ Serviços parados"
    exit 0
}

# Configurar trap para cleanup
trap cleanup SIGINT SIGTERM

# Verificar se a porta 3002 está livre
if lsof -Pi :3002 -sTCP:LISTEN -t >/dev/null ; then
    echo "❌ Porta 3002 já está em uso"
    echo "Execute: lsof -ti:3002 | xargs kill -9"
    exit 1
fi

echo "🔧 Iniciando Next.js..."
# Iniciar Next.js em background
PORT=3002 npm run dev > logs/nextjs.log 2> logs/nextjs-error.log &
NEXTJS_PID=$!

# Aguardar Next.js iniciar
echo "⏳ Aguardando Next.js inicializar..."
sleep 5

# Verificar se Next.js está rodando
if ! kill -0 $NEXTJS_PID 2>/dev/null; then
    echo "❌ Erro ao iniciar Next.js. Verifique logs/nextjs-error.log"
    exit 1
fi

# Aguardar porta 3002 ficar disponível
echo "⏳ Aguardando porta 3002..."
while ! nc -z localhost 3002; do
    sleep 1
done

echo "✅ Next.js rodando na porta 3002"

echo "🌐 Iniciando Cloudflare Tunnel..."
# Iniciar Cloudflare Tunnel
cloudflared tunnel run > logs/tunnel.log 2> logs/tunnel-error.log &
TUNNEL_PID=$!

# Aguardar tunnel iniciar
sleep 3

# Verificar se tunnel está rodando
if ! kill -0 $TUNNEL_PID 2>/dev/null; then
    echo "❌ Erro ao iniciar tunnel. Verifique logs/tunnel-error.log"
    kill $NEXTJS_PID 2>/dev/null
    exit 1
fi

echo "✅ Tunnel ativo"

# Mostrar informações
echo ""
echo "🎉 VemJoao está rodando!"
echo ""
echo "📊 Status dos serviços:"
echo "  • Next.js: http://localhost:3002"
echo "  • Cloudflare Tunnel: Ativo"
echo ""
echo "📋 Logs disponíveis:"
echo "  • Next.js: tail -f logs/nextjs.log"
echo "  • Tunnel: tail -f logs/tunnel.log"
echo ""
echo "🌐 Acesse seu site através do domínio configurado"
echo ""
echo "Pressione Ctrl+C para parar os serviços"

# Manter script rodando
wait