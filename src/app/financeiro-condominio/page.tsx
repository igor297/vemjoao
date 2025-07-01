'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Container, Row, Col, Card, Button, Form, Modal, Alert, Spinner, Dropdown } from 'react-bootstrap'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { safeJsonParse } from '@/lib/api-utils'

// Categorias predefinidas para condomínio
const CATEGORIAS_CONDOMINIO = {
  receitas: [
    { value: 'juros_atraso', label: '💰 Juros de Atraso' },
    { value: 'taxa_extra', label: '📋 Taxa Extra/Especial' },
    { value: 'renda_salao', label: '🎉 Aluguel Salão de Festas' },
    { value: 'renda_garagem', label: '🚗 Aluguel de Garagem' },
    { value: 'vendas_diversas', label: '💵 Vendas Diversas' },
    { value: 'receita_bancaria', label: '🏦 Rendimento Bancário' },
    { value: 'doacao', label: '🎁 Doações' },
    { value: 'outras_receitas', label: '📈 Outras Receitas' }
  ],
  despesas: [
    { value: 'limpeza', label: '🧹 Limpeza e Conservação' },
    { value: 'seguranca', label: '🛡️ Segurança' },
    { value: 'manutencao_elevador', label: '🛗 Manutenção Elevador' },
    { value: 'manutencao_geral', label: '🔧 Manutenção Geral' },
    { value: 'jardinagem', label: '🌱 Jardinagem' },
    { value: 'agua_esgoto', label: '💧 Água e Esgoto' },
    { value: 'energia_eletrica', label: '⚡ Energia Elétrica' },
    { value: 'gas', label: '🔥 Gás' },
    { value: 'telefone_internet', label: '📞 Telefone/Internet' },
    { value: 'seguro_predial', label: '🏠 Seguro Predial' },
    { value: 'administracao', label: '👔 Administração' },
    { value: 'contabilidade', label: '📊 Contabilidade' },
    { value: 'juridico', label: '⚖️ Jurídico' },
    { value: 'portaria', label: '🚪 Portaria' },
    { value: 'material_limpeza', label: '🧴 Material de Limpeza' },
    { value: 'material_escritorio', label: '📎 Material de Escritório' },
    { value: 'obras_reformas', label: '🏗️ Obras e Reformas' },
    { value: 'impostos_taxas', label: '📄 Impostos e Taxas' },
    { value: 'outras_despesas', label: '📉 Outras Despesas' }
  ]
}

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
  observacoes?: string
  recorrente?: boolean
  periodicidade?: string
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
  const [selectedCondominium, setSelectedCondominium] = useState<Condominium | null>(null)
  const [loading, setLoading] = useState(false)
  const [alert, setAlert] = useState<{type: string, message: string} | null>(null)

  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<FinanceiroCondominio | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<FinanceiroCondominio | null>(null)

  const [formData, setFormData] = useState<Partial<FinanceiroCondominio & {valor: string | number}>>({
    tipo: 'despesa',
    categoria: '',
    descricao: '',
    valor: '',
    data_vencimento: format(new Date(), 'yyyy-MM-dd'),
    data_pagamento: '',
    status: 'pendente',
    origem_nome: '',
    origem_cpf: '',
    origem_cargo: '',
    bloco: '',
    apartamento: '',
    unidade: '',
    observacoes: '',
    recorrente: false,
    periodicidade: '',
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
        // Carregar lista de condomínios
        loadCondominiums(user.id)
        
        // Verificar condomínio ativo
        const activeCondominio = localStorage.getItem('activeCondominio')
        if (activeCondominio) {
          console.log('🏢 Condomínio ativo encontrado:', activeCondominio)
          setSelectedCondominiumId(activeCondominio)
          fetchCondominiumCompleto(activeCondominio)
        } else {
          console.log('🏢 Nenhum condomínio ativo encontrado')
        }
      } else if (user.condominio_id) {
        setSelectedCondominiumId(user.condominio_id)
        fetchCondominiumCompleto(user.condominio_id)
      }
    } else {
      router.push('/login')
    }

    // Listener para mudanças no condomínio ativo
    const handleStorageChange = () => {
      const userData = localStorage.getItem('userData')
      if (userData) {
        const user = JSON.parse(userData)
        if (user.tipo === 'master') {
          const activeCondominio = localStorage.getItem('activeCondominio')
          if (activeCondominio && activeCondominio !== selectedCondominiumId) {
            console.log('🏢 Condomínio ativo mudou para:', activeCondominio)
            setSelectedCondominiumId(activeCondominio)
            fetchCondominiumCompleto(activeCondominio)
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
  }, [router])

  useEffect(() => {
    if (selectedCondominiumId && currentUser) {
      fetchFinanceiroData()
      fetchDashboardData()
    }
  }, [selectedCondominiumId, currentUser, filtros])

  // UseEffect para verificar condomínio ativo periodicamente
  useEffect(() => {
    if (currentUser?.tipo === 'master') {
      const interval = setInterval(() => {
        const activeCondominio = localStorage.getItem('activeCondominio')
        if (activeCondominio && activeCondominio !== selectedCondominiumId) {
          console.log('🏢 Atualizando condomínio ativo:', activeCondominio)
          setSelectedCondominiumId(activeCondominio)
          fetchCondominiumCompleto(activeCondominio)
        }
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [currentUser, selectedCondominiumId])

  const loadCondominiums = async (masterId: string) => {
    try {
      const response = await fetch(`/api/condominios?master_id=${encodeURIComponent(masterId)}`)
      const result = await safeJsonParse(response)
      if (result.success && result.data?.success) {
        setCondominiums(result.data.condominios)
      } else {
        console.error('Erro ao carregar condomínios:', result.error)
      }
    } catch (error) {
      console.error('Erro ao carregar condomínios:', error)
    }
  }

  const fetchCondominiumCompleto = async (condominiumId: string) => {
    try {
      console.log('🏢 Buscando configurações do condomínio:', condominiumId)
      const response = await fetch(`/api/condominios?id=${condominiumId}`)
      const result = await safeJsonParse(response)
      
      if (result.success && result.data?.success && result.data.condominio) {
        console.log('✅ Configurações do condomínio carregadas:', result.data.condominio.nome)
        setSelectedCondominium(result.data.condominio)
        return result.data.condominio
      } else {
        console.log('❌ Erro ao carregar configurações do condomínio:', result.error)
      }
    } catch (error) {
      console.error('❌ Erro ao carregar configurações do condomínio:', error)
    }
    return null
  }

  const fetchFinanceiroData = async () => {
    setLoading(true)
    setAlert(null)
    try {
      const params = new URLSearchParams({
        condominio_id: selectedCondominiumId,
        master_id: currentUser.master_id || currentUser.id,
        tipo_usuario: currentUser.tipo,
        ...(filtros.tipo && { tipo: filtros.tipo }),
        ...(filtros.status && { status: filtros.status }),
        ...(filtros.categoria && { categoria: filtros.categoria }),
        ...(filtros.dataInicio && { dataInicio: filtros.dataInicio }),
        ...(filtros.dataFim && { dataFim: filtros.dataFim }),
        ...(filtros.busca && { busca: filtros.busca })
      })

      const response = await fetch(`/api/financeiro-condominio?${params}`)
      const result = await safeJsonParse(response)
      if (result.success && result.data?.success) {
        setFinanceiro(result.data.lancamentos || [])
      } else if (result.success && result.data?.lancamentos) {
        setFinanceiro(result.data.lancamentos)
      } else {
        setAlert({ type: 'danger', message: result.error || result.data?.error || 'Erro ao carregar dados financeiros.' })
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
      const params = new URLSearchParams({
        condominio_id: selectedCondominiumId,
        master_id: currentUser.master_id || currentUser.id,
        tipo_usuario: currentUser.tipo,
        relatorio: 'resumo'
      })

      const response = await fetch(`/api/financeiro-condominio?${params}`)
      const result = await safeJsonParse(response)
      if (result.success && result.data?.resumo) {
        // Criar estrutura de dashboard a partir dos dados de resumo
        const resumo = result.data.resumo
        setDashboardData({
          totalReceitas: resumo.total_receitas || 0,
          totalDespesas: resumo.total_despesas || 0,
          saldo: (resumo.total_receitas || 0) - (resumo.total_despesas || 0),
          receitasPorCategoria: resumo.receitas_por_categoria || [],
          despesasPorCategoria: resumo.despesas_por_categoria || [],
          lancamentosRecentes: resumo.lancamentos_recentes || []
        })
      } else {
        console.log('Dados de dashboard não disponíveis, usando valores padrão')
        setDashboardData({
          totalReceitas: 0,
          totalDespesas: 0,
          saldo: 0,
          receitasPorCategoria: [],
          despesasPorCategoria: [],
          lancamentosRecentes: []
        })
      }
    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error)
      setDashboardData({
        totalReceitas: 0,
        totalDespesas: 0,
        saldo: 0,
        receitasPorCategoria: [],
        despesasPorCategoria: [],
        lancamentosRecentes: []
      })
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    
    if (name === 'valor') {
      const formattedValue = formatCurrencyInput(value)
      setFormData(prev => ({
        ...prev,
        [name]: formattedValue
      }))
    } else if (name === 'origem_cpf') {
      const formattedCPF = formatCPF(value)
      setFormData(prev => ({
        ...prev,
        [name]: formattedCPF
      }))
    } else if (name === 'categoria') {
      // Determinar o tipo automaticamente baseado na categoria
      const isReceita = CATEGORIAS_CONDOMINIO.receitas.some(cat => cat.value === value)
      const isDespesa = CATEGORIAS_CONDOMINIO.despesas.some(cat => cat.value === value)
      
      let tipo: 'receita' | 'despesa' | 'transferencia' = 'despesa' // padrão
      if (isReceita) tipo = 'receita'
      else if (isDespesa) tipo = 'despesa'
      
      setFormData(prev => ({
        ...prev,
        [name]: value,
        tipo: tipo
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }))
    }
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
        valor: formatCurrencyForEdit(item.valor_total || item.valor),
        data_vencimento: item.data_vencimento
          ? format(new Date(item.data_vencimento.includes('T') ? item.data_vencimento : item.data_vencimento + 'T12:00:00'), 'yyyy-MM-dd')
          : '',
        data_pagamento: item.data_pagamento
          ? format(new Date(item.data_pagamento.includes('T') ? item.data_pagamento : item.data_pagamento + 'T12:00:00'), 'yyyy-MM-dd')
          : '',
        status: item.status,
        origem_nome: item.origem_nome || '',
        origem_cpf: item.origem_cpf || '',
        origem_cargo: item.origem_cargo || '',
        bloco: item.bloco || '',
        apartamento: item.apartamento || '',
        unidade: item.unidade || '',
        observacoes: item.observacoes || '',
        recorrente: item.recorrente || false,
        periodicidade: item.periodicidade || '',
      })
    } else {
      setEditingItem(null)
      setFormData({
        tipo: 'despesa',
        categoria: '',
        descricao: '',
        valor: '',
        data_vencimento: format(new Date(), 'yyyy-MM-dd'),
        data_pagamento: '',
        status: 'pendente',
        origem_nome: '',
        origem_cpf: '',
        origem_cargo: '',
        bloco: '',
        apartamento: '',
        unidade: '',
        observacoes: '',
        recorrente: false,
        periodicidade: '',
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
      valor: '',
      data_vencimento: format(new Date(), 'yyyy-MM-dd'),
      data_pagamento: '',
      status: 'pendente',
      origem_nome: '',
      origem_cpf: '',
      origem_cargo: '',
      bloco: '',
      apartamento: '',
      unidade: '',
      observacoes: '',
      recorrente: false,
      periodicidade: '',
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
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          valor: typeof formData.valor === 'string' ? 
            parseFloat(formData.valor.replace(/\./g, '').replace(',', '.')) : 
            formData.valor,
          periodicidade: formData.recorrente && formData.periodicidade ? formData.periodicidade : null,
          condominio_id: selectedCondominiumId,
          master_id: currentUser.master_id || currentUser.id,
          usuario_id: currentUser.id,
          tipo_usuario: currentUser.tipo,
          criado_por_nome: currentUser.nome || currentUser.email,
        })
      })

      const result = await safeJsonParse(response)
      if (result.success) {
        setAlert({ type: 'success', message: `Lançamento ${editingItem ? 'atualizado' : 'adicionado'} com sucesso!` })
        handleCloseModal()
        fetchFinanceiroData()
        fetchDashboardData()
      } else {
        setAlert({ type: 'danger', message: result.error || `Erro ao ${editingItem ? 'atualizar' : 'adicionar'} lançamento.` })
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
      const response = await fetch(`/api/financeiro-condominio?id=${itemToDelete._id}&tipo_usuario=${currentUser?.tipo}`, {
        method: 'DELETE'
      })

      const result = await safeJsonParse(response)
      if (result.success) {
        setAlert({ type: 'success', message: 'Lançamento excluído com sucesso!' })
        fetchFinanceiroData()
        fetchDashboardData()
      } else {
        setAlert({ type: 'danger', message: result.error || 'Erro ao excluir lançamento.' })
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

  const formatCurrencyInput = (value: string) => {
    let cleanValue = value.replace(/\D/g, '')
    if (cleanValue.length > 10) {
      cleanValue = cleanValue.substring(0, 10)
    }
    if (cleanValue === '') return ''
    const numericValue = parseInt(cleanValue) / 100
    return numericValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }

  const formatCurrencyForEdit = (value: number) => {
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }

  const formatCPF = (value: string) => {
    const cleanValue = value.replace(/\D/g, '')
    if (cleanValue.length <= 11) {
      return cleanValue.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    }
    return cleanValue.substring(0, 11).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }

  const getCategoriaLabel = (categoria: string, tipo?: string) => {
    // Se tipo não for fornecido, procurar em ambas as listas
    if (!tipo) {
      const receitaCat = CATEGORIAS_CONDOMINIO.receitas.find(c => c.value === categoria)
      if (receitaCat) return receitaCat.label
      
      const despesaCat = CATEGORIAS_CONDOMINIO.despesas.find(c => c.value === categoria)
      if (despesaCat) return despesaCat.label
      
      return categoria
    }
    
    const categorias = tipo === 'receita' ? CATEGORIAS_CONDOMINIO.receitas : CATEGORIAS_CONDOMINIO.despesas
    const cat = categorias.find(c => c.value === categoria)
    return cat ? cat.label : categoria
  }

  const handleCondominiumChange = async (condominioId: string) => {
    setSelectedCondominiumId(condominioId)
    
    if (condominioId && currentUser) {
      await fetchCondominiumCompleto(condominioId)
    } else {
      setSelectedCondominium(null)
    }
  }

  if (!currentUser) {
    return (
      <Container className="d-flex justify-content-center align-items-center min-vh-100">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Carregando...</span>
        </Spinner>
        <p className="ms-3">Carregando informações do usuário...</p>
      </Container>
    )
  }

  return (
    <Container className="mt-4">
      <h1 className="mb-4">💰 Financeiro do Condomínio</h1>

      {alert && <Alert variant={alert.type}>{alert.message}</Alert>}

      {currentUser?.tipo === 'master' && (
        <Row className="mb-4">
          <Col>
            <Card>
              <Card.Header className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">🏢 Seleção de Condomínio</h5>
              </Card.Header>
              <Card.Body>
                <Row>
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
                      <Form.Text className="text-muted">
                        {localStorage.getItem('activeCondominio') && localStorage.getItem('activeCondominio') === selectedCondominiumId ? (
                          <span className="text-success">
                            ✅ Condomínio ativo selecionado automaticamente
                          </span>
                        ) : (
                          "Selecione o condomínio para visualizar os dados financeiros"
                        )}
                      </Form.Text>
                    </Form.Group>
                  </Col>
                  <Col md={6} className="d-flex align-items-end">
                    <div className="w-100">
                      <small className="text-muted">
                        <strong>Condomínios disponíveis:</strong> {condominiums.length}
                      </small>
                      {localStorage.getItem('activeCondominio') && (
                        <div className="mt-1">
                          <small className="text-success">
                            🏢 <strong>Condomínio Ativo:</strong> {localStorage.getItem('activeCondominiumName') || selectedCondominium?.nome || 'Carregando...'}
                          </small>
                        </div>
                      )}
                    </div>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {currentUser?.tipo === 'master' && !selectedCondominiumId ? (
        <Alert variant="info" className="text-center">
          <h5>👆 Selecione um condomínio acima</h5>
          <p className="mb-0">Escolha o condomínio para visualizar os dados financeiros</p>
        </Alert>
      ) : selectedCondominiumId ? (
        <>
          {selectedCondominium && (
            <Row className="mb-3">
              <Col>
                <Alert variant="success" className="mb-0">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <strong>🏢 Condomínio Selecionado:</strong> {selectedCondominium.nome}
                    </div>
                    <small className="text-muted">
                      ID: {selectedCondominiumId}
                    </small>
                  </div>
                </Alert>
              </Col>
            </Row>
          )}
        </>
      ) : null}

      {selectedCondominiumId && (
        <>
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
                      <td>{getCategoriaLabel(item.categoria, item.tipo)}</td>
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
                        <div className="d-flex gap-1">
                          <Button variant="warning" size="sm" onClick={() => handleShowModal(item)} title="Editar">
                            ✏️
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => handleDeleteConfirm(item)} title="Excluir">
                            🗑️
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Modal de Adição/Edição Melhorado */}
      <Modal show={showModal} onHide={handleCloseModal} size="xl" backdrop="static">
        <Modal.Header closeButton className="bg-primary text-white">
          <Modal.Title className="d-flex align-items-center">
            <i className="fas fa-plus-circle me-2"></i>
            {editingItem ? '✏️ Editar Lançamento Financeiro' : '💰 Novo Lançamento Financeiro'}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body className="p-4">
            {/* Informações do Condomínio */}
            {selectedCondominium && (
              <Alert variant="info" className="mb-4">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="mb-1">🏢 <strong>Condomínio:</strong> {selectedCondominium.nome}</h6>
                    <small className="text-muted">Criando lançamento para este condomínio</small>
                  </div>
                  <div className="text-end">
                    <small className="text-muted">ID: {selectedCondominiumId}</small>
                  </div>
                </div>
              </Alert>
            )}

            {/* Seção 1: Informações Básicas */}
            <Card className="mb-4">
              <Card.Header className="bg-light">
                <h6 className="mb-0">📋 Informações Básicas</h6>
              </Card.Header>
              <Card.Body>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="fw-bold">Categoria *</Form.Label>
                      <Form.Select 
                        name="categoria" 
                        value={formData.categoria || ''} 
                        onChange={handleInputChange} 
                        required
                        className="form-select-lg"
                      >
                        <option value="">Selecione uma categoria</option>
                        {[...CATEGORIAS_CONDOMINIO.receitas, ...CATEGORIAS_CONDOMINIO.despesas].map((cat) => (
                          <option key={cat.value} value={cat.value}>
                            {cat.label}
                          </option>
                        ))}
                      </Form.Select>
                      <Form.Text className="text-muted">
                        Escolha a categoria que melhor descreve este lançamento
                      </Form.Text>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="fw-bold">Status *</Form.Label>
                      <Form.Select 
                        name="status" 
                        value={formData.status || 'pendente'} 
                        onChange={handleInputChange} 
                        required
                        className="form-select-lg"
                      >
                        <option value="pendente">⏳ Pendente</option>
                        <option value="pago">✅ Pago</option>
                        <option value="atrasado">⚠️ Atrasado</option>
                        <option value="cancelado">❌ Cancelado</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>
                
                <Row>
                  <Col md={12}>
                    <Form.Group className="mb-3">
                      <Form.Label className="fw-bold">Descrição *</Form.Label>
                      <Form.Control 
                        as="textarea" 
                        rows={3}
                        name="descricao" 
                        value={formData.descricao || ''} 
                        onChange={handleInputChange} 
                        required 
                        placeholder="Descreva detalhadamente este lançamento financeiro..."
                        maxLength={500}
                      />
                      <Form.Text className="text-muted">
                        {formData.descricao?.length || 0}/500 caracteres
                      </Form.Text>
                    </Form.Group>
                  </Col>
                </Row>
              </Card.Body>
            </Card>

            {/* Seção 2: Valores e Datas */}
            <Card className="mb-4">
              <Card.Header className="bg-light">
                <h6 className="mb-0">💰 Valores e Datas</h6>
              </Card.Header>
              <Card.Body>
                <Row>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label className="fw-bold">Valor *</Form.Label>
                      <div className="input-group input-group-lg">
                        <span className="input-group-text">R$</span>
                        <Form.Control 
                          type="text" 
                          name="valor" 
                          value={formData.valor || ''} 
                          onChange={handleInputChange} 
                          required 
                          placeholder="0,00"
                          className="text-end"
                        />
                      </div>
                      <Form.Text className="text-muted">
                        Digite apenas números. A formatação será aplicada automaticamente.
                      </Form.Text>
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label className="fw-bold">Data de Vencimento *</Form.Label>
                      <Form.Control 
                        type="date" 
                        name="data_vencimento" 
                        value={formData.data_vencimento || ''} 
                        onChange={handleInputChange} 
                        required 
                        className="form-control-lg"
                      />
                      <Form.Text className="text-muted">
                        Data limite para pagamento
                      </Form.Text>
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label className="fw-bold">Data de Pagamento</Form.Label>
                      <Form.Control 
                        type="date" 
                        name="data_pagamento" 
                        value={formData.data_pagamento || ''} 
                        onChange={handleInputChange} 
                        className="form-control-lg"
                      />
                      <Form.Text className="text-muted">
                        Data em que foi realizado o pagamento (opcional)
                      </Form.Text>
                    </Form.Group>
                  </Col>
                </Row>
              </Card.Body>
            </Card>


            {/* Seção 3: Informações Adicionais */}
            <Card className="mb-4">
              <Card.Header className="bg-light">
                <h6 className="mb-0">📝 Informações Adicionais</h6>
              </Card.Header>
              <Card.Body>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Check
                        type="checkbox"
                        id="recorrente"
                        label="🔄 Lançamento Recorrente"
                        checked={formData.recorrente || false}
                        onChange={(e) => setFormData(prev => ({...prev, recorrente: e.target.checked}))}
                      />
                      <Form.Text className="text-muted">
                        Marque se este lançamento se repete mensalmente
                      </Form.Text>
                    </Form.Group>
                  </Col>
                  {formData.recorrente && (
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Periodicidade</Form.Label>
                        <Form.Select 
                          name="periodicidade" 
                          value={formData.periodicidade || ''} 
                          onChange={handleInputChange}
                          required={formData.recorrente}
                        >
                          <option value="">Selecione</option>
                          <option value="mensal">📅 Mensal</option>
                          <option value="bimestral">📅 Bimestral</option>
                          <option value="trimestral">📅 Trimestral</option>
                          <option value="semestral">📅 Semestral</option>
                          <option value="anual">📅 Anual</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                  )}
                </Row>
                <Row>
                  <Col md={12}>
                    <Form.Group className="mb-3">
                      <Form.Label>Observações</Form.Label>
                      <Form.Control 
                        as="textarea" 
                        rows={3}
                        name="observacoes" 
                        value={formData.observacoes || ''} 
                        onChange={handleInputChange} 
                        placeholder="Observações adicionais sobre este lançamento..."
                        maxLength={500}
                      />
                      <Form.Text className="text-muted">
                        {formData.observacoes?.length || 0}/500 caracteres
                      </Form.Text>
                    </Form.Group>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Modal.Body>
          <Modal.Footer className="bg-light">
            <div className="d-flex justify-content-between w-100 align-items-center">
              <div>
                <small className="text-muted">
                  * Campos obrigatórios
                </small>
              </div>
              <div>
                <Button variant="outline-secondary" onClick={handleCloseModal} className="me-3">
                  <i className="fas fa-times me-2"></i>
                  Cancelar
                </Button>
                <Button variant="primary" type="submit" disabled={loading} size="lg">
                  {loading ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <i className={`fas ${editingItem ? 'fa-save' : 'fa-plus'} me-2`}></i>
                      {editingItem ? 'Salvar Alterações' : 'Criar Lançamento'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Modal.Footer>
        </Form>
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
        </>
      )}
    </Container>
  )
}
