#!/usr/bin/env node

/**
 * VERIFICADOR DE BACKUP - VemJoao
 * 
 * Script para verificar e analisar arquivos de backup
 * sem modificar dados no banco
 * 
 * USO:
 * node check-backup.js [arquivo-backup.json]
 */

const fs = require('fs');
const path = require('path');

// Cores para terminal
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

function analyzeBackup(filePath) {
  try {
    // Verificar se arquivo existe
    if (!fs.existsSync(filePath)) {
      throw new Error(`Arquivo não encontrado: ${filePath}`);
    }

    // Obter informações do arquivo
    const stats = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    const backup = JSON.parse(content);

    // Banner
    log(colors.blue, '╔════════════════════════════════════════════════════════════╗');
    log(colors.blue, '║                 ANÁLISE DE BACKUP - VemJoao               ║');
    log(colors.blue, '╚════════════════════════════════════════════════════════════╝');
    console.log('');

    // Informações do arquivo
    log(colors.cyan, '📁 INFORMAÇÕES DO ARQUIVO:');
    log(colors.white, `   • Arquivo: ${path.basename(filePath)}`);
    log(colors.white, `   • Tamanho: ${(stats.size / 1024).toFixed(2)} KB`);
    log(colors.white, `   • Modificado: ${stats.mtime.toLocaleString('pt-BR')}`);
    console.log('');

    // Validação da estrutura
    log(colors.cyan, '🔍 VALIDAÇÃO DA ESTRUTURA:');
    
    const checks = [
      { field: 'timestamp', value: backup.timestamp, required: true },
      { field: 'master_id', value: backup.master_id, required: true },
      { field: 'version', value: backup.version, required: true },
      { field: 'data', value: backup.data, required: true }
    ];

    let isValid = true;
    checks.forEach(check => {
      if (check.required && !check.value) {
        log(colors.red, `   ❌ ${check.field}: AUSENTE`);
        isValid = false;
      } else {
        log(colors.green, `   ✅ ${check.field}: ${check.value || 'Presente'}`);
      }
    });

    if (!isValid) {
      log(colors.red, '\n❌ BACKUP INVÁLIDO - Estrutura incompleta');
      return;
    }

    console.log('');

    // Informações do backup
    log(colors.cyan, '📊 INFORMAÇÕES DO BACKUP:');
    log(colors.white, `   • Data de criação: ${new Date(backup.timestamp).toLocaleString('pt-BR')}`);
    log(colors.white, `   • Master ID: ${backup.master_id}`);
    log(colors.white, `   • Versão: ${backup.version}`);
    if (backup.type) {
      log(colors.white, `   • Tipo: ${backup.type}`);
    }
    console.log('');

    // Análise dos dados
    log(colors.cyan, '📋 DADOS POR COLEÇÃO:');
    
    const collections = ['condominios', 'moradores', 'administradores', 'colaboradores', 'contas_bancarias', 'status_pagamentos'];
    let totalRecords = 0;
    
    collections.forEach(collectionName => {
      const data = backup.data[collectionName] || [];
      totalRecords += data.length;
      
      if (data.length > 0) {
        log(colors.green, `   ✅ ${collectionName}: ${data.length} registros`);
        
        // Mostrar uma amostra dos campos se houver dados
        if (data[0]) {
          const fields = Object.keys(data[0]).filter(key => !key.startsWith('_')).slice(0, 5);
          log(colors.white, `      📝 Campos: ${fields.join(', ')}${fields.length < Object.keys(data[0]).length ? '...' : ''}`);
        }
      } else {
        log(colors.yellow, `   ⚠️  ${collectionName}: vazio`);
      }
    });

    console.log('');
    log(colors.magenta, `📊 TOTAL DE REGISTROS: ${totalRecords}`);

    // Verificações adicionais
    console.log('');
    log(colors.cyan, '🔍 VERIFICAÇÕES ADICIONAIS:');

    // Verificar consistência de master_id
    let masterIdConsistent = true;
    collections.forEach(collectionName => {
      const data = backup.data[collectionName] || [];
      data.forEach((item, index) => {
        if (item.master_id && item.master_id !== backup.master_id) {
          log(colors.red, `   ❌ ${collectionName}[${index}]: master_id inconsistente (${item.master_id})`);
          masterIdConsistent = false;
        }
      });
    });

    if (masterIdConsistent) {
      log(colors.green, '   ✅ Master ID consistente em todos os registros');
    }

    // Verificar se há dados relacionais
    const condominios = backup.data.condominios || [];
    const moradores = backup.data.moradores || [];
    
    if (condominios.length > 0 && moradores.length > 0) {
      log(colors.green, '   ✅ Dados relacionais presentes (condomínios + moradores)');
    } else if (condominios.length === 0 && moradores.length === 0) {
      log(colors.yellow, '   ⚠️  Backup não contém dados principais');
    }

    // Verificar data de criação
    const backupDate = new Date(backup.timestamp);
    const now = new Date();
    const daysDiff = Math.floor((now - backupDate) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 0) {
      log(colors.green, '   ✅ Backup criado hoje');
    } else if (daysDiff <= 7) {
      log(colors.yellow, `   ⚠️  Backup criado há ${daysDiff} dia(s)`);
    } else {
      log(colors.red, `   ❌ Backup antigo (${daysDiff} dias)`);
    }

    console.log('');
    log(colors.green, '✅ ANÁLISE CONCLUÍDA - Backup parece válido para restauração');
    console.log('');

  } catch (error) {
    console.log('');
    log(colors.red, `❌ ERRO: ${error.message}`);
    console.log('');
  }
}

// Função principal
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    log(colors.red, '❌ Erro: Especifique o arquivo de backup para analisar');
    log(colors.white, 'Uso: node check-backup.js [arquivo-backup.json]');
    log(colors.white, 'Exemplo: node check-backup.js backup_2025-01-13-10-30-00.json');
    process.exit(1);
  }

  const backupFilePath = args[0];
  analyzeBackup(backupFilePath);
}

// Executar apenas se chamado diretamente
if (require.main === module) {
  main();
}

module.exports = { analyzeBackup };