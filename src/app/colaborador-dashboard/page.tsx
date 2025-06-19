'use client'

import { useState, useEffect } from 'react'
import { Container, Row, Col, Card, Alert, Badge } from 'react-bootstrap'
import Header from '@/components/Header'

export default function ColaboradorDashboardPage() {
  const [userInfo, setUserInfo] = useState<any>(null)

  useEffect(() => {
    const userData = localStorage.getItem('userData')
    if (userData) {
      try {
        const user = JSON.parse(userData)
        setUserInfo(user)
      } catch (error) {
        console.error('Error parsing user data:', error)
      }
    }
  }, [])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR')
  }

  return (
    <>
      <Header />
      <Container fluid className="py-5 bg-light min-vh-100">
        <Container>
          <Row className="justify-content-center">
            <Col lg={10}>
              <div className="text-center mb-5">
                <div className="bg-success rounded-circle d-inline-flex align-items-center justify-content-center mb-4"
                     style={{ width: '96px', height: '96px' }}>
                  <svg className="text-white" width="48" height="48" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16,4C18.11,4 19.8,5.69 19.8,7.8C19.8,9.91 18.11,11.6 16,11.6C13.89,11.6 12.2,9.91 12.2,7.8C12.2,5.69 13.89,4 16,4M16,13.4C20.67,13.4 24.4,15.27 24.4,17.6V20H7.6V17.6C7.6,15.27 11.33,13.4 16,13.4M8.8,13.4H6C3.79,13.4 2,15.19 2,17.4V20H7.6V17.6C7.6,16.5 8.09,15.45 8.8,14.58V13.4Z"/>
                  </svg>
                </div>
                
                <h1 className="display-4 fw-bold text-dark mb-4">
                  Dashboard do Colaborador
                </h1>
                
                <p className="lead text-muted mb-5">
                  Área de trabalho para colaboradores do condomínio.
                </p>
              </div>

              {userInfo && (
                <Row className="mb-5">
                  <Col>
                    <Card className="shadow">
                      <Card.Header className="bg-success text-white">
                        <h5 className="mb-0">👤 Suas Informações</h5>
                      </Card.Header>
                      <Card.Body>
                        <Row>
                          <Col md={6}>
                            <div className="mb-3">
                              <strong>Nome:</strong>
                              <div className="text-muted">{userInfo.nome}</div>
                            </div>
                            <div className="mb-3">
                              <strong>Email:</strong>
                              <div className="text-muted">{userInfo.email}</div>
                            </div>
                          </Col>
                          <Col md={6}>
                            <div className="mb-3">
                              <strong>Tipo:</strong>
                              <div className="mt-1">
                                <Badge bg="secondary" className="fs-6">Colaborador</Badge>
                              </div>
                            </div>
                            <div className="mb-3">
                              <strong>Condomínio:</strong>
                              <div className="text-muted">{userInfo.condominio_nome}</div>
                            </div>
                          </Col>
                        </Row>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              )}

              <Row>
                <Col md={6} lg={4} className="mb-4">
                  <Card className="shadow-sm h-100">
                    <Card.Body className="text-center">
                      <div className="bg-primary rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
                           style={{ width: '64px', height: '64px' }}>
                        <svg className="text-white" width="32" height="32" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M9,10V12H7V10H9M13,10V12H11V10H13M17,10V12H15V10H17M19,3A2,2 0 0,1 21,5V19A2,2 0 0,1 19,21H5C3.89,21 3,20.1 3,19V5A2,2 0 0,1 5,3H6V1H8V3H16V1H18V3H19M19,19V8H5V19H19M9,14V16H7V14H9M13,14V16H11V14H13M17,14V16H15V14H17Z"/>
                        </svg>
                      </div>
                      <h5 className="card-title">Horários</h5>
                      <p className="card-text text-muted">
                        Visualizar escala de trabalho
                      </p>
                    </Card.Body>
                  </Card>
                </Col>

                <Col md={6} lg={4} className="mb-4">
                  <Card className="shadow-sm h-100">
                    <Card.Body className="text-center">
                      <div className="bg-info rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
                           style={{ width: '64px', height: '64px' }}>
                        <svg className="text-white" width="32" height="32" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 12,14A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2M19,11C19,14.53 16.39,17.44 13,17.93V21H11V17.93C7.61,17.44 5,14.53 5,11H7A5,5 0 0,0 12,16A5,5 0 0,0 17,11H19Z"/>
                        </svg>
                      </div>
                      <h5 className="card-title">Comunicados</h5>
                      <p className="card-text text-muted">
                        Avisos e informações importantes
                      </p>
                    </Card.Body>
                  </Card>
                </Col>

                <Col md={6} lg={4} className="mb-4">
                  <Card className="shadow-sm h-100">
                    <Card.Body className="text-center">
                      <div className="bg-warning rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
                           style={{ width: '64px', height: '64px' }}>
                        <svg className="text-white" width="32" height="32" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3M19,5V19H5V5H19Z"/>
                        </svg>
                      </div>
                      <h5 className="card-title">Ordens de Serviço</h5>
                      <p className="card-text text-muted">
                        Tarefas e manutenções atribuídas
                      </p>
                    </Card.Body>
                  </Card>
                </Col>

                <Col md={6} lg={4} className="mb-4">
                  <Card className="shadow-sm h-100">
                    <Card.Body className="text-center">
                      <div className="bg-success rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
                           style={{ width: '64px', height: '64px' }}>
                        <svg className="text-white" width="32" height="32" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M11,16.5L18,9.5L16.59,8.09L11,13.67L7.91,10.59L6.5,12L11,16.5Z"/>
                        </svg>
                      </div>
                      <h5 className="card-title">Relatórios</h5>
                      <p className="card-text text-muted">
                        Registrar atividades realizadas
                      </p>
                    </Card.Body>
                  </Card>
                </Col>

                <Col md={6} lg={4} className="mb-4">
                  <Card className="shadow-sm h-100">
                    <Card.Body className="text-center">
                      <div className="bg-danger rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
                           style={{ width: '64px', height: '64px' }}>
                        <svg className="text-white" width="32" height="32" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12,2A2,2 0 0,1 14,4C14,4.74 13.6,5.39 13,5.73V7H14A7,7 0 0,1 21,14H22A1,1 0 0,1 23,15V18A1,1 0 0,1 22,19H21V20A2,2 0 0,1 19,22H5A2,2 0 0,1 3,20V19H2A1,1 0 0,1 1,18V15A1,1 0 0,1 2,14H3A7,7 0 0,1 10,7H11V5.73C10.4,5.39 10,4.74 10,4A2,2 0 0,1 12,2M7.5,13A2.5,2.5 0 0,0 5,15.5A2.5,2.5 0 0,0 7.5,18A2.5,2.5 0 0,0 10,15.5A2.5,2.5 0 0,0 7.5,13M16.5,13A2.5,2.5 0 0,0 14,15.5A2.5,2.5 0 0,0 16.5,18A2.5,2.5 0 0,0 19,15.5A2.5,2.5 0 0,0 16.5,13Z"/>
                        </svg>
                      </div>
                      <h5 className="card-title">Equipamentos</h5>
                      <p className="card-text text-muted">
                        Controle de ferramentas e materiais
                      </p>
                    </Card.Body>
                  </Card>
                </Col>

                <Col md={6} lg={4} className="mb-4">
                  <Card className="shadow-sm h-100">
                    <Card.Body className="text-center">
                      <div className="bg-dark rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
                           style={{ width: '64px', height: '64px' }}>
                        <svg className="text-white" width="32" height="32" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 12,14A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2M19,11C19,14.53 16.39,17.44 13,17.93V21H11V17.93C7.61,17.44 5,14.53 5,11H7A5,5 0 0,0 12,16A5,5 0 0,0 17,11H19Z"/>
                        </svg>
                      </div>
                      <h5 className="card-title">Contato</h5>
                      <p className="card-text text-muted">
                        Falar com administração
                      </p>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              <Alert variant="info" className="mt-4">
                <Alert.Heading>👷 Área do Colaborador</Alert.Heading>
                <p className="mb-0">
                  Você está logado como colaborador do condomínio. Use o menu acima para acessar suas funcionalidades de trabalho.
                </p>
              </Alert>
            </Col>
          </Row>
        </Container>
      </Container>
    </>
  )
}