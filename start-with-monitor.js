#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuração
const CONFIG = {
  nextjs_port: 3000,
  monitor_port: 3001,
  log_dir: './logs',
  restart_on_crash: true,
  max_restarts: 5,
  restart_delay: 5000 // 5 segundos
};

class PaymentSystemManager {
  constructor() {
    this.processes = {
      nextjs: null,
      monitor: null
    };
    this.restartCounts = {
      nextjs: 0,
      monitor: 0
    };
    this.isShuttingDown = false;
    this.setupLogDirectory();
  }

  setupLogDirectory() {
    if (!fs.existsSync(CONFIG.log_dir)) {
      fs.mkdirSync(CONFIG.log_dir, { recursive: true });
      console.log(`📁 Diretório de logs criado: ${CONFIG.log_dir}`);
    }
  }

  async start() {
    console.log('🚀 Iniciando Sistema de Pagamentos Completo');
    console.log('==========================================');
    
    // Verificar se as portas estão livres
    await this.checkPorts();
    
    // Iniciar Next.js
    await this.startNextJS();
    
    // Aguardar o Next.js subir completamente
    await this.waitForNextJS();
    
    // Iniciar Monitor
    await this.startMonitor();
    
    // Configurar handlers de sinal
    this.setupSignalHandlers();
    
    console.log('\n✅ Sistema completo iniciado com sucesso!');
    console.log(`📡 Next.js rodando em: http://localhost:${CONFIG.nextjs_port}`);
    console.log(`📊 Monitor rodando em: http://localhost:${CONFIG.monitor_port}`);
    console.log('\n📋 Comandos disponíveis:');
    console.log('  Ctrl+C - Parar sistema');
    console.log('  rs - Reiniciar ambos os serviços');
    console.log(`  logs - Ver logs (disponível em ${CONFIG.log_dir})`);
    
    // Configurar entrada do usuário
    this.setupUserInput();
  }

  async checkPorts() {
    const net = require('net');
    
    const checkPort = (port) => {
      return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(port, () => {
          server.once('close', () => resolve(true));
          server.close();
        });
        server.on('error', () => resolve(false));
      });
    };

    const nextjsAvailable = await checkPort(CONFIG.nextjs_port);
    const monitorAvailable = await checkPort(CONFIG.monitor_port);

    if (!nextjsAvailable) {
      throw new Error(`Porta ${CONFIG.nextjs_port} já está em uso (Next.js)`);
    }
    
    if (!monitorAvailable) {
      throw new Error(`Porta ${CONFIG.monitor_port} já está em uso (Monitor)`);
    }

    console.log('✅ Portas disponíveis verificadas');
  }

  async startNextJS() {
    console.log('🔄 Iniciando servidor Next.js...');
    
    const logFile = fs.createWriteStream(path.join(CONFIG.log_dir, 'nextjs.log'), { flags: 'a' });
    const errorFile = fs.createWriteStream(path.join(CONFIG.log_dir, 'nextjs-error.log'), { flags: 'a' });
    
    this.processes.nextjs = spawn('npm', ['run', 'dev'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { 
        ...process.env, 
        PORT: CONFIG.nextjs_port.toString(),
        NODE_ENV: 'development'
      }
    });

    // Redirecionar logs
    this.processes.nextjs.stdout.pipe(logFile);
    this.processes.nextjs.stderr.pipe(errorFile);

    // Mostrar logs em tempo real no console
    this.processes.nextjs.stdout.on('data', (data) => {
      const message = data.toString().trim();
      if (message) {
        console.log(`[Next.js] ${message}`);
      }
    });

    this.processes.nextjs.stderr.on('data', (data) => {
      const message = data.toString().trim();
      if (message && !message.includes('warn')) {
        console.error(`[Next.js Error] ${message}`);
      }
    });

    // Configurar restart automático
    this.processes.nextjs.on('exit', (code) => {
      console.log(`⚠️  Next.js terminou com código: ${code}`);
      
      if (!this.isShuttingDown && CONFIG.restart_on_crash && this.restartCounts.nextjs < CONFIG.max_restarts) {
        this.restartCounts.nextjs++;
        console.log(`🔄 Reiniciando Next.js (tentativa ${this.restartCounts.nextjs}/${CONFIG.max_restarts})...`);
        
        setTimeout(() => {
          this.startNextJS();
        }, CONFIG.restart_delay);
      }
    });

    console.log('✅ Next.js iniciado');
  }

  async waitForNextJS() {
    console.log('⏳ Aguardando Next.js ficar pronto...');
    
    const maxAttempts = 30; // 30 segundos
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(`http://localhost:${CONFIG.nextjs_port}/api/health`);
        if (response.ok) {
          console.log('✅ Next.js está pronto');
          return;
        }
      } catch (error) {
        // Servidor ainda não está pronto
      }

      attempts++;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('⚠️  Next.js demorou para ficar pronto, prosseguindo...');
  }

  async startMonitor() {
    console.log('🔄 Iniciando monitor de pagamentos...');
    
    const logFile = fs.createWriteStream(path.join(CONFIG.log_dir, 'monitor.log'), { flags: 'a' });
    const errorFile = fs.createWriteStream(path.join(CONFIG.log_dir, 'monitor-error.log'), { flags: 'a' });
    
    this.processes.monitor = spawn('node', ['payment-monitor.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { 
        ...process.env,
        NODE_ENV: 'development'
      }
    });

    // Redirecionar logs
    this.processes.monitor.stdout.pipe(logFile);
    this.processes.monitor.stderr.pipe(errorFile);

    // Mostrar logs em tempo real no console
    this.processes.monitor.stdout.on('data', (data) => {
      const message = data.toString().trim();
      if (message) {
        console.log(`[Monitor] ${message}`);
      }
    });

    this.processes.monitor.stderr.on('data', (data) => {
      const message = data.toString().trim();
      if (message) {
        console.error(`[Monitor Error] ${message}`);
      }
    });

    // Configurar restart automático
    this.processes.monitor.on('exit', (code) => {
      console.log(`⚠️  Monitor terminou com código: ${code}`);
      
      if (!this.isShuttingDown && CONFIG.restart_on_crash && this.restartCounts.monitor < CONFIG.max_restarts) {
        this.restartCounts.monitor++;
        console.log(`🔄 Reiniciando Monitor (tentativa ${this.restartCounts.monitor}/${CONFIG.max_restarts})...`);
        
        setTimeout(() => {
          this.startMonitor();
        }, CONFIG.restart_delay);
      }
    });

    console.log('✅ Monitor iniciado');
  }

  setupSignalHandlers() {
    const shutdown = async (signal) => {
      console.log(`\n🛑 Recebido ${signal}, desligando sistema...`);
      this.isShuttingDown = true;
      
      const promises = [];
      
      if (this.processes.nextjs) {
        console.log('🔄 Parando Next.js...');
        this.processes.nextjs.kill('SIGTERM');
        promises.push(new Promise(resolve => {
          this.processes.nextjs.on('exit', resolve);
          setTimeout(resolve, 5000); // Force after 5s
        }));
      }
      
      if (this.processes.monitor) {
        console.log('🔄 Parando Monitor...');
        this.processes.monitor.kill('SIGTERM');
        promises.push(new Promise(resolve => {
          this.processes.monitor.on('exit', resolve);
          setTimeout(resolve, 5000); // Force after 5s
        }));
      }
      
      await Promise.all(promises);
      console.log('✅ Sistema desligado');
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }

  setupUserInput() {
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (data) => {
      const command = data.toString().trim().toLowerCase();
      
      switch (command) {
        case 'rs':
        case 'restart':
          this.restart();
          break;
        case 'logs':
          this.showLogs();
          break;
        case 'status':
          this.showStatus();
          break;
        case 'help':
          this.showHelp();
          break;
        case 'quit':
        case 'exit':
          process.kill(process.pid, 'SIGINT');
          break;
        default:
          if (command) {
            console.log(`❓ Comando não reconhecido: ${command}`);
            console.log('Digite "help" para ver comandos disponíveis');
          }
      }
    });
  }

  async restart() {
    console.log('🔄 Reiniciando sistema...');
    this.restartCounts.nextjs = 0;
    this.restartCounts.monitor = 0;
    
    // Parar processos
    if (this.processes.nextjs) {
      this.processes.nextjs.kill('SIGTERM');
    }
    if (this.processes.monitor) {
      this.processes.monitor.kill('SIGTERM');
    }
    
    // Aguardar um pouco
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Reiniciar
    await this.startNextJS();
    await this.waitForNextJS();
    await this.startMonitor();
    
    console.log('✅ Sistema reiniciado');
  }

  showLogs() {
    console.log('\n📋 Arquivos de log disponíveis:');
    const logFiles = fs.readdirSync(CONFIG.log_dir);
    logFiles.forEach(file => {
      const filePath = path.join(CONFIG.log_dir, file);
      const stats = fs.statSync(filePath);
      console.log(`  ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
    });
    console.log(`\n💡 Use: tail -f ${CONFIG.log_dir}/nextjs.log para acompanhar logs em tempo real`);
  }

  async showStatus() {
    console.log('\n📊 Status do Sistema:');
    
    // Status dos processos
    console.log(`Next.js: ${this.processes.nextjs ? '🟢 Rodando' : '🔴 Parado'}`);
    console.log(`Monitor: ${this.processes.monitor ? '🟢 Rodando' : '🔴 Parado'}`);
    
    // Tentativa de conexão com os serviços
    try {
      const nextjsResponse = await fetch(`http://localhost:${CONFIG.nextjs_port}/api/health`);
      console.log(`API Next.js: ${nextjsResponse.ok ? '🟢 Acessível' : '🟡 Com problemas'}`);
    } catch {
      console.log('API Next.js: 🔴 Inacessível');
    }
    
    try {
      const monitorResponse = await fetch(`http://localhost:${CONFIG.monitor_port}/status`);
      if (monitorResponse.ok) {
        const monitorData = await monitorResponse.json();
        console.log(`Monitor API: 🟢 Acessível`);
        console.log(`Transações pendentes: ${monitorData.transacoes_pendentes}`);
        console.log(`Total verificações: ${monitorData.stats.total_verificacoes}`);
      }
    } catch {
      console.log('Monitor API: 🔴 Inacessível');
    }
  }

  showHelp() {
    console.log('\n📖 Comandos disponíveis:');
    console.log('  rs, restart - Reiniciar ambos os serviços');
    console.log('  logs        - Mostrar arquivos de log');
    console.log('  status      - Mostrar status dos serviços');
    console.log('  help        - Mostrar esta ajuda');
    console.log('  quit, exit  - Sair do sistema');
    console.log('  Ctrl+C      - Parar sistema');
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  const manager = new PaymentSystemManager();
  manager.start().catch(error => {
    console.error('❌ Erro ao iniciar sistema:', error);
    process.exit(1);
  });
}

module.exports = PaymentSystemManager;