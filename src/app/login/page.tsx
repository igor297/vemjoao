'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from 'react-bootstrap'

export default function LoginPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

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
    setError('')

    try {
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

      const data = await response.json()

      if (response.ok && data.success) {
        localStorage.setItem('userData', JSON.stringify(data.user))
        
        // Redirecionar baseado no tipo de usuário
        if (data.user.tipo === 'master') {
          router.push('/dashboard')
        } else if (data.user.tipo === 'adm') {
          router.push('/adm-dashboard')
        } else {
          router.push('/dashboard')
        }
      } else {
        alert('Email ou senha incorretos')
        setError(data.error || 'Email ou senha incorretos')
      }
    } catch (err) {
      alert('Email ou senha incorretos')
      setError('Erro ao fazer login. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
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
                  {error && (
                    <Alert variant="danger" className="mb-3">
                      {error}
                    </Alert>
                  )}

                  <Form.Group className="mb-3">
                    <Form.Label>Email</Form.Label>
                    <Form.Control
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="seu@email.com"
                      required
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Senha</Form.Label>
                    <Form.Control
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="••••••••"
                      required
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
  )
}