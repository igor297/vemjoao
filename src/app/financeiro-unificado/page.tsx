'use client'

import { useState, useEffect } from 'react'
import { Container, Row, Col, Card, Button, Modal, Form, Alert, Badge, Nav, Table, Dropdown, ProgressBar } from 'react-bootstrap'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
)

interface FinanceiroUnificado {
  _id: string
  codigo_lancamento: string
  tipo_operacao: 'receita' | 'despesa' | 'transferencia'
  categoria_origem: 'condominio' | 'colaborador' | 'morador' | 'adm' | 'fornecedor' | 'banco'
  subcategoria: string
  descricao: string
  valor: number
  data_vencimento: string
  data_pagamento?: string
  status: 'pendente' | 'pago' | 'atrasado' | 'cancelado' | 'agendado' | 'processando'
  vinculo_nome?: string
  apartamento?: string
  bloco?: string
  forma_pagamento?: string
  mes_referencia?: string
  observacoes?: string
  criado_por_nome: string
  data_criacao: string
}

interface Condominium {
  _id: string
  nome: string
}

interface DashboardData {
  resumo: {
    total_receitas: number
    total_despesas: number
    resultado_liquido: number
    pendentes: number
    atrasados: number
  }
  fluxo_mensal: any[]
  categorias: any[]
  inadimplencia: any[]
}

export default function FinanceiroUnificadoPage() {
  const [financeiro, setFinanceiro] = useState<FinanceiroUnificado[]>([])
  const [condominiums, setCondominiums] = useState<Condominium[]>([])
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  
  // Estados de controle
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [selectedCondominiumId, setSelectedCondominiumId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [alert, setAlert] = useState<{type: string, message: string} | null>(null)
  
  // Estados da interface
  const [activeView, setActiveView] = useState<'dashboard' | 'condominio' | 'colaborador' | 'morador' | 'configuracao'>('dashboard')
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<FinanceiroUnificado | null>(null)
  const [showConfigModal, setShowConfigModal] = useState(false)
  
  // Filtros
  const [filtros, setFiltros] = useState({
    categoria_origem: '',
    status: '',
    data_inicio: '',
    data_fim: '',
    subcategoria: ''
  })
  
  // Paginação
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  })

  // Formulário
  const [formData, setFormData] = useState({
    tipo_operacao: 'receita' as const,
    categoria_origem: 'condominio' as const,
    subcategoria: '',
    descricao: '',
    valor: 0,
    data_vencimento: '',
    data_pagamento: '',
    status: 'pendente' as const,
    vinculo_id: '',
    vinculo_nome: '',
    apartamento: '',
    bloco: '',
    forma_pagamento: '',
    observacoes: '',
    recorrente: false,
    periodicidade: ''
  })

  // Função auxiliar para localStorage
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
      
      if (user.tipo === 'master') {
        loadCondominiums(user.id)
        const activeCondominiumId = getLocalStorage('activeCondominio')
        if (activeCondominiumId) {
          setSelectedCondominiumId(activeCondominiumId)
          loadDashboard(user, activeCondominiumId)
          loadFinanceiro(user, activeCondominiumId)
        }
      } else {
        if (user.condominio_id) {
          setSelectedCondominiumId(user.condominio_id)
          loadCondominiums(user.master_id || user.id)
          loadDashboard(user, user.condominio_id)
          loadFinanceiro(user, user.condominio_id)
        }
      }
    }

    // Event listeners para mudança de condomínio
    const handleCondominioChange = () => {
      const userData = getLocalStorage('userData')
      if (userData) {
        const user = JSON.parse(userData)
        if (user.tipo === 'master') {
          const activeCondominiumId = getLocalStorage('activeCondominio')
          if (activeCondominiumId) {
            setSelectedCondominiumId(activeCondominiumId)
            loadDashboard(user, activeCondominiumId)
            loadFinanceiro(user, activeCondominiumId)
          }
        }
      }
    }

    window.addEventListener('storage', handleCondominioChange)
    window.addEventListener('condominioChanged', handleCondominioChange)

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

  const loadDashboard = async (user: any, condominioId: string) => {
    try {
      setLoading(true)
      const masterId = user.master_id || user.id
      
      // Carregar dados do dashboard
      const [resumoRes, fluxoRes, categoriasRes, inadimplenciaRes] = await Promise.all([
        fetch(`/api/financeiro-unificado?master_id=${masterId}&condominio_id=${condominioId}&tipo_usuario=${user.tipo}&usuario_id=${user.id}&relatorio=resumo`),
        fetch(`/api/financeiro-unificado?master_id=${masterId}&condominio_id=${condominioId}&tipo_usuario=${user.tipo}&usuario_id=${user.id}&relatorio=fluxo-caixa`),
        fetch(`/api/financeiro-unificado?master_id=${masterId}&condominio_id=${condominioId}&tipo_usuario=${user.tipo}&usuario_id=${user.id}&relatorio=categorias`),
        fetch(`/api/financeiro-unificado?master_id=${masterId}&condominio_id=${condominioId}&tipo_usuario=${user.tipo}&usuario_id=${user.id}&relatorio=inadimplencia`)
      ])

      const [resumoData, fluxoData, categoriasData, inadimplenciaData] = await Promise.all([
        resumoRes.json(),
        fluxoRes.json(),
        categoriasRes.json(),
        inadimplenciaRes.json()
      ])

      // Processar dados do resumo
      const resumo = {
        total_receitas: 0,
        total_despesas: 0,
        resultado_liquido: 0,
        pendentes: 0,
        atrasados: 0
      }

      if (resumoData.success) {
        resumoData.dados.forEach((item: any) => {
          if (item._id === 'receita') {
            resumo.total_receitas = item.total_geral || 0
            item.detalhes.forEach((det: any) => {
              if (det.status === 'pendente') resumo.pendentes += det.total
              if (det.status === 'atrasado') resumo.atrasados += det.total
            })
          } else if (item._id === 'despesa') {
            resumo.total_despesas = item.total_geral || 0
          }
        })
        resumo.resultado_liquido = resumo.total_receitas - resumo.total_despesas
      }

      setDashboardData({
        resumo,
        fluxo_mensal: fluxoData.success ? fluxoData.dados : [],
        categorias: categoriasData.success ? categoriasData.dados : [],
        inadimplencia: inadimplenciaData.success ? inadimplenciaData.dados : []
      })

    } catch (error) {
      console.error('Erro ao carregar dashboard:', error)
      showAlert('danger', 'Erro ao carregar dados do dashboard')
    } finally {
      setLoading(false)
    }
  }

  const loadFinanceiro = async (user: any, condominioId: string, categoriaOrigem?: string) => {
    try {
      setLoading(true)
      const masterId = user.master_id || user.id
      
      let url = `/api/financeiro-unificado?master_id=${masterId}&condominio_id=${condominioId}&tipo_usuario=${user.tipo}&usuario_id=${user.id}&page=${pagination.page}&limit=${pagination.limit}`
      
      if (categoriaOrigem) {
        url += `&categoria_origem=${categoriaOrigem}`
      }
      
      // Aplicar filtros
      Object.entries(filtros).forEach(([key, value]) => {
        if (value) {
          url += `&${key}=${encodeURIComponent(value)}`
        }
      })

      const response = await fetch(url)
      const data = await response.json()
      
      if (data.success) {
        setFinanceiro(data.financeiro)
        setPagination(data.pagination)
      } else {
        showAlert('danger', data.error || 'Erro ao carregar dados financeiros')
      }
    } catch (error) {
      console.error('Erro ao carregar financeiro:', error)
      showAlert('danger', 'Erro ao carregar dados financeiros')
    } finally {
      setLoading(false)
    }
  }

  const showAlert = (type: string, message: string) => {
    setAlert({ type, message })
    setTimeout(() => setAlert(null), 5000)
  }

  const handleCondominiumChange = (condominioId: string) => {
    setSelectedCondominiumId(condominioId)
    if (condominioId && currentUser) {
      loadDashboard(currentUser, condominioId)
      loadFinanceiro(currentUser, condominioId)
    }
  }

  const handleViewChange = (view: typeof activeView) => {
    setActiveView(view)
    if (view !== 'dashboard' && view !== 'configuracao' && selectedCondominiumId) {
      const categoriaOrigem = view === 'condominio' ? 'condominio' : view === 'colaborador' ? 'colaborador' : 'morador'
      loadFinanceiro(currentUser, selectedCondominiumId, categoriaOrigem)
    }
  }

  const handleNewLancamento = (categoriaOrigem: string) => {
    setEditingItem(null)
    setFormData({
      ...formData,
      categoria_origem: categoriaOrigem as any,
      subcategoria: getSubcategoriaDefault(categoriaOrigem),
      tipo_operacao: categoriaOrigem === 'morador' ? 'receita' : 'despesa'
    })
    setShowModal(true)
  }

  const getSubcategoriaDefault = (categoriaOrigem: string) => {
    const defaults = {
      condominio: 'administracao',
      colaborador: 'salario',
      morador: 'taxa_condominio_morador',
      adm: 'contabilidade'
    }
    return defaults[categoriaOrigem as keyof typeof defaults] || 'outros'
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const url = '/api/financeiro-unificado'
      const method = editingItem ? 'PUT' : 'POST'
      
      const dataToSend = {
        ...formData,
        ...(editingItem && { _id: editingItem._id }),
        master_id: currentUser?.master_id || currentUser?.id,
        condominio_id: selectedCondominiumId,
        tipo_usuario: currentUser?.tipo,
        usuario_id: currentUser?.id,
        criado_por_nome: currentUser?.nome || currentUser?.email
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend)
      })

      const data = await response.json()
      
      if (data.success) {
        showAlert('success', editingItem ? 'Lançamento atualizado!' : 'Lançamento criado!')
        handleCloseModal()
        loadDashboard(currentUser, selectedCondominiumId)
        if (activeView !== 'dashboard') {
          const categoriaOrigem = activeView === 'condominio' ? 'condominio' : activeView === 'colaborador' ? 'colaborador' : 'morador'
          loadFinanceiro(currentUser, selectedCondominiumId, categoriaOrigem)
        }
      } else {
        showAlert('danger', data.error || 'Erro ao salvar lançamento')
      }
    } catch (error) {
      showAlert('danger', 'Erro ao salvar lançamento')
    } finally {
      setLoading(false)
    }
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingItem(null)
  }

  const formatCurrency = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR')
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pendente: { bg: 'warning', text: 'Pendente' },
      pago: { bg: 'success', text: 'Pago' },
      atrasado: { bg: 'danger', text: 'Atrasado' },
      cancelado: { bg: 'secondary', text: 'Cancelado' },
      agendado: { bg: 'info', text: 'Agendado' },
      processando: { bg: 'primary', text: 'Processando' }
    }
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pendente
    return <Badge bg={config.bg}>{config.text}</Badge>
  }

  const getTipoOperacaoBadge = (tipo: string) => {
    const config = {
      receita: { bg: 'success', text: 'Receita', icon: '📈' },
      despesa: { bg: 'danger', text: 'Despesa', icon: '📉' },
      transferencia: { bg: 'info', text: 'Transferência', icon: '🔄' }
    }
    const item = config[tipo as keyof typeof config] || config.receita
    return <Badge bg={item.bg}>{item.icon} {item.text}</Badge>
  }

  const getSelectedCondominiumName = () => {
    const cond = condominiums.find(c => c._id === selectedCondominiumId)
    return cond?.nome || 'Selecione um condomínio'
  }

  // Gráficos
  const fluxoCaixaChartData = {
    labels: dashboardData?.fluxo_mensal.map(item => `${item._id.mes}/${item._id.ano}`) || [],
    datasets: [
      {
        label: 'Receitas',
        data: dashboardData?.fluxo_mensal.filter(item => item._id.tipo_operacao === 'receita').map(item => item.total) || [],
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.1
      },
      {
        label: 'Despesas',
        data: dashboardData?.fluxo_mensal.filter(item => item._id.tipo_operacao === 'despesa').map(item => item.total) || [],
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        tension: 0.1
      }
    ]
  }

  const categoriasChartData = {
    labels: dashboardData?.categorias.slice(0, 8).map(item => item._id.subcategoria) || [],
    datasets: [{
      data: dashboardData?.categorias.slice(0, 8).map(item => item.total) || [],
      backgroundColor: [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
        '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
      ]
    }]
  }

  return (
    <>
      <Container fluid className="mt-4">
        {alert && (
          <Alert variant={alert.type} className="mb-3">
            {alert.message}
          </Alert>
        )}

        <Row className="mb-4">
          <Col>
            <div className="d-flex justify-content-between align-items-center">
              <h2>💰 Sistema Financeiro Unificado</h2>
              <div className="d-flex gap-2">
                {currentUser?.tipo === 'master' && condominiums.length > 0 && (
                  <Dropdown>
                    <Dropdown.Toggle variant="outline-primary" size="sm">
                      🏢 {getSelectedCondominiumName()}
                    </Dropdown.Toggle>
                    <Dropdown.Menu>
                      {condominiums.map(cond => (
                        <Dropdown.Item
                          key={cond._id}
                          onClick={() => handleCondominiumChange(cond._id)}
                          active={cond._id === selectedCondominiumId}
                        >
                          {cond.nome}
                        </Dropdown.Item>
                      ))}
                    </Dropdown.Menu>
                  </Dropdown>
                )}
                <Button 
                  variant="outline-secondary" 
                  size="sm"
                  onClick={() => setShowConfigModal(true)}
                >
                  ⚙️ Configurações
                </Button>
              </div>
            </div>
          </Col>
        </Row>

        {/* Navegação */}
        <Row className="mb-4">
          <Col>
            <Nav variant="pills" activeKey={activeView} onSelect={(key) => handleViewChange(key as any)}>
              <Nav.Item>
                <Nav.Link eventKey="dashboard">📊 Dashboard</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="condominio">🏢 Condomínio</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="colaborador">👷 Colaboradores</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="morador">🏠 Moradores</Nav.Link>
              </Nav.Item>
            </Nav>
          </Col>
        </Row>

        {/* Dashboard */}
        {activeView === 'dashboard' && dashboardData && (
          <>
            {/* Resumo Financeiro */}
            <Row className="mb-4">
              <Col md={3}>
                <Card className="text-center">
                  <Card.Body>
                    <h5 className="text-success">📈 Receitas</h5>
                    <h3 className="text-success">{formatCurrency(dashboardData.resumo.total_receitas)}</h3>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card className="text-center">
                  <Card.Body>
                    <h5 className="text-danger">📉 Despesas</h5>
                    <h3 className="text-danger">{formatCurrency(dashboardData.resumo.total_despesas)}</h3>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card className="text-center">
                  <Card.Body>
                    <h5 className={dashboardData.resumo.resultado_liquido >= 0 ? 'text-success' : 'text-danger'}>
                      💰 Resultado
                    </h5>
                    <h3 className={dashboardData.resumo.resultado_liquido >= 0 ? 'text-success' : 'text-danger'}>
                      {formatCurrency(dashboardData.resumo.resultado_liquido)}
                    </h3>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card className="text-center">
                  <Card.Body>
                    <h5 className="text-warning">⏰ Pendentes</h5>
                    <h3 className="text-warning">{formatCurrency(dashboardData.resumo.pendentes)}</h3>
                    <small className="text-danger">Atrasados: {formatCurrency(dashboardData.resumo.atrasados)}</small>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {/* Gráficos */}
            <Row className="mb-4">
              <Col md={8}>
                <Card>
                  <Card.Header>
                    <h5>📈 Fluxo de Caixa Mensal</h5>
                  </Card.Header>
                  <Card.Body>
                    <Line data={fluxoCaixaChartData} options={{
                      responsive: true,
                      plugins: {
                        legend: { position: 'top' as const },
                        title: { display: true, text: 'Receitas vs Despesas' }
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          ticks: {
                            callback: function(value) {
                              return formatCurrency(Number(value))
                            }
                          }
                        }
                      }
                    }} />
                  </Card.Body>
                </Card>
              </Col>
              <Col md={4}>
                <Card>
                  <Card.Header>
                    <h5>🎯 Principais Categorias</h5>
                  </Card.Header>
                  <Card.Body>
                    <Doughnut data={categoriasChartData} options={{
                      responsive: true,
                      plugins: {
                        legend: { position: 'bottom' as const }
                      }
                    }} />
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {/* Inadimplência */}
            {dashboardData.inadimplencia.length > 0 && (
              <Row>
                <Col>
                  <Card>
                    <Card.Header>
                      <h5>🚨 Relatório de Inadimplência</h5>
                    </Card.Header>
                    <Card.Body>
                      <Table responsive striped>
                        <thead>
                          <tr>
                            <th>Morador</th>
                            <th>Unidade</th>
                            <th>Total Devido</th>
                            <th>Pendências</th>
                            <th>Mais Antigo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dashboardData.inadimplencia.slice(0, 10).map((item, index) => (
                            <tr key={index}>
                              <td>{item.vinculo_nome}</td>
                              <td>{item.bloco ? `${item.bloco} - ` : ''}{item.apartamento}</td>
                              <td className="text-danger fw-bold">{formatCurrency(item.total_devido)}</td>
                              <td>
                                <Badge bg="danger">{item.quantidade_pendencias}</Badge>
                              </td>
                              <td>{formatDate(item.mais_antigo)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            )}
          </>
        )}

        {/* Tabelas por Categoria */}
        {['condominio', 'colaborador', 'morador'].includes(activeView) && (
          <Row>
            <Col>
              <Card>
                <Card.Header className="d-flex justify-content-between align-items-center">
                  <h5>
                    {activeView === 'condominio' && '🏢 Financeiro do Condomínio'}
                    {activeView === 'colaborador' && '👷 Financeiro de Colaboradores'}
                    {activeView === 'morador' && '🏠 Financeiro de Moradores'}
                  </h5>
                  <Button 
                    variant="primary" 
                    size="sm"
                    onClick={() => handleNewLancamento(activeView)}
                  >
                    ➕ Novo Lançamento
                  </Button>
                </Card.Header>
                <Card.Body>
                  {financeiro.length === 0 ? (
                    <Alert variant="info" className="text-center">
                      <h6>📊 Nenhum lançamento encontrado</h6>
                      <p className="mb-0">Não há registros financeiros para esta categoria</p>
                    </Alert>
                  ) : (
                    <Table responsive striped>
                      <thead>
                        <tr>
                          <th>Código</th>
                          <th>Tipo</th>
                          <th>Descrição</th>
                          <th>Valor</th>
                          <th>Vencimento</th>
                          <th>Status</th>
                          <th>Vinculação</th>
                          <th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {financeiro.map((item) => (
                          <tr key={item._id}>
                            <td>
                              <small className="text-muted">{item.codigo_lancamento}</small>
                            </td>
                            <td>{getTipoOperacaoBadge(item.tipo_operacao)}</td>
                            <td>
                              <strong>{item.descricao}</strong>
                              <br />
                              <small className="text-muted">{item.subcategoria}</small>
                            </td>
                            <td className={item.tipo_operacao === 'receita' ? 'text-success' : 'text-danger'}>
                              <strong>{formatCurrency(item.valor)}</strong>
                            </td>
                            <td>{formatDate(item.data_vencimento)}</td>
                            <td>{getStatusBadge(item.status)}</td>
                            <td>
                              {item.vinculo_nome && (
                                <>
                                  {item.vinculo_nome}
                                  {item.apartamento && (
                                    <>
                                      <br />
                                      <small className="text-muted">
                                        {item.bloco ? `${item.bloco} - ` : ''}{item.apartamento}
                                      </small>
                                    </>
                                  )}
                                </>
                              )}
                            </td>
                            <td>
                              <Button variant="outline-primary" size="sm" className="me-1">
                                ✏️
                              </Button>
                              <Button variant="outline-danger" size="sm">
                                🗑️
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
        )}

        {/* Modal Principal */}
        <Modal show={showModal} onHide={handleCloseModal} size="lg">
          <Modal.Header closeButton>
            <Modal.Title>
              {editingItem ? 'Editar Lançamento' : 'Novo Lançamento'}
            </Modal.Title>
          </Modal.Header>
          <Form onSubmit={handleSubmit}>
            <Modal.Body>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Tipo de Operação *</Form.Label>
                    <Form.Select
                      name="tipo_operacao"
                      value={formData.tipo_operacao}
                      onChange={(e) => setFormData(prev => ({ ...prev, tipo_operacao: e.target.value as any }))}
                      required
                    >
                      <option value="receita">📈 Receita</option>
                      <option value="despesa">📉 Despesa</option>
                      <option value="transferencia">🔄 Transferência</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Categoria *</Form.Label>
                    <Form.Select
                      name="categoria_origem"
                      value={formData.categoria_origem}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        categoria_origem: e.target.value as any,
                        subcategoria: getSubcategoriaDefault(e.target.value)
                      }))}
                      required
                    >
                      <option value="condominio">🏢 Condomínio</option>
                      <option value="colaborador">👷 Colaborador</option>
                      <option value="morador">🏠 Morador</option>
                      <option value="adm">👨‍💼 Administrativo</option>
                      <option value="fornecedor">🏪 Fornecedor</option>
                      <option value="banco">🏦 Bancário</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>

              <Form.Group className="mb-3">
                <Form.Label>Descrição *</Form.Label>
                <Form.Control
                  type="text"
                  name="descricao"
                  value={formData.descricao}
                  onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                  required
                  minLength={5}
                  placeholder="Descrição detalhada do lançamento..."
                />
              </Form.Group>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Valor *</Form.Label>
                    <Form.Control
                      type="number"
                      name="valor"
                      value={formData.valor}
                      onChange={(e) => setFormData(prev => ({ ...prev, valor: parseFloat(e.target.value) || 0 }))}
                      required
                      min="0"
                      step="0.01"
                      placeholder="0,00"
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Data de Vencimento *</Form.Label>
                    <Form.Control
                      type="date"
                      name="data_vencimento"
                      value={formData.data_vencimento}
                      onChange={(e) => setFormData(prev => ({ ...prev, data_vencimento: e.target.value }))}
                      required
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Form.Group className="mb-3">
                <Form.Label>Observações</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  name="observacoes"
                  value={formData.observacoes}
                  onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                  placeholder="Observações adicionais..."
                />
              </Form.Group>

              <div className="d-flex gap-3">
                <Form.Check
                  type="checkbox"
                  label="Lançamento recorrente"
                  checked={formData.recorrente}
                  onChange={(e) => setFormData(prev => ({ ...prev, recorrente: e.target.checked }))}
                />
                {formData.recorrente && (
                  <Form.Select
                    value={formData.periodicidade}
                    onChange={(e) => setFormData(prev => ({ ...prev, periodicidade: e.target.value }))}
                    style={{ width: 'auto' }}
                  >
                    <option value="">Selecione...</option>
                    <option value="mensal">Mensal</option>
                    <option value="bimestral">Bimestral</option>
                    <option value="trimestral">Trimestral</option>
                    <option value="semestral">Semestral</option>
                    <option value="anual">Anual</option>
                  </Form.Select>
                )}
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={handleCloseModal}>
                Cancelar
              </Button>
              <Button 
                variant="primary" 
                type="submit"
                disabled={loading}
              >
                {loading ? 'Salvando...' : (editingItem ? 'Atualizar' : 'Criar')}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>

        {/* Modal de Configurações */}
        <Modal show={showConfigModal} onHide={() => setShowConfigModal(false)} size="lg">
          <Modal.Header closeButton>
            <Modal.Title>⚙️ Configurações Financeiras</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Alert variant="info">
              <h6>🔧 Configurações Avançadas</h6>
              <p className="mb-0">
                Painel de configurações para integração bancária, gateways de pagamento, 
                relatórios personalizados e automações financeiras.
              </p>
              <hr />
              <ul className="mb-0">
                <li>🏦 Configuração de contas bancárias</li>
                <li>💳 Gateways de pagamento (PIX, Boleto, Cartão)</li>
                <li>📊 Relatórios contábeis personalizados</li>
                <li>🤖 Automações e notificações</li>
                <li>📈 Centros de custo e orçamentos</li>
              </ul>
            </Alert>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowConfigModal(false)}>
              Fechar
            </Button>
          </Modal.Footer>
        </Modal>
      </Container>
    </>
  )
}