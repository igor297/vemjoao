'use client'

import { useState, useEffect } from 'react'
import { Container, Row, Col, Card, Form, Alert, ListGroup, Badge, Button } from 'react-bootstrap'

interface Condominio {
  _id: string
  nome: string
  tickets_habilitado: boolean
}

interface UserData {
  id: string
  tipo: string
  nome: string
}

export default function ConfiguracoesPage() {
  const [userInfo, setUserInfo] = useState<UserData | null>(null)
  const [condominiums, setCondominiums] = useState<Condominio[]>([])
  const [selectedCondominium, setSelectedCondominium] = useState<Condominio | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [alert, setAlert] = useState<{ type: string; message: string } | null>(null)

  const showAlert = (type: string, message: string) => {
    setAlert({ type, message })
    setTimeout(() => setAlert(null), 5000)
  }

  const loadUserData = () => {
    const userData = localStorage.getItem('userData')
    if (userData) {
      try {
        const user = JSON.parse(userData)
        setUserInfo(user)
        return user
      } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error)
        showAlert('danger', 'Erro ao carregar dados do usuário')
      }
    }
    return null
  }

  const loadCondominiums = async (masterId: string) => {
    try {
      const response = await fetch(`/api/condominios?master_id=${encodeURIComponent(masterId)}`)
      const data = await response.json()
      
      if (data.success) {
        setCondominiums(data.condominios)
        
        // Auto-selecionar condomínio ativo
        const activeCondominiumId = localStorage.getItem('activeCondominio')
        if (activeCondominiumId) {
          const activeCondominium = data.condominios.find((c: Condominio) => c._id === activeCondominiumId)
          if (activeCondominium) {
            setSelectedCondominium(activeCondominium)
          }
        }
      } else {
        showAlert('danger', data.error || 'Erro ao carregar condomínios')
      }
    } catch (error) {
      console.error('Erro ao carregar condomínios:', error)
      showAlert('danger', 'Erro ao carregar condomínios')
    } finally {
      setLoading(false)
    }
  }

  const handleCondominiumChange = (condominiumId: string) => {
    if (!condominiumId) {
      setSelectedCondominium(null)
      return
    }

    const condominium = condominiums.find(c => c._id === condominiumId)
    if (condominium) {
      setSelectedCondominium(condominium)
      
      // Atualizar condomínio ativo
      localStorage.setItem('activeCondominio', condominiumId)
      localStorage.setItem('activeCondominiumName', condominium.nome)
      
      // Disparar evento para atualizar o header
      window.dispatchEvent(new CustomEvent('condominioChanged'))
    }
  }

  const handleToggleTickets = async (enabled: boolean) => {
    if (!selectedCondominium || !userInfo) return

    setUpdating(true)
    try {
      const response = await fetch(`/api/condominios/${selectedCondominium._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-data': JSON.stringify({
            ...userInfo,
            master_id: userInfo.id
          })
        },
        body: JSON.stringify({
          tickets_habilitado: enabled
        })
      })

      const data = await response.json()

      if (data.success) {
        // Atualizar estado local
        setSelectedCondominium(prev => 
          prev ? { ...prev, tickets_habilitado: enabled } : null
        )
        
        showAlert('success', `Sistema de tickets ${enabled ? 'habilitado' : 'desabilitado'} com sucesso!`)
        
        // Atualizar localStorage e cookies
        localStorage.setItem('tickets_habilitado', enabled.toString())
        document.cookie = `tickets_habilitado=${enabled}; path=/; max-age=86400`
        
        // Disparar evento para o Header
        window.dispatchEvent(new CustomEvent('ticketsConfigChanged', {
          detail: { ticketsHabilitado: enabled }
        }))
      } else {
        showAlert('danger', data.error || 'Erro ao atualizar configuração')
      }
    } catch (error) {
      console.error('Erro ao atualizar configuração:', error)
      showAlert('danger', 'Erro ao atualizar configuração')
    } finally {
      setUpdating(false)
    }
  }

  useEffect(() => {
    const user = loadUserData()
    if (user && user.tipo === 'master') {
      loadCondominiums(user.id)
    } else {
      setLoading(false)
    }
  }, [])

  if (loading) {
    return (
      <Container fluid className="py-5 bg-light min-vh-100">
        <Container>
          <Row className="justify-content-center">
            <Col lg={10}>
              <div className="text-center">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Carregando...</span>
                </div>
                <p className="mt-3 text-muted">Carregando configurações...</p>
              </div>
            </Col>
          </Row>
        </Container>
      </Container>
    )
  }

  if (!userInfo || userInfo.tipo !== 'master') {
    return (
      <Container fluid className="py-5 bg-light min-vh-100">
        <Container>
          <Row className="justify-content-center">
            <Col lg={10}>
              <Alert variant="warning" className="text-center">
                <h4>Acesso Restrito</h4>
                <p className="mb-0">Esta página é exclusiva para usuários master.</p>
              </Alert>
            </Col>
          </Row>
        </Container>
      </Container>
    )
  }

  return (
    <Container fluid className="py-5 bg-light min-vh-100">
      <Container>
        <Row className="justify-content-center">
          <Col lg={10}>
            <div className="text-center mb-5">
              <h1 className="display-4 fw-bold text-dark mb-4">Configurações</h1>
              <p className="lead text-muted mb-5">
                Gerencie as configurações do sistema de condomínios.
              </p>
            </div>

            {alert && (
              <Alert variant={alert.type} className="mb-4">
                {alert.message}
              </Alert>
            )}

            {/* Seleção de Condomínio */}
            <Card className="shadow mb-4">
              <Card.Header className="bg-primary text-white">
                <h5 className="mb-0">🏢 Seleção de Condomínio</h5>
              </Card.Header>
              <Card.Body>
                <Row>
                  <Col md={8}>
                    <Form.Group>
                      <Form.Label>Selecione o Condomínio</Form.Label>
                      <Form.Select
                        value={selectedCondominium?._id || ''}
                        onChange={(e) => handleCondominiumChange(e.target.value)}
                        disabled={updating}
                      >
                        <option value="">Selecione um condomínio</option>
                        {condominiums.map((cond) => (
                          <option key={cond._id} value={cond._id}>
                            {cond.nome}
                          </option>
                        ))}
                      </Form.Select>
                      <Form.Text className="text-muted">
                        Selecione o condomínio para configurar seus módulos
                      </Form.Text>
                    </Form.Group>
                  </Col>
                  <Col md={4} className="d-flex align-items-end">
                    {selectedCondominium && (
                      <div className="w-100">
                        <div className="text-center p-3 bg-light rounded">
                          <small className="text-success fw-bold">
                            ✅ Condomínio Selecionado
                          </small>
                          <br />
                          <small className="text-muted">
                            {selectedCondominium.nome}
                          </small>
                        </div>
                      </div>
                    )}
                  </Col>
                </Row>
              </Card.Body>
            </Card>

            {/* Configurações dos Módulos */}
            <Card className="shadow">
              <Card.Header className="bg-primary text-white">
                <h5 className="mb-0">⚙️ Configurações dos Módulos</h5>
              </Card.Header>
              <Card.Body>
                {selectedCondominium ? (
                  <div>
                    <h6 className="mb-4">Módulos Disponíveis</h6>
                    
                    <ListGroup className="mb-4">
                      <ListGroup.Item className="d-flex justify-content-between align-items-center">
                        <div className="flex-grow-1">
                          <div className="d-flex align-items-center mb-2">
                            <h5 className="mb-0 me-3">🎫 Sistema de Tickets</h5>
                            <Badge bg={selectedCondominium.tickets_habilitado ? 'success' : 'secondary'}>
                              {selectedCondominium.tickets_habilitado ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </div>
                          <p className="text-muted mb-0">
                            Permite que moradores abram e acompanhem solicitações de suporte e manutenção.
                          </p>
                        </div>
                        <div className="ms-3">
                          <Form.Check
                            type="switch"
                            id="tickets-toggle"
                            checked={selectedCondominium.tickets_habilitado || false}
                            onChange={(e) => handleToggleTickets(e.target.checked)}
                            disabled={updating}
                            size="lg"
                          />
                        </div>
                      </ListGroup.Item>
                    </ListGroup>

                    <Alert variant="info">
                      <small>
                        <strong>💡 Dica:</strong> Os módulos desabilitados não aparecerão no menu de navegação dos moradores.
                      </small>
                    </Alert>

                    {updating && (
                      <Alert variant="warning">
                        <div className="d-flex align-items-center">
                          <div className="spinner-border spinner-border-sm me-3" role="status">
                            <span className="visually-hidden">Atualizando...</span>
                          </div>
                          Atualizando configurações...
                        </div>
                      </Alert>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-5">
                    <h6 className="text-muted mb-3">Nenhum condomínio selecionado</h6>
                    <p className="text-muted mb-0">
                      Selecione um condomínio acima para acessar suas configurações.
                    </p>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </Container>
  )
}