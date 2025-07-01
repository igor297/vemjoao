# ========================================
# Script: restaurargithub.ps1
# Descrição: Automatiza o processo de restaurar/sincronizar com o GitHub
# Autor: Gerado por Claude Code
# Data: 2025-06-30
# ========================================

param(
    [switch]$Force = $false,
    [switch]$Reset = $false,
    [string]$Branch = ""
)

# Função para exibir mensagens coloridas
function Write-ColorMessage {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

# Função para verificar se estamos em um repositório Git
function Test-GitRepository {
    try {
        git status | Out-Null
        return $true
    }
    catch {
        return $false
    }
}

# Função para criar backup das mudanças locais
function Backup-LocalChanges {
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupBranch = "backup_local_$timestamp"
    
    Write-ColorMessage "💾 Criando backup das mudanças locais..." "Yellow"
    
    try {
        git add .
        git commit -m "Backup automático antes de restaurar do GitHub - $timestamp"
        git branch $backupBranch
        
        Write-ColorMessage "✅ Backup criado na branch: $backupBranch" "Green"
        return $backupBranch
    }
    catch {
        Write-ColorMessage "⚠️  Não foi possível criar backup (pode não haver mudanças)" "Yellow"
        return $null
    }
}

# Cabeçalho do script
Write-ColorMessage "========================================" "Cyan"
Write-ColorMessage "🔄 SCRIPT DE RESTAURAÇÃO DO GITHUB" "Cyan"
Write-ColorMessage "========================================" "Cyan"
Write-Host ""

# Verificar se estamos em um repositório Git
if (-not (Test-GitRepository)) {
    Write-ColorMessage "❌ ERRO: Este diretório não é um repositório Git!" "Red"
    Write-ColorMessage "   Execute 'git init' ou navegue para um diretório Git válido." "Yellow"
    exit 1
}

# Verificar branch atual
$branchAtual = git branch --show-current
if ([string]::IsNullOrWhiteSpace($Branch)) {
    $Branch = $branchAtual
}

Write-ColorMessage "🌿 Branch atual: $branchAtual" "Blue"
Write-ColorMessage "🎯 Branch de destino: $Branch" "Blue"

# Verificar se há mudanças locais
Write-ColorMessage "🔍 Verificando mudanças locais..." "Yellow"
$gitStatus = git status --porcelain
$hasUncommittedChanges = $gitStatus -ne $null

if ($hasUncommittedChanges -and -not $Force) {
    Write-ColorMessage "⚠️  ATENÇÃO: Existem mudanças locais não commitadas!" "Red"
    Write-Host ""
    Write-ColorMessage "📊 Mudanças detectadas:" "Yellow"
    git status --short
    Write-Host ""
    
    Write-ColorMessage "🤔 O que você deseja fazer?" "Yellow"
    Write-ColorMessage "  1. Fazer backup e continuar (RECOMENDADO)" "Green"
    Write-ColorMessage "  2. Descartar mudanças locais (PERIGOSO)" "Red"
    Write-ColorMessage "  3. Cancelar operação" "White"
    
    do {
        $escolha = Read-Host "Digite sua escolha (1, 2 ou 3)"
    } while ($escolha -notin @("1", "2", "3"))
    
    switch ($escolha) {
        "1" {
            $backupBranch = Backup-LocalChanges
        }
        "2" {
            Write-ColorMessage "🗑️  Descartando mudanças locais..." "Red"
            git reset --hard HEAD
            git clean -fd
        }
        "3" {
            Write-ColorMessage "❌ Operação cancelada pelo usuário." "Yellow"
            exit 0
        }
    }
}

try {
    # Buscar atualizações do repositório remoto
    Write-ColorMessage "📡 Buscando atualizações do GitHub..." "Yellow"
    git fetch origin
    
    if ($LASTEXITCODE -ne 0) {
        throw "Erro ao buscar atualizações do repositório remoto"
    }
    
    Write-ColorMessage "✅ Atualizações buscadas com sucesso!" "Green"

    # Verificar se a branch remota existe
    $remoteBranchExists = git ls-remote --heads origin $Branch | Select-String $Branch
    
    if (-not $remoteBranchExists) {
        Write-ColorMessage "❌ ERRO: Branch '$Branch' não existe no repositório remoto!" "Red"
        Write-ColorMessage "📋 Branches disponíveis:" "Yellow"
        git branch -r
        exit 1
    }

    # Mudar para a branch especificada se necessário
    if ($branchAtual -ne $Branch) {
        Write-ColorMessage "🔄 Mudando para a branch: $Branch" "Yellow"
        
        # Verificar se a branch local existe
        $localBranchExists = git branch --list $Branch
        
        if ($localBranchExists) {
            git checkout $Branch
        } else {
            git checkout -b $Branch origin/$Branch
        }
        
        if ($LASTEXITCODE -ne 0) {
            throw "Erro ao mudar para a branch $Branch"
        }
    }

    # Fazer pull das mudanças
    Write-ColorMessage "⬇️  Baixando mudanças do GitHub..." "Yellow"
    
    if ($Reset) {
        Write-ColorMessage "🔄 Modo reset: forçando sincronização completa..." "Red"
        git reset --hard origin/$Branch
    } else {
        git pull origin $Branch
    }
    
    if ($LASTEXITCODE -ne 0) {
        Write-ColorMessage "⚠️  Possível conflito detectado. Tentando merge automático..." "Yellow"
        
        # Tentar resolver conflitos automaticamente
        git pull origin $Branch --no-edit
        
        if ($LASTEXITCODE -ne 0) {
            throw "Conflitos de merge detectados que requerem resolução manual"
        }
    }

    Write-ColorMessage "✅ Mudanças baixadas com sucesso!" "Green"

    # Verificar se há dependências para instalar
    if (Test-Path "package.json") {
        Write-ColorMessage "📦 Verificando dependências do Node.js..." "Yellow"
        
        # Verificar se package-lock.json foi atualizado
        $packageLockChanged = git diff HEAD~1 HEAD --name-only | Select-String "package-lock.json"
        $packageJsonChanged = git diff HEAD~1 HEAD --name-only | Select-String "package.json"
        
        if ($packageLockChanged -or $packageJsonChanged) {
            Write-ColorMessage "🔧 Dependências foram atualizadas. Executando npm install..." "Yellow"
            npm install
            
            if ($LASTEXITCODE -eq 0) {
                Write-ColorMessage "✅ Dependências instaladas com sucesso!" "Green"
            } else {
                Write-ColorMessage "⚠️  Aviso: Problemas na instalação de dependências" "Yellow"
            }
        }
    }

    # Verificar status final
    Write-ColorMessage "🔍 Status final:" "Blue"
    git status

    Write-Host ""
    Write-ColorMessage "========================================" "Green"
    Write-ColorMessage "🎉 RESTAURAÇÃO CONCLUÍDA COM SUCESSO!" "Green"
    Write-ColorMessage "========================================" "Green"
    Write-ColorMessage "🌿 Branch ativa: $(git branch --show-current)" "White"
    Write-ColorMessage "🔄 Status: Sincronizado com GitHub" "White"
    
    if ($backupBranch) {
        Write-ColorMessage "💾 Backup criado em: $backupBranch" "White"
    }

} catch {
    Write-ColorMessage "========================================" "Red"
    Write-ColorMessage "❌ ERRO DURANTE A RESTAURAÇÃO!" "Red"
    Write-ColorMessage "========================================" "Red"
    Write-ColorMessage "Erro: $($_.Exception.Message)" "Red"
    Write-Host ""
    Write-ColorMessage "🔧 Possíveis soluções:" "Yellow"
    Write-ColorMessage "  1. Verifique sua conexão com a internet" "White"
    Write-ColorMessage "  2. Resolva conflitos manualmente com 'git status'" "White"
    Write-ColorMessage "  3. Use o parâmetro -Reset para forçar sincronização" "White"
    Write-ColorMessage "  4. Execute 'git log --oneline -10' para ver histórico" "White"
    
    if ($backupBranch) {
        Write-ColorMessage "  5. Restaure o backup com 'git checkout $backupBranch'" "White"
    }
    
    exit 1
}

# Pausa para visualização (opcional)
Write-Host ""
Write-ColorMessage "Pressione qualquer tecla para continuar..." "Gray"
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")