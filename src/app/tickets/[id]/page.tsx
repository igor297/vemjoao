'use client'

import { useState, useEffect } from 'react'
import { Container, Card, Button, Form, Alert, Spinner, Row, Col, Badge } from 'react-bootstrap'
import { useRouter, useParams } from 'next/navigation'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Message {
  id: string
  remetente_tipo: string
  remetente_id: string
  remetente_nome: string
  mensagem: string
  data: string
}

interface Ticket {
  _id: string
  titulo: string
  descricao: string
  categoria: 'financeiro' | 'manutencao' | 'administrativo' | 'outros'
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente'
  status: 'aberto' | 'em_andamento' | 'aguardando_resposta' | 'resolvido' | 'fechado'
  solicitante_tipo: 'colaborador' | 'morador' | 'inquilino' | 'conjuge' | 'dependente'
  solicitante_id: string
  solicitante_nome: string
  solicitante_apartamento?: string
  solicitante_bloco?: string
  condominio_id: string
  master_id: string
  data_abertura: string
  data_atualizacao: string
  mensagens: Message[]
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

export default function TicketDetailsPage() {
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(true)
  const [alert, setAlert] = useState<{ type: string; message: string } | null>(null)
  const [currentUser, setCurrentUser] = useState<UserData | null>(null)
  const [responseMessage, setResponseMessage] = useState('')
  const [isResponding, setIsResponding] = useState(false)
  const [newStatus, setNewStatus] = useState<Ticket['status'] | ''>('')

  const router = useRouter()
  const params = useParams()
  const ticketId = params.id as string

  useEffect(() => {
    const userData = localStorage.getItem('userData')
    if (userData) {
      setCurrentUser(JSON.parse(userData))
    } else {
      router.push('/login')
    }
  }, [router])

  useEffect(() => {
    if (currentUser && ticketId) {
      fetchTicketDetails()
    }
  }, [currentUser, ticketId])

  const fetchTicketDetails = async () => {
    setLoading(true)
    try {
      // Determinar qual condomínio usar
      let condominioId = ''
      if (currentUser?.tipo === 'master') {
        condominioId = localStorage.getItem('activeCondominio') || ''
      } else {
        condominioId = currentUser?.condominio_id || ''
      }

      // Se não tem condomínio, não pode carregar
      if (!condominioId) {
        showAlert('warning', 'Nenhum condomínio selecionado.')
        setLoading(false)
        return
      }

      const url = `/api/tickets?master_id=${currentUser?.master_id || currentUser?.id}&tipo_usuario=${currentUser?.tipo}&condominio_id=${condominioId}&ticket_id=${ticketId}`
      const response = await fetch(url)
      
      // Verificar se a resposta é HTML (erro 404/500)
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        console.error('API ticket details retornou HTML:', text.substring(0, 200))
        showAlert('danger', `Erro ao carregar ticket: ${response.status} ${response.statusText}`)
        setTicket(null)
        return
      }
      
      const data = await response.json()
      if (data.success && data.tickets.length > 0) {
        setTicket(data.tickets[0])
        setNewStatus(data.tickets[0].status)
      } else {
        showAlert('danger', data.error || 'Ticket não encontrado')
        setTicket(null)
      }
    } catch (error) {
      console.error('Erro ao buscar detalhes do ticket:', error)
      showAlert('danger', 'Erro ao buscar detalhes do ticket')
      setTicket(null)
    } finally {
      setLoading(false)
    }
  }

  const showAlert = (type: string, message: string) => {
    setAlert({ type, message })
    setTimeout(() => setAlert(null), 5000)
  }

  const handleResponseSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsResponding(true)

    if (!currentUser || !ticket) {
      showAlert('danger', 'Usuário não autenticado ou ticket não encontrado.')
      setIsResponding(false)
      return
    }

    try {
      const response = await fetch('/api/tickets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _id: ticket._id,
          acao: 'responder',
          usuario_tipo: currentUser.tipo,
          usuario_id: currentUser.id,
          usuario_nome: currentUser.nome,
          mensagem: responseMessage,
        }),
      })

      // Verificar se a resposta é HTML (erro 404/500)
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        console.error('API ticket response retornou HTML:', text.substring(0, 200))
        showAlert('danger', `Erro ao enviar resposta: ${response.status} ${response.statusText}`)
        return
      }

      const data = await response.json()
      if (data.success) {
        showAlert('success', 'Resposta enviada com sucesso!')
        setResponseMessage('')
        fetchTicketDetails()
      } else {
        showAlert('danger', data.error || 'Erro ao enviar resposta')
      }
    } catch (error) {
      console.error('Erro ao enviar resposta:', error)
      showAlert('danger', 'Erro ao enviar resposta')
    } finally {
      setIsResponding(false)
    }
  }

  const handleStatusChange = async () => {
    if (!currentUser || !ticket || !newStatus) {
      showAlert('danger', 'Usuário não autenticado, ticket não encontrado ou status inválido.')
      return
    }

    if (newStatus === ticket.status) return // Não faz nada se o status não mudou

    setLoading(true)
    try {
      const response = await fetch('/api/tickets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _id: ticket._id,
          acao: 'atualizar_status',
          usuario_tipo: currentUser.tipo,
          usuario_id: currentUser.id,
          usuario_nome: currentUser.nome,
          status: newStatus,
        }),
      })

      const data = await response.json()
      if (data.success) {
        showAlert('success', 'Status do ticket atualizado com sucesso!')
        fetchTicketDetails()
      } else {
        showAlert('danger', data.error || 'Erro ao atualizar status')
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error)
      showAlert('danger', 'Erro ao atualizar status')
    } finally {
      setLoading(false)
    }
  }

  const handleCloseTicket = async () => {
    if (!confirm('Tem certeza que deseja fechar este ticket?')) return

    if (!currentUser || !ticket) {
      showAlert('danger', 'Usuário não autenticado ou ticket não encontrado.')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/tickets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _id: ticket._id,
          acao: 'fechar',
          usuario_tipo: currentUser.tipo,
          usuario_id: currentUser.id,
          usuario_nome: currentUser.nome,
        }),
      })

      const data = await response.json()
      if (data.success) {
        showAlert('success', 'Ticket fechado com sucesso!')
        fetchTicketDetails()
      } else {
        showAlert('danger', data.error || 'Erro ao fechar ticket')
      }
    } catch (error) {
      console.error('Erro ao fechar ticket:', error)
      showAlert('danger', 'Erro ao fechar ticket')
    } finally {
      setLoading(false)
    }
  }

  const canRespond = () => {
    return currentUser && ['master', 'adm', 'sindico', 'subsindico'].includes(currentUser.tipo)
  }

  const canChangeStatus = () => {
    return currentUser && ['master', 'adm', 'sindico', 'subsindico'].includes(currentUser.tipo)
  }

  if (loading || !currentUser) {
    return (
      <Container fluid className="py-4 text-center">
        <Spinner animation="border" role="status" className="me-2" />
        <span>Carregando detalhes do ticket...</span>
      </Container>
    )
  }

  if (!ticket) {
    return (
      <Container fluid className="py-4">
        <Alert variant="danger">Ticket não encontrado.</Alert>
        <Button variant="primary" onClick={() => router.push('/tickets')}>Voltar para Meus Tickets</Button>
      </Container>
    )
  }

  return (
    <Container fluid className="py-4">
      {alert && (
        <Alert variant={alert.type} dismissible onClose={() => setAlert(null)}>
          {alert.message}
        </Alert>
      )}

      <Card className="mb-4">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h4 className="mb-0">Ticket #{ticket.id_ticket} - {ticket.titulo}</h4>
          <div>
            {ticket.status !== 'fechado' && canChangeStatus() && (
              <>
                <Form.Select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as Ticket['status'])}
                  className="d-inline-block w-auto me-2"
                  aria-label="Alterar Status"
                >
                  <option value="aberto">Aberto</option>
                  <option value="em_andamento">Em Andamento</option>
                  <option value="aguardando_resposta">Aguardando Resposta</option>
                  <option value="resolvido">Resolvido</option>
                  <option value="fechado">Fechado</option>
                </Form.Select>
                <Button variant="success" onClick={handleStatusChange} className="me-2">
                  Atualizar Status
                </Button>
              </>
            )}
            {ticket.status !== 'fechado' && canChangeStatus() && (
              <Button variant="danger" onClick={handleCloseTicket}>
                Fechar Ticket
              </Button>
            )}
            <Button variant="secondary" onClick={() => router.push('/tickets')} className="ms-2">
              Voltar
            </Button>
          </div>
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={6}>
              <p><strong>Solicitante:</strong> {ticket.solicitante_nome} ({ticket.solicitante_tipo})</p>
              {ticket.solicitante_bloco && ticket.solicitante_apartamento && (
                <p><strong>Local:</strong> Bloco {ticket.solicitante_bloco}, Apartamento {ticket.solicitante_apartamento}</p>
              )}
              <p><strong>Categoria:</strong> {ticket.categoria}</p>
              <p><strong>Prioridade:</strong> {getPriorityBadge(ticket.prioridade)}</p>
            </Col>
            <Col md={6}>
              <p><strong>Status:</strong> {getStatusBadge(ticket.status)}</p>
              <p><strong>Abertura:</strong> {format(new Date(ticket.data_abertura), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</p>
              <p><strong>Última Atualização:</strong> {format(new Date(ticket.data_atualizacao), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</p>
            </Col>
          </Row>
          <hr />
          <h5>Descrição:</h5>
          <p>{ticket.descricao}</p>
        </Card.Body>
      </Card>

      <Card className="mb-4">
        <Card.Header><h5>Histórico de Mensagens</h5></Card.Header>
        <Card.Body>
          {ticket.mensagens.length === 0 ? (
            <Alert variant="info">Nenhuma mensagem neste ticket ainda.</Alert>
          ) : (
            ticket.mensagens.map((msg, index) => (
              <div key={index} className={`mb-3 p-3 border rounded ${msg.remetente_id === currentUser?.id ? 'bg-light ms-auto' : 'bg-white me-auto'}`} style={{ maxWidth: '80%' }}>
                <p className="mb-1">
                  <strong>{msg.remetente_nome} ({msg.remetente_tipo}):</strong> {msg.mensagem}
                </p>
                <small className="text-muted">{format(new Date(msg.data), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</small>
              </div>
            ))
          )}
        </Card.Body>
      </Card>

      {canRespond() && ticket.status !== 'fechado' && (
        <Card>
          <Card.Header><h5>Responder Ticket</h5></Card.Header>
          <Card.Body>
            <Form onSubmit={handleResponseSubmit}>
              <Form.Group className="mb-3">
                <Form.Label>Sua Mensagem</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={responseMessage}
                  onChange={(e) => setResponseMessage(e.target.value)}
                  required
                  disabled={isResponding}
                />
              </Form.Group>
              <Button variant="primary" type="submit" disabled={isResponding}>
                {isResponding ? 'Enviando...' : 'Enviar Resposta'}
              </Button>
            </Form>
          </Card.Body>
        </Card>
      )}
    </Container>
  )
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