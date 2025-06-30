'use client'

import { useState, useEffect } from 'react'
import { Container, Row, Col, Card, Alert, Badge } from 'react-bootstrap'

export default function AdmDashboardPage() {
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

  const getTipoBadge = (tipo: string) => {
    const colors = {
      sindico: 'primary',
      subsindico: 'secondary', 
      conselheiro: 'info'
    }
    return <Badge bg={colors[tipo as keyof typeof colors]} className="fs-6">
      {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
    </Badge>
  }

  return (
    <>
      <Container fluid className="py-5 bg-light min-vh-100">
        <Container>
          <Row className="justify-content-center">
            <Col lg={10}>
              <div className="text-center mb-5">
                <div className="bg-success rounded-circle d-inline-flex align-items-center justify-content-center mb-4"
                     style={{ width: '96px', height: '96px' }}>
                  <svg className="text-white" width="48" height="48" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 4V6L21 9ZM15 10C16.1 10 17 10.9 17 12S16.1 14 15 14 13 13.1 13 12 13.9 10 15 10ZM9 10C10.1 10 11 10.9 11 12S10.1 14 9 14 7 13.1 7 12 7.9 10 9 10ZM12 15C14.2 15 16 16.8 16 19V21H8V19C8 16.8 9.8 15 12 15Z"/>
                  </svg>
                </div>
                
                <h1 className="display-4 fw-bold text-dark mb-4">
                  Dashboard do Administrador
                </h1>
                
                <p className="lead text-muted mb-5">
                  Área restrita para administradores do condomínio.
                </p>
              </div>

              {userInfo && (
                <Row className="mb-5">
                  <Col>
                    <Card className="shadow">
                      <Card.Header className="bg-primary text-white">
                        <h5 className="mb-0">📋 Suas Informações</h5>
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
                              <div className="mt-1">{getTipoBadge(userInfo.subtipo)}</div>
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
                          <path d="M16,4C18.11,4 19.8,5.69 19.8,7.8C19.8,9.91 18.11,11.6 16,11.6C13.89,11.6 12.2,9.91 12.2,7.8C12.2,5.69 13.89,4 16,4M16,13.4C20.67,13.4 24.4,15.27 24.4,17.6V20H7.6V17.6C7.6,15.27 11.33,13.4 16,13.4M8.8,13.4H6C3.79,13.4 2,15.19 2,17.4V20H7.6V17.6C7.6,16.5 8.09,15.45 8.8,14.58V13.4Z"/>
                        </svg>
                      </div>
                      <h5 className="card-title">Moradores</h5>
                      <p className="card-text text-muted">
                        Gerenciar informações dos moradores
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
                          <path d="M20,2H4A2,2 0 0,0 2,4V22L6,18H20A2,2 0 0,0 22,16V4C22,2.89 21.1,2 20,2Z"/>
                        </svg>
                      </div>
                      <h5 className="card-title">Comunicados</h5>
                      <p className="card-text text-muted">
                        Enviar avisos e comunicados
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
                      <h5 className="card-title">Reservas</h5>
                      <p className="card-text text-muted">
                        Controlar reservas de áreas comuns
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
                      <h5 className="card-title">Manutenções</h5>
                      <p className="card-text text-muted">
                        Controlar ordens de serviço
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
                          <path d="M7,2V13H10V22L17,10H13L17,2H7Z"/>
                        </svg>
                      </div>
                      <h5 className="card-title">Financeiro</h5>
                      <p className="card-text text-muted">
                        Controle financeiro e boletos
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
                          <path d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z"/>
                        </svg>
                      </div>
                      <h5 className="card-title">Relatórios</h5>
                      <p className="card-text text-muted">
                        Relatórios e estatísticas
                      </p>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              <Alert variant="info" className="mt-4">
                <Alert.Heading>🔒 Área Restrita de Administrador</Alert.Heading>
                <p className="mb-0">
                  Você está logado como administrador do condomínio. Suas funcionalidades estão sendo desenvolvidas para oferecer o melhor controle administrativo.
                </p>
              </Alert>
            </Col>
          </Row>
        </Container>
      </Container>
    </>
  )
}