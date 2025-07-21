'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from 'react-bootstrap'
import Link from 'next/link'

export default function CadastroPage() {
  const [formData, setFormData] = useState({
    nome: '',
    cpf: '',
    cnpj: '',
    email: '',
    password: '',
    confirmPassword: '',
    celular1: '',
    celular2: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  
  const router = useRouter()

  // Funções de máscara
  const formatCPF = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1')
  }

  const formatCNPJ = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1')
  }

  const formatPhone = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .replace(/(-\d{4})\d+?$/, '$1')
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { id, value } = e.target
    let formattedValue = value

    // Aplicar máscaras baseadas no campo
    switch (id) {
      case 'cpf':
        formattedValue = formatCPF(value)
        break
      case 'cnpj':
        formattedValue = formatCNPJ(value)
        break
      case 'celular1':
      case 'celular2':
        formattedValue = formatPhone(value)
        break
      default:
        formattedValue = value
    }

    setFormData(prev => ({
      ...prev,
      [id]: formattedValue
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setSuccess('')

    // Validações
    if (!formData.nome || !formData.cpf || !formData.email || !formData.password || !formData.confirmPassword || !formData.celular1) {
      setError('Por favor, preencha todos os campos obrigatórios.')
      setIsLoading(false)
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError('As senhas não coincidem.')
      setIsLoading(false)
      return
    }

    if (formData.password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nome: formData.nome,
          cpf: formData.cpf,
          cnpj: formData.cnpj,
          email: formData.email,
          password: formData.password,
          celular1: formData.celular1,
          celular2: formData.celular2
        })
      })

      const result = await response.json()

      if (result.success) {
        setSuccess('Cadastro realizado com sucesso! Redirecionando para o login...')
        setTimeout(() => {
          router.push('/login')
        }, 2000)
      } else {
        setError(result.message || 'Erro ao realizar cadastro.')
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
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            padding: 20px 0;
        }
        
        .cadastro-container {
            background-color: white;
            border-radius: 12px;
            box-shadow: 0 15px 30px rgba(0, 0, 0, 0.1);
            overflow: hidden;
            width: 100%;
            max-width: 600px;
            margin: 20px;
        }

        .cadastro-form {
            padding: 50px;
        }

        .cadastro-header {
            margin-bottom: 40px;
            text-align: center;
        }

        .cadastro-header h1 {
            color: var(--primary-color);
            font-weight: 700;
            margin-bottom: 10px;
            font-size: 28px;
        }

        .cadastro-header p {
            color: #7f8c8d;
            font-size: 16px;
        }

        .form-floating {
            margin-bottom: 20px;
        }

        .form-floating .form-control, .form-select {
            border-radius: 8px;
            height: 58px;
            border: 1px solid #dfe6e9;
            padding-left: 15px;
        }

        .form-floating label {
            padding-left: 15px;
            color: #7f8c8d;
        }

        .form-control:focus, .form-select:focus {
            border-color: var(--secondary-color);
            box-shadow: 0 0 0 0.25rem rgba(52, 152, 219, 0.25);
        }

        .btn-cadastro {
            background-color: var(--secondary-color);
            border: none;
            padding: 14px;
            font-weight: 500;
            letter-spacing: 0.5px;
            transition: all 0.3s;
            border-radius: 8px;
            font-size: 16px;
        }

        .btn-cadastro:hover, .btn-cadastro:focus {
            background-color: #2980b9;
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
        }

        .cadastro-footer {
            text-align: center;
            margin-top: 30px;
            color: #7f8c8d;
        }

        .cadastro-footer a {
            color: var(--secondary-color);
            text-decoration: none;
            transition: color 0.3s;
            font-weight: 500;
        }

        .cadastro-footer a:hover {
            color: #2980b9;
            text-decoration: underline;
        }

        .cadastro-logo {
            max-width: 150px;
            margin-bottom: 20px;
            border-radius: 12px;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.05);
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

        .alert-success {
            background-color: rgba(46, 204, 113, 0.1);
            border-color: rgba(46, 204, 113, 0.2);
            color: #27ae60;
        }

        @media (max-width: 768px) {
            .cadastro-container {
                margin: 10px;
                border-radius: 8px;
            }
            .cadastro-form {
                padding: 30px 20px;
            }
        }
      `}</style>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet" />
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet" />

      <div className="container">
        <div className="cadastro-container">
          <div className="cadastro-form">
            <div className="cadastro-header">
              <div className="d-flex flex-column align-items-center">
                <img src="/logo-transparente.jpeg" alt="Logo do Condomínio" className="cadastro-logo mx-auto d-block mb-0" />
              </div>
              <h1>Criar Conta</h1>
              <p>Preencha os dados para criar sua conta</p>
            </div>

            {error && (
              <div className="alert alert-danger" style={{ display: 'block' }}>
                <i className="fas fa-exclamation-circle me-2"></i>
                {error}
              </div>
            )}

            {success && (
              <div className="alert alert-success" style={{ display: 'block' }}>
                <i className="fas fa-check-circle me-2"></i>
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-floating">
                <input
                  type="text"
                  className="form-control"
                  id="nome"
                  placeholder="Nome completo"
                  value={formData.nome}
                  onChange={handleInputChange}
                  required
                />
                <label htmlFor="nome"><i className="fas fa-user me-2"></i>Nome completo *</label>
              </div>

              <div className="form-floating">
                <input
                  type="email"
                  className="form-control"
                  id="email"
                  placeholder="E-mail"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                />
                <label htmlFor="email"><i className="fas fa-envelope me-2"></i>E-mail *</label>
              </div>

              <div className="form-floating">
                <input
                  type="text"
                  className="form-control"
                  id="cpf"
                  placeholder="CPF"
                  value={formData.cpf}
                  onChange={handleInputChange}
                  required
                />
                <label htmlFor="cpf"><i className="fas fa-id-card me-2"></i>CPF *</label>
              </div>

              <div className="form-floating">
                <input
                  type="text"
                  className="form-control"
                  id="cnpj"
                  placeholder="CNPJ (opcional)"
                  value={formData.cnpj}
                  onChange={handleInputChange}
                />
                <label htmlFor="cnpj"><i className="fas fa-building me-2"></i>CNPJ (opcional)</label>
              </div>

              <div className="form-floating">
                <input
                  type="tel"
                  className="form-control"
                  id="celular1"
                  placeholder="Celular Principal"
                  value={formData.celular1}
                  onChange={handleInputChange}
                  required
                />
                <label htmlFor="celular1"><i className="fas fa-mobile-alt me-2"></i>Celular Principal *</label>
              </div>

              <div className="form-floating">
                <input
                  type="tel"
                  className="form-control"
                  id="celular2"
                  placeholder="Celular Secundário (opcional)"
                  value={formData.celular2}
                  onChange={handleInputChange}
                />
                <label htmlFor="celular2"><i className="fas fa-mobile-alt me-2"></i>Celular Secundário (opcional)</label>
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
                <label htmlFor="password"><i className="fas fa-lock me-2"></i>Senha *</label>
                <span className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
                  <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </span>
              </div>

              <div className="form-floating position-relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="form-control"
                  id="confirmPassword"
                  placeholder="Confirmar senha"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  required
                />
                <label htmlFor="confirmPassword"><i className="fas fa-lock me-2"></i>Confirmar senha *</label>
                <span className="password-toggle" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                  <i className={`fas ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </span>
              </div>

              <button type="submit" className="btn btn-primary btn-cadastro w-100" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Criando conta...
                  </>
                ) : (
                  <>
                    <i className="fas fa-user-plus me-2"></i>Criar conta
                  </>
                )}
              </button>
            </form>

            <div className="cadastro-footer">
              <p>Já tem uma conta? <Link href="/login">Fazer login</Link></p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}