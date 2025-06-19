'use client'

import { useState, useEffect } from 'react'
import { Container, Row, Col, Card, Button, Modal, Form, Alert, Badge, Nav } from 'react-bootstrap'
import Header from '@/components/Header'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'

interface Evento {
  _id: string
  nome: string
  descricao: string
  tipo: 'retirada_entrega' | 'visita' | 'reserva' | 'reuniao' | 'avisos' | 'outros'
  data_inicio: string
  hora_inicio: string
  data_fim: string
  hora_fim: string
  condominio_evento?: string
  observacoes?: string
  criado_por_tipo: string
  criado_por_id: string
  criado_por_nome: string
  condominio_id: string
  master_id: string
  ativo: boolean
}

interface Condominium {
  _id: string
  nome: string
}

export default function EventosPage() {
  const [eventos, setEventos] = useState<Evento[]>([])
  const [condominiums, setCondominiums] = useState<Condominium[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingEvento, setEditingEvento] = useState<Evento | null>(null)
  const [loading, setLoading] = useState(false)
  const [alert, setAlert] = useState<{type: string, message: string} | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [selectedCondominiumId, setSelectedCondominiumId] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'calendario' | 'lista'>('calendario')

  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    tipo: 'retirada_entrega' as Evento['tipo'],
    data_inicio: '',
    hora_inicio: '',
    data_fim: '',
    hora_fim: '',
    condominio_evento: '',
    observacoes: ''
  })

  // Função auxiliar para acessar localStorage com segurança
  const getLocalStorage = (key: string) => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(key)
    }
    return null
  }

  useEffect(() => {
    const userData = getLocalStorage('userData')
    if (userData) {
      const user = JSON.parse(userData)
      setCurrentUser(user)
      
      // Definir condomínio automaticamente baseado no tipo de usuário
      if (user.tipo === 'master') {
        loadCondominiums(user.id)
        const activeCondominiumId = getLocalStorage('activeCondominio')
        if (activeCondominiumId) {
          setSelectedCondominiumId(activeCondominiumId)
          loadEventos(user, activeCondominiumId)
        } else {
          loadEventos(user)
        }
      } else {
        // Para outros tipos de usuário, usar o condomínio do usuário
        if (user.condominio_id) {
          setSelectedCondominiumId(user.condominio_id)
          loadEventos(user, user.condominio_id)
          // Carregar dados do condomínio para exibir o nome
          loadCondominiums(user.master_id || user.id)
        }
      }
    }

    // Escutar mudanças no condomínio ativo
    const handleCondominioChange = () => {
      const userData = getLocalStorage('userData')
      if (userData) {
        const user = JSON.parse(userData)
        if (user.tipo === 'master') {
          const activeCondominiumId = getLocalStorage('activeCondominio')
          if (activeCondominiumId) {
            console.log('🔄 [DEBUG] Condomínio ativo mudou para:', activeCondominiumId)
            setSelectedCondominiumId(activeCondominiumId)
            loadEventos(user, activeCondominiumId)
          }
        }
      }
    }

    // Adicionar listeners para mudanças no condomínio ativo
    window.addEventListener('storage', handleCondominioChange)
    window.addEventListener('condominioChanged', handleCondominioChange)

    // Cleanup
    return () => {
      window.removeEventListener('storage', handleCondominioChange)
      window.removeEventListener('condominioChanged', handleCondominioChange)
    }
  }, [])

  const loadCondominiums = async (masterId: string) => {
    try {
      const response = await fetch(`/api/condominios?master_id=${encodeURIComponent(masterId)}`)
      const data = await response.json()
      if (data.success) {
        setCondominiums(data.condominios)
      }
    } catch (error) {
      console.error('Erro ao carregar condomínios:', error)
    }
  }

  const loadEventos = async (user: any, condominioId?: string) => {
    try {
      const masterId = user.master_id || user.id
      let url = `/api/eventos?master_id=${encodeURIComponent(masterId)}&tipo_usuario=${user.tipo}&usuario_id=${user.id}`
      if (condominioId) {
        url += `&condominio_id=${encodeURIComponent(condominioId)}`
      }
      
      console.log('🔍 [DEBUG] Carregando eventos com URL:', url)
      const response = await fetch(url)
      const data = await response.json()
      console.log('📊 [DEBUG] Resposta da API eventos:', data)
      if (data.success) {
        console.log('✅ [DEBUG] Eventos carregados:', data.eventos.length)
        setEventos(data.eventos)
      } else {
        console.error('❌ [DEBUG] Erro ao carregar eventos:', data.error)
        showAlert('danger', data.error || 'Erro ao carregar eventos')
      }
    } catch (error) {
      showAlert('danger', 'Erro ao carregar eventos')
    }
  }

  const showAlert = (type: string, message: string) => {
    setAlert({ type, message })
    setTimeout(() => setAlert(null), 5000)
  }

  const handleCondominiumChange = (condominioId: string) => {
    setSelectedCondominiumId(condominioId)
    if (condominioId && currentUser) {
      loadEventos(currentUser, condominioId)
    } else if (currentUser) {
      loadEventos(currentUser)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // Validação adicional
    if (formData.descricao.trim().length < 5) {
      showAlert('danger', 'A descrição deve ter pelo menos 5 caracteres')
      setLoading(false)
      return
    }

    try {
      const url = editingEvento ? '/api/eventos' : '/api/eventos'
      const method = editingEvento ? 'PUT' : 'POST'
      
      const dataToSend = {
        ...formData,
        ...(editingEvento && { _id: editingEvento._id }),
        criado_por_tipo: currentUser?.tipo,
        criado_por_id: currentUser?.id,
        criado_por_nome: currentUser?.nome || currentUser?.email,
        condominio_id: selectedCondominiumId,
        master_id: currentUser?.master_id || currentUser?.id,
        ...(editingEvento && { 
          usuario_tipo: currentUser?.tipo,
          usuario_id: currentUser?.id 
        })
      }
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend)
      })

      const data = await response.json()
      
      if (data.success) {
        showAlert('success', editingEvento ? 'Evento atualizado!' : 'Evento criado!')
        handleCloseModal()
        loadEventos(currentUser, selectedCondominiumId)
      } else {
        showAlert('danger', data.error || 'Erro ao salvar evento')
      }
    } catch (error) {
      showAlert('danger', 'Erro ao salvar evento')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (evento: Evento) => {
    setEditingEvento(evento)
    setFormData({
      nome: evento.nome,
      descricao: evento.descricao,
      tipo: evento.tipo,
      data_inicio: evento.data_inicio?.split('T')[0] || '',
      hora_inicio: evento.hora_inicio,
      data_fim: evento.data_fim?.split('T')[0] || '',
      hora_fim: evento.hora_fim,
      condominio_evento: evento.condominio_evento || '',
      observacoes: evento.observacoes || ''
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este evento?')) return

    try {
      const response = await fetch(`/api/eventos?id=${id}&usuario_tipo=${currentUser?.tipo}&usuario_id=${currentUser?.id}`, {
        method: 'DELETE'
      })

      const data = await response.json()
      
      if (data.success) {
        showAlert('success', 'Evento excluído!')
        loadEventos(currentUser, selectedCondominiumId)
      } else {
        showAlert('danger', data.error || 'Erro ao excluir evento')
      }
    } catch (error) {
      showAlert('danger', 'Erro ao excluir evento')
    }
  }

  const handleNewEvento = () => {
    setFormData({
      nome: '',
      descricao: '',
      tipo: 'retirada_entrega',
      data_inicio: '',
      hora_inicio: '',
      data_fim: '',
      hora_fim: '',
      condominio_evento: '',
      observacoes: ''
    })
    setEditingEvento(null)
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingEvento(null)
  }

  const getCondominiumName = (condominioId: string) => {
    const cond = condominiums.find(c => c._id === condominioId)
    return cond?.nome || 'N/A'
  }

  const getCreatorDetails = () => {
    if (!currentUser) return { nome: 'N/A', detalhes: '' }
    
    let detalhes = ''
    const tipoFormatado = {
      'master': 'Master',
      'sindico': 'Síndico',
      'subsindico': 'Subsíndico', 
      'conselheiro': 'Conselheiro',
      'colaborador': 'Colaborador',
      'morador': 'Morador',
      'inquilino': 'Inquilino',
      'conjuge': 'Cônjuge',
      'dependente': 'Dependente'
    }[currentUser.tipo] || currentUser.tipo
    
    // Para usuários internos (síndico, subsíndico) e moradores/inquilinos, mostrar bloco/ap
    if (['sindico', 'subsindico', 'morador', 'inquilino', 'conjuge', 'dependente'].includes(currentUser.tipo)) {
      if (currentUser.bloco && currentUser.apartamento) {
        detalhes = `Bloco ${currentUser.bloco}, Ap ${currentUser.apartamento}`
      } else if (currentUser.apartamento) {
        detalhes = `Apartamento ${currentUser.apartamento}`
      }
      
      // Se for cônjuge ou dependente, mostrar o responsável
      if (currentUser.tipo === 'conjuge' && currentUser.morador_responsavel) {
        detalhes += ` (Cônjuge de ${currentUser.morador_responsavel})`
      } else if (currentUser.tipo === 'dependente' && currentUser.morador_responsavel) {
        detalhes += ` (Dependente de ${currentUser.morador_responsavel})`
      }
    }
    
    return {
      nome: currentUser.nome || currentUser.email || 'N/A',
      tipo: tipoFormatado,
      detalhes: detalhes
    }
  }

  const getTipoBadge = (tipo: string) => {
    const cores = {
      retirada_entrega: 'warning',
      visita: 'info',
      reserva: 'success',
      reuniao: 'primary',
      avisos: 'danger',
      outros: 'secondary'
    }
    
    const nomes = {
      retirada_entrega: 'Retirada/Entrega',
      visita: 'Visita',
      reserva: 'Reserva',
      reuniao: 'Reunião',
      avisos: 'Avisos',
      outros: 'Outros'
    }
    
    return <Badge bg={cores[tipo as keyof typeof cores]}>{nomes[tipo as keyof typeof nomes]}</Badge>
  }

  const handleDateClick = (arg: any) => {
    // Quando clica em uma data no calendário, abrir modal com a data preenchida
    setFormData(prev => ({
      ...prev,
      data_inicio: arg.dateStr,
      data_fim: arg.dateStr
    }))
    setEditingEvento(null)
    setShowModal(true)
  }

  const handleEventClick = (info: any) => {
    const evento = eventos.find(e => e._id === info.event.id)
    if (evento) {
      handleEdit(evento)
    }
  }

  // Converter eventos para formato do FullCalendar
  const calendarEvents = eventos.map(evento => {
    // Debug das datas
    console.log('🎯 [DEBUG] Evento original:', {
      nome: evento.nome,
      data_inicio: evento.data_inicio,
      hora_inicio: evento.hora_inicio,
      data_fim: evento.data_fim,
      hora_fim: evento.hora_fim
    })
    
    // Formatar datas corretamente
    const dataInicio = evento.data_inicio.includes('T') 
      ? evento.data_inicio.split('T')[0] 
      : evento.data_inicio
    const dataFim = evento.data_fim.includes('T') 
      ? evento.data_fim.split('T')[0] 
      : evento.data_fim
    
    const startDateTime = `${dataInicio}T${evento.hora_inicio}`
    const endDateTime = `${dataFim}T${evento.hora_fim}`
    
    console.log('📅 [DEBUG] Evento formatado para FullCalendar:', {
      id: evento._id,
      title: evento.nome,
      start: startDateTime,
      end: endDateTime
    })
    
    return {
      id: evento._id,
      title: evento.nome,
      start: startDateTime,
      end: endDateTime,
      backgroundColor: getEventColor(evento.tipo),
      borderColor: getEventColor(evento.tipo),
      extendedProps: {
        tipo: evento.tipo,
        descricao: evento.descricao,
        criado_por: evento.criado_por_nome
      }
    }
  })

  function getEventColor(tipo: string) {
    const cores = {
      retirada_entrega: '#ffc107',
      visita: '#17a2b8',
      reserva: '#28a745',
      reuniao: '#007bff',
      avisos: '#dc3545',
      outros: '#6c757d'
    }
    return cores[tipo as keyof typeof cores] || '#6c757d'
  }


  const canCreateEvent = () => {
    if (!currentUser) return false
    // Master e Síndico podem criar qualquer tipo
    if (['master', 'sindico'].includes(currentUser.tipo)) return true
    // Outros tipos dependem do tipo de evento
    return true // Simplificado - a validação real é feita no backend
  }

  return (
    <>
      <Header />
      <Container fluid className="py-4">
        {alert && (
          <Alert variant={alert.type} dismissible onClose={() => setAlert(null)}>
            {alert.message}
          </Alert>
        )}

        <Row className="mb-4">
          <Col>
            <Card>
              <Card.Header className="d-flex justify-content-between align-items-center">
                <h4 className="mb-0">📅 Eventos do Condomínio</h4>
                {canCreateEvent() && (
                  <Button variant="primary" onClick={handleNewEvento} disabled={!selectedCondominiumId}>
                    <i className="bi bi-plus-circle me-2"></i>
                    Novo Evento
                  </Button>
                )}
              </Card.Header>
              <Card.Body>
                {/* Filtro por condomínio - apenas para master */}
                <Row className="mb-3">
                  {currentUser?.tipo === 'master' ? (
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Selecione o Condomínio *</Form.Label>
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
                      </Form.Group>
                    </Col>
                  ) : (
                    <Col md={6}>
                      <div className="alert alert-info">
                        <strong>🏢 Condomínio:</strong> {getCondominiumName(selectedCondominiumId)}
                      </div>
                    </Col>
                  )}
                  <Col md={6} className="d-flex align-items-end">
                    <Nav variant="tabs" activeKey={activeTab} onSelect={(k) => setActiveTab(k as any)}>
                      <Nav.Item>
                        <Nav.Link eventKey="calendario">📅 Calendário</Nav.Link>
                      </Nav.Item>
                      <Nav.Item>
                        <Nav.Link eventKey="lista">📋 Lista</Nav.Link>
                      </Nav.Item>
                    </Nav>
                  </Col>
                </Row>

                {!selectedCondominiumId ? (
                  <Alert variant="info" className="text-center">
                    {currentUser?.tipo === 'master' ? (
                      <>
                        <h5>👆 Selecione um condomínio acima</h5>
                        <p className="mb-0">Escolha o condomínio para visualizar os eventos</p>
                      </>
                    ) : (
                      <>
                        <h5>⏳ Carregando eventos...</h5>
                        <p className="mb-0">Aguarde enquanto carregamos os eventos do seu condomínio</p>
                      </>
                    )}
                  </Alert>
                ) : (
                  <>
                    {activeTab === 'calendario' ? (
                      <div style={{ height: '600px' }}>
                        {console.log('🗓️ [DEBUG] Eventos sendo passados para FullCalendar:', calendarEvents)}
                        <FullCalendar
                          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                          initialView="dayGridMonth"
                          locale="pt-br"
                          events={calendarEvents}
                          dateClick={handleDateClick}
                          eventClick={handleEventClick}
                          headerToolbar={{
                            left: 'prev,next today',
                            center: 'title',
                            right: 'dayGridMonth,timeGridWeek,timeGridDay'
                          }}
                          buttonText={{
                            today: 'Hoje',
                            month: 'Mês',
                            week: 'Semana',
                            day: 'Dia'
                          }}
                          height="100%"
                          eventDisplay="block"
                          dayMaxEvents={3}
                          moreLinkText="mais"
                        />
                      </div>
                    ) : (
                      <div>
                        {eventos.length === 0 ? (
                          <Alert variant="secondary" className="text-center">
                            <h6>📋 Nenhum evento encontrado</h6>
                            <p className="mb-0">Clique em "Novo Evento" para criar o primeiro evento</p>
                          </Alert>
                        ) : (
                          <Row>
                            {eventos.map((evento) => (
                              <Col md={6} lg={4} key={evento._id} className="mb-3">
                                <Card className="h-100">
                                  <Card.Header className="d-flex justify-content-between align-items-center">
                                    {getTipoBadge(evento.tipo)}
                                    <small className="text-muted">
                                      {evento.criado_por_nome}
                                    </small>
                                  </Card.Header>
                                  <Card.Body>
                                    <Card.Title className="h6">{evento.nome}</Card.Title>
                                    <Card.Text className="small">
                                      {evento.descricao}
                                    </Card.Text>
                                    <div className="small text-muted">
                                      <div>📅 {new Date(evento.data_inicio).toLocaleDateString('pt-BR')} {evento.hora_inicio}</div>
                                      <div>🕐 até {new Date(evento.data_fim).toLocaleDateString('pt-BR')} {evento.hora_fim}</div>
                                      {evento.condominio_evento && (
                                        <div>📍 {evento.condominio_evento}</div>
                                      )}
                                    </div>
                                  </Card.Body>
                                  <Card.Footer className="d-flex justify-content-end">
                                    <div className="btn-group btn-group-sm">
                                      <Button
                                        variant="outline-primary"
                                        size="sm"
                                        onClick={() => handleEdit(evento)}
                                        title="Editar"
                                      >
                                        ✏️
                                      </Button>
                                      <Button
                                        variant="outline-danger"
                                        size="sm"
                                        onClick={() => handleDelete(evento._id)}
                                        title="Excluir"
                                      >
                                        🗑️
                                      </Button>
                                    </div>
                                  </Card.Footer>
                                </Card>
                              </Col>
                            ))}
                          </Row>
                        )}
                      </div>
                    )}
                  </>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Modal para criar/editar evento */}
        <Modal show={showModal} onHide={handleCloseModal} size="lg">
          <Modal.Header closeButton>
            <div>
              <Modal.Title>
                {editingEvento ? 'Editar Evento' : 'Novo Evento'}
              </Modal.Title>
              <div className="text-muted small mt-1">
                {(() => {
                  const creatorInfo = getCreatorDetails()
                  return (
                    <>
                      👤 <strong>Criador:</strong> {creatorInfo.nome} ({creatorInfo.tipo})
                      {creatorInfo.detalhes && (
                        <>
                          <br />
                          📍 <strong>Localização:</strong> {creatorInfo.detalhes}
                        </>
                      )}
                      {selectedCondominiumId && (
                        <>
                          <br />
                          🏢 <strong>Condomínio:</strong> {getCondominiumName(selectedCondominiumId)}
                        </>
                      )}
                    </>
                  )
                })()}
              </div>
            </div>
          </Modal.Header>
          <Form onSubmit={handleSubmit}>
            <Modal.Body>
              <Row>
                <Col md={8}>
                  <Form.Group className="mb-3">
                    <Form.Label>Nome do Evento *</Form.Label>
                    <Form.Control
                      type="text"
                      name="nome"
                      value={formData.nome}
                      onChange={handleInputChange}
                      required
                      placeholder="Digite o nome do evento"
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Tipo *</Form.Label>
                    <Form.Select
                      name="tipo"
                      value={formData.tipo}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="retirada_entrega">Retirada/Entrega</option>
                      <option value="visita">Visita</option>
                      <option value="reserva">Reserva</option>
                      <option value="reuniao">Reunião</option>
                      <option value="avisos">Avisos</option>
                      <option value="outros">Outros</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>

              <Form.Group className="mb-3">
                <Form.Label>Descrição *</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  name="descricao"
                  value={formData.descricao}
                  onChange={handleInputChange}
                  required
                  minLength={5}
                  placeholder="Descreva o evento (mínimo 5 caracteres)..."
                />
                <Form.Text className="text-muted">
                  {formData.descricao.length}/500 caracteres (mínimo 5)
                </Form.Text>
              </Form.Group>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Data Início *</Form.Label>
                    <Form.Control
                      type="date"
                      name="data_inicio"
                      value={formData.data_inicio}
                      onChange={handleInputChange}
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Hora Início *</Form.Label>
                    <Form.Control
                      type="time"
                      name="hora_inicio"
                      value={formData.hora_inicio}
                      onChange={handleInputChange}
                      required
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Data Fim *</Form.Label>
                    <Form.Control
                      type="date"
                      name="data_fim"
                      value={formData.data_fim}
                      onChange={handleInputChange}
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Hora Fim *</Form.Label>
                    <Form.Control
                      type="time"
                      name="hora_fim"
                      value={formData.hora_fim}
                      onChange={handleInputChange}
                      required
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Form.Group className="mb-3">
                <Form.Label>Local do Evento no Condomínio</Form.Label>
                <Form.Control
                  type="text"
                  name="condominio_evento"
                  value={formData.condominio_evento}
                  onChange={handleInputChange}
                  placeholder="Ex: Salão de Festas, Quadra, Área de Lazer, etc."
                />
                <Form.Text className="text-muted">
                  Especifique onde no condomínio será realizado o evento
                </Form.Text>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Observações</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  name="observacoes"
                  value={formData.observacoes}
                  onChange={handleInputChange}
                  placeholder="Informações adicionais sobre o evento..."
                  maxLength={1000}
                />
                <Form.Text className="text-muted">
                  Máximo 1000 caracteres
                </Form.Text>
              </Form.Group>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={handleCloseModal}>
                Cancelar
              </Button>
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? 'Salvando...' : (editingEvento ? 'Atualizar' : 'Criar')}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>
      </Container>
    </>
  )
}