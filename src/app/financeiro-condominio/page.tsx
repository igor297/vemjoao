'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Container, Row, Col, Card, Button, Form, Modal, Alert, Spinner, Dropdown } from 'react-bootstrap'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface FinanceiroCondominio {
  _id: string
  tipo: 'receita' | 'despesa' | 'transferencia'
  categoria: string
  descricao: string
  valor: number
  data_vencimento: string
  data_pagamento?: string
  status: 'pendente' | 'pago' | 'atrasado' | 'cancelado'
  origem_nome?: string
  origem_cpf?: string
  origem_cargo?: string
  bloco?: string
  apartamento?: string
  unidade?: string
  valor_total: number
}

interface Condominium {
  _id: string
  nome: string
}

interface DashboardData {
  totalReceitas: number
  totalDespesas: number
  saldo: number
  receitasPorCategoria: { _id: string; total: number }[]
  despesasPorCategoria: { _id: string; total: number }[]
  lancamentosRecentes: FinanceiroCondominio[]
}

export default function FinanceiroCondominioPage() {
  const router = useRouter()
  const [financeiro, setFinanceiro] = useState<FinanceiroCondominio[]>([])
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [condominiums, setCondominiums] = useState<Condominium[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [selectedCondominiumId, setSelectedCondominiumId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [alert, setAlert] = useState<{type: string, message: string} | null>(null)

  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<FinanceiroCondominio | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<FinanceiroCondominio | null>(null)

  const [formData, setFormData] = useState<Partial<FinanceiroCondominio>>({
    tipo: 'despesa',
    categoria: '',
    descricao: '',
    valor: 0,
    data_vencimento: format(new Date(), 'yyyy-MM-dd'),
    status: 'pendente',
    origem_nome: '',
    origem_cpf: '',
    origem_cargo: '',
    bloco: '',
    apartamento: '',
    unidade: '',
  })

  const [filtros, setFiltros] = useState({
    tipo: '',
    status: '',
    categoria: '',
    dataInicio: '',
    dataFim: '',
    busca: ''
  })

  useEffect(() => {
    const userData = localStorage.getItem('userData')
    if (userData) {
      const user = JSON.parse(userData)
      setCurrentUser(user)
      if (user.tipo === 'master') {
        const activeCondominio = localStorage.getItem('activeCondominio')
        if (activeCondominio) {
          setSelectedCondominiumId(activeCondominio)
        } else {
          setAlert({ type: 'warning', message: 'Selecione um condomínio ativo para gerenciar o financeiro.' })
        }
      } else if (user.condominio_id) {
        setSelectedCondominiumId(user.condominio_id)
      }
    } else {
      router.push('/login')
    }
  }, [router])

  useEffect(() => {
    if (selectedCondominiumId && currentUser) {
      fetchCondominiums()
      fetchFinanceiroData()
      fetchDashboardData()
    }
  }, [selectedCondominiumId, currentUser, filtros])

  const fetchCondominiums = async () => {
    try {
      const response = await fetch('/api/condominios', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      if (response.ok) {
        const data = await response.json()
        setCondominiums(data)
      } else {
        setAlert({ type: 'danger', message: 'Erro ao carregar condomínios.' })
      }
    } catch (error) {
      console.error('Erro ao carregar condomínios:', error)
      setAlert({ type: 'danger', message: 'Erro de rede ao carregar condomínios.' })
    }
  }

  const fetchFinanceiroData = async () => {
    setLoading(true)
    setAlert(null)
    try {
      const query = new URLSearchParams(filtros).toString()
      const response = await fetch(`/api/financeiro-condominio?condominio_id=${selectedCondominiumId}&${query}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      if (response.ok) {
        const data = await response.json()
        setFinanceiro(data)
      } else {
        const errorData = await response.json()
        setAlert({ type: 'danger', message: errorData.message || 'Erro ao carregar dados financeiros.' })
      }
    } catch (error) {
      console.error('Erro ao carregar dados financeiros:', error)
      setAlert({ type: 'danger', message: 'Erro de rede ao carregar dados financeiros.' })
    } finally {
      setLoading(false)
    }
  }

  const fetchDashboardData = async () => {
    try {
      const response = await fetch(`/api/financeiro-condominio/dashboard?condominio_id=${selectedCondominiumId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      if (response.ok) {
        const data = await response.json()
        setDashboardData(data)
      } else {
        const errorData = await response.json()
        setAlert({ type: 'danger', message: errorData.message || 'Erro ao carregar dados do dashboard.' })
      }
    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error)
      setAlert({ type: 'danger', message: 'Erro de rede ao carregar dados do dashboard.' })
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'valor' ? parseFloat(value) || 0 : value
    }))
  }

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFiltros(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleShowModal = (item?: FinanceiroCondominio) => {
    if (item) {
      setEditingItem(item)
      setFormData({
        tipo: item.tipo,
        categoria: item.categoria,
        descricao: item.descricao,
        valor: item.valor,
        data_vencimento: format(new Date(item.data_vencimento), 'yyyy-MM-dd'),
        data_pagamento: item.data_pagamento ? format(new Date(item.data_pagamento), 'yyyy-MM-dd') : '',
        status: item.status,
        origem_nome: item.origem_nome || '',
        origem_cpf: item.origem_cpf || '',
        origem_cargo: item.origem_cargo || '',
        bloco: item.bloco || '',
        apartamento: item.apartamento || '',
        unidade: item.unidade || '',
      })
    } else {
      setEditingItem(null)
      setFormData({
        tipo: 'despesa',
        categoria: '',
        descricao: '',
        valor: 0,
        data_vencimento: format(new Date(), 'yyyy-MM-dd'),
        status: 'pendente',
        origem_nome: '',
        origem_cpf: '',
        origem_cargo: '',
        bloco: '',
        apartamento: '',
        unidade: '',
      })
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingItem(null)
    setFormData({
      tipo: 'despesa',
      categoria: '',
      descricao: '',
      valor: 0,
      data_vencimento: format(new Date(), 'yyyy-MM-dd'),
      status: 'pendente',
      origem_nome: '',
      origem_cpf: '',
      origem_cargo: '',
      bloco: '',
      apartamento: '',
      unidade: '',
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setAlert(null)

    const method = editingItem ? 'PUT' : 'POST'
    const url = editingItem ? `/api/financeiro-condominio/${editingItem._id}` : '/api/financeiro-condominio'

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...formData,
          condominio_id: selectedCondominiumId,
          master_id: currentUser.master_id || currentUser.id,
          criado_por_id: currentUser.id,
          criado_por_tipo: currentUser.tipo,
          criado_por_nome: currentUser.nome,
        })
      })

      if (response.ok) {
        setAlert({ type: 'success', message: `Lançamento ${editingItem ? 'atualizado' : 'adicionado'} com sucesso!` })
        handleCloseModal()
        fetchFinanceiroData()
        fetchDashboardData()
      } else {
        const errorData = await response.json()
        setAlert({ type: 'danger', message: errorData.message || `Erro ao ${editingItem ? 'atualizar' : 'adicionar'} lançamento.` })
      }
    } catch (error) {
      console.error('Erro ao salvar lançamento:', error)
      setAlert({ type: 'danger', message: 'Erro de rede ao salvar lançamento.' })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteConfirm = (item: FinanceiroCondominio) => {
    setItemToDelete(item)
    setShowDeleteModal(true)
  }

  const handleDelete = async () => {
    if (!itemToDelete) return

    setLoading(true)
    setAlert(null)

    try {
      const response = await fetch(`/api/financeiro-condominio/${itemToDelete._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })

      if (response.ok) {
        setAlert({ type: 'success', message: 'Lançamento excluído com sucesso!' })
        fetchFinanceiroData()
        fetchDashboardData()
      } else {
        const errorData = await response.json()
        setAlert({ type: 'danger', message: errorData.message || 'Erro ao excluir lançamento.' })
      }
    } catch (error) {
      console.error('Erro ao excluir lançamento:', error)
      setAlert({ type: 'danger', message: 'Erro de rede ao excluir lançamento.' })
    } finally {
      setLoading(false)
      setShowDeleteModal(false)
      setItemToDelete(null)
    }
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'pago': return 'success'
      case 'pendente': return 'warning'
      case 'atrasado': return 'danger'
      case 'cancelado': return 'secondary'
      default: return 'info'
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
  }

  if (!currentUser || !selectedCondominiumId) {
    return (
      <Container className="d-flex justify-content-center align-items-center min-vh-100">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Carregando...</span>
        </Spinner>
        <p className="ms-3">Carregando informações do usuário e condomínio...</p>
      </Container>
    )
  }

  return (
    <Container className="mt-4">
      <h1 className="mb-4">Financeiro do Condomínio</h1>

      {alert && <Alert variant={alert.type}>{alert.message}</Alert>}

      <Card className="mb-4 shadow-sm">
        <Card.Header className="bg-primary text-white">Resumo Financeiro</Card.Header>
        <Card.Body>
          {dashboardData ? (
            <Row>
              <Col md={4} className="mb-3">
                <Card className="text-center bg-light">
                  <Card.Body>
                    <Card.Title className="text-success">Receitas Totais</Card.Title>
                    <Card.Text className="fs-4 fw-bold">{formatCurrency(dashboardData.totalReceitas)}</Card.Text>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={4} className="mb-3">
                <Card className="text-center bg-light">
                  <Card.Body>
                    <Card.Title className="text-danger">Despesas Totais</Card.Title>
                    <Card.Text className="fs-4 fw-bold">{formatCurrency(dashboardData.totalDespesas)}</Card.Text>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={4} className="mb-3">
                <Card className={`text-center ${dashboardData.saldo >= 0 ? 'bg-success text-white' : 'bg-danger text-white'}`}>
                  <Card.Body>
                    <Card.Title>Saldo Atual</Card.Title>
                    <Card.Text className="fs-4 fw-bold">{formatCurrency(dashboardData.saldo)}</Card.Text>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          ) : (
            <p>Carregando resumo financeiro...</p>
          )}
        </Card.Body>
      </Card>

      <Card className="mb-4 shadow-sm">
        <Card.Header className="bg-info text-white d-flex justify-content-between align-items-center">
          Lançamentos
          <Button variant="light" onClick={() => handleShowModal()}>Novo Lançamento</Button>
        </Card.Header>
        <Card.Body>
          <Form className="mb-3">
            <Row>
              <Col md={3}>
                <Form.Group controlId="filtroTipo">
                  <Form.Label>Tipo</Form.Label>
                  <Form.Select name="tipo" value={filtros.tipo} onChange={handleFilterChange}>
                    <option value="">Todos</option>
                    <option value="receita">Receita</option>
                    <option value="despesa">Despesa</option>
                    <option value="transferencia">Transferência</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group controlId="filtroStatus">
                  <Form.Label>Status</Form.Label>
                  <Form.Select name="status" value={filtros.status} onChange={handleFilterChange}>
                    <option value="">Todos</option>
                    <option value="pendente">Pendente</option>
                    <option value="pago">Pago</option>
                    <option value="atrasado">Atrasado</option>
                    <option value="cancelado">Cancelado</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group controlId="filtroCategoria">
                  <Form.Label>Categoria</Form.Label>
                  <Form.Control type="text" name="categoria" value={filtros.categoria} onChange={handleFilterChange} placeholder="Buscar por categoria" />
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group controlId="filtroBusca">
                  <Form.Label>Busca</Form.Label>
                  <Form.Control type="text" name="busca" value={filtros.busca} onChange={handleFilterChange} placeholder="Descrição, CPF, etc." />
                </Form.Group>
              </Col>
            </Row>
            <Row className="mt-2">
              <Col md={3}>
                <Form.Group controlId="filtroDataInicio">
                  <Form.Label>Data Início</Form.Label>
                  <Form.Control type="date" name="dataInicio" value={filtros.dataInicio} onChange={handleFilterChange} />
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group controlId="filtroDataFim">
                  <Form.Label>Data Fim</Form.Label>
                  <Form.Control type="date" name="dataFim" value={filtros.dataFim} onChange={handleFilterChange} />
                </Form.Group>
              </Col>
            </Row>
          </Form>

          {loading ? (
            <div className="text-center"><Spinner animation="border" /></div>
          ) : financeiro.length === 0 ? (
            <Alert variant="info">Nenhum lançamento encontrado para o condomínio selecionado ou com os filtros aplicados.</Alert>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover table-striped">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Categoria</th>
                    <th>Descrição</th>
                    <th>Valor</th>
                    <th>Vencimento</th>
                    <th>Pagamento</th>
                    <th>Status</th>
                    <th>Origem</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {financeiro.map(item => (
                    <tr key={item._id}>
                      <td>
                        <span className={`badge bg-${item.tipo === 'receita' ? 'success' : item.tipo === 'despesa' ? 'danger' : 'info'}`}>
                          {item.tipo.charAt(0).toUpperCase() + item.tipo.slice(1)}
                        </span>
                      </td>
                      <td>{item.categoria}</td>
                      <td>{item.descricao}</td>
                      <td>{formatCurrency(item.valor_total || item.valor)}</td>
                      <td>{format(new Date(item.data_vencimento), 'dd/MM/yyyy', { locale: ptBR })}</td>
                      <td>{item.data_pagamento ? format(new Date(item.data_pagamento), 'dd/MM/yyyy', { locale: ptBR }) : 'N/A'}</td>
                      <td>
                        <span className={`badge bg-${getStatusVariant(item.status)}`}>
                          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                        </span>
                      </td>
                      <td>
                        {item.origem_nome && `Nome: ${item.origem_nome}`}<br/>
                        {item.origem_cpf && `CPF: ${item.origem_cpf}`}<br/>
                        {item.origem_cargo && `Cargo: ${item.origem_cargo}`}
                        {item.bloco && `Bloco: ${item.bloco}`}
                        {item.apartamento && `Apto: ${item.apartamento}`}
                        {item.unidade && `Unidade: ${item.unidade}`}
                      </td>
                      <td>
                        <Button variant="warning" size="sm" className="me-2" onClick={() => handleShowModal(item)}>Editar</Button>
                        <Button variant="danger" size="sm" onClick={() => handleDeleteConfirm(item)}>Excluir</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Modal de Adição/Edição */}
      <Modal show={showModal} onHide={handleCloseModal} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{editingItem ? 'Editar Lançamento' : 'Novo Lançamento'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmit}>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Tipo</Form.Label>
                  <Form.Select name="tipo" value={formData.tipo} onChange={handleInputChange} required>
                    <option value="despesa">Despesa</option>
                    <option value="receita">Receita</option>
                    <option value="transferencia">Transferência</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Categoria</Form.Label>
                  <Form.Control type="text" name="categoria" value={formData.categoria} onChange={handleInputChange} required />
                </Form.Group>
              </Col>
            </Row>
            <Form.Group className="mb-3">
              <Form.Label>Descrição</Form.Label>
              <Form.Control as="textarea" name="descricao" value={formData.descricao} onChange={handleInputChange} required />
            </Form.Group>
            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Valor</Form.Label>
                  <Form.Control type="number" name="valor" value={formData.valor} onChange={handleInputChange} required min="0" step="0.01" />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Data de Vencimento</Form.Label>
                  <Form.Control type="date" name="data_vencimento" value={formData.data_vencimento} onChange={handleInputChange} required />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Data de Pagamento (Opcional)</Form.Label>
                  <Form.Control type="date" name="data_pagamento" value={formData.data_pagamento} onChange={handleInputChange} />
                </Form.Group>
              </Col>
            </Row>
            <Form.Group className="mb-3">
              <Form.Label>Status</Form.Label>
              <Form.Select name="status" value={formData.status} onChange={handleInputChange} required>
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
                <option value="atrasado">Atrasado</option>
                <option value="cancelado">Cancelado</option>
              </Form.Select>
            </Form.Group>
            
            {/* Campos de Origem (condicional) */}
            {(formData.tipo === 'despesa' || formData.tipo === 'receita') && (
              <Card className="mb-3">
                <Card.Header>Detalhes da Origem/Destino</Card.Header>
                <Card.Body>
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Nome da Origem/Destino</Form.Label>
                        <Form.Control type="text" name="origem_nome" value={formData.origem_nome} onChange={handleInputChange} />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>CPF da Origem/Destino</Form.Label>
                        <Form.Control type="text" name="origem_cpf" value={formData.origem_cpf} onChange={handleInputChange} placeholder="Apenas números" />
                      </Form.Group>
                    </Col>
                  </Row>
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Cargo (se aplicável)</Form.Label>
                        <Form.Control type="text" name="origem_cargo" value={formData.origem_cargo} onChange={handleInputChange} />
                      </Form.Group>
                    </Col>
                    <Col md={2}>
                      <Form.Group className="mb-3">
                        <Form.Label>Bloco</Form.Label>
                        <Form.Control type="text" name="bloco" value={formData.bloco} onChange={handleInputChange} />
                      </Form.Group>
                    </Col>
                    <Col md={2}>
                      <Form.Group className="mb-3">
                        <Form.Label>Apto</Form.Label>
                        <Form.Control type="text" name="apartamento" value={formData.apartamento} onChange={handleInputChange} />
                      </Form.Group>
                    </Col>
                    <Col md={2}>
                      <Form.Group className="mb-3">
                        <Form.Label>Unidade</Form.Label>
                        <Form.Control type="text" name="unidade" value={formData.unidade} onChange={handleInputChange} />
                      </Form.Group>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            )}

            <div className="d-flex justify-content-end">
              <Button variant="secondary" onClick={handleCloseModal} className="me-2">Cancelar</Button>
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? <Spinner animation="border" size="sm" /> : (editingItem ? 'Salvar Alterações' : 'Adicionar Lançamento')}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Modal de Confirmação de Exclusão */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Confirmar Exclusão</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Tem certeza que deseja excluir o lançamento "{itemToDelete?.descricao}" (Valor: {formatCurrency(itemToDelete?.valor || 0)})?
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>Cancelar</Button>
          <Button variant="danger" onClick={handleDelete} disabled={loading}>
            {loading ? <Spinner animation="border" size="sm" /> : 'Excluir'}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  )
}
