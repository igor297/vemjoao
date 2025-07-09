'use client'

import { useState, useEffect } from 'react'
import { Container, Row, Col, Card, Button, Form, Modal, Table, Alert, Badge } from 'react-bootstrap'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Ticket {
  _id: string
  id_ticket?: string
  titulo: string
  descricao: string
  categoria: 'financeiro' | 'manutencao' | 'administrativo' | 'outros'
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente'
  status: 'aberto' | 'em_andamento' | 'aguardando_resposta' | 'resolvido' | 'fechado'
  solicitante_tipo: 'colaborador' | 'morador' | 'inquilino' | 'conjuge' | 'dependente'
  solicitante_id: string
  solicitante_nome: string
  solicitante_cpf?: string
  solicitante_apartamento?: string
  solicitante_bloco?: string
  condominio_id: string
  master_id: string
  data_abertura: string
  data_atualizacao: string
  mensagens: {
    id: string
    remetente_tipo: string
    remetente_id: string
    remetente_nome: string
    mensagem: string
    data: string
  }[]
}

interface UserData {
  id: string
  tipo: string
  email: string
  nome: string
  cpf: string
  condominio_id?: string
  master_id?: string
  bloco?: string
  unidade?: string
}

interface Condominium {
  _id: string
  nome: string
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    categoria: 'manutencao',
    prioridade: 'media',
  })
  const [loading, setLoading] = useState(false)
  const [alert, setAlert] = useState<{ type: string; message: string } | null>(null)
  const [currentUser, setCurrentUser] = useState<UserData | null>(null)
  const [condominiums, setCondominiums] = useState<Condominium[]>([])
  const [selectedCondominiumId, setSelectedCondominiumId] = useState<string>('')
  const router = useRouter()

  useEffect(() => {
    const userData = localStorage.getItem('userData')
    if (userData) {
      const user = JSON.parse(userData)
      setCurrentUser(user)
      
      // Se for master, carregar condomínios
      if (user.tipo === 'master') {
        fetchCondominiums(user.id)
        
        // Verificar condomínio ativo
        const activeCondominiumId = localStorage.getItem('activeCondominio')
        if (activeCondominiumId) {
          setSelectedCondominiumId(activeCondominiumId)
        }
      }
    } else {
      router.push('/login')
    }
  }, [router])

  useEffect(() => {
    if (currentUser) {
      fetchTickets()
    }
  }, [currentUser, selectedCondominiumId])

  // Listener para mudanças no condomínio ativo
  useEffect(() => {
    const handleStorageChange = () => {
      const userData = localStorage.getItem('userData')
      if (userData) {
        const user = JSON.parse(userData)
        if (user.tipo === 'master') {
          const activeCondominiumId = localStorage.getItem('activeCondominio')
          if (activeCondominiumId && activeCondominiumId !== selectedCondominiumId) {
            setSelectedCondominiumId(activeCondominiumId)
          }
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('condominioChanged', handleStorageChange)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('condominioChanged', handleStorageChange)
    }
  }, [selectedCondominiumId])

  const fetchTickets = async () => {
    setLoading(true)
    try {
      // Determinar qual condomínio usar
      let condominioId = ''
      if (currentUser?.tipo === 'master') {
        condominioId = selectedCondominiumId || ''
      } else {
        condominioId = currentUser?.condominio_id || ''
      }

      // Verificar se há condomínio selecionado
      if (!condominioId) {
        setTickets([])
        if (currentUser?.tipo === 'master') {
          showAlert('warning', 'Selecione um condomínio para visualizar os tickets.')
        } else {
          showAlert('warning', 'Nenhum condomínio selecionado. Selecione um condomínio para visualizar os tickets.')
        }
        setLoading(false)
        return
      }

      let url = `/api/tickets?master_id=${currentUser?.master_id || currentUser?.id}&tipo_usuario=${currentUser?.tipo}&condominio_id=${condominioId}`
      
      // Se não for master ou adm, filtrar por solicitante_id
      if (!['master', 'adm'].includes(currentUser?.tipo || '')) {
        url += `&usuario_id=${currentUser?.id}`
      }

      const response = await fetch(url)
      
      // Verificar se a resposta é HTML (erro 404/500)
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        console.error('API retornou HTML ao invés de JSON:', text.substring(0, 200))
        showAlert('danger', `Erro na API: ${response.status} ${response.statusText}`)
        return
      }
      
      const data = await response.json()
      if (data.success) {
        setTickets(data.tickets)
      } else {
        showAlert('danger', data.error || 'Erro ao carregar tickets')
      }
    } catch (error) {
      console.error('Erro ao buscar tickets:', error)
      showAlert('danger', 'Erro ao carregar tickets')
    } finally {
      setLoading(false)
    }
  }

  const fetchCondominiums = async (masterId: string) => {
    try {
      const response = await fetch(`/api/condominios?master_id=${masterId}`)
      
      // Verificar se a resposta é HTML (erro 404/500)
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        console.error('API condominios retornou HTML:', text.substring(0, 200))
        showAlert('danger', `Erro ao carregar condomínios: ${response.status}`)
        return
      }
      
      const data = await response.json()
      
      if (data.success) {
        setCondominiums(data.condominios)
      }
    } catch (error) {
      console.error('Error fetching condominiums:', error)
    }
  }

  const handleCondominiumChange = (condominioId: string) => {
    setSelectedCondominiumId(condominioId)
  }

  const showAlert = (type: string, message: string) => {
    setAlert({ type, message })
    setTimeout(() => setAlert(null), 5000)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    if (!currentUser) {
      showAlert('danger', 'Usuário não autenticado.')
      setLoading(false)
      return
    }

    try {
      // Determinar qual condomínio usar
      let condominioId = ''
      if (currentUser.tipo === 'master') {
        condominioId = selectedCondominiumId || ''
      } else {
        condominioId = currentUser.condominio_id || ''
      }

      if (!condominioId) {
        showAlert('danger', 'Selecione um condomínio para criar o ticket.')
        setLoading(false)
        return
      }

      const ticketData = {
        ...formData,
        solicitante_tipo: currentUser.tipo,
        solicitante_id: currentUser.id,
        solicitante_nome: currentUser.nome,
        condominio_id: condominioId,
        master_id: currentUser.master_id || currentUser.id,
        // Adicionar bloco e unidade se o usuário for morador/inquilino/colaborador
        ...( (['morador', 'inquilino', 'colaborador'].includes(currentUser.tipo)) && {
          solicitante_apartamento: currentUser.unidade || '',
          solicitante_bloco: currentUser.bloco || '',
        })
      }

      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticketData),
      })

      // Verificar se a resposta é HTML (erro 404/500)
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        console.error('API tickets POST retornou HTML:', text.substring(0, 200))
        showAlert('danger', `Erro ao criar ticket: ${response.status} ${response.statusText}`)
        return
      }

      const data = await response.json()
      if (data.success) {
        showAlert('success', 'Ticket criado com sucesso!')
        setShowModal(false)
        setFormData({ titulo: '', descricao: '', categoria: 'manutencao', prioridade: 'media' })
        fetchTickets()
      } else {
        showAlert('danger', data.error || 'Erro ao criar ticket')
      }
    } catch (error) {
      console.error('Erro ao criar ticket:', error)
      showAlert('danger', 'Erro ao criar ticket')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    let bg = 'secondary'
    switch (status) {
      case 'aberto':
        bg = 'info'
        break
      case 'em_andamento':
        bg = 'primary'
        break
      case 'aguardando_resposta':
        bg = 'warning'
        break
      case 'resolvido':
        bg = 'success'
        break
      case 'fechado':
        bg = 'dark'
        break
    }
    return <Badge bg={bg}>{status.replace(/_/g, ' ').charAt(0).toUpperCase() + status.replace(/_/g, ' ').slice(1)}</Badge>
  }

  const getPriorityBadge = (prioridade: string) => {
    let bg = 'secondary'
    switch (prioridade) {
      case 'baixa':
        bg = 'success'
        break
      case 'media':
        bg = 'info'
        break
      case 'alta':
        bg = 'warning'
        break
      case 'urgente':
        bg = 'danger'
        break
    }
    return <Badge bg={bg}>{prioridade.charAt(0).toUpperCase() + prioridade.slice(1)}</Badge>
  }

  return (
    <Container fluid className="py-4">
      {alert && (
        <Alert variant={alert.type} dismissible onClose={() => setAlert(null)}>
          {alert.message}
        </Alert>
      )}

      {/* Filtro de Condomínio para Master */}
      {currentUser?.tipo === 'master' && (
        <Row className="mb-3">
          <Col md={6}>
            <Card>
              <Card.Header>
                <h6 className="mb-0">
                  <i className="bi bi-building me-2"></i>
                  Filtrar por Condomínio
                </h6>
              </Card.Header>
              <Card.Body>
                <Form.Group>
                  <Form.Select
                    value={selectedCondominiumId}
                    onChange={(e) => handleCondominiumChange(e.target.value)}
                  >
                    <option value="">Selecione um condomínio</option>
                    {condominiums.map((cond) => (
                      <option key={cond._id} value={cond._id}>
                        {cond.nome}
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Text className="text-muted">
                    {selectedCondominiumId && localStorage.getItem('activeCondominio') === selectedCondominiumId && (
                      <span className="text-success">
                        <i className="bi bi-check-circle me-1"></i>
                        Condomínio ativo selecionado
                      </span>
                    )}
                  </Form.Text>
                </Form.Group>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      <Row className="mb-4">
        <Col>
          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
              <h4 className="mb-0">
                {currentUser?.tipo === 'master' ? 'Tickets do Condomínio' : 'Meus Tickets'}
              </h4>
              {currentUser && !['adm'].includes(currentUser.tipo) && (
                <Button 
                  variant="primary" 
                  onClick={() => setShowModal(true)}
                  disabled={currentUser.tipo === 'master' && !selectedCondominiumId}
                >
                  <i className="bi bi-plus-circle me-2"></i>
                  Abrir Novo Ticket
                </Button>
              )}
            </Card.Header>
            <Card.Body>
              {loading ? (
                <div className="text-center">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Carregando...</span>
                  </div>
                  <p className="mt-2">Carregando tickets...</p>
                </div>
              ) : tickets.length === 0 ? (
                <Alert variant="info" className="text-center">
                  Nenhum ticket encontrado. Clique em "Abrir Novo Ticket" para começar!
                </Alert>
              ) : (
                <Table responsive striped hover>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Título</th>
                      <th>Categoria</th>
                      <th>Prioridade</th>
                      <th>Status</th>
                      <th>Abertura</th>
                      <th>Última Atualização</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((ticket) => (
                      <tr key={ticket._id}>
                        <td>{ticket.id_ticket || ticket._id.slice(-6)}</td>
                        <td>{ticket.titulo}</td>
                        <td>{ticket.categoria}</td>
                        <td>{getPriorityBadge(ticket.prioridade)}</td>
                        <td>{getStatusBadge(ticket.status)}</td>
                        <td>{format(new Date(ticket.data_abertura), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</td>
                        <td>{format(new Date(ticket.data_atualizacao), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</td>
                        <td>
                          <Button variant="info" size="sm" onClick={() => router.push(`/tickets/${ticket._id}`)}>
                            Ver Detalhes
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Abrir Novo Ticket</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Título</Form.Label>
              <Form.Control
                type="text"
                name="titulo"
                value={formData.titulo}
                onChange={handleInputChange}
                required
                maxLength={100}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Descrição</Form.Label>
              <Form.Control
                as="textarea"
                name="descricao"
                value={formData.descricao}
                onChange={handleInputChange}
                required
                rows={5}
                maxLength={1000}
              />
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Categoria</Form.Label>
                  <Form.Select
                    name="categoria"
                    value={formData.categoria}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="manutencao">Manutenção</option>
                    <option value="financeiro">Financeiro</option>
                    <option value="administrativo">Administrativo</option>
                    <option value="outros">Outros</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Prioridade</Form.Label>
                  <Form.Select
                    name="prioridade"
                    value={formData.prioridade}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="media">Média</option>
                    <option value="baixa">Baixa</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? 'Enviando...' : 'Abrir Ticket'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  )
}