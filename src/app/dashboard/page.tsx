'use client'

import { useState, useEffect, useMemo } from 'react'
import { Container, Row, Col, Card, Form, Button, Alert, Badge } from 'react-bootstrap'

interface Condominio {
  _id: string
  nome: string
}

export default function DashboardPage() {
  const [userInfo, setUserInfo] = useState<any>(null)
  const [condominios, setCondominios] = useState<Condominio[]>([])
  const [activeCondominio, setActiveCondominio] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const userData = localStorage.getItem('userData')
    if (userData) {
      try {
        const user = JSON.parse(userData)
        setUserInfo(user)
        
        // Carregar condomínio ativo salvo
        const savedActiveCondominio = localStorage.getItem('activeCondominio')
        const savedActiveCondominioName = localStorage.getItem('activeCondominioName')
        
        if (savedActiveCondominio) {
          setActiveCondominio(savedActiveCondominio)
        }
        
        // Se for master, carregar lista de condomínios
        if (user.tipo === 'master') {
          fetchCondominios(user)
        }
      } catch (error) {
        console.error('Error parsing user data:', error)
        setError('Erro ao carregar dados do usuário')
      }
    }
  }, [])

  const fetchCondominios = async (userInfo: any) => {
    try {
      setLoading(true)
      setError('')
      
      // Usar ID como master_id (único e imutável)
      const masterId = userInfo.id
      
      if (!masterId) {
        setError('ID do master não encontrado')
        return
      }
      
      const response = await fetch(`/api/condominios?master_id=${encodeURIComponent(masterId)}`)
      const data = await response.json()
      
      if (data.success) {
        setCondominios(data.condominios || [])
        
        if (!data.condominios || data.condominios.length === 0) {
          setError('Nenhum condomínio encontrado para este master')
        }
      } else {
        setError(data.error || 'Erro ao carregar condomínios')
      }
    } catch (error) {
      setError('Erro de conexão ao carregar condomínios')
    } finally {
      setLoading(false)
    }
  }

  const handleActivateCondominio = () => {
    if (!activeCondominio) {
      setError('Selecione um condomínio para ativar')
      return
    }

    // Salvar condomínio ativo no localStorage
    localStorage.setItem('activeCondominio', activeCondominio)
    
    // Encontrar o nome do condomínio selecionado
    const selectedCond = condominios.find(c => c._id === activeCondominio)
    
    if (selectedCond) {
      localStorage.setItem('activeCondominioName', selectedCond.nome)
      setSuccess(`Condomínio "${selectedCond.nome}" ativado com sucesso!`)
      
      // Forçar atualização do header com eventos múltiplos
      window.dispatchEvent(new Event('storage'))
      window.dispatchEvent(new CustomEvent('condominioChanged', { 
        detail: { 
          condominioId: activeCondominio, 
          condominioName: selectedCond.nome 
        }
      }))
      
      // Forçar re-render imediato
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    }
  }

  // 🚀 Performance: Cache de dados computados
  const activeCondominios = useMemo(() => 
    condominios.filter(c => c.nome && c._id),
    [condominios]
  )

  const activeCondominioName = useMemo(() => {
    if (userInfo?.tipo === 'master') {
      const activeCond = activeCondominios.find(c => c._id === activeCondominio)
      return activeCond?.nome || 'Nenhum condomínio ativo'
    }
    return userInfo?.condominio_nome || 'N/A'
  }, [userInfo, activeCondominios, activeCondominio])

  const getActiveCondominioName = () => activeCondominioName

  return (
      <Container fluid className="py-5 bg-light min-vh-100">
        <Container>
          <Row className="justify-content-center">
            <Col lg={10}>
              <div className="text-center mb-5">
                <div className="bg-success rounded-circle d-inline-flex align-items-center justify-content-center mb-4"
                     style={{ width: '96px', height: '96px' }}>
                  <svg className="text-white" width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                
                <h1 className="display-4 fw-bold text-dark mb-4">
                  Bem-vindo ao Dashboard!
                </h1>
                
                <p className="lead text-muted mb-5">
                  {userInfo?.tipo === 'master' 
                    ? 'Gerencie todos os seus condomínios de forma centralizada' 
                    : `Dashboard do ${userInfo?.condominio_nome}`}
                </p>
              </div>

              {error && (
                <Alert variant="danger" dismissible onClose={() => setError('')}>
                  {error}
                </Alert>
              )}

              {success && (
                <Alert variant="success" dismissible onClose={() => setSuccess('')}>
                  {success}
                </Alert>
              )}

              {/* Card de seleção de condomínio ativo - apenas para Master */}
              {userInfo?.tipo === 'master' && (
                <Row className="mb-4">
                  <Col>
                    <Card className="shadow">
                      <Card.Header className="bg-primary text-white d-flex justify-content-between align-items-center">
                        <h5 className="mb-0">🏢 Seleção de Condomínio Ativo</h5>
                        <div className="d-flex align-items-center">
                          {loading && (
                            <div className="spinner-border spinner-border-sm text-light me-2" role="status">
                              <span className="visually-hidden">Carregando...</span>
                            </div>
                          )}
                          <Button 
                            variant="outline-light" 
                            size="sm"
                            onClick={() => userInfo && fetchCondominios(userInfo)}
                            disabled={loading}
                            title="Recarregar condomínios"
                          >
                            🔄
                          </Button>
                        </div>
                      </Card.Header>
                      <Card.Body>
                        {loading ? (
                          <div className="text-center py-3">
                            <div className="spinner-border text-primary" role="status">
                              <span className="visually-hidden">Carregando seus condomínios...</span>
                            </div>
                            <p className="mt-2 text-muted">Carregando seus condomínios...</p>
                          </div>
                        ) : (
                          <Row className="align-items-end">
                            <Col md={6}>
                              <Form.Group>
                                <Form.Label>
                                  Selecione o condomínio para trabalhar:
                                  <small className="text-muted ms-2">
                                    ({condominios.length} condomínio{condominios.length !== 1 ? 's' : ''} encontrado{condominios.length !== 1 ? 's' : ''})
                                  </small>
                                </Form.Label>
                                <Form.Select
                                  value={activeCondominio}
                                  onChange={(e) => setActiveCondominio(e.target.value)}
                                  disabled={loading || condominios.length === 0}
                                >
                                  <option value="">
                                    {condominios.length === 0 ? 'Nenhum condomínio disponível' : 'Selecione um condomínio'}
                                  </option>
                                  {condominios.map((cond) => (
                                    <option key={cond._id} value={cond._id}>
                                      {cond.nome}
                                    </option>
                                  ))}
                                </Form.Select>
                              </Form.Group>
                            </Col>
                            <Col md={3}>
                              <Button 
                                variant="success" 
                                onClick={handleActivateCondominio}
                                disabled={loading || !activeCondominio || condominios.length === 0}
                                className="w-100"
                              >
                                {loading ? 'Carregando...' : 'Ativar Condomínio'}
                              </Button>
                            </Col>
                            <Col md={3}>
                              <div className="text-center">
                                <small className="text-muted d-block">Condomínio Ativo:</small>
                                <Badge bg={getActiveCondominioName() === 'Nenhum condomínio ativo' ? 'secondary' : 'info'} className="fs-6">
                                  {getActiveCondominioName()}
                                </Badge>
                              </div>
                            </Col>
                          </Row>
                        )}
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              )}

              {/* Informações do usuário */}
              {userInfo && (
                <Row className="mb-4">
                  <Col>
                    <Card className="shadow">
                      <Card.Header className="bg-info text-white">
                        <h5 className="mb-0">👤 Suas Informações</h5>
                      </Card.Header>
                      <Card.Body>
                        <Row>
                          <Col md={6}>
                            <div className="mb-2">
                              <strong>Nome:</strong>
                              <div className="text-muted">{userInfo.nome}</div>
                            </div>
                            <div className="mb-2">
                              <strong>Email:</strong>
                              <div className="text-muted">{userInfo.email}</div>
                            </div>
                          </Col>
                          <Col md={6}>
                            <div className="mb-2">
                              <strong>Tipo de Usuário:</strong>
                              <div>
                                {userInfo.tipo === 'master' && (
                                  <Badge bg="primary">Master</Badge>
                                )}
                                {userInfo.tipo === 'adm' && (
                                  <Badge bg="warning">
                                    {userInfo.subtipo?.charAt(0).toUpperCase()}{userInfo.subtipo?.slice(1)}
                                  </Badge>
                                )}
                                {userInfo.tipo === 'colaborador' && (
                                  <Badge bg="secondary">Colaborador</Badge>
                                )}
                                {userInfo.tipo === 'morador' && (
                                  <Badge bg="success">
                                    {userInfo.subtipo?.charAt(0).toUpperCase()}{userInfo.subtipo?.slice(1)}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {userInfo.condominio_nome && (
                              <div className="mb-2">
                                <strong>Condomínio:</strong>
                                <div className="text-muted">{userInfo.condominio_nome}</div>
                              </div>
                            )}
                          </Col>
                        </Row>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              )}

              {/* Card de Configurações para Master */}
              {userInfo?.tipo === 'master' && (
                <Row className="mb-4">
                  <Col>
                    <Card className="shadow">
                      <Card.Header className="bg-secondary text-white">
                        <h5 className="mb-0">⚙️ Configurações</h5>
                      </Card.Header>
                      <Card.Body>
                        <p className="text-muted">Acesse as configurações gerais do sistema.</p>
                        <Button variant="primary" href="/settings">
                          Ir para Configurações
                        </Button>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              )}

            </Col>
          </Row>
        </Container>
      </Container>
  )
}