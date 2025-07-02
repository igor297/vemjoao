'use client'

import { useState, useEffect } from 'react'
import { Container, Row, Col, Card, Alert, Badge, Button, Modal, Form } from 'react-bootstrap'
import ConjugeManager from '@/components/moradores/ConjugeManager'
import DependenteManager from '@/components/moradores/DependenteManager'
import VeiculoManager from '@/components/moradores/VeiculoManager'
import AnimalManager from '@/components/moradores/AnimalManager'

export default function MoradorDashboardPage() {
  const [userInfo, setUserInfo] = useState<any>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showConjugeModal, setShowConjugeModal] = useState(false)
  const [showDependenteModal, setShowDependenteModal] = useState(false)
  const [showVeiculoModal, setShowVeiculoModal] = useState(false)
  const [showAnimalModal, setShowAnimalModal] = useState(false)
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
        // Garantir que _id esteja presente para compatibilidade com os Managers
        user._id = user.id; 
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

                  {/* Gerenciamento de Familia e Pertences */}
                  <Row className="mb-4">
                    <Col>
                      <Card className="shadow">
                        <Card.Header className="bg-secondary text-white">
                          <h5 className="mb-0">&#128106;&#127998; Gerenciar Família e Pertences</h5>
                        </Card.Header>
                        <Card.Body>
                          <p className="text-muted">
                            Adicione ou gerencie seus dependentes, cônjuge, veículos e animais de estimação.
                          </p>
                          <div className="d-grid gap-3 d-md-flex">
                            <Button 
                              variant="outline-primary" 
                              onClick={() => setShowConjugeModal(true)}
                            >
                              &#128141; Gerenciar Cônjuge
                            </Button>
                            <Button 
                              variant="outline-success" 
                              onClick={() => setShowDependenteModal(true)}
                            >
                              &#128106;&#127998; Gerenciar Dependentes
                            </Button>
                            <Button 
                              variant="outline-warning" 
                              onClick={() => setShowVeiculoModal(true)}
                            >
                              &#128663; Gerenciar Veículos
                            </Button>
                            <Button 
                              variant="outline-info" 
                              onClick={() => setShowAnimalModal(true)}
                            >
                              &#128062; Gerenciar Animais
                            </Button>
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                  </Row>
                </>
              )}

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

      {userInfo && (
        <ConjugeManager
          show={showConjugeModal}
          onHide={() => setShowConjugeModal(false)}
          morador={userInfo}
          onSuccess={setSuccess}
          onError={setError}
        />
      )}

      {userInfo && (
        <DependenteManager
          show={showDependenteModal}
          onHide={() => setShowDependenteModal(false)}
          morador={userInfo}
          onSuccess={setSuccess}
          onError={setError}
        />
      )}

      {userInfo && (
        <VeiculoManager
          show={showVeiculoModal}
          onHide={() => setShowVeiculoModal(false)}
          morador={userInfo}
          onSuccess={setSuccess}
          onError={setError}
        />
      )}

      {userInfo && (
        <AnimalManager
          show={showAnimalModal}
          onHide={() => setShowAnimalModal(false)}
          morador={userInfo}
          onSuccess={setSuccess}
          onError={setError}
        />
      )}
    </>
  )
}