'use client'

import React, { useState, useEffect } from 'react'
import { Container, Row, Col, Card, Button, Modal, Form, Alert, Badge, Table, Dropdown } from 'react-bootstrap'
import Header from '@/components/Header'
import { Line, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
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
  Title,
  Tooltip,
  Legend,
  ArcElement
)

interface FinanceiroCondominio {
  _id: string
  tipo: 'receita' | 'despesa' | 'transferencia'
  categoria: string
  descricao: string
  valor: number
  data_vencimento: string
  data_pagamento?: string
  status: 'pendente' | 'pago' | 'atrasado' | 'cancelado'
  observacoes?: string
  recorrente: boolean
  periodicidade?: string
  criado_por_nome: string
  data_criacao: string
  origem_sistema?: string
  origem_nome?: string
  origem_identificacao?: string
  bloco?: string
  apartamento?: string
  unidade?: string
  // Dados adicionais para identificação da unidade
  morador_cpf?: string
  morador_tipo?: string
}

interface DashboardData {
  resumo: {
    total_receitas: number
    total_despesas: number
    resultado_liquido: number
    total_pendentes: number
    total_atrasados: number
    count_pendentes: number
    count_atrasados: number
  }
  categorias: any[]
  fluxo_mensal: any[]
}

const CATEGORIAS_CONDOMINIO = [
  { value: 'taxa_condominio', label: '🏠 Taxa de Condomínio', tipo: 'receita' },
  { value: 'fundo_reserva', label: '💰 Fundo de Reserva', tipo: 'receita' },
  { value: 'taxa_obras', label: '🏗️ Taxa para Obras', tipo: 'receita' },
  
  { value: 'administracao', label: '📋 Administração', tipo: 'despesa' },
  { value: 'limpeza', label: '🧹 Limpeza', tipo: 'despesa' },
  { value: 'seguranca', label: '🛡️ Segurança', tipo: 'despesa' },
  { value: 'manutencao', label: '🔧 Manutenção', tipo: 'despesa' },
  { value: 'jardinagem', label: '🌱 Jardinagem', tipo: 'despesa' },
  
  { value: 'agua', label: '💧 Água', tipo: 'despesa' },
  { value: 'energia', label: '⚡ Energia', tipo: 'despesa' },
  { value: 'gas', label: '🔥 Gás', tipo: 'despesa' },
  { value: 'internet', label: '🌐 Internet/TV', tipo: 'despesa' },
  { value: 'elevador', label: '🛗 Elevador', tipo: 'despesa' },
  
  { value: 'seguros', label: '🛡️ Seguros', tipo: 'despesa' },
  { value: 'juridico', label: '⚖️ Jurídico', tipo: 'despesa' },
  { value: 'contabilidade', label: '📊 Contabilidade', tipo: 'despesa' },
  
  { value: 'obras', label: '🏗️ Obras e Reformas', tipo: 'despesa' },
  { value: 'equipamentos', label: '🔧 Equipamentos', tipo: 'despesa' },
  { value: 'emergencia', label: '🚨 Emergência', tipo: 'despesa' },
  { value: 'outros', label: '📦 Outros', tipo: 'ambos' }
]

interface Condominio {
  _id: string
  nome: string
}

export default function FinanceiroCondominioPage() {
  const [financeiro, setFinanceiro] = useState<FinanceiroCondominio[]>([])
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [condominios, setCondominios] = useState<Condominio[]>([])
  
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [selectedCondominiumId, setSelectedCondominiumId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [alert, setAlert] = useState<{type: string, message: string} | null>(null)
  
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<FinanceiroCondominio | null>(null)
  
  const [formData, setFormData] = useState({
    tipo: 'despesa' as 'receita' | 'despesa' | 'transferencia',
    categoria: '',
    descricao: '',
    valor: '',
    data_vencimento: '',
    observacoes: '',
    recorrente: false,
    periodicidade: '',
    status: 'pendente' as 'pendente' | 'pago' | 'atrasado' | 'cancelado',
    data_pagamento: ''
  })

  const [filtros, setFiltros] = useState({
    categoria: '',
    status: '',
    data_inicio: '',
    data_fim: '',
    tipo: ''
  })

  useEffect(() => {
    const userData = localStorage.getItem('userData')
    
    if (userData) {
      try {
        const user = JSON.parse(userData)
        setCurrentUser(user)
        
        if (user.tipo === 'master') {
          fetchCondominios(user.id)
          // Verificar condomínio ativo
          const activeCondominioId = localStorage.getItem('activeCondominio')
          if (activeCondominioId) {
            setSelectedCondominiumId(activeCondominioId)
            loadDashboard(user, activeCondominioId)
            loadFinanceiro(user, activeCondominioId)
          }
        } else {
          // Para não-masters, usar condomínio do usuário
          if (user.condominio_id) {
            setSelectedCondominiumId(user.condominio_id)
            loadDashboard(user, user.condominio_id)
            loadFinanceiro(user, user.condominio_id)
          }
        }
      } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error)
      }
    }

    // Listener para mudanças no condomínio ativo
    const handleStorageChange = () => {
      const userData = localStorage.getItem('userData')
      if (userData) {
        const user = JSON.parse(userData)
        if (user.tipo === 'master') {
          const activeCondominioId = localStorage.getItem('activeCondominio')
          if (activeCondominioId && activeCondominioId !== selectedCondominiumId) {
            setSelectedCondominiumId(activeCondominioId)
            loadDashboard(user, activeCondominioId)
            loadFinanceiro(user, activeCondominioId)
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
  }, [])

  // UseEffect para verificar condomínio ativo periodicamente
  useEffect(() => {
    if (currentUser?.tipo === 'master') {
      const interval = setInterval(() => {
        const activeCondominio = localStorage.getItem('activeCondominio')
        if (activeCondominio && activeCondominio !== selectedCondominiumId) {
          console.log('Atualizando condomínio ativo:', activeCondominio)
          setSelectedCondominiumId(activeCondominio)
          loadDashboard(currentUser, activeCondominio)
          loadFinanceiro(currentUser, activeCondominio)
        }
      }, 1000) // Verifica a cada segundo

      return () => clearInterval(interval)
    }
  }, [currentUser, selectedCondominiumId])

  const showAlert = (type: string, message: string) => {
    setAlert({ type, message })
    setTimeout(() => setAlert(null), 5000)
  }

  const fetchCondominios = async (masterId: string) => {
    try {
      const response = await fetch(`/api/condominios?master_id=${masterId}`)
      const data = await response.json()
      
      if (data.success) {
        setCondominios(data.condominios)
      }
    } catch (error) {
      console.error('Erro ao carregar condomínios:', error)
    }
  }

  const loadDashboard = async (user: any, condominioId: string) => {
    try {
      const response = await fetch(
        `/api/financeiro-condominio?master_id=${user.master_id || user.id}&condominio_id=${condominioId}&tipo_usuario=${user.tipo}&relatorio=resumo`
      )
      const data = await response.json()
      
      if (data.success) {
        // Definir estrutura padrão para dashboard
        const defaultDashboard = {
          resumo: data.resumo || {
            total_receitas: 0,
            total_despesas: 0,
            resultado_liquido: 0,
            total_pendentes: 0,
            total_atrasados: 0,
            count_pendentes: 0,
            count_atrasados: 0
          },
          categorias: [],
          fluxo_mensal: []
        }

        // Tentar carregar dados adicionais
        try {
          const [categoriasResponse, fluxoResponse] = await Promise.all([
            fetch(`/api/financeiro-condominio?master_id=${user.master_id || user.id}&condominio_id=${condominioId}&tipo_usuario=${user.tipo}&relatorio=por_categoria`),
            fetch(`/api/financeiro-condominio?master_id=${user.master_id || user.id}&condominio_id=${condominioId}&tipo_usuario=${user.tipo}&relatorio=fluxo_mensal`)
          ])

          const categoriasData = await categoriasResponse.json()
          const fluxoData = await fluxoResponse.json()

          defaultDashboard.categorias = categoriasData.success ? (categoriasData.categorias || []) : []
          defaultDashboard.fluxo_mensal = fluxoData.success ? (fluxoData.fluxo_mensal || []) : []
        } catch (error) {
          console.error('Erro ao carregar dados adicionais:', error)
        }

        setDashboardData(defaultDashboard)
      } else {
        // Definir dashboard vazio se não houver dados
        setDashboardData({
          resumo: {
            total_receitas: 0,
            total_despesas: 0,
            resultado_liquido: 0,
            total_pendentes: 0,
            total_atrasados: 0,
            count_pendentes: 0,
            count_atrasados: 0
          },
          categorias: [],
          fluxo_mensal: []
        })
      }
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error)
      // Definir dashboard vazio em caso de erro
      setDashboardData({
        resumo: {
          total_receitas: 0,
          total_despesas: 0,
          resultado_liquido: 0,
          total_pendentes: 0,
          total_atrasados: 0,
          count_pendentes: 0,
          count_atrasados: 0
        },
        categorias: [],
        fluxo_mensal: []
      })
    }
  }

  const loadFinanceiro = async (user: any, condominioId: string) => {
    try {
      setLoading(true)
      
      const params = new URLSearchParams({
        master_id: user.master_id || user.id,
        condominio_id: condominioId,
        tipo_usuario: user.tipo,
        ...(filtros.categoria && { categoria: filtros.categoria }),
        ...(filtros.status && { status: filtros.status }),
        ...(filtros.tipo && { tipo: filtros.tipo }),
        ...(filtros.data_inicio && { data_inicio: filtros.data_inicio }),
        ...(filtros.data_fim && { data_fim: filtros.data_fim })
      })

      const response = await fetch(`/api/financeiro-condominio?${params}`)
      const data = await response.json()
      
      if (data.success) {
        setFinanceiro(data.lancamentos)
      } else {
        showAlert('error', data.error || 'Erro ao carregar lançamentos')
      }
    } catch (error) {
      console.error('Erro ao carregar financeiro:', error)
      showAlert('error', 'Erro ao carregar dados financeiros')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: string) => {
    // Remove tudo que não é dígito
    let cleanValue = value.replace(/\D/g, '')
    
    // Limitar a 10 dígitos (máximo R$ 99.999.999,99)
    if (cleanValue.length > 10) {
      cleanValue = cleanValue.substring(0, 10)
    }
    
    // Se vazio, retorna vazio
    if (cleanValue === '') return ''
    
    // Converte para number e divide por 100 para ter centavos
    const numericValue = parseInt(cleanValue) / 100
    
    // Formata como moeda brasileira
    return numericValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const formattedValue = formatCurrency(value)
    setFormData({...formData, valor: formattedValue})
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedCondominiumId) {
      showAlert('error', 'Selecione um condomínio primeiro')
      return
    }
    
    if (!formData.tipo || !formData.categoria || !formData.descricao || !formData.valor || !formData.data_vencimento) {
      showAlert('error', 'Preencha todos os campos obrigatórios')
      return
    }

    if (formData.recorrente && !formData.periodicidade) {
      showAlert('error', 'Selecione a periodicidade para lançamentos recorrentes')
      return
    }

    try {
      // Converter valor formatado para número
      const valorNumerico = parseFloat(formData.valor.replace(/\./g, '').replace(',', '.'))
      
      const dataToSend: any = {
        ...formData,
        master_id: currentUser?.master_id || currentUser?.id,
        condominio_id: selectedCondominiumId, // Herda automaticamente
        tipo_usuario: currentUser?.tipo,
        usuario_id: currentUser?.id,
        criado_por_nome: currentUser?.nome || currentUser?.email,
        valor: valorNumerico,
        // Só enviar periodicidade se for recorrente e tiver valor
        periodicidade: formData.recorrente && formData.periodicidade ? formData.periodicidade : undefined,
        // Incluir status e data_pagamento
        status: formData.status,
        data_pagamento: formData.status === 'pago' && formData.data_pagamento ? formData.data_pagamento : undefined
      }


      const url = '/api/financeiro-condominio'
      const method = editingItem ? 'PUT' : 'POST'
      
      if (editingItem) {
        dataToSend._id = editingItem._id
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend)
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Resposta do servidor não é JSON válido')
      }

      const data = await response.json()
      
      if (data.success) {
        showAlert('success', editingItem ? 'Lançamento atualizado!' : 'Lançamento criado!')
        handleCloseModal()
        loadDashboard(currentUser, selectedCondominiumId)
        loadFinanceiro(currentUser, selectedCondominiumId)
      } else {
        showAlert('error', data.error || 'Erro ao salvar lançamento')
      }
    } catch (error) {
      console.error('Erro ao submeter:', error)
      showAlert('error', 'Erro interno do servidor')
    }
  }

  const handleEdit = (item: FinanceiroCondominio) => {
    setEditingItem(item)
    setFormData({
      tipo: item.tipo,
      categoria: item.categoria,
      descricao: item.descricao,
      valor: item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      data_vencimento: item.data_vencimento.split('T')[0],
      observacoes: item.observacoes || '',
      recorrente: item.recorrente,
      periodicidade: item.periodicidade || '',
      status: item.status,
      data_pagamento: item.data_pagamento ? item.data_pagamento.split('T')[0] : ''
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este lançamento?')) return

    try {
      const response = await fetch(
        `/api/financeiro-condominio?id=${id}&tipo_usuario=${currentUser?.tipo}`,
        { method: 'DELETE' }
      )
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Resposta do servidor não é JSON válido')
      }

      const data = await response.json()
      
      if (data.success) {
        showAlert('success', 'Lançamento excluído!')
        loadDashboard(currentUser, selectedCondominiumId)
        loadFinanceiro(currentUser, selectedCondominiumId)
      } else {
        showAlert('error', data.error || 'Erro ao excluir')
      }
    } catch (error) {
      console.error('Erro ao excluir:', error)
      showAlert('error', 'Erro interno do servidor')
    }
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingItem(null)
    setFormData({
      tipo: 'despesa',
      categoria: '',
      descricao: '',
      valor: '',
      data_vencimento: '',
      observacoes: '',
      recorrente: false,
      periodicidade: '',
      status: 'pendente',
      data_pagamento: ''
    })
  }

  const clearFilters = () => {
    setFiltros({
      categoria: '',
      status: '',
      data_inicio: '',
      data_fim: '',
      tipo: ''
    })
  }

  // UseEffect para aplicar filtros automaticamente quando mudarem
  useEffect(() => {
    if (currentUser && selectedCondominiumId) {
      loadFinanceiro(currentUser, selectedCondominiumId)
    }
  }, [filtros])

  const handleCondominioChange = (condominioId: string) => {
    setSelectedCondominiumId(condominioId)
    if (condominioId && currentUser) {
      loadDashboard(currentUser, condominioId)
      loadFinanceiro(currentUser, condominioId)
    }
  }

  const formatCurrencyDisplay = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      pendente: { bg: 'warning', text: 'Pendente' },
      pago: { bg: 'success', text: 'Pago' },
      atrasado: { bg: 'danger', text: 'Atrasado' },
      cancelado: { bg: 'secondary', text: 'Cancelado' }
    }
    const config = variants[status as keyof typeof variants] || variants.pendente
    return <Badge bg={config.bg}>{config.text}</Badge>
  }

  const getCategoriaLabel = (categoria: string) => {
    const cat = CATEGORIAS_CONDOMINIO.find(c => c.value === categoria)
    return cat ? cat.label : categoria
  }

  // Função para buscar dados de unidade do morador
  const buscarDadosUnidade = async (nomeOrigemMorador: string, condominioId: string) => {
    try {
      const masterId = currentUser?.master_id || currentUser?.id
      const response = await fetch(`/api/moradores?nome=${encodeURIComponent(nomeOrigemMorador)}&condominio_id=${condominioId}&master_id=${masterId}`)
      const data = await response.json()
      
      if (data.success && data.moradores && data.moradores.length > 0) {
        const morador = data.moradores[0]
        return {
          bloco: morador.bloco,
          unidade: morador.unidade,
          tipo: morador.tipo
        }
      }
    } catch (error) {
      console.error('Erro ao buscar dados do morador:', error)
    }
    return null
  }

  // Componente para exibir unidade com fallback para busca dinâmica
  const UnidadeDisplay = ({ item }: { item: FinanceiroCondominio }) => {
    const [dadosUnidade, setDadosUnidade] = useState<{bloco?: string, unidade?: string, tipo?: string} | null>(null)
    const [carregando, setCarregando] = useState(false)

    useEffect(() => {
      if (item.origem_sistema === 'morador' && (!item.bloco && !item.apartamento && !item.unidade) && item.origem_nome) {
        setCarregando(true)
        buscarDadosUnidade(item.origem_nome, selectedCondominiumId).then((dados) => {
          setDadosUnidade(dados)
          setCarregando(false)
        })
      }
    }, [item, selectedCondominiumId])

    if (item.origem_sistema === 'morador') {
      const bloco = item.bloco || dadosUnidade?.bloco
      const apartamento = item.apartamento || item.unidade || dadosUnidade?.unidade
      
      if (carregando) {
        return (
          <div>
            <div className="fw-bold text-primary">
              🏠 <span className="placeholder-glow"><span className="placeholder col-4"></span></span>
            </div>
            <small className="text-muted">Buscando dados...</small>
          </div>
        )
      }

      return (
        <div>
          <div className="fw-bold text-primary">
            🏠 {bloco ? `${bloco} - ` : ''}{apartamento || 'N/A'}
          </div>
          <small className="text-muted">
            {bloco && apartamento ? `Bloco ${bloco}, Apt ${apartamento}` : 
             apartamento ? `Apartamento ${apartamento}` : 
             'Unidade não identificada'}
            {dadosUnidade?.tipo && (
              <span className="ms-2 badge badge-sm bg-secondary">
                {dadosUnidade.tipo}
              </span>
            )}
          </small>
        </div>
      )
    } else if (item.origem_sistema === 'colaborador') {
      return (
        <div>
          <div className="fw-bold text-info">
            💼 {item.departamento || item.cargo || 'Colaborador'}
          </div>
          <small className="text-muted">Setor/Função</small>
        </div>
      )
    } else {
      return (
        <div>
          <div className="fw-bold text-secondary">
            📝 Manual
          </div>
          <small className="text-muted">Lançamento direto</small>
        </div>
      )
    }
  }

  const categoriasDisponiveis = CATEGORIAS_CONDOMINIO.filter(cat => 
    cat.tipo === formData.tipo || cat.tipo === 'ambos'
  )

  // Dados para gráficos
  const fluxoCaixaData = {
    labels: dashboardData?.fluxo_mensal?.map(item => `${item._id.mes}/${item._id.ano}`) || [],
    datasets: [
      {
        label: 'Receitas',
        data: dashboardData?.fluxo_mensal?.map(item => item.receitas) || [],
        borderColor: '#28a745',
        backgroundColor: 'rgba(40, 167, 69, 0.1)',
        tension: 0.4,
        fill: true
      },
      {
        label: 'Despesas',
        data: dashboardData?.fluxo_mensal?.map(item => item.despesas) || [],
        borderColor: '#dc3545',
        backgroundColor: 'rgba(220, 53, 69, 0.1)',
        tension: 0.4,
        fill: true
      }
    ]
  }

  const categoriasData = {
    labels: dashboardData?.categorias?.slice(0, 6).map(cat => getCategoriaLabel(cat._id)) || [],
    datasets: [{
      data: dashboardData?.categorias?.slice(0, 6).map(cat => cat.total_valor) || [],
      backgroundColor: [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
        '#9966FF', '#FF9F40'
      ],
      borderWidth: 2,
      borderColor: '#fff'
    }]
  }

  return (
    <>
      <Header />
      <Container fluid className="mt-4">
        {alert && (
          <Alert variant={alert.type} dismissible onClose={() => setAlert(null)}>
            {alert.message}
          </Alert>
        )}

        <Row className="mb-4">
          <Col>
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <h2 className="mb-1">🏢 Gestão Financeira do Condomínio</h2>
                <p className="text-muted mb-0">Sistema especializado para controle financeiro predial</p>
              </div>
              <Button 
                variant="primary" 
                size="lg"
                onClick={() => setShowModal(true)}
                disabled={!selectedCondominiumId}
              >
                <i className="fas fa-plus me-2"></i>
                Novo Lançamento
              </Button>
            </div>
          </Col>
        </Row>

        {/* Filtro de Condomínio para Masters */}
        {currentUser?.tipo === 'master' && (
          <Row className="mb-4">
            <Col>
              <Card>
                <Card.Body>
                  <Row>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Selecionar Condomínio *</Form.Label>
                        <Form.Select
                          value={selectedCondominiumId}
                          onChange={(e) => handleCondominioChange(e.target.value)}
                        >
                          <option value="">Selecione um condomínio</option>
                          {condominios.map((cond) => (
                            <option key={cond._id} value={cond._id}>
                              {cond.nome}
                            </option>
                          ))}
                        </Form.Select>
                        <Form.Text className="text-muted">
                          {selectedCondominiumId ? (
                            localStorage.getItem('activeCondominio') === selectedCondominiumId ? (
                              <span className="text-success">
                                ✅ Condomínio ativo selecionado automaticamente
                              </span>
                            ) : (
                              <span className="text-info">
                                📋 Condomínio selecionado manualmente
                              </span>
                            )
                          ) : (
                            <span className="text-warning">
                              ⚠️ Selecione um condomínio para ver os dados financeiros
                            </span>
                          )}
                        </Form.Text>
                      </Form.Group>
                    </Col>
                    <Col md={6} className="d-flex align-items-end">
                      <div className="w-100">
                        <small className="text-muted">
                          <strong>Total de lançamentos:</strong> {financeiro.length}
                        </small>
                        {localStorage.getItem('activeCondominio') && (
                          <div className="mt-1">
                            <small className="text-success">
                              🏢 <strong>Condomínio Ativo:</strong> {localStorage.getItem('activeCondominioName') || 'Carregando...'}
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

        {dashboardData && (
          <>
            <Row className="mb-4">
              <Col md={3}>
                <Card className="border-success">
                  <Card.Body className="text-center">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <h6 className="text-success mb-0">Receitas</h6>
                      <i className="fas fa-arrow-up text-success"></i>
                    </div>
                    <h3 className="text-success mb-0">{formatCurrencyDisplay(dashboardData?.resumo?.total_receitas || 0)}</h3>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card className="border-danger">
                  <Card.Body className="text-center">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <h6 className="text-danger mb-0">Despesas</h6>
                      <i className="fas fa-arrow-down text-danger"></i>
                    </div>
                    <h3 className="text-danger mb-0">{formatCurrencyDisplay(dashboardData?.resumo?.total_despesas || 0)}</h3>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card className={(dashboardData?.resumo?.resultado_liquido || 0) >= 0 ? 'border-primary' : 'border-warning'}>
                  <Card.Body className="text-center">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <h6 className="mb-0">Saldo</h6>
                      <i className={`fas ${(dashboardData?.resumo?.resultado_liquido || 0) >= 0 ? 'fa-check-circle text-primary' : 'fa-exclamation-triangle text-warning'}`}></i>
                    </div>
                    <h3 className={(dashboardData?.resumo?.resultado_liquido || 0) >= 0 ? 'text-primary' : 'text-warning'}>
                      {formatCurrencyDisplay(dashboardData?.resumo?.resultado_liquido || 0)}
                    </h3>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card className="border-warning">
                  <Card.Body className="text-center">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <h6 className="text-warning mb-0">Pendentes</h6>
                      <Badge bg="warning">{dashboardData?.resumo?.count_pendentes || 0}</Badge>
                    </div>
                    <h3 className="text-warning mb-0">{formatCurrencyDisplay(dashboardData?.resumo?.total_pendentes || 0)}</h3>
                    {(dashboardData?.resumo?.total_atrasados || 0) > 0 && (
                      <small className="text-danger">
                        <i className="fas fa-exclamation-triangle me-1"></i>
                        {formatCurrencyDisplay(dashboardData?.resumo?.total_atrasados || 0)} em atraso
                      </small>
                    )}
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            <Row className="mb-4">
              <Col md={8}>
                <Card className="h-100">
                  <Card.Header className="bg-light">
                    <h5 className="mb-0">📈 Fluxo de Caixa Mensal</h5>
                  </Card.Header>
                  <Card.Body>
                    {dashboardData?.fluxo_mensal && dashboardData.fluxo_mensal.length > 0 ? (
                      <Line 
                        data={fluxoCaixaData} 
                        options={{
                          responsive: true,
                          interaction: {
                            mode: 'index' as const,
                            intersect: false,
                          },
                          plugins: {
                            legend: {
                              position: 'top' as const,
                            },
                            tooltip: {
                              callbacks: {
                                label: function(context) {
                                  return `${context.dataset.label}: ${formatCurrencyDisplay(context.parsed.y)}`
                                }
                              }
                            }
                          },
                          scales: {
                            y: {
                              beginAtZero: true,
                              ticks: {
                                callback: function(value) {
                                  return formatCurrencyDisplay(Number(value))
                                }
                              }
                            }
                          }
                        }} 
                      />
                    ) : (
                      <div className="text-center text-muted py-5">
                        <i className="fas fa-chart-line fa-3x mb-3"></i>
                        <p>Nenhum dado disponível para o gráfico</p>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </Col>
              <Col md={4}>
                <Card className="h-100">
                  <Card.Header className="bg-light">
                    <h5 className="mb-0">🎯 Principais Categorias</h5>
                  </Card.Header>
                  <Card.Body>
                    {dashboardData?.categorias && dashboardData.categorias.length > 0 ? (
                      <Doughnut 
                        data={categoriasData} 
                        options={{
                          responsive: true,
                          plugins: {
                            legend: {
                              position: 'bottom' as const,
                            },
                            tooltip: {
                              callbacks: {
                                label: function(context) {
                                  return `${context.label}: ${formatCurrencyDisplay(context.parsed)}`
                                }
                              }
                            }
                          }
                        }} 
                      />
                    ) : (
                      <div className="text-center text-muted py-5">
                        <i className="fas fa-chart-pie fa-3x mb-3"></i>
                        <p>Nenhum dado disponível</p>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </>
        )}

        <Row>
          <Col>
            <Card>
              <Card.Header>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h5 className="mb-0">📋 Lançamentos Financeiros</h5>
                  <div className="d-flex gap-2">
                    <Button 
                      variant="outline-secondary" 
                      size="sm"
                      onClick={clearFilters}
                    >
                      <i className="fas fa-times me-1"></i>
                      Limpar Filtros
                    </Button>
                  </div>
                </div>
                
                {/* Filtros */}
                <div className="bg-light p-3 rounded">
                  <Row className="g-2">
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label className="small mb-1">Tipo</Form.Label>
                        <Form.Select 
                          size="sm"
                          value={filtros.tipo}
                          onChange={(e) => setFiltros({...filtros, tipo: e.target.value})}
                        >
                          <option value="">Todos os tipos</option>
                          <option value="receita">📈 Receita</option>
                          <option value="despesa">📉 Despesa</option>
                          <option value="transferencia">🔄 Transferência</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label className="small mb-1">Status</Form.Label>
                        <Form.Select 
                          size="sm"
                          value={filtros.status}
                          onChange={(e) => setFiltros({...filtros, status: e.target.value})}
                        >
                          <option value="">Todos os status</option>
                          <option value="pendente">Pendente</option>
                          <option value="pago">Pago</option>
                          <option value="atrasado">Atrasado</option>
                          <option value="cancelado">Cancelado</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label className="small mb-1">Categoria</Form.Label>
                        <Form.Select 
                          size="sm"
                          value={filtros.categoria}
                          onChange={(e) => setFiltros({...filtros, categoria: e.target.value})}
                        >
                          <option value="">Todas as categorias</option>
                          {CATEGORIAS_CONDOMINIO.map(cat => (
                            <option key={cat.value} value={cat.value}>{cat.label}</option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                    </Col>
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label className="small mb-1">Período</Form.Label>
                        <div className="d-flex flex-column gap-2">
                          <div className="position-relative">
                            <Form.Control
                              type="date"
                              size="sm"
                              value={filtros.data_inicio}
                              onChange={(e) => setFiltros({...filtros, data_inicio: e.target.value})}
                              placeholder="Data início"
                              style={{ paddingRight: filtros.data_inicio ? '35px' : '12px' }}
                            />
                            {filtros.data_inicio && (
                              <button
                                type="button"
                                className="btn btn-sm p-0"
                                onClick={() => setFiltros({...filtros, data_inicio: ''})}
                                title="Limpar data início"
                                style={{
                                  position: 'absolute',
                                  right: '6px',
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  border: 'none',
                                  background: 'transparent',
                                  color: '#6c757d',
                                  width: '20px',
                                  height: '20px',
                                  borderRadius: '3px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = '#f8f9fa'
                                  e.currentTarget.style.color = '#dc3545'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'transparent'
                                  e.currentTarget.style.color = '#6c757d'
                                }}
                              >
                                <i className="fas fa-times" style={{ fontSize: '10px' }}></i>
                              </button>
                            )}
                          </div>
                          <div className="position-relative">
                            <Form.Control
                              type="date"
                              size="sm"
                              value={filtros.data_fim}
                              onChange={(e) => setFiltros({...filtros, data_fim: e.target.value})}
                              placeholder="Data fim"
                              style={{ paddingRight: filtros.data_fim ? '35px' : '12px' }}
                            />
                            {filtros.data_fim && (
                              <button
                                type="button"
                                className="btn btn-sm p-0"
                                onClick={() => setFiltros({...filtros, data_fim: ''})}
                                title="Limpar data fim"
                                style={{
                                  position: 'absolute',
                                  right: '6px',
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  border: 'none',
                                  background: 'transparent',
                                  color: '#6c757d',
                                  width: '20px',
                                  height: '20px',
                                  borderRadius: '3px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = '#f8f9fa'
                                  e.currentTarget.style.color = '#dc3545'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'transparent'
                                  e.currentTarget.style.color = '#6c757d'
                                }}
                              >
                                <i className="fas fa-times" style={{ fontSize: '10px' }}></i>
                              </button>
                            )}
                          </div>
                          <div className="d-flex gap-1 justify-content-center">
                            <Button
                              variant="outline-info"
                              size="sm"
                              type="button"
                              onClick={() => {
                                const hoje = new Date()
                                const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
                                const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
                                setFiltros({
                                  ...filtros, 
                                  data_inicio: inicioMes.toISOString().split('T')[0],
                                  data_fim: fimMes.toISOString().split('T')[0]
                                })
                              }}
                              title="Filtrar por este mês"
                              style={{ 
                                fontSize: '11px',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '6px'
                              }}
                            >
                              <i className="fas fa-calendar-check me-1"></i>
                              Este mês
                            </Button>
                          </div>
                        </div>
                      </Form.Group>
                    </Col>
                  </Row>
                  
                  {/* Indicadores de filtros ativos */}
                  {(filtros.tipo || filtros.status || filtros.categoria || filtros.data_inicio || filtros.data_fim) && (
                    <div className="mt-2">
                      <small className="text-muted">Filtros ativos: </small>
                      {filtros.tipo && <span className="badge bg-primary me-1">Tipo: {filtros.tipo}</span>}
                      {filtros.status && <span className="badge bg-warning me-1">Status: {filtros.status}</span>}
                      {filtros.categoria && (
                        <span className="badge bg-info me-1">
                          Categoria: {getCategoriaLabel(filtros.categoria)}
                        </span>
                      )}
                      {filtros.data_inicio && <span className="badge bg-secondary me-1">De: {filtros.data_inicio}</span>}
                      {filtros.data_fim && <span className="badge bg-secondary me-1">Até: {filtros.data_fim}</span>}
                    </div>
                  )}
                </div>
              </Card.Header>
              <Card.Body>
                <Table responsive hover>
                  <thead>
                    <tr>
                      <th>Nome/CPF</th>
                      <th>Unidade</th>
                      <th>Categoria</th>
                      <th>Descrição</th>
                      <th>Valor</th>
                      <th>Vencimento</th>
                      <th>Status</th>
                      <th>Recorrente</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financeiro.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center text-muted py-4">
                          <i className="fas fa-inbox fa-2x mb-2"></i>
                          <p>Nenhum lançamento encontrado</p>
                        </td>
                      </tr>
                    ) : (
                      financeiro.map((item) => (
                        <tr key={item._id}>
                          <td>
                            <div>
                              <strong>{item.origem_nome || 'Manual'}</strong>
                              {item.origem_identificacao && (
                                <>
                                  <br />
                                  <small className="text-muted">
                                    CPF: {item.origem_identificacao.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}
                                  </small>
                                </>
                              )}
                              {item.origem_sistema && (
                                <>
                                  <br />
                                  <Badge bg={item.origem_sistema === 'morador' ? 'success' : item.origem_sistema === 'colaborador' ? 'primary' : 'secondary'} size="sm">
                                    {item.origem_sistema === 'morador' ? '🏠 Morador' : item.origem_sistema === 'colaborador' ? '💼 Colaborador' : '📝 Manual'}
                                  </Badge>
                                  {item.origem_sistema === 'morador' && (item.bloco || item.apartamento || item.unidade) && (
                                    <div className="mt-1">
                                      <Badge bg="info" size="sm" className="me-1">
                                        📍 {item.bloco ? `${item.bloco}-` : ''}{item.apartamento || item.unidade}
                                      </Badge>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                          <td>
                            <UnidadeDisplay item={item} />
                          </td>
                          <td>{getCategoriaLabel(item.categoria)}</td>
                          <td>
                            <strong>{item.descricao}</strong>
                            {item.observacoes && (
                              <>
                                <br />
                                <small className="text-muted">{item.observacoes}</small>
                              </>
                            )}
                          </td>
                          <td className={item.tipo === 'receita' ? 'text-success' : 'text-danger'}>
                            <strong>{formatCurrencyDisplay(item.valor)}</strong>
                          </td>
                          <td>{new Date(item.data_vencimento).toLocaleDateString('pt-BR')}</td>
                          <td>{getStatusBadge(item.status)}</td>
                          <td>
                            {item.recorrente ? (
                              <Badge bg="info">
                                <i className="fas fa-sync-alt me-1"></i>
                                {item.periodicidade}
                              </Badge>
                            ) : (
                              <Badge bg="light" text="dark">Única</Badge>
                            )}
                          </td>
                          <td>
                            <Dropdown>
                              <Dropdown.Toggle variant="outline-secondary" size="sm">
                                <i className="fas fa-ellipsis-v"></i>
                              </Dropdown.Toggle>
                              <Dropdown.Menu>
                                <Dropdown.Item onClick={() => handleEdit(item)}>
                                  <i className="fas fa-edit me-2"></i>
                                  Editar
                                </Dropdown.Item>
                                <Dropdown.Item 
                                  onClick={() => handleDelete(item._id)}
                                  className="text-danger"
                                >
                                  <i className="fas fa-trash me-2"></i>
                                  Excluir
                                </Dropdown.Item>
                              </Dropdown.Menu>
                            </Dropdown>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <Modal show={showModal} onHide={handleCloseModal} size="lg">
          <Modal.Header closeButton>
            <Modal.Title>
              {editingItem ? 'Editar Lançamento' : 'Novo Lançamento'}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form onSubmit={handleSubmit}>
              {/* Informação do condomínio herdado */}
              {selectedCondominiumId && (
                <Alert variant="info" className="mb-3">
                  <div className="d-flex align-items-center">
                    <i className="fas fa-building me-2"></i>
                    <div>
                      <strong>Condomínio:</strong> {condominios.find(c => c._id === selectedCondominiumId)?.nome || 'Carregando...'}
                      <br />
                      <small className="text-muted">Este lançamento será automaticamente vinculado ao condomínio selecionado</small>
                    </div>
                  </div>
                </Alert>
              )}
              
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Tipo de Operação *</Form.Label>
                    <Form.Select
                      value={formData.tipo}
                      onChange={(e) => {
                        const tipo = e.target.value as 'receita' | 'despesa' | 'transferencia'
                        setFormData({...formData, tipo, categoria: ''})
                      }}
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
                      value={formData.categoria}
                      onChange={(e) => setFormData({...formData, categoria: e.target.value})}
                      required
                    >
                      <option value="">Selecione uma categoria</option>
                      {categoriasDisponiveis.map(cat => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>

              <Form.Group className="mb-3">
                <Form.Label>Descrição *</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Descrição detalhada do lançamento..."
                  value={formData.descricao}
                  onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                  required
                />
              </Form.Group>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Valor *</Form.Label>
                    <div className="input-group">
                      <span className="input-group-text">R$</span>
                      <Form.Control
                        type="text"
                        placeholder="0,00"
                        value={formData.valor}
                        onChange={handleValueChange}
                        required
                      />
                    </div>
                    <Form.Text className="text-muted">
                      Digite apenas números (ex: 12345 = R$ 123,45)
                      <br />
                      <small>Máximo: R$ 99.999.999,99</small>
                    </Form.Text>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Data de Vencimento *</Form.Label>
                    <div className="position-relative">
                      <Form.Control
                        type="date"
                        value={formData.data_vencimento}
                        onChange={(e) => setFormData({...formData, data_vencimento: e.target.value})}
                        required
                        min={new Date().toISOString().split('T')[0]}
                        style={{ paddingRight: '80px' }}
                      />
                      <div className="position-absolute" style={{ right: '8px', top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '4px' }}>
                        {formData.data_vencimento && (
                          <button
                            type="button"
                            className="btn btn-sm p-1"
                            onClick={() => setFormData({...formData, data_vencimento: ''})}
                            title="Limpar data"
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: '#6c757d',
                              width: '24px',
                              height: '24px',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#f8f9fa'
                              e.currentTarget.style.color = '#dc3545'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent'
                              e.currentTarget.style.color = '#6c757d'
                            }}
                          >
                            <i className="fas fa-times" style={{ fontSize: '12px' }}></i>
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-sm p-1"
                          onClick={() => {
                            const hoje = new Date()
                            const proximoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 10)
                            setFormData({...formData, data_vencimento: proximoMes.toISOString().split('T')[0]})
                          }}
                          title="Próximo mês (dia 10)"
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#0d6efd',
                            width: '24px',
                            height: '24px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#e7f1ff'
                            e.currentTarget.style.color = '#0a58ca'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent'
                            e.currentTarget.style.color = '#0d6efd'
                          }}
                        >
                          <i className="fas fa-calendar-plus" style={{ fontSize: '12px' }}></i>
                        </button>
                      </div>
                    </div>
                    <Form.Text className="text-muted">
                      <small>
                        <i className="fas fa-info-circle me-1"></i>
                        Clique em <i className="fas fa-calendar-plus text-primary"></i> para definir próximo mês ou <i className="fas fa-times text-danger"></i> para limpar
                      </small>
                    </Form.Text>
                  </Form.Group>
                </Col>
              </Row>

              <Form.Group className="mb-3">
                <Form.Label>Observações</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  placeholder="Observações adicionais..."
                  value={formData.observacoes}
                  onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
                />
              </Form.Group>

              <Row>
                <Col md={6}>
                  <Form.Check
                    type="checkbox"
                    label="Lançamento recorrente"
                    checked={formData.recorrente}
                    onChange={(e) => setFormData({...formData, recorrente: e.target.checked})}
                  />
                </Col>
                {formData.recorrente && (
                  <Col md={6}>
                    <Form.Select
                      value={formData.periodicidade}
                      onChange={(e) => setFormData({...formData, periodicidade: e.target.value})}
                      required={formData.recorrente}
                    >
                      <option value="">Selecione a periodicidade</option>
                      <option value="mensal">Mensal</option>
                      <option value="bimestral">Bimestral</option>
                      <option value="trimestral">Trimestral</option>
                      <option value="semestral">Semestral</option>
                      <option value="anual">Anual</option>
                    </Form.Select>
                  </Col>
                )}
              </Row>

              <Row className="mt-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Status do Lançamento *</Form.Label>
                    <Form.Select
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value as 'pendente' | 'pago' | 'atrasado' | 'cancelado'})}
                      required
                    >
                      <option value="pendente">⏳ Pendente</option>
                      <option value="pago">✅ Pago</option>
                      <option value="atrasado">⚠️ Atrasado</option>
                      <option value="cancelado">❌ Cancelado</option>
                    </Form.Select>
                    <Form.Text className="text-muted">
                      <small>
                        <i className="fas fa-info-circle me-1"></i>
                        {editingItem ? 'Atualize o status conforme necessário' : 'Novos lançamentos geralmente começam como "Pendente"'}
                      </small>
                    </Form.Text>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  {formData.status === 'pago' && (
                    <Form.Group>
                      <Form.Label>Data de Pagamento</Form.Label>
                      <div className="position-relative">
                        <Form.Control
                          type="date"
                          value={formData.data_pagamento || ''}
                          onChange={(e) => setFormData({...formData, data_pagamento: e.target.value})}
                          max={new Date().toISOString().split('T')[0]}
                        />
                        <button
                          type="button"
                          className="btn btn-sm p-1"
                          onClick={() => {
                            const hoje = new Date().toISOString().split('T')[0]
                            setFormData({...formData, data_pagamento: hoje})
                          }}
                          title="Hoje"
                          style={{
                            position: 'absolute',
                            right: '8px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            border: 'none',
                            background: 'transparent',
                            color: '#28a745',
                            width: '24px',
                            height: '24px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#e8f5e8'
                            e.currentTarget.style.color = '#155724'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent'
                            e.currentTarget.style.color = '#28a745'
                          }}
                        >
                          <i className="fas fa-calendar-day" style={{ fontSize: '12px' }}></i>
                        </button>
                      </div>
                      <Form.Text className="text-muted">
                        <small>Data em que o pagamento foi realizado</small>
                      </Form.Text>
                    </Form.Group>
                  )}
                </Col>
              </Row>
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseModal}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSubmit}>
              {editingItem ? 'Atualizar' : 'Criar'} Lançamento
            </Button>
          </Modal.Footer>
        </Modal>
      </Container>
    </>
  )
}