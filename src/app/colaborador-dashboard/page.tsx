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


            </Col>
          </Row>
        </Container>
      </Container>
    </>
  )
}