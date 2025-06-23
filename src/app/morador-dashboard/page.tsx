'use client'

import { useState, useEffect } from 'react'
import { Container, Row, Col, Card, Alert, Badge, Button, Modal, Form } from 'react-bootstrap'

export default function MoradorDashboardPage() {
  const [userInfo, setUserInfo] = useState<any>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  const [editData, setEditData] = useState({
    celular1: '',
    celular2: '',
    email: '',
    observacoes: ''
  })

  useEffect(() => {
    const userData = localStorage.getItem('userData')
    if (userData) {
      try {
        const user = JSON.parse(userData)
        setUserInfo(user)
        setEditData({
          celular1: user.celular1 || '',
          celular2: user.celular2 || '',
          email: user.email || '',
          observacoes: user.observacoes || ''
        })
      } catch (error) {
        console.error('Error parsing user data:', error)
      }
    }
  }, [])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR')
  }

  const getTipoBadge = (tipo: string) => {
    const colors = {
      proprietario: 'primary',
      inquilino: 'warning', 
      dependente: 'secondary'
    }
    const labels = {
      proprietario: 'Proprietário',
      inquilino: 'Inquilino',
      dependente: 'Dependente'
    }
    return <Badge bg={colors[tipo as keyof typeof colors]} className="fs-6">
      {labels[tipo as keyof typeof labels]}
    </Badge>
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    
    // Aplicar máscaras
    if (name === 'celular1' || name === 'celular2') {
      let phone = value.replace(/\D/g, '')
      if (phone.length <= 11) {
        if (phone.length === 11) {
          phone = phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
        } else if (phone.length === 10) {
          phone = phone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
        }
        setEditData(prev => ({ ...prev, [name]: phone }))
      }
      return
    }
    
    setEditData(prev => ({ ...prev, [name]: value }))
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/moradores/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          morador_id: userInfo.id,
          ...editData
        })
      })

      const data = await response.json()

      if (data.success) {
        setSuccess('Perfil atualizado com sucesso!')
        setShowEditModal(false)
        
        // Atualizar dados locais
        const updatedUser = { ...userInfo, ...editData }
        setUserInfo(updatedUser)
        localStorage.setItem('userData', JSON.stringify(updatedUser))
      } else {
        setError(data.error)
      }
    } catch (error) {
      setError('Erro ao atualizar perfil')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Container fluid className="py-5 bg-light min-vh-100">
        <Container>
          <Row className="justify-content-center">
            <Col lg={10}>
              <div className="text-center mb-5">
                <div className="bg-info rounded-circle d-inline-flex align-items-center justify-content-center mb-4"
                     style={{ width: '96px', height: '96px' }}>
                  <svg className="text-white" width="48" height="48" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>
                  </svg>
                </div>
                
                <h1 className="display-4 fw-bold text-dark mb-4">
                  Meu Perfil
                </h1>
                
                <p className="lead text-muted mb-5">
                  Área pessoal do morador - Visualize e edite suas informações
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

              {userInfo && (
                <>
                  {/* Informações Pessoais */}
                  <Row className="mb-4">
                    <Col>
                      <Card className="shadow">
                        <Card.Header className="bg-info text-white d-flex justify-content-between align-items-center">
                          <h5 className="mb-0">👤 Suas Informações Pessoais</h5>
                          <Button 
                            variant="light" 
                            size="sm"
                            onClick={() => setShowEditModal(true)}
                          >
                            ✏️ Editar
                          </Button>
                        </Card.Header>
                        <Card.Body>
                          <Row>
                            <Col md={6}>
                              <div className="mb-3">
                                <strong>Nome Completo:</strong>
                                <div className="text-muted">{userInfo.nome}</div>
                              </div>
                              <div className="mb-3">
                                <strong>Email:</strong>
                                <div className="text-muted">{userInfo.email}</div>
                              </div>
                              <div className="mb-3">
                                <strong>Celular Principal:</strong>
                                <div className="text-muted">{editData.celular1}</div>
                              </div>
                              {editData.celular2 && (
                                <div className="mb-3">
                                  <strong>Celular Secundário:</strong>
                                  <div className="text-muted">{editData.celular2}</div>
                                </div>
                              )}
                            </Col>
                            <Col md={6}>
                              <div className="mb-3">
                                <strong>Tipo de Morador:</strong>
                                <div className="mt-1">{getTipoBadge(userInfo.subtipo)}</div>
                              </div>
                              <div className="mb-3">
                                <strong>Unidade:</strong>
                                <div className="text-muted">
                                  {userInfo.bloco ? `${userInfo.bloco} - ` : ''}{userInfo.unidade}
                                </div>
                              </div>
                              <div className="mb-3">
                                <strong>Condomínio:</strong>
                                <div className="text-muted">{userInfo.condominio_nome}</div>
                              </div>
                              {userInfo.responsavel_nome && (
                                <div className="mb-3">
                                  <strong>Responsável:</strong>
                                  <div className="text-muted">{userInfo.responsavel_nome}</div>
                                </div>
                              )}
                              {userInfo.subtipo === 'inquilino' && userInfo.proprietario_nome && (
                                <div className="mb-3">
                                  <strong>Proprietário:</strong>
                                  <div className="text-muted">{userInfo.proprietario_nome}</div>
                                </div>
                              )}
                            </Col>
                          </Row>
                          {editData.observacoes && (
                            <Row>
                              <Col>
                                <div className="mb-0">
                                  <strong>Observações:</strong>
                                  <div className="text-muted">{editData.observacoes}</div>
                                </div>
                              </Col>
                            </Row>
                          )}
                        </Card.Body>
                      </Card>
                    </Col>
                  </Row>

                  {/* Cards de funcionalidades */}
                  <Row>
                    <Col md={6} lg={4} className="mb-4">
                      <Card className="shadow-sm h-100">
                        <Card.Body className="text-center">
                          <div className="bg-primary rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
                               style={{ width: '64px', height: '64px' }}>
                            <svg className="text-white" width="32" height="32" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M20,2H4A2,2 0 0,0 2,4V22L6,18H20A2,2 0 0,0 22,16V4C22,2.89 21.1,2 20,2Z"/>
                            </svg>
                          </div>
                          <h5 className="card-title">Comunicados</h5>
                          <p className="card-text text-muted">
                            Avisos e informações do condomínio
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
                            Reservar áreas comuns do condomínio
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
                              <path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z"/>
                            </svg>
                          </div>
                          <h5 className="card-title">Solicitações</h5>
                          <p className="card-text text-muted">
                            Solicitar manutenções e serviços
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
                            Ver boletos e taxas pendentes
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
                          <h5 className="card-title">Contato</h5>
                          <p className="card-text text-muted">
                            Falar com a administração
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
                          <h5 className="card-title">Documentos</h5>
                          <p className="card-text text-muted">
                            Acessar documentos pessoais
                          </p>
                        </Card.Body>
                      </Card>
                    </Col>
                  </Row>
                </>
              )}

              <Alert variant="info" className="mt-4">
                <Alert.Heading>🏠 Área do Morador</Alert.Heading>
                <p className="mb-0">
                  Bem-vindo ao seu painel pessoal! Aqui você pode acessar informações específicas da sua unidade e do condomínio.
                </p>
              </Alert>
            </Col>
          </Row>
        </Container>
      </Container>

      {/* Modal de Edição */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Editar Perfil</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleUpdateProfile}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Celular Principal *</Form.Label>
              <Form.Control
                type="text"
                name="celular1"
                value={editData.celular1}
                onChange={handleInputChange}
                required
                placeholder="(85) 99999-9999"
                maxLength={15}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Celular Secundário</Form.Label>
              <Form.Control
                type="text"
                name="celular2"
                value={editData.celular2}
                onChange={handleInputChange}
                placeholder="(85) 99999-9999"
                maxLength={15}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Email *</Form.Label>
              <Form.Control
                type="email"
                name="email"
                value={editData.email}
                onChange={handleInputChange}
                required
                placeholder="seu@email.com"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Observações</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                name="observacoes"
                value={editData.observacoes}
                onChange={handleInputChange}
                placeholder="Informações adicionais..."
                maxLength={500}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  )
}