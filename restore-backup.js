#!/usr/bin/env node

/**
 * SCRIPT DE RESTAURAÇÃO DE EMERGÊNCIA - VemJoao
 * 
 * Este script permite restaurar backups diretamente no MongoDB
 * sem depender do sistema web (front-end ou back-end)
 * 
 * USO:
 * node restore-backup.js [caminho-do-arquivo-backup.json]
 * 
 * EXEMPLO:
 * node restore-backup.js backup_2025-01-13-10-30-00.json
 * 
 * REQUISITOS:
 * - Node.js instalado
 * - Arquivo de backup válido (.json)
 * - Acesso ao MongoDB
 */

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const readline = require('readline');

// Configurações
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vemjoao';
const DB_NAME = 'vemjoao';

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

// Função para log colorido
function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

// Função para input do usuário
function askQuestion(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// Função para validar arquivo de backup
function validateBackupFile(filePath) {
  try {
    // Verificar se arquivo existe
    if (!fs.existsSync(filePath)) {
      throw new Error(`Arquivo não encontrado: ${filePath}`);
    }

    // Verificar extensão
    if (!filePath.endsWith('.json')) {
      throw new Error('Arquivo deve ter extensão .json');
    }

    // Ler e validar JSON
    const content = fs.readFileSync(filePath, 'utf8');
    const backup = JSON.parse(content);

    // Validar estrutura
    if (!backup.master_id) {
      throw new Error('Backup inválido: master_id não encontrado');
    }

    if (!backup.data) {
      throw new Error('Backup inválido: seção data não encontrada');
    }

    if (!backup.timestamp) {
      throw new Error('Backup inválido: timestamp não encontrado');
    }

    return backup;
  } catch (error) {
    throw new Error(`Erro ao validar arquivo: ${error.message}`);
  }
}

// Função para conectar ao MongoDB
async function connectToMongoDB() {
  try {
    log(colors.blue, '🔗 Conectando ao MongoDB...');
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    log(colors.green, '✅ Conectado ao MongoDB com sucesso!');
    return client;
  } catch (error) {
    throw new Error(`Erro ao conectar ao MongoDB: ${error.message}`);
  }
}

// Função para fazer backup dos dados atuais (segurança)
async function createSafetyBackup(db, masterId) {
  try {
    log(colors.yellow, '🛡️  Criando backup de segurança dos dados atuais...');
    
    const collections = ['condominios', 'moradores', 'administradores', 'colaboradores', 'contas_bancarias', 'status_pagamentos'];
    const safetyData = {
      timestamp: new Date().toISOString(),
      master_id: masterId,
      version: "1.0",
      type: "safety_backup",
      data: {}
    };

    for (const collectionName of collections) {
      const collection = db.collection(collectionName);
      const data = await collection.find({ master_id: masterId }).toArray();
      safetyData.data[collectionName] = data;
      log(colors.cyan, `   📋 ${collectionName}: ${data.length} registros salvos`);
    }

    const safetyFileName = `safety_backup_${masterId}_${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.json`;
    fs.writeFileSync(safetyFileName, JSON.stringify(safetyData, null, 2));
    
    log(colors.green, `✅ Backup de segurança criado: ${safetyFileName}`);
    return safetyFileName;
  } catch (error) {
    throw new Error(`Erro ao criar backup de segurança: ${error.message}`);
  }
}

// Função para restaurar dados
async function restoreData(db, backupData) {
  try {
    const masterId = backupData.master_id;
    log(colors.blue, `🔄 Iniciando restauração para master_id: ${masterId}`);

    const collections = ['condominios', 'moradores', 'administradores', 'colaboradores', 'contas_bancarias', 'status_pagamentos'];
    let totalRestored = 0;

    for (const collectionName of collections) {
      const collection = db.collection(collectionName);
      const dataArray = backupData.data[collectionName] || [];
      
      if (dataArray.length > 0) {
        // Remover dados existentes do master
        const deleteResult = await collection.deleteMany({ master_id: masterId });
        log(colors.yellow, `   🗑️  ${collectionName}: ${deleteResult.deletedCount} registros removidos`);
        
        // Inserir novos dados
        const insertResult = await collection.insertMany(dataArray);
        log(colors.green, `   ✅ ${collectionName}: ${insertResult.insertedCount} registros inseridos`);
        
        totalRestored += insertResult.insertedCount;
      } else {
        log(colors.cyan, `   ⏭️  ${collectionName}: nenhum dado para restaurar`);
      }
    }

    return totalRestored;
  } catch (error) {
    throw new Error(`Erro durante restauração: ${error.message}`);
  }
}

// Função principal
async function main() {
  try {
    // Banner
    log(colors.magenta, '╔════════════════════════════════════════════════════════════╗');
    log(colors.magenta, '║               RESTAURAÇÃO DE EMERGÊNCIA - VemJoao         ║');
    log(colors.magenta, '║                                                            ║');
    log(colors.magenta, '║   🚨 ATENÇÃO: Este script substitui TODOS os dados!       ║');
    log(colors.magenta, '║   📋 Um backup de segurança será criado automaticamente   ║');
    log(colors.magenta, '╚════════════════════════════════════════════════════════════╝');
    console.log('');

    // Verificar argumentos
    const args = process.argv.slice(2);
    if (args.length === 0) {
      log(colors.red, '❌ Erro: Especifique o arquivo de backup');
      log(colors.white, 'Uso: node restore-backup.js [arquivo-backup.json]');
      log(colors.white, 'Exemplo: node restore-backup.js backup_2025-01-13-10-30-00.json');
      process.exit(1);
    }

    const backupFilePath = args[0];
    
    // Validar arquivo
    log(colors.blue, '📁 Validando arquivo de backup...');
    const backupData = validateBackupFile(backupFilePath);
    
    log(colors.green, '✅ Arquivo de backup válido!');
    log(colors.cyan, `   📅 Data do backup: ${new Date(backupData.timestamp).toLocaleString('pt-BR')}`);
    log(colors.cyan, `   👤 Master ID: ${backupData.master_id}`);
    log(colors.cyan, `   📊 Versão: ${backupData.version}`);
    
    // Mostrar estatísticas
    const stats = Object.keys(backupData.data).map(key => ({
      collection: key,
      count: backupData.data[key].length
    }));
    
    console.log('');
    log(colors.yellow, '📊 Dados que serão restaurados:');
    stats.forEach(stat => {
      log(colors.white, `   • ${stat.collection}: ${stat.count} registros`);
    });
    console.log('');

    // Confirmação do usuário
    const confirmation = await askQuestion('⚠️  Tem certeza que deseja prosseguir? Digite "CONFIRMO" para continuar: ');
    
    if (confirmation !== 'CONFIRMO') {
      log(colors.yellow, '⏹️  Operação cancelada pelo usuário');
      process.exit(0);
    }

    // Conectar ao MongoDB
    const client = await connectToMongoDB();
    const db = client.db(DB_NAME);

    // Criar backup de segurança
    const safetyBackupFile = await createSafetyBackup(db, backupData.master_id);

    // Restaurar dados
    log(colors.blue, '🔄 Iniciando restauração...');
    const totalRestored = await restoreData(db, backupData);

    // Fechar conexão
    await client.close();

    // Resultado
    console.log('');
    log(colors.green, '🎉 RESTAURAÇÃO CONCLUÍDA COM SUCESSO!');
    log(colors.white, `   📊 Total de registros restaurados: ${totalRestored}`);
    log(colors.white, `   🛡️  Backup de segurança: ${safetyBackupFile}`);
    log(colors.yellow, '   ⚠️  Reinicie o sistema web para ver as mudanças');
    console.log('');

  } catch (error) {
    log(colors.red, `❌ ERRO: ${error.message}`);
    process.exit(1);
  }
}

// Executar apenas se chamado diretamente
if (require.main === module) {
  main();
}