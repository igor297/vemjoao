#!/bin/bash

# Script de inicialização para Railway
echo "🚀 Iniciando aplicação no Railway..."

# Verificar se as variáveis de ambiente estão configuradas
if [ -z "$MONGODB_URI" ]; then
    echo "❌ ERRO: MONGODB_URI não configurado!"
    echo "Configure as variáveis de ambiente no Railway Dashboard:"
    echo "MONGODB_URI=mongodb://mongo:tJhXIsPGeEmWUhKehhXEkhMTegYIRQBC@mongodb.railway.internal:27017/condominio-sistema"
    exit 1
fi

echo "✅ MongoDB URI configurado: ${MONGODB_URI:0:20}..."

# Iniciar a aplicação
echo "🎯 Iniciando Next.js..."
npm start