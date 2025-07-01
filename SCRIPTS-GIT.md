# 🚀 Scripts de Automação Git/GitHub

Este documento descreve os scripts PowerShell criados para automatizar operações com Git e GitHub.

## 📁 Scripts Disponíveis

### 1. `atualizar.github.ps1` - Script de Atualização
**Função:** Automatiza o processo de commit e push para o GitHub

### 2. `restaurargithub.ps1` - Script de Restauração  
**Função:** Automatiza o processo de pull e sincronização com o GitHub

---

## 🔧 Como Usar

### ⬆️ Atualizar GitHub (Push)

```powershell
# Uso básico - detecta mudanças automaticamente
.\atualizar.github.ps1

# Com mensagem personalizada
.\atualizar.github.ps1 -Mensagem "feat: nova funcionalidade de login"

# Forçar push mesmo sem mudanças
.\atualizar.github.ps1 -Force
```

**O que o script faz:**
1. ✅ Verifica se há mudanças no repositório
2. 📦 Adiciona todos os arquivos modificados ao staging
3. 💾 Cria commit com mensagem personalizada ou automática
4. 🚀 Faz push para o GitHub
5. 📊 Exibe status final da operação

---

### ⬇️ Restaurar do GitHub (Pull)

```powershell
# Uso básico - puxa mudanças da branch atual
.\restaurargithub.ps1

# Especificar branch diferente
.\restaurargithub.ps1 -Branch "develop"

# Forçar reset completo (CUIDADO: perde mudanças locais)
.\restaurargithub.ps1 -Reset

# Ignorar mudanças locais
.\restaurargithub.ps1 -Force
```

**O que o script faz:**
1. 🔍 Verifica mudanças locais não commitadas
2. 💾 Cria backup automático se houver mudanças
3. 📡 Busca atualizações do repositório remoto
4. ⬇️ Faz pull das mudanças
5. 📦 Instala dependências npm se necessário
6. 📊 Exibe status final da operação

---

## ⚠️ Cenários de Uso

### 📤 Quando usar `atualizar.github.ps1`:
- ✅ Terminei uma funcionalidade e quero subir para o GitHub
- ✅ Fiz correções de bugs
- ✅ Atualizei documentação
- ✅ Quero sincronizar mudanças locais

### 📥 Quando usar `restaurargithub.ps1`:
- ✅ Outro desenvolvedor fez push no GitHub
- ✅ Quero pegar as últimas atualizações
- ✅ Preciso sincronizar com a versão remota
- ✅ Quero mudar de branch

---

## 🛡️ Segurança e Backups

### 🔒 Proteções Implementadas:

#### No `restaurargithub.ps1`:
- **Backup Automático:** Cria branch de backup antes de mudanças
- **Detecção de Conflitos:** Avisa sobre mudanças locais não salvas
- **Modo Interativo:** Pergunta o que fazer com mudanças locais
- **Verificação de Dependências:** Instala npm packages automaticamente

#### No `atualizar.github.ps1`:
- **Verificação de Status:** Só commita se há mudanças
- **Mensagem Automática:** Gera timestamp se não especificar mensagem
- **Tratamento de Erros:** Exibe soluções para problemas comuns
- **Validação de Branch:** Confirma branch antes do push

---

## 🎯 Exemplos Práticos

### Cenário 1: Desenvolvedor trabalhando sozinho
```powershell
# Ao final do dia
.\atualizar.github.ps1 -Mensagem "fix: correções de bugs e melhorias"

# No início do próximo dia
.\restaurargithub.ps1
```

### Cenário 2: Equipe colaborativa
```powershell
# Antes de começar a trabalhar
.\restaurargithub.ps1

# Após terminar uma feature
.\atualizar.github.ps1 -Mensagem "feat: implementa sistema de notificações"
```

### Cenário 3: Emergência - resetar tudo
```powershell
# CUIDADO: Perde mudanças locais!
.\restaurargithub.ps1 -Reset -Force
```

---

## 🔧 Solução de Problemas

### ❌ Erro de Permissão
```powershell
# Habilitar execução de scripts (execute como Administrador)
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### ❌ Conflitos de Merge
```powershell
# O script detecta automaticamente e oferece opções:
# 1. Backup + Pull (Recomendado)
# 2. Descartar mudanças locais
# 3. Cancelar operação
```

### ❌ Sem Conexão com Internet
- ✅ Scripts verificam conectividade automaticamente
- ✅ Exibem mensagens de erro claras
- ✅ Sugerem soluções específicas

---

## 🎨 Recursos Visuais

### 🌈 Cores dos Scripts:
- 🔵 **Azul:** Informações gerais
- 🟡 **Amarelo:** Processamento/Aguarde  
- 🟢 **Verde:** Sucesso
- 🔴 **Vermelho:** Erros críticos
- ⚪ **Branco:** Detalhes/Dados

### 📊 Indicadores de Status:
- ✅ Operação bem-sucedida
- ⚠️ Aviso importante
- ❌ Erro crítico
- 🔍 Verificando/Analisando
- 💾 Fazendo backup
- 🚀 Enviando/Baixando

---

## 📝 Notas Importantes

1. **Backup Automático:** O script `restaurargithub.ps1` sempre cria backup antes de mudanças destrutivas
2. **Mensagens de Commit:** Seguem padrão Conventional Commits quando possível
3. **Detecção de npm:** Scripts detectam e instalam dependências automaticamente
4. **Multiplataforma:** Funciona em Windows PowerShell e PowerShell Core
5. **Logs Detalhados:** Todos os scripts fornecem feedback visual detalhado

---

## 🆘 Suporte

Se encontrar problemas:

1. **Verifique o arquivo de log** exibido pelo script
2. **Execute `git status`** para ver o estado atual
3. **Use os parâmetros `-Force` ou `-Reset`** quando necessário
4. **Consulte a documentação** do Git para casos específicos

---

*Scripts gerados por Claude Code - Versão 1.0*