'use client'

import { useState, useEffect, useCallback } from 'react'
import { Container, Row, Col, Card, Form, Alert, Button, Modal } from 'react-bootstrap'

interface Condominium {
  _id: string
  nome: string
}

interface MasterUser {
  _id: string
  nome: string
  email: string
  celular1: string
  celular2: string
  data_criacao: string
}

export default function SettingsPage() {
  const [condominiums, setCondominiums] = useState<Condominium[]>([])
  const [masterUser, setMasterUser] = useState<MasterUser | null>(null)
  const [showMasterModal, setShowMasterModal] = useState(false)
  const [editingMaster, setEditingMaster] = useState<MasterUser | null>(null)
  const [alert, setAlert] = useState<{type: string, message: string} | null>(null)
  const [currentUser, setCurrentUser] = useState<{id: string, tipo: string, email: string} | null>(null)
  const [selectedCondominiumId, setSelectedCondominiumId] = useState<string>('')
  const [useTicketingSystem, setUseTicketingSystem] = useState<boolean>(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light') // 'light' ou 'dark'
  const [isClient, setIsClient] = useState(false)
  
  const getLocalStorage = (key: string) => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(key)
    }
    return null
  }

  const setLocalStorage = (key: string, value: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, value)
    }
  }

  const showAlert = (type: string, message: string) => {
    setAlert({ type, message })
    setTimeout(() => setAlert(null), 5000)
  }

  const loadCondominiumSetting = useCallback(async (condominioId: string, masterId: string) => {
    try {
      const response = await fetch(`/api/condominium-settings?condominio_id=${encodeURIComponent(condominioId)}&master_id=${encodeURIComponent(masterId)}`)
      const data = await response.json()
      if (data.success && data.setting) {
        setUseTicketingSystem(data.setting.use_ticketing_system)
      } else {
        setUseTicketingSystem(false) // Default to false if no setting found
      }
    } catch (error) {
      console.error('Error loading condominium setting:', error)
      setUseTicketingSystem(false)
    }
  }, [])

  useEffect(() => {
    setIsClient(true)
    
    const userData = getLocalStorage('userData')
    if (userData) {
      const user = JSON.parse(userData)
      setCurrentUser(user)
      loadCondominiums(user.id)
      loadMasterData(user.id)
      
      if (user.tipo === 'master') {
        const activeCondominiumId = getLocalStorage('activeCondominio')
        if (activeCondominiumId) {
          setSelectedCondominiumId(activeCondominiumId)
          if (user.id) {
            loadCondominiumSetting(activeCondominiumId, user.id)
          }
        }
      }
    }

    // Carregar tema do localStorage
    const savedTheme = getLocalStorage('theme')
    if (savedTheme === 'dark') {
      setTheme('dark')
    } else {
      setTheme('light')
    }
  }, [loadCondominiumSetting])

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    console.log('🎨 Settings: Mudando tema para:', newTheme)
    setTheme(newTheme)
    setLocalStorage('theme', newTheme)
    console.log('🎨 Settings: Tema salvo no localStorage:', getLocalStorage('theme'))
    // Disparar evento para notificar o layout sobre a mudança de tema
    window.dispatchEvent(new CustomEvent('themeChange', { detail: newTheme }))
    console.log('🎨 Settings: Evento themeChange disparado com:', newTheme)
  }

  const loadCondominiums = async (masterId: string) => {
    try {
      const response = await fetch(`/api/condominios?master_id=${encodeURIComponent(masterId)}`)
      const data = await response.json()
      if (data.success) {
        setCondominiums(data.condominios)
      }
    } catch (_error) {
      console.error('Erro ao carregar condomínios:', _error)
    }
  }

  const loadMasterData = async (masterId: string) => {
    try {
      const response = await fetch(`/api/masters/${encodeURIComponent(masterId)}`)
      const data = await response.json()
      if (data.success) {
        setMasterUser(data.masters)
      }
    } catch (error) {
      console.error('Erro ao carregar dados do master:', error)
    }
  }

  const updateMasterData = async (updatedMaster: MasterUser) => {
    try {
      const response = await fetch(`/api/masters/${encodeURIComponent(updatedMaster._id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getLocalStorage('token')}`
        },
        body: JSON.stringify(updatedMaster)
      })
      const data = await response.json()
      if (data.success) {
        setMasterUser(data.masters)
        setShowMasterModal(false)
        showAlert('success', 'Dados do master atualizados com sucesso!')
      } else {
        showAlert('danger', data.error || 'Erro ao atualizar dados do master.')
      }
    } catch (error) {
      console.error('Erro ao atualizar dados do master:', error)
      showAlert('danger', 'Erro ao comunicar com o servidor.')
    }
  }

  const handleEditMaster = () => {
    if (masterUser) {
      setEditingMaster({ ...masterUser })
      setShowMasterModal(true)
    }
  }

  const handleSaveMaster = () => {
    if (editingMaster) {
      updateMasterData(editingMaster)
    }
  }

  const handleCondominiumChange = (condominioId: string) => {
    setSelectedCondominiumId(condominioId)
    if (typeof window !== 'undefined') {
      const selectedCondo = condominiums.find(c => c._id === condominioId);
      if (condominioId) {
        localStorage.setItem('activeCondominio', condominioId)
        if (selectedCondo) {
          localStorage.setItem('activeCondominioName', selectedCondo.nome);
        }
        showAlert('success', `Condomínio "${selectedCondo?.nome}" definido como ativo!`)
        if (currentUser?.id) {
          loadCondominiumSetting(condominioId, currentUser.id)
        }
      } else {
        localStorage.removeItem('activeCondominio')
        localStorage.removeItem('activeCondominioName');
        showAlert('info', 'Nenhum condomínio ativo selecionado.')
        setUseTicketingSystem(false) // Reset toggle if no condominium is selected
      }
      // Disparar evento para notificar outras partes da aplicação
      window.dispatchEvent(new Event('condominioChanged'));
    }
  }

  const handleTicketingSystemChange = async (checked: boolean) => {
    if (!selectedCondominiumId || !currentUser?.id) {
      showAlert('danger', 'Selecione um condomínio e faça login como master para alterar esta configuração.')
      return
    }

    try {
      const response = await fetch('/api/condominium-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getLocalStorage('token')}` // Adiciona o token de autenticação
        },
        body: JSON.stringify({
          condominio_id: selectedCondominiumId,
          use_ticketing_system: checked,
          master_id: currentUser?.id, // Adiciona o master_id ao corpo da requisição
        }),
      })
      const data = await response.json()
      if (data.success) {
        setUseTicketingSystem(checked)
        showAlert('success', `Sistema de tickets ${checked ? 'ativado' : 'desativado'} com sucesso!`)
        
        // Disparar evento para notificar o Header sobre a mudança
        window.dispatchEvent(new CustomEvent('condominioChanged'))
      } else {
        showAlert('danger', data.error || 'Erro ao atualizar configuração do sistema de tickets.')
      }
    } catch (error) {
      console.error('Error updating ticketing system setting:', error)
      showAlert('danger', 'Erro ao comunicar com o servidor para atualizar a configuração.')
    }
  }

  return (
    <>
      <Container fluid className="py-4">
        {alert && (
          <Alert variant={alert.type} dismissible onClose={() => setAlert(null)}>
            {alert.message}
          </Alert>
        )}

        <Row className="mb-4">
          <Col>
            <Card>
              <Card.Header>
                <h4 className="mb-0">Configurações</h4>
              </Card.Header>
              <Card.Body>
                <Row className="mb-3">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Selecione o Condomínio Ativo *</Form.Label>
                      <Form.Select
                        value={selectedCondominiumId}
                        onChange={(e) => handleCondominiumChange(e.target.value)}
                        required
                      >
                        <option value="">Selecione um condomínio</option>
                        {condominiums.map((cond) => (
                          <option key={cond._id} value={cond._id}>
                            {cond.nome}
                          </option>
                        ))}
                      </Form.Select>
                      <Form.Text className="text-muted">
                        O condomínio selecionado aqui será o padrão para as outras telas do sistema.
                      </Form.Text>
                    </Form.Group>
                  </Col>
                  <Col md={6} className="d-flex align-items-end">
                    <div className="w-100">
                      {isClient && getLocalStorage('activeCondominio') && (
                        <div className="mt-1">
                          <small className="text-success">
                            🏢 <strong>Condomínio Ativo:</strong> {getLocalStorage('activeCondominioName') || 'Carregando...'}
                          </small>
                        </div>
                      )}
                    </div>
                  </Col>
                </Row>
                {!selectedCondominiumId && (
                  <Alert variant="info" className="text-center">
                    <h5>👆 Selecione um condomínio acima</h5>
                    <p className="mb-0">Escolha um condomínio para definir como ativo no sistema.</p>
                  </Alert>
                )}

                {selectedCondominiumId && currentUser?.tipo === 'master' && (
                  <Row className="mt-4">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Sistema de Tickets</Form.Label>
                        <Form.Check 
                          type="switch"
                          id="ticketing-system-switch"
                          label={useTicketingSystem ? "Ativado" : "Desativado"}
                          checked={useTicketingSystem}
                          onChange={(e) => handleTicketingSystemChange(e.target.checked)}
                        />
                        <Form.Text className="text-muted">
                          Ativa ou desativa o sistema de tickets para o condomínio selecionado.
                        </Form.Text>
                      </Form.Group>
                    </Col>
                  </Row>
                )}

                <Row className="mt-4">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Tema da Interface</Form.Label>
                      <Form.Check 
                        type="switch"
                        id="theme-switch"
                        label={theme === 'dark' ? "Dark (Escuro)" : "Padrão (Claro)"}
                        checked={theme === 'dark'}
                        onChange={(e) => handleThemeChange(e.target.checked ? 'dark' : 'light')}
                      />
                      <Form.Text className="text-muted">
                        Altera o tema visual da aplicação para claro ou escuro.
                      </Form.Text>
                    </Form.Group>
                  </Col>
                </Row>

                {masterUser && (
                  <Row className="mt-4">
                    <Col>
                      <Card>
                        <Card.Header className="d-flex justify-content-between align-items-center">
                          <h5 className="mb-0">Dados do Master</h5>
                          <Button variant="outline-primary" size="sm" onClick={handleEditMaster}>
                            Editar
                          </Button>
                        </Card.Header>
                        <Card.Body>
                          <Row>
                            <Col md={6}>
                              <p><strong>Nome:</strong> {masterUser.nome}</p>
                              <p><strong>Email:</strong> {masterUser.email}</p>
                            </Col>
                            <Col md={6}>
                              <p><strong>Celular 1:</strong> {masterUser.celular1}</p>
                              <p><strong>Celular 2:</strong> {masterUser.celular2}</p>
                              <p><strong>Data de Criação:</strong> {new Date(masterUser.data_criacao).toLocaleDateString('pt-BR')}</p>
                            </Col>
                          </Row>
                        </Card.Body>
                      </Card>
                    </Col>
                  </Row>
                )}

              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>

      {/* Modal de Edição do Master */}
      <Modal show={showMasterModal} onHide={() => setShowMasterModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Editar Dados do Master</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {editingMaster && (
            <Form>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Nome</Form.Label>
                    <Form.Control
                      type="text"
                      value={editingMaster.nome}
                      onChange={(e) => setEditingMaster({...editingMaster, nome: e.target.value})}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Email</Form.Label>
                    <Form.Control
                      type="email"
                      value={editingMaster.email}
                      onChange={(e) => setEditingMaster({...editingMaster, email: e.target.value})}
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Celular 1</Form.Label>
                    <Form.Control
                      type="text"
                      value={editingMaster.celular1}
                      onChange={(e) => setEditingMaster({...editingMaster, celular1: e.target.value})}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Celular 2</Form.Label>
                    <Form.Control
                      type="text"
                      value={editingMaster.celular2}
                      onChange={(e) => setEditingMaster({...editingMaster, celular2: e.target.value})}
                    />
                  </Form.Group>
                </Col>
              </Row>
            </Form>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowMasterModal(false)}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSaveMaster}>
            Salvar Alterações
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  )
}
