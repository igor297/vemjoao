/**
 * Script principal para a tela de login do condomínio
 * Implementa validação de formulário, animações e simulação de login
 */

document.addEventListener('DOMContentLoaded', function() {
    // Elementos do DOM
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const passwordToggle = document.getElementById('password-toggle');
    const errorMessage = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');
    const rememberMe = document.getElementById('remember-me');
    const forgotPasswordLink = document.getElementById('forgot-password');
    const newUserLink = document.getElementById('new-user');
    
    // Verificar se há dados salvos no localStorage
    checkSavedCredentials();
    
    // Toggle de visibilidade da senha
    passwordToggle.addEventListener('click', function() {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        
        // Toggle do ícone de olho
        const eyeIcon = passwordToggle.querySelector('i');
        eyeIcon.classList.toggle('fa-eye');
        eyeIcon.classList.toggle('fa-eye-slash');
    });
    
    // Validação do formulário
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        
        // Resetar estado de erro
        hideError();
        
        // Validação dos campos
        if (!validateForm(username, password)) {
            return;
        }
        
        // Salvar credenciais se "lembrar-me" estiver marcado
        if (rememberMe.checked) {
            saveCredentials(username);
        } else {
            clearSavedCredentials();
        }
        
        // Simular tentativa de login
        simulateLogin(username, password);
    });
    
    // Link "Esqueceu sua senha"
    forgotPasswordLink.addEventListener('click', function(e) {
        e.preventDefault();
        showModalMessage('Recuperação de Senha', 
            'Por favor, entre em contato com a administração do condomínio para recuperar seu acesso.');
    });
    
    // Link "Cadastre-se"
    newUserLink.addEventListener('click', function(e) {
        e.preventDefault();
        showModalMessage('Novo Cadastro', 
            'Para solicitar acesso ao portal, entre em contato com a administração do condomínio.');
    });
    
    // Adicionar eventos de foco para melhorar a experiência do usuário
    usernameInput.addEventListener('focus', function() {
        hideError();
    });
    
    passwordInput.addEventListener('focus', function() {
        hideError();
    });
    
    /**
     * Valida os campos do formulário
     * @param {string} username - Nome de usuário
     * @param {string} password - Senha
     * @returns {boolean} - Resultado da validação
     */
    function validateForm(username, password) {
        // Validação do nome de usuário
        if (username === '') {
            showError('Por favor, informe seu usuário.');
            usernameInput.focus();
            return false;
        }
        
        // Validação da senha
        if (password === '') {
            showError('Por favor, informe sua senha.');
            passwordInput.focus();
            return false;
        }
        
        // Validação de comprimento mínimo da senha
        if (password.length < 4) {
            showError('A senha deve ter pelo menos 4 caracteres.');
            passwordInput.focus();
            return false;
        }
        
        return true;
    }
    
    /**
     * Exibe mensagem de erro com animação
     * @param {string} message - Mensagem de erro
     */
    function showError(message) {
        errorText.textContent = message;
        errorMessage.style.display = 'block';
        
        // Efeito de animação shake
        errorMessage.classList.add('shake');
        setTimeout(() => {
            errorMessage.classList.remove('shake');
        }, 800);
    }
    
    /**
     * Esconde a mensagem de erro
     */
    function hideError() {
        errorMessage.style.display = 'none';
    }
    
    /**
     * Simula uma tentativa de login com feedback visual
     * @param {string} username - Nome de usuário
     * @param {string} password - Senha
     */
    function simulateLogin(username, password) {
        // Simular chamada de API com estado de carregamento
        const loginButton = loginForm.querySelector('button[type="submit"]');
        const originalButtonText = loginButton.innerHTML;
        
        // Desabilitar botão e mostrar spinner
        loginButton.disabled = true;
        loginButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Entrando...';
        
        // Simular atraso de rede
        setTimeout(() => {
            loginButton.disabled = false;
            loginButton.innerHTML = originalButtonText;
            
            // Esta é apenas uma demonstração de frontend - em uma aplicação real,
            // isso seria tratado por um sistema de autenticação backend
            if (username === 'admin' && password === 'admin') {
                // Simulação de login bem-sucedido
                showSuccessMessage();
                setTimeout(() => {
                    window.location.href = '#dashboard'; // Redirecionaria para o dashboard em uma aplicação real
                    showModalMessage('Login Bem-sucedido', 
                        'Em uma aplicação real, você seria redirecionado para o dashboard do condomínio.');
                }, 1000);
            } else {
                // Login falhou
                showError('Usuário ou senha incorretos. Tente novamente.');
                passwordInput.value = ''; // Limpar senha por segurança
                passwordInput.focus();
            }
        }, 1500);
    }
    
    /**
     * Exibe mensagem de sucesso temporária
     */
    function showSuccessMessage() {
        // Criar elemento de mensagem de sucesso
        const successDiv = document.createElement('div');
        successDiv.className = 'alert alert-success animate__animated animate__fadeIn';
        successDiv.innerHTML = '<i class="fas fa-check-circle me-2"></i>Login realizado com sucesso!';
        successDiv.style.display = 'block';
        
        // Substituir mensagem de erro, se existir
        if (errorMessage.parentNode) {
            errorMessage.parentNode.insertBefore(successDiv, errorMessage);
            errorMessage.style.display = 'none';
        }
        
        // Remover após alguns segundos
        setTimeout(() => {
            successDiv.classList.replace('animate__fadeIn', 'animate__fadeOut');
            setTimeout(() => {
                if (successDiv.parentNode) {
                    successDiv.parentNode.removeChild(successDiv);
                }
            }, 500);
        }, 2000);
    }
    
    /**
     * Exibe uma mensagem modal
     * @param {string} title - Título do modal
     * @param {string} message - Conteúdo da mensagem
     */
    function showModalMessage(title, message) {
        // Verificar se já existe um modal e removê-lo
        const existingModal = document.querySelector('.modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Criar estrutura do modal
        const modalHTML = `
            <div class="modal fade" id="messageModal" tabindex="-1" aria-labelledby="messageModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="messageModalLabel">${title}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
                        </div>
                        <div class="modal-body">
                            <p>${message}</p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Adicionar modal ao DOM
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Inicializar e mostrar o modal
        const modalElement = document.getElementById('messageModal');
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
        
        // Remover modal do DOM quando for fechado
        modalElement.addEventListener('hidden.bs.modal', function () {
            modalElement.remove();
        });
    }
    
    /**
     * Salva o nome de usuário no localStorage
     * @param {string} username - Nome de usuário
     */
    function saveCredentials(username) {
        localStorage.setItem('rememberedUser', username);
    }
    
    /**
     * Limpa credenciais salvas
     */
    function clearSavedCredentials() {
        localStorage.removeItem('rememberedUser');
    }
    
    /**
     * Verifica se há credenciais salvas e preenche o formulário
     */
    function checkSavedCredentials() {
        const savedUsername = localStorage.getItem('rememberedUser');
        if (savedUsername) {
            usernameInput.value = savedUsername;
            rememberMe.checked = true;
        }
    }
});
