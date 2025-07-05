'use client'

import { useState, useEffect } from 'react'
import { Container, Row, Col, Card, Button, Form, Alert, Badge, ListGroup } from 'react-bootstrap'

export default function PixConfigPage() {
  const [config, setConfig] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [alert, setAlert] = useState<{type: string, message: string} | null>(null)
  const [credentials, setCredentials] = useState({
    mercado_pago: {
      access_token: '',
      public_key: ''
    },
    stone: {
      api_key: '',
      secret_key: ''
    }
  })

  useEffect(() => {
    loadCurrentConfig()
  }, [])

  const loadCurrentConfig = async () => {
    try {
      const response = await fetch('/api/admin/configure-pix')
      const data = await response.json()
      if (data.success) {
        setConfig(data.current_config)
      }
    } catch (error) {
      showAlert('danger', 'Erro ao carregar configuração')
    }
  }

  const showAlert = (type: string, message: string) => {
    setAlert({ type, message })
    setTimeout(() => setAlert(null), 5000)
  }

  const handleEnableReal = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/configure-pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enable_real',
          provider: 'mercado_pago'
        })
      })

      const data = await response.json()
      if (data.success) {
        showAlert('info', data.message)
        setConfig(prev => ({ ...prev, ...data.current_status }))
      } else {
        showAlert('danger', data.error)
      }
    } catch (error) {
      showAlert('danger', 'Erro ao configurar PIX')
    } finally {
      setLoading(false)
    }
  }

  const testCredentials = async (provider: string) => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/configure-pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test_credentials',
          provider,
          credentials: credentials[provider as keyof typeof credentials]
        })
      })

      const data = await response.json()
      if (data.success) {
        showAlert('success', data.message)
      } else {
        showAlert('danger', data.message)
      }
    } catch (error) {
      showAlert('danger', 'Erro ao testar credenciais')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container fluid className="py-4">
      {alert && (
        <Alert variant={alert.type} dismissible onClose={() => setAlert(null)}>
          {alert.message}
        </Alert>
      )}

      <Row>
        <Col>
          <Card>
            <Card.Header>
              <h4 className="mb-0">⚡ Configuração PIX Real</h4>
            </Card.Header>
            <Card.Body>
              {config && (
                <>
                  <Alert variant={config.pix_use_real ? 'success' : 'warning'}>
                    <h6>Status Atual:</h6>
                    <p className="mb-0">
                      PIX Real: <Badge bg={config.pix_use_real ? 'success' : 'secondary'}>
                        {config.pix_use_real ? 'ATIVADO' : 'DESATIVADO'}
                      </Badge>
                    </p>
                  </Alert>

                  <Row>
                    <Col md={6}>
                      <Card className="mb-3">
                        <Card.Header>
                          <h6 className="mb-0">
                            💳 Mercado Pago 
                            <Badge bg={config.mercado_pago.configured ? 'success' : 'secondary'} className="ms-2">
                              {config.mercado_pago.configured ? 'Configurado' : 'Não configurado'}
                            </Badge>
                          </h6>
                        </Card.Header>
                        <Card.Body>
                          {config.mercado_pago.configured ? (
                            <p>Token: <code>{config.mercado_pago.token_preview}</code></p>
                          ) : (
                            <>
                              <Form.Group className="mb-3">
                                <Form.Label>Access Token</Form.Label>
                                <Form.Control
                                  type="password"
                                  placeholder="APP_USR-..."
                                  value={credentials.mercado_pago.access_token}
                                  onChange={(e) => setCredentials(prev => ({
                                    ...prev,
                                    mercado_pago: {
                                      ...prev.mercado_pago,
                                      access_token: e.target.value
                                    }
                                  }))}
                                />
                              </Form.Group>
                              <Form.Group className="mb-3">
                                <Form.Label>Public Key</Form.Label>
                                <Form.Control
                                  type="text"
                                  placeholder="APP_USR-..."
                                  value={credentials.mercado_pago.public_key}
                                  onChange={(e) => setCredentials(prev => ({
                                    ...prev,
                                    mercado_pago: {
                                      ...prev.mercado_pago,
                                      public_key: e.target.value
                                    }
                                  }))}
                                />
                              </Form.Group>
                              <Button 
                                variant="outline-primary" 
                                size="sm"
                                onClick={() => testCredentials('mercado_pago')}
                                disabled={loading || !credentials.mercado_pago.access_token}
                              >
                                Testar Credenciais
                              </Button>
                            </>
                          )}
                        </Card.Body>
                      </Card>
                    </Col>

                    <Col md={6}>
                      <Card className="mb-3">
                        <Card.Header>
                          <h6 className="mb-0">
                            💎 Stone 
                            <Badge bg={config.stone.configured ? 'success' : 'secondary'} className="ms-2">
                              {config.stone.configured ? 'Configurado' : 'Não configurado'}
                            </Badge>
                          </h6>
                        </Card.Header>
                        <Card.Body>
                          <Form.Group className="mb-3">
                            <Form.Label>API Key</Form.Label>
                            <Form.Control
                              type="password"
                              placeholder="stone_..."
                              value={credentials.stone.api_key}
                              onChange={(e) => setCredentials(prev => ({
                                ...prev,
                                stone: {
                                  ...prev.stone,
                                  api_key: e.target.value
                                }
                              }))}
                            />
                          </Form.Group>
                          <Form.Group className="mb-3">
                            <Form.Label>Secret Key</Form.Label>
                            <Form.Control
                              type="password"
                              placeholder="secret_..."
                              value={credentials.stone.secret_key}
                              onChange={(e) => setCredentials(prev => ({
                                ...prev,
                                stone: {
                                  ...prev.stone,
                                  secret_key: e.target.value
                                }
                              }))}
                            />
                          </Form.Group>
                          <Button 
                            variant="outline-primary" 
                            size="sm"
                            onClick={() => testCredentials('stone')}
                            disabled={loading || !credentials.stone.api_key}
                          >
                            Testar Credenciais
                          </Button>
                        </Card.Body>
                      </Card>
                    </Col>
                  </Row>

                  <Card>
                    <Card.Header>
                      <h6 className="mb-0">📋 Instruções para PIX Real</h6>
                    </Card.Header>
                    <Card.Body>
                      <ListGroup variant="flush">
                        <ListGroup.Item>
                          <strong>1. Mercado Pago:</strong>
                          <br />Acesse <a href="https://www.mercadopago.com.br/developers/panel/app" target="_blank">developers.mercadopago.com</a>
                          <br />Crie uma aplicação e copie as credenciais de produção
                        </ListGroup.Item>
                        <ListGroup.Item>
                          <strong>2. Configure variáveis de ambiente:</strong>
                          <br /><code>MERCADO_PAGO_ACCESS_TOKEN=seu_token</code>
                          <br /><code>PIX_USE_REAL=true</code>
                        </ListGroup.Item>
                        <ListGroup.Item>
                          <strong>3. Reinicie o servidor</strong>
                        </ListGroup.Item>
                      </ListGroup>
                      
                      <Button 
                        variant="success" 
                        className="mt-3"
                        onClick={handleEnableReal}
                        disabled={loading}
                      >
                        Ver Instruções Completas
                      </Button>
                    </Card.Body>
                  </Card>
                </>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  )
}