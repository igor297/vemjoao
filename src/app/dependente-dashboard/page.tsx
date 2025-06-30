'use client'

import { useState, useEffect } from 'react'
import { Container, Row, Col, Card, Alert, Badge, Button, Modal, Form } from 'react-bootstrap'
import VeiculoManager from '@/components/moradores/VeiculoManager'
import AnimalManager from '@/components/moradores/AnimalManager'

interface DependenteInfo {
  id: string;
  nome: string;
  email: string;
  tipo: 'dependente';
  unidade: string;
  apartamento: string;
  bloco?: string;
  condominio_id: string;
  condominio_nome: string;
  master_id: string;
  morador_responsavel?: string;
  ativo: boolean;
  observacoes?: string;
  idade?: number;
  parentesco?: string;
}

export default function DependenteDashboardPage() {
  const [userInfo, setUserInfo] = useState<DependenteInfo | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  
  const [showVeiculoManager, setShowVeiculoManager] = useState(false)
  const [showAnimalManager, setShowAnimalManager] = useState(false)

  const [editData, setEditData] = useState({
    email: '',
    observacoes: ''
  })

  useEffect(() => {
    const userData = localStorage.getItem('userData')
    if (userData) {
      try {
        const user = JSON.parse(userData)
        if (user.tipo !== 'dependente') {
          window.location.href = '/login'
          return
        }
        setUserInfo(user)
        setEditData({
          email: user.email || '',
          observacoes: user.observacoes || ''
        })
      } catch (error) {
        console.error('Error parsing user data:', error)
        window.location.href = '/login'
      }
    } else {
      window.location.href = '/login'
    }
  }, [])

  const handleSuccess = (message: string) => {
    setSuccess(message)
    setTimeout(() => setSuccess(''), 3000)
  }

  const handleError = (message: string) => {
    setError(message)
    setTimeout(() => setError(''), 3000)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setEditData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSave = async () => {
    if (!userInfo?.id) return
    
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/dependentes', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          _id: userInfo.id,
          email: editData.email,
          observacoes: editData.observacoes
        })
      })

      const data = await response.json()

      if (data.success) {
        const updatedUser = { ...userInfo, ...editData }
        setUserInfo(updatedUser)
        localStorage.setItem('userData', JSON.stringify(updatedUser))
        setSuccess('Dados atualizados com sucesso!')
        setShowEditModal(false)
      } else {
        setError(data.error || 'Erro ao atualizar dados')
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      setError('Erro ao atualizar dados')
    } finally {
      setLoading(false)
    }
  }

  

  const getIdadeBadge = (idade?: number) => {
    if (!idade) return null
    
    let color = 'primary'
    let label = 'Adulto'
    
    if (idade < 12) {
      color = 'success'
      label = 'Criança'
    } else if (idade < 18) {
      color = 'warning'
      label = 'Adolescente'
    } else if (idade >= 60) {
      color = 'info'
      label = 'Idoso'
    }
    
    return <Badge bg={color} className="fs-6">{label} ({idade} anos)</Badge>
  }

  if (!userInfo) {
    return (
      <Container className="mt-5">
        <div className="text-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Carregando...</span>
          </div>
        </div>
      </Container>
    )
  }

  return (
    <Container fluid className="py-4">
      <Row className="mb-4">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h2 className="mb-0">👶 Dashboard do Dependente</h2>
              <p className="text-muted mb-0">Bem-vindo(a), {userInfo.nome}</p>
            </div>
            
          </div>
        </Col>
      </Row>

      {success && (
        <Alert variant="success" dismissible onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Row>
        <Col lg={8}>
          <Card className="mb-4">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <h5 className="mb-0">👤 Meus Dados</h5>
              <Button 
                variant="outline-primary" 
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
                    <strong>Tipo:</strong>
                    <div className="mt-1">
                      <Badge bg="secondary" className="fs-6">👶 Dependente</Badge>
                    </div>
                  </div>
                  {userInfo.idade && (
                    <div className="mb-3">
                      <strong>Faixa Etária:</strong>
                      <div className="mt-1">{getIdadeBadge(userInfo.idade)}</div>
                    </div>
                  )}
                </Col>
                <Col md={6}>
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
                  {userInfo.morador_responsavel && (
                    <div className="mb-3">
                      <strong>Responsável:</strong>
                      <div className="text-muted">{userInfo.morador_responsavel}</div>
                    </div>
                  )}
                  {userInfo.parentesco && (
                    <div className="mb-3">
                      <strong>Parentesco:</strong>
                      <div className="text-muted">{userInfo.parentesco}</div>
                    </div>
                  )}
                </Col>
              </Row>
              {userInfo.observacoes && (
                <Row className="mt-3">
                  <Col>
                    <div className="border-top pt-3">
                      <strong>Observações:</strong>
                      <div className="text-muted mt-1">{userInfo.observacoes}</div>
                    </div>
                  </Col>
                </Row>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col lg={4}>
          <Card className="mb-4">
            <Card.Header>
              <h5 className="mb-0">🛠️ Gerenciar</h5>
            </Card.Header>
            <Card.Body>
              <div className="d-grid gap-2">
                <Button 
                  variant="outline-primary"
                  onClick={() => setShowVeiculoManager(true)}
                >
                  🚗 Meus Veículos
                </Button>
                <Button 
                  variant="outline-success"
                  onClick={() => setShowAnimalManager(true)}
                >
                  🐕 Meus Animais
                </Button>
                <hr />
                <Button 
                  variant="outline-info"
                  href="/dependente-dashboard/financas"
                >
                  💰 Finanças da Família
                </Button>
              </div>
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>
              <h5 className="mb-0">ℹ️ Informações</h5>
            </Card.Header>
            <Card.Body>
              <small className="text-muted">
                Como dependente, você tem acesso a:
                <ul className="mt-2">
                  <li>Gerenciamento de veículos</li>
                  <li>Gerenciamento de animais</li>
                  <li>Visualização das finanças familiares</li>
                  <li>Atualização dos seus dados pessoais</li>
                </ul>
                {userInfo.idade && userInfo.idade < 18 && (
                  <div className="mt-2 p-2 bg-warning bg-opacity-10 rounded">
                    <strong>⚠️ Menor de idade:</strong> Algumas funcionalidades podem ter restrições.
                  </div>
                )}
              </small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Modal de Edição */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Editar Meus Dados</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Email *</Form.Label>
              <Form.Control
                type="email"
                name="email"
                value={editData.email}
                onChange={handleInputChange}
                required
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
              <Form.Text className="text-muted">
                Máximo 500 caracteres
              </Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEditModal(false)}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modais de Gerenciamento */}
      {userInfo && (
        <>
          <VeiculoManager
            show={showVeiculoManager}
            onHide={() => setShowVeiculoManager(false)}
            morador={userInfo}
            onSuccess={handleSuccess}
            onError={handleError}
          />

          <AnimalManager
            show={showAnimalManager}
            onHide={() => setShowAnimalManager(false)}
            morador={userInfo}
            onSuccess={handleSuccess}
            onError={handleError}
          />
        </>
      )}
    </Container>
  )
}