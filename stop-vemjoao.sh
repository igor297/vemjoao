#!/bin/bash

# Script para parar o VemJoao

echo "🛑 Parando VemJoao..."

# Parar sessão screen
if screen -list | grep -q "vemjoao"; then
    echo "  Parando sessão: vemjoao"
    screen -S "vemjoao" -X quit 2>/dev/null || true
else
    echo "  Sessão vemjoao não encontrada"
fi

# Aguardar um pouco
sleep 3

# Matar processo na porta 3002 como backup
echo "🔪 Verificando processo na porta 3002..."
if lsof -Pi :3002 -sTCP:LISTEN -t >/dev/null ; then
    echo "  Parando processo na porta 3002..."
    lsof -ti:3002 | xargs kill -9 2>/dev/null || true
fi

# Verificar status final
echo ""
echo "📊 Status final:"
if screen -list | grep -q "vemjoao"; then
    echo "❌ Sessão ainda está rodando:"
    screen -list | grep "vemjoao"
else
    echo "✅ Sessão screen foi parada"
fi

if lsof -Pi :3002 -sTCP:LISTEN -t >/dev/null ; then
    echo "❌ Porta 3002 ainda está em uso"
else
    echo "✅ Porta 3002 foi liberada"
fi

echo ""
echo "✅ VemJoao parado com sucesso!"
echo "💡 Para reiniciar: ./start-vemjoao-screen.sh"