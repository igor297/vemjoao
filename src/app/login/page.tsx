'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from 'react-bootstrap'
import { safeJsonParse } from '@/lib/api-utils'

export default function LoginPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [honeypot, setHoneypot] = useState('')
  const [isBotChecked, setIsBotChecked] = useState(false)
  const [loginAttempts, setLoginAttempts] = useState(0)
  const [isLockedOut, setIsLockedOut] = useState(false)
  const [countdown, setCountdown] = useState(0)
  
  const [showAlert, setShowAlert] = useState(false)
  const [alertData, setAlertData] = useState({ type: '', message: '', icon: '' })
  const [fieldError, setFieldError] = useState('')
  const router = useRouter()

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isLockedOut) {
      setCountdown(30);
      timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setIsLockedOut(false);
            setLoginAttempts(0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isLockedOut]);

  const showCustomAlert = (errorType: string, message: string) => {
    let icon = '⚠️'
    let type = 'error'
    
    switch (errorType) {
      case 'INVALID_CREDENTIALS':
        icon = '🔐'
        type = 'credentials-error'
        break
      case 'NETWORK_ERROR':
        icon = '🌐'
        type = 'network-error'
        break
      case 'SERVER_ERROR':
        icon = '🛠️'
        type = 'server-error'
        break
      case 'BOT_DETECTED':
        icon = '🤖'
        type = 'general-error' // Pode ser um tipo específico se quiser estilizar diferente
        break
      case 'BOT_CHECK_REQUIRED':
        icon = '✅'
        type = 'general-error'
        break
      case 'LOCKED_OUT':
        icon = '🔒'
        type = 'general-error'
        break
      default:
        icon = '😕'
        type = 'general-error'
    }
    
    setAlertData({ type, message, icon })
    setShowAlert(true)
    
    // Para credenciais inválidas, não destacar campo específico
    setFieldError('')
    
    // Esconder alerta após 8 segundos (mais tempo para ler)
    setTimeout(() => {
      setShowAlert(false)
    }, 8000)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    console.log('🔄 [FRONTEND] Iniciando processo de login')
    console.log('🔄 [FRONTEND] Email:', formData.email)
    console.log('🔄 [FRONTEND] Password length:', formData.password.length)

    if (honeypot) {
      console.error('Detecção de bot (Honeypot preenchido).')
      showCustomAlert('BOT_DETECTED', 'Detecção de atividade suspeita. Tente novamente mais tarde.')
      setIsLoading(false)
      return
    }

    if (!isBotChecked) {
      showCustomAlert('BOT_CHECK_REQUIRED', 'Por favor, confirme que você não é um robô.')
      setIsLoading(false)
      return
    }

    if (isLockedOut) {
      showCustomAlert('LOCKED_OUT', `Muitas tentativas de login. Tente novamente em ${countdown} segundos.`) 
      setIsLoading(false)
      return
    }

    try {
      console.log('🔄 [FRONTEND] Fazendo requisição POST para /api/auth/login')
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password
        })
      })

      console.log('🔄 [FRONTEND] Resposta recebida, status:', response.status)
      console.log('🔄 [FRONTEND] Content-Type:', response.headers.get('content-type'))

      const result = await safeJsonParse(response)
      console.log('🔄 [FRONTEND] Resultado parsed:', result)

      if (result.success && result.data?.success) {
        localStorage.setItem('userData', JSON.stringify(result.data.user))
        setLoginAttempts(0) // Reset attempts on successful login
        
        // Redirecionar baseado no campo redirectTo ou no tipo de usuário
        if (result.data.redirectTo) {
          router.push(result.data.redirectTo)
        } else if (result.data.user.tipo === 'master') {
          router.push('/dashboard')
        } else if (result.data.user.tipo === 'adm') {
          router.push('/adm-dashboard')
        } else {
          router.push('/dashboard')
        }
      } else {
        const errorData = result.data || result
        const errorType = errorData.errorType || 'GENERAL_ERROR'
        const errorMessage = errorData.message || 'Algo não funcionou como esperado. Tente novamente em alguns instantes.'
        
        const newAttempts = loginAttempts + 1;
        setLoginAttempts(newAttempts);

        if (newAttempts >= 3) {
          setIsLockedOut(true);
          showCustomAlert('LOCKED_OUT', `Muitas tentativas de login. Tente novamente em 30 segundos.`);
        } else {
          showCustomAlert(errorType, errorMessage);
        }
      }
    } catch (err) {
      const errorMessage = 'Não conseguimos conectar ao servidor. Verifique sua internet e tente novamente em alguns segundos.'
      showCustomAlert('NETWORK_ERROR', errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <style jsx>{`
        .modern-alert {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 90%;
          max-width: 420px;
          z-index: 10000;
          border-radius: 16px;
          background: white;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
          border: 1px solid rgba(0, 0, 0, 0.08);
          animation: slideInScale 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          display: ${showAlert ? 'block' : 'none'};
        }
        
        .alert-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(4px);
          z-index: 9999;
          display: ${showAlert ? 'block' : 'none'};
        }
        
        @keyframes slideInScale {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.8);
          }
          100% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }
        
        .alert-header {
          padding: 24px 24px 16px 24px;
          border-bottom: 1px solid #f1f1f1;
          display: flex;
          align-items: center;
        }
        
        .alert-icon-container {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 16px;
          font-size: 24px;
        }
        
        .alert-icon-container.credentials-error {
          background: linear-gradient(135deg, #ff6b6b20, #ee5a2420);
          color: #e55353;
        }
        
        .alert-icon-container.network-error {
          background: linear-gradient(135deg, #6c5ce720, #a29bfe20);
          color: #6c5ce7;
        }
        
        .alert-icon-container.general-error {
          background: linear-gradient(135deg, #ff767520, #d6303120);
          color: #e74c3c;
        }
        
        .alert-icon-container.server-error {
          background: linear-gradient(135deg, #fd7f6f20, #bd5eff20);
          color: #9d4edd;
        }
        
        .alert-title {
          font-size: 18px;
          font-weight: 600;
          color: #2d3748;
          margin: 0;
          line-height: 1.3;
        }
        
        .alert-body {
          padding: 0 24px 24px 24px;
        }
        
        .alert-message {
          font-size: 14px;
          color: #4a5568;
          line-height: 1.5;
          margin: 8px 0 24px 0;
        }
        
        .alert-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }
        
        .alert-button {
          padding: 10px 20px;
          border-radius: 8px;
          border: none;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .alert-button.primary {
          background: #3182ce;
          color: white;
        }
        
        .alert-button.primary:hover {
          background: #2c5aa0;
          transform: translateY(-1px);
        }
        
        .alert-button.secondary {
          background: #f7fafc;
          color: #4a5568;
          border: 1px solid #e2e8f0;
        }
        
        .alert-button.secondary:hover {
          background: #edf2f7;
        }
        
        .input-error {
          border: 2px solid #e53e3e !important;
          background-color: #fed7d7 !important;
          animation: shake 0.5s ease-in-out;
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
      `}</style>

      {/* Overlay */}
      {showAlert && (
        <div className="alert-overlay" onClick={() => setShowAlert(false)}></div>
      )}

      {/* Alerta Moderno */}
      {showAlert && (
        <div className="modern-alert">
          <div className="alert-header">
            <div className={`alert-icon-container ${alertData.type}`}>
              {alertData.icon}
            </div>
            <div>
              <h3 className="alert-title">
                {alertData.type === 'credentials-error' ? 'Email ou senha errada' :
                 alertData.type === 'network-error' ? 'Problemas de conexão' :
                 alertData.type === 'server-error' ? 'Nosso servidor está ocupado' :
                 alertData.type === 'LOCKED_OUT' ? 'Acesso Temporariamente Bloqueado' :
                 'Algo não funcionou como esperado'}
              </h3>
            </div>
          </div>
          <div className="alert-body">
            <p className="alert-message">{alertData.message}</p>
            <div className="alert-actions">
              <button 
                className="alert-button primary"
                onClick={() => setShowAlert(false)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="min-vh-100 bg-primary d-flex align-items-center justify-content-center">
      <Container>
        <Row className="justify-content-center">
          <Col md={6} lg={4}>
            <Card className="shadow-lg">
              <Card.Body className="p-5">
                <div className="text-center mb-4">
                  <div className="bg-primary rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
                       style={{ width: '48px', height: '48px' }}>
                    <svg className="text-white" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <h3 className="fw-bold text-dark mb-2">Sistema Condomínio</h3>
                  <p className="text-muted">Faça login para acessar o sistema</p>
                </div>

                <Form onSubmit={handleSubmit}>
                  <Form.Group className="mb-3" style={{ display: 'none' }}>
                    <Form.Label htmlFor="honeypot">Não preencha este campo</Form.Label>
                    <Form.Control
                      type="text"
                      id="honeypot"
                      name="honeypot"
                      value={honeypot}
                      onChange={(e) => setHoneypot(e.target.value)}
                      tabIndex={-1}
                      autoComplete="off"
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Check
                      type="checkbox"
                      id="not-a-robot"
                      label="Não sou um robô"
                      checked={isBotChecked}
                      onChange={(e) => setIsBotChecked(e.target.checked)}
                      disabled={isLockedOut}
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Email</Form.Label>
                    <Form.Control
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={(e) => {
                        handleInputChange(e)
                        setFieldError('')
                      }}
                      placeholder="seu@email.com"
                      required
                      className={fieldError === 'email' ? 'input-error' : ''}
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Senha</Form.Label>
                    <Form.Control
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={(e) => {
                        handleInputChange(e)
                        setFieldError('')
                      }}
                      placeholder="••••••••"
                      required
                      className={fieldError === 'password' ? 'input-error' : ''}
                      style={{
                        WebkitTextSecurity: 'disc',
                        color: '#000000'
                      }}
                    />
                  </Form.Group>

                  <Row className="mb-3">
                    <Col>
                      <Form.Check
                        type="checkbox"
                        id="remember-me"
                        label="Lembrar de mim"
                      />
                    </Col>
                    <Col xs="auto">
                      <a href="#" className="text-decoration-none">
                        Esqueceu a senha?
                      </a>
                    </Col>
                  </Row>

                  <Button
                    variant="primary"
                    type="submit"
                    disabled={isLoading}
                    className="w-100 py-2"
                  >
                    {isLoading && <Spinner animation="border" size="sm" className="me-2" />}
                    {isLoading ? 'Entrando...' : 'Entrar'}
                  </Button>

                  <div className="text-center mt-3">
                    <small className="text-muted">
                      Não tem conta?{' '}
                      <a href="#" className="text-decoration-none">
                        Entre em contato com a administração
                      </a>
                    </small>
                  </div>
                </Form>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
      </div>
    </>
  )
}