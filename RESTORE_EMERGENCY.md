# 🚨 RESTAURAÇÃO DE EMERGÊNCIA - VemJoao

Este documento explica como restaurar backups quando o sistema web (front-end ou back-end) está indisponível.

## 📋 REQUISITOS

- ✅ Node.js instalado no servidor
- ✅ Acesso ao servidor onde está o MongoDB
- ✅ Arquivo de backup válido (.json)
- ✅ Variável de ambiente `MONGODB_URI` configurada (opcional)

## 🔧 CONFIGURAÇÃO

### 1. Preparar o ambiente
```bash
# Navegar para o diretório do projeto
cd /root/vemjoao

# Verificar se o Node.js está instalado
node --version

# Instalar dependências se necessário
npm install mongodb
```

### 2. Configurar conexão com MongoDB
```bash
# Opção 1: Usar variável de ambiente
export MONGODB_URI="mongodb://localhost:27017/vemjoao"

# Opção 2: Editar diretamente no script
# Linha 24: const MONGODB_URI = 'sua-conexao-aqui';
```

## 🚀 COMO USAR

### 1. Comando básico
```bash
node restore-backup.js [arquivo-backup.json]
```

### 2. Exemplo prático
```bash
# Restaurar um backup específico
node restore-backup.js backup_2025-01-13-10-30-00.json

# Com caminho completo
node restore-backup.js /caminho/para/backup_2025-01-13-10-30-00.json
```

### 3. Processo passo a passo

#### ✅ **Passo 1**: Executar o comando
```bash
node restore-backup.js backup_exemplo.json
```

#### ✅ **Passo 2**: Verificar informações
O script mostrará:
- ✅ Validação do arquivo
- 📅 Data do backup
- 👤 Master ID
- 📊 Quantidade de registros por categoria

#### ✅ **Passo 3**: Confirmar operação
- Digite `CONFIRMO` para prosseguir
- Qualquer outra coisa cancela a operação

#### ✅ **Passo 4**: Aguardar conclusão
O script irá:
1. 🔗 Conectar ao MongoDB
2. 🛡️ Criar backup de segurança dos dados atuais
3. 🗑️ Remover dados existentes
4. ✅ Inserir dados do backup
5. 📊 Mostrar estatísticas finais

## 🛡️ SEGURANÇA

### Backup Automático de Segurança
- ✅ **Sempre criado** antes da restauração
- ✅ Nome: `safety_backup_[master_id]_[timestamp].json`
- ✅ Permite reverter mudanças se necessário

### Validações Implementadas
- ✅ Arquivo existe e é JSON válido
- ✅ Estrutura de backup correta
- ✅ Master ID presente
- ✅ Confirmação manual obrigatória

## 📋 EXEMPLO DE SAÍDA

```
╔════════════════════════════════════════════════════════════╗
║               RESTAURAÇÃO DE EMERGÊNCIA - VemJoao         ║
║                                                            ║
║   🚨 ATENÇÃO: Este script substitui TODOS os dados!       ║
║   📋 Um backup de segurança será criado automaticamente   ║
╚════════════════════════════════════════════════════════════╝

📁 Validando arquivo de backup...
✅ Arquivo de backup válido!
   📅 Data do backup: 13/01/2025 10:30:00
   👤 Master ID: 507f1f77bcf86cd799439011
   📊 Versão: 1.0

📊 Dados que serão restaurados:
   • condominios: 5 registros
   • moradores: 25 registros
   • administradores: 3 registros
   • colaboradores: 8 registros
   • contas_bancarias: 2 registros
   • status_pagamentos: 15 registros

⚠️  Tem certeza que deseja prosseguir? Digite "CONFIRMO" para continuar: CONFIRMO

🔗 Conectando ao MongoDB...
✅ Conectado ao MongoDB com sucesso!

🛡️  Criando backup de segurança dos dados atuais...
   📋 condominios: 5 registros salvos
   📋 moradores: 25 registros salvos
   📋 administradores: 3 registros salvos
   📋 colaboradores: 8 registros salvos
   📋 contas_bancarias: 2 registros salvos
   📋 status_pagamentos: 15 registros salvos
✅ Backup de segurança criado: safety_backup_507f1f77bcf86cd799439011_2025-01-13-15-45-30.json

🔄 Iniciando restauração para master_id: 507f1f77bcf86cd799439011
   🗑️  condominios: 5 registros removidos
   ✅ condominios: 5 registros inseridos
   🗑️  moradores: 25 registros removidos
   ✅ moradores: 25 registros inseridos
   🗑️  administradores: 3 registros removidos
   ✅ administradores: 3 registros inseridos
   🗑️  colaboradores: 8 registros removidos
   ✅ colaboradores: 8 registros inseridos
   🗑️  contas_bancarias: 2 registros removidos
   ✅ contas_bancarias: 2 registros inseridos
   🗑️  status_pagamentos: 15 registros removidos
   ✅ status_pagamentos: 15 registros inseridos

🎉 RESTAURAÇÃO CONCLUÍDA COM SUCESSO!
   📊 Total de registros restaurados: 58
   🛡️  Backup de segurança: safety_backup_507f1f77bcf86cd799439011_2025-01-13-15-45-30.json
   ⚠️  Reinicie o sistema web para ver as mudanças
```

## ❌ SOLUÇÃO DE PROBLEMAS

### Erro: "Arquivo não encontrado"
```bash
# Verificar se o arquivo existe
ls -la backup_*.json

# Usar caminho absoluto
node restore-backup.js /caminho/completo/para/backup.json
```

### Erro: "Erro ao conectar ao MongoDB"
```bash
# Verificar se MongoDB está rodando
systemctl status mongod

# Verificar string de conexão
echo $MONGODB_URI

# Testar conexão manual
mongo "mongodb://localhost:27017/vemjoao"
```

### Erro: "Backup inválido"
```bash
# Verificar estrutura do arquivo
head -20 backup.json

# Validar JSON
python -m json.tool backup.json
```

## 🔄 REVERTER RESTAURAÇÃO

Se algo der errado, use o backup de segurança criado automaticamente:

```bash
# O script criou: safety_backup_[master_id]_[timestamp].json
node restore-backup.js safety_backup_507f1f77bcf86cd799439011_2025-01-13-15-45-30.json
```

## 📞 EMERGÊNCIA

Se este script não funcionar:

1. 🔍 **Verificar logs**: `/var/log/mongodb/mongod.log`
2. 🔧 **Restaurar MongoDB diretamente**:
   ```bash
   mongorestore --db vemjoao backup_folder/
   ```
3. 📧 **Contatar suporte técnico** com:
   - Arquivo de backup
   - Logs de erro
   - Backup de segurança gerado

---

## ⚠️ IMPORTANTE

- 🚨 **Este script SUBSTITUI todos os dados** do master especificado
- 🛡️ **Sempre cria backup de segurança** antes de modificar
- 🔒 **Requer confirmação manual** para executar
- ⏰ **Funciona independente** do sistema web
- 🔄 **Requer reinicialização** do sistema após uso