#!/bin/bash

# Script para iniciar o VemJoao em screen
# Usa screen para manter o processo rodando mesmo após desconectar SSH

echo "🚀 Iniciando VemJoao em screen..."

# Verificar se as dependências estão instaladas
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install
fi

# Criar logs directory se não existir
mkdir -p logs

# Verificar se screen está instalado
if ! command -v screen &> /dev/null; then
    echo "❌ Screen não encontrado. Instalando..."
    sudo apt update && sudo apt install -y screen
fi

# Parar sessão existente
echo "🛑 Parando sessão anterior..."
screen -S vemjoao -X quit 2>/dev/null || true
sleep 2

# Verificar se a porta 3002 está livre
if lsof -Pi :3002 -sTCP:LISTEN -t >/dev/null ; then
    echo "❌ Porta 3002 já está em uso"
    echo "Execute: lsof -ti:3002 | xargs kill -9"
    exit 1
fi

echo "🔧 Iniciando VemJoao na porta 3002 em screen..."
# Iniciar VemJoao em sessão screen
screen -dmS vemjoao bash -c "cd /home/igor/vemjoao && PORT=3002 npm run dev > logs/nextjs.log 2> logs/nextjs-error.log; exec bash"

# Aguardar inicializar
echo "⏳ Aguardando VemJoao inicializar..."
sleep 8

# Aguardar porta 3002 ficar disponível
echo "⏳ Aguardando porta 3002..."
timeout=30
while ! nc -z localhost 3002 && [ $timeout -gt 0 ]; do
    sleep 1
    ((timeout--))
done

if [ $timeout -eq 0 ]; then
    echo "❌ Timeout aguardando VemJoao na porta 3002"
    echo "📋 Verifique os logs: tail -f logs/nextjs-error.log"
    exit 1
fi

echo "✅ VemJoao rodando na porta 3002"

# Mostrar informações
echo ""
echo "🎉 VemJoao está rodando em sessão screen!"
echo ""
echo "📊 Status do serviço:"
echo "  • VemJoao: http://localhost:3002 (screen: vemjoao)"
echo ""
echo "📋 Comandos úteis:"
echo "  • Ver sessões: screen -ls"
echo "  • Conectar ao VemJoao: screen -r vemjoao"
echo "  • Sair do screen: Ctrl+A+D"
echo ""
echo "📋 Logs disponíveis:"
echo "  • VemJoao: tail -f logs/nextjs.log"
echo "  • Erros: tail -f logs/nextjs-error.log"
echo ""
echo "🌐 Acesse:"
echo "  • Local: http://localhost:3002"
echo "  • Público: https://admin.onesystemas.com.br"
echo ""
echo "✅ O serviço continuará rodando mesmo se você desconectar do SSH!"
echo "💡 Para parar: ./stop-vemjoao.sh"