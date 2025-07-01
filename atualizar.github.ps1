# ========================================
# Script: atualizar.github.ps1
# Descrição: Automatiza o processo de atualizar o GitHub
# Autor: Gerado por Claude Code
# Data: 2025-06-30
# ========================================

param(
    [string]$Mensagem = "",
    [switch]$Force = $false
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

# Cabeçalho do script
Write-ColorMessage "========================================" "Cyan"
Write-ColorMessage "🚀 SCRIPT DE ATUALIZAÇÃO DO GITHUB" "Cyan"
Write-ColorMessage "========================================" "Cyan"
Write-Host ""

# Verificar se estamos em um repositório Git
if (-not (Test-GitRepository)) {
    Write-ColorMessage "❌ ERRO: Este diretório não é um repositório Git!" "Red"
    Write-ColorMessage "   Execute 'git init' ou navegue para um diretório Git válido." "Yellow"
    exit 1
}

# Verificar se há mudanças para commit
Write-ColorMessage "🔍 Verificando status do repositório..." "Yellow"
$gitStatus = git status --porcelain

if (-not $gitStatus -and -not $Force) {
    Write-ColorMessage "✅ Nenhuma mudança detectada no repositório." "Green"
    Write-ColorMessage "   Use o parâmetro -Force para forçar um push sem mudanças." "Yellow"
    exit 0
}

# Mostrar status atual
Write-ColorMessage "📊 Status atual do Git:" "Blue"
git status --short

Write-Host ""

# Solicitar mensagem de commit se não foi fornecida
if ([string]::IsNullOrWhiteSpace($Mensagem)) {
    Write-ColorMessage "💬 Digite a mensagem do commit (ou pressione Enter para usar mensagem padrão):" "Yellow"
    $inputMensagem = Read-Host "Mensagem"
    
    if ([string]::IsNullOrWhiteSpace($inputMensagem)) {
        $dataAtual = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        $Mensagem = "update: atualizações automáticas - $dataAtual"
    } else {
        $Mensagem = $inputMensagem
    }
}

try {
    # Adicionar todas as mudanças
    if ($gitStatus) {
        Write-ColorMessage "📦 Adicionando arquivos ao staging..." "Yellow"
        git add .
        
        if ($LASTEXITCODE -ne 0) {
            throw "Erro ao adicionar arquivos ao staging"
        }
        Write-ColorMessage "✅ Arquivos adicionados com sucesso!" "Green"
    }

    # Fazer commit
    if ($gitStatus) {
        Write-ColorMessage "💾 Criando commit..." "Yellow"
        $commitMessage = @"
$Mensagem

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
"@
        
        git commit -m $commitMessage
        
        if ($LASTEXITCODE -ne 0) {
            throw "Erro ao criar commit"
        }
        Write-ColorMessage "✅ Commit criado com sucesso!" "Green"
    }

    # Verificar branch atual
    $branchAtual = git branch --show-current
    Write-ColorMessage "🌿 Branch atual: $branchAtual" "Blue"

    # Fazer push
    Write-ColorMessage "🚀 Enviando para o GitHub..." "Yellow"
    git push origin $branchAtual
    
    if ($LASTEXITCODE -ne 0) {
        Write-ColorMessage "⚠️  Tentando fazer push com --set-upstream..." "Yellow"
        git push --set-upstream origin $branchAtual
        
        if ($LASTEXITCODE -ne 0) {
            throw "Erro ao fazer push para o GitHub"
        }
    }

    Write-ColorMessage "✅ Push realizado com sucesso!" "Green"

    # Verificar status final
    Write-ColorMessage "🔍 Status final:" "Blue"
    git status

    Write-Host ""
    Write-ColorMessage "========================================" "Green"
    Write-ColorMessage "🎉 ATUALIZAÇÃO CONCLUÍDA COM SUCESSO!" "Green"
    Write-ColorMessage "========================================" "Green"
    Write-ColorMessage "📝 Commit: $Mensagem" "White"
    Write-ColorMessage "🌿 Branch: $branchAtual" "White"
    Write-ColorMessage "🚀 Status: Sincronizado com GitHub" "White"

} catch {
    Write-ColorMessage "========================================" "Red"
    Write-ColorMessage "❌ ERRO DURANTE A ATUALIZAÇÃO!" "Red"
    Write-ColorMessage "========================================" "Red"
    Write-ColorMessage "Erro: $($_.Exception.Message)" "Red"
    Write-Host ""
    Write-ColorMessage "🔧 Possíveis soluções:" "Yellow"
    Write-ColorMessage "  1. Verifique sua conexão com a internet" "White"
    Write-ColorMessage "  2. Confirme se você tem permissões no repositório" "White"
    Write-ColorMessage "  3. Execute 'git status' para verificar conflitos" "White"
    Write-ColorMessage "  4. Execute 'git pull' antes de tentar novamente" "White"
    exit 1
}

# Pausa para visualização (opcional)
Write-Host ""
Write-ColorMessage "Pressione qualquer tecla para continuar..." "Gray"
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")