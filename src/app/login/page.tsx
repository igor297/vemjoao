
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from 'react-bootstrap'
import { safeJsonParse } from '@/lib/api-utils'

export default function LoginPage() {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  
  const router = useRouter()

  useEffect(() => {
    const savedUsername = localStorage.getItem('rememberedUser')
    if (savedUsername) {
      setFormData(prev => ({ ...prev, username: savedUsername }))
      setRememberMe(true)
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target
    setFormData(prev => ({
      ...prev,
      [id]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    if (formData.username.trim() === '' || formData.password.trim() === '') {
      setError('Por favor, preencha todos os campos.')
      setIsLoading(false)
      return
    }

    if (rememberMe) {
      localStorage.setItem('rememberedUser', formData.username)
    } else {
      localStorage.removeItem('rememberedUser')
    }

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.username, // A API espera 'email'
          password: formData.password
        })
      })

      const result = await safeJsonParse(response)

      if (result.success && result.data?.success) {
        localStorage.setItem('userData', JSON.stringify(result.data.user))
        
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
        setError(errorData.message || 'Usuário ou senha incorretos.')
      }
    } catch (err) {
      setError('Não foi possível conectar ao servidor. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <style jsx global>{`
        :root {
            --primary-color: #2c3e50;
            --secondary-color: #3498db;
            --accent-color: #1abc9c;
            --light-color: #ecf0f1;
            --dark-color: #2c3e50;
            --danger-color: #e74c3c;
            --success-color: #2ecc71;
            --warning-color: #f39c12;
        }

        body {
            font-family: 'Roboto', sans-serif;
            background: linear-gradient(135deg, var(--light-color), #bdc3c7);
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            padding: 0;
        }
        
        .login-container {
            background-color: white;
            border-radius: 12px;
            box-shadow: 0 15px 30px rgba(0, 0, 0, 0.1);
            overflow: hidden;
            width: 100%;
            max-width: 900px;
            display: flex;
            
        }

        .login-image {
            background-image: url('https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?ixlib=rb-4.0.3&auto=format&fit=crop&w=1470&q=80');
            background-size: cover;
            background-position: center;
            flex: 1;
            position: relative;
            display: none;
        }

        .login-image::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(44, 62, 80, 0.7);
        }

        .login-image-content {
            position: absolute;
            bottom: 40px;
            left: 40px;
            color: white;
            z-index: 1;
            padding-right: 20px;
        }

        .login-image-content h2 {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 10px;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .login-image-content p {
            font-size: 16px;
            opacity: 0.9;
            line-height: 1.6;
        }

        .login-form {
            flex: 1;
            padding: 50px;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }

        .login-header {
            margin-bottom: 40px;
            text-align: center;
        }

        .login-header h1 {
            color: var(--primary-color);
            font-weight: 700;
            margin-bottom: 10px;
            font-size: 28px;
        }

        .login-header p {
            color: #7f8c8d;
            font-size: 16px;
        }

        .form-floating {
            margin-bottom: 20px;
        }

        .form-floating .form-control {
            border-radius: 8px;
            height: 58px;
            border: 1px solid #dfe6e9;
            padding-left: 15px;
        }

        .form-floating label {
            padding-left: 15px;
            color: #7f8c8d;
        }

        .form-control:focus {
            border-color: var(--secondary-color);
            box-shadow: 0 0 0 0.25rem rgba(52, 152, 219, 0.25);
        }

        .btn-login {
            background-color: var(--secondary-color);
            border: none;
            padding: 14px;
            font-weight: 500;
            letter-spacing: 0.5px;
            transition: all 0.3s;
            border-radius: 8px;
            font-size: 16px;
        }

        .btn-login:hover, .btn-login:focus {
            background-color: #2980b9;
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
        }

        .login-footer {
            text-align: center;
            margin-top: 30px;
            color: #7f8c8d;
        }

        .login-footer a {
            color: var(--secondary-color);
            text-decoration: none;
            transition: color 0.3s;
            font-weight: 500;
        }

        .login-footer a:hover {
            color: #2980b9;
            text-decoration: underline;
        }

        .login-logo {
            max-width: 200px;
            margin-bottom: 20px;
            border-radius: 12px;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.05);
        }

        .form-check {
            margin-bottom: 20px;
        }

        .form-check-input:checked {
            background-color: var(--secondary-color);
            border-color: var(--secondary-color);
        }

        .form-check-label {
            color: #7f8c8d;
            font-size: 14px;
        }

        .password-toggle {
            position: absolute;
            right: 15px;
            top: 50%;
            transform: translateY(-50%);
            cursor: pointer;
            color: #95a5a6;
            z-index: 10;
            transition: color 0.3s;
        }

        .password-toggle:hover {
            color: var(--secondary-color);
        }

        .alert {
            display: none;
            margin-bottom: 20px;
            border-radius: 8px;
            padding: 12px 15px;
        }

        .alert-danger {
            background-color: rgba(231, 76, 60, 0.1);
            border-color: rgba(231, 76, 60, 0.2);
            color: #c0392b;
        }

        @media (min-width: 768px) {
            .login-image {
                display: block;
            }
        }

        @media (max-width: 767px) {
            .login-container {
                min-height: 100vh;
                border-radius: 0;
                box-shadow: none;
            }
            .login-form {
                padding: 30px 20px;
            }
        }

        @media (max-width: 480px) {
            body {
                background: white;
                padding: 0;
            }
            .login-container {
                box-shadow: none;
                border-radius: 0;
            }
            .login-form {
                padding: 20px 15px;
            }
        }
      `}</style>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet" />
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet" />

      <div className="container">
        <div className="login-container">
          <div className="login-image">
            <div className="login-image-content">
              <h2>Bem-vindo ao seu sistema de condominio</h2>
              <p>Acesse  para saber informações sobre o condominio</p>
            </div>
          </div>
          <div className="login-form">
            <div className="login-header">
              <div className="d-flex flex-column align-items-center">
                <img src="/logo-transparente.jpeg" alt="Logo do Condomínio" className="login-logo mx-auto d-block mb-0" />
              </div>
              <h1>Portal do Condomínio</h1>
              <p>Faça login para acessar sua conta</p>
            </div>

            {error && (
              <div className="alert alert-danger" style={{ display: 'block' }}>
                <i className="fas fa-exclamation-circle me-2"></i>
                {error}
              </div>
            )}

            <form id="login-form" onSubmit={handleSubmit}>
              <div className="form-floating">
                <input
                  type="text"
                  className="form-control"
                  id="username"
                  placeholder="Usuário"
                  value={formData.username}
                  onChange={handleInputChange}
                  required
                />
                <label htmlFor="username"><i className="fas fa-user me-2"></i>Usuário</label>
              </div>

              <div className="form-floating position-relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-control"
                  id="password"
                  placeholder="Senha"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                />
                <label htmlFor="password"><i className="fas fa-lock me-2"></i>Senha</label>
                <span className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
                  <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </span>
              </div>

              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="remember-me"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="remember-me">
                  Lembrar meus dados
                </label>
              </div>

              <button type="submit" className="btn btn-primary btn-login w-100" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Entrando...
                  </>
                ) : (
                  <>
                    <i className="fas fa-sign-in-alt me-2"></i>Entrar
                  </>
                )}
              </button>
            </form>

            <div className="login-footer">
              <p>Esqueceu sua senha? <a href="#">Recuperar acesso</a></p>
              <p className="mt-3">Primeiro acesso? <a href="#">Cadastre-se</a></p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
