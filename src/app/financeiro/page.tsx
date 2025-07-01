'use client'

import React, { useState, useEffect } from 'react'
import { Container, Row, Col, Card, Badge, Alert, Table, Form, Button } from 'react-bootstrap'
import { Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  ArcElement
)

interface ResumoMorador {
  _id: string
  nome: string
  unidade: string
  bloco?: string
  tipo: string
  total_atrasado?: number
  count_atrasados?: number
  status_pagamento: 'em_dia' | 'atrasado'
  moradores_na_unidade?: number
  dias_atraso?: number
  fonte?: string
}

interface ResumoColaborador {
  _id: string
  nome: string
  cargo?: string
  cpf?: string
  total_a_receber?: number
  total_atrasado?: number
  count_pendentes?: number
  count_atrasados?: number
  status_pagamento: 'em_dia' | 'pendente' | 'atrasado'
}

interface DadosCondominio {
  receitas: {
    total: number
    pendentes: number
    atrasadas: number
    count_pendentes: number
  }
  despesas: {
    total: number
    pendentes: number
    atrasadas: number
    count_pendentes: number
  }
  saldo_liquido: number
}

interface ResumoUnificado {
  dados_unificados: {
    moradores: {
      em_dia: ResumoMorador[]
      atrasados: ResumoMorador[]
      total_atrasado: number
      estatisticas: {
        total_unidades: number
        unidades_em_dia: number
        unidades_atrasadas: number
        percentual_em_dia: number
      }
    }
    condominio: DadosCondominio
    colaboradores: {
      em_dia: ResumoColaborador[]
      pendentes: ResumoColaborador[]
      atrasados: ResumoColaborador[]
      total_a_pagar: number
      estatisticas: {
        total: number
        em_dia_count: number
        pendentes_count: number
        atrasados_count: number
      }
    }
  }
  resumo_geral: {
    total_a_receber_moradores: number
    total_a_pagar_colaboradores: number
    receitas_condominio_pendentes: number
    despesas_condominio_pendentes: number
    resultado_liquido: number
    situacao_financeira: {
      moradores_ok: boolean
      colaboradores_ok: boolean
      condominio_ok: boolean
    }
  }
  timestamp: string
}

interface FinanceiroCondominioLancamento {
  _id: string;
  tipo: 'receita' | 'despesa' | 'transferencia';
  categoria: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  data_pagamento?: string;
  status: 'pendente' | 'pago' | 'atrasado' | 'cancelado';
  origem_sistema: string;
  origem_nome?: string;
  bloco?: string;
  unidade?: string;
  cargo?: string;
}

interface PaginationData {
  current_page: number;
  total_pages: number;
  total_items: number;
  items_per_page: number;
}

const CATEGORIAS_FINANCEIRO = [
  { value: 'taxa_condominio', label: '🏢 Taxa Condomínio', tipo: 'receita' },
  { value: 'multa_atraso', label: '⚠️ Multa Morador', tipo: 'receita' },
  { value: 'salario', label: '💰 Salário Colaborador', tipo: 'despesa' },
  { value: 'manutencao', label: '🛠️ Manutenção', tipo: 'despesa' },
  { value: 'agua', label: '💧 Água', tipo: 'despesa' },
  { value: 'luz', label: '💡 Luz', tipo: 'despesa' },
  { value: 'limpeza', label: '🧹 Limpeza', tipo: 'despesa' },
  { value: 'seguranca', label: ' vigilant Segurança', tipo: 'despesa' },
  { value: 'outros_receita', label: '➕ Outras Receitas', tipo: 'receita' },
  { value: 'outros_despesa', label: '➖ Outras Despesas', tipo: 'despesa' },
];

export default function FinanceiroPage() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [selectedCondominiumId, setSelectedCondominiumId] = useState<string>('')
  const [condominiums, setCondominiums] = useState<any[]>([])
  const [resumoUnificado, setResumoUnificado] = useState<ResumoUnificado | null>(null)
  const [loading, setLoading] = useState(false)
  const [alert, setAlert] = useState<{type: string, message: string} | null>(null)
  const [lastUpdate, setLastUpdate] = useState<string>('')
  const [autoRefresh, setAutoRefresh] = useState(true)
  
  // Pagination states
  const [moradoresAtrasadosPage, setMoradoresAtrasadosPage] = useState(1)
  const [moradoresEmDiaPage, setMoradoresEmDiaPage] = useState(1)
  const [colaboradoresAtrasadosPage, setColaboradoresAtrasadosPage] = useState(1)
  const [colaboradoresPendentesPage, setColaboradoresPendentesPage] = useState(1)
  const [colaboradoresEmDiaPage, setColaboradoresEmDiaPage] = useState(1)
  const itemsPerPage = 20
  
  // Estados para lançamentos detalhados
  const [lancamentos, setLancamentos] = useState<any[]>([])
  const [lancamentosPage, setLancamentosPage] = useState(1)
  const [lancamentosLoading, setLancamentosLoading] = useState(false)
  const [lancamentosPagination, setLancamentosPagination] = useState<any>(null)
  const [lancamentosResumo, setLancamentosResumo] = useState<any>(null)
  const [showLancamentos, setShowLancamentos] = useState(false)
  const [lancamentosFilters, setLancamentosFilters] = useState({
    status: '',
    tipo: '',
    origem: ''
  })

  useEffect(() => {
    const userData = localStorage.getItem('userData')
    if (userData) {
      try {
        const user = JSON.parse(userData)
        setCurrentUser(user)
        
        if (user.tipo === 'master') {
          loadCondominiums(user.id)
          
          const activeCondominiumId = localStorage.getItem('activeCondominio')
          if (activeCondominiumId) {
            setSelectedCondominiumId(activeCondominiumId)
            loadResumoUnificado(user, activeCondominiumId)
          }
        } else {
          if (user.condominio_id) {
            setSelectedCondominiumId(user.condominio_id)
            loadResumoUnificado(user, user.condominio_id)
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
            loadResumoUnificado(user, activeCondominioId)
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
          setSelectedCondominiumId(activeCondominio)
          loadResumoUnificado(currentUser, activeCondominio)
        }
      }, 2000)

      return () => clearInterval(interval)
    }
  }, [currentUser, selectedCondominiumId])

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

  const handleCondominioChange = async (condominioId: string) => {
    setSelectedCondominiumId(condominioId)
    
    if (condominioId && currentUser) {
      loadResumoUnificado(currentUser, condominioId)
    } else {
      setResumoUnificado(null)
    }
  }

  // Auto refresh a cada 30 segundos
  useEffect(() => {
    if (autoRefresh && selectedCondominiumId && currentUser) {
      const interval = setInterval(() => {
        loadResumoUnificado(currentUser, selectedCondominiumId)
      }, 30000) // 30 segundos

      return () => clearInterval(interval)
    }
  }, [autoRefresh, selectedCondominiumId, currentUser])

  const loadResumoUnificado = async (user: any, condominioId: string) => {
    setLoading(true)
    setAlert(null)
    
    try {
      console.log('🔄 Carregando resumo unificado em tempo real...')
      const response = await fetch(
        `/api/financeiro-unificado/resumo?master_id=${user.master_id || user.id}&condominio_id=${condominioId}&tipo_usuario=${user.tipo}`
      )
      
      const data = await response.json()
      
      if (data.success) {
        setResumoUnificado(data)
        setLastUpdate(new Date(data.timestamp).toLocaleString('pt-BR'))
        console.log('✅ Resumo unificado carregado:', {
          timestamp: data.timestamp,
          moradores_atrasados: data.dados_unificados.moradores.atrasados.length,
          colaboradores_pendentes: data.dados_unificados.colaboradores.pendentes.length + data.dados_unificados.colaboradores.atrasados.length,
          saldo_condominio: data.dados_unificados.condominio.saldo_liquido
        })
      } else {
        console.error('❌ Erro na API:', data.error)
        setAlert({ type: 'danger', message: data.error || 'Erro ao carregar dados financeiros' })
      }
    } catch (error) {
      console.error('❌ Erro ao carregar resumo unificado:', error)
      setAlert({ type: 'danger', message: 'Erro de rede ao carregar dados financeiros' })
    } finally {
      setLoading(false)
    }
  }

  const formatCurrencyDisplay = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }
  
  // Funções auxiliares de paginação
  const getPaginatedData = (data: any[], page: number, itemsPerPage: number) => {
    const startIndex = (page - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return data.slice(startIndex, endIndex)
  }
  
  const getTotalPages = (totalItems: number, itemsPerPage: number) => {
    return Math.ceil(totalItems / itemsPerPage)
  }
  
  const renderPaginationControls = (currentPage: number, totalPages: number, onPageChange: (page: number) => void, dataLength: number) => {
    if (totalPages <= 1) return null
    
    return (
      <div className="d-flex justify-content-between align-items-center mt-3">
        <Button 
          variant="outline-secondary" 
          size="sm" 
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          ← Anterior
        </Button>
        <div className="text-center">
          <span className="badge bg-primary me-2">
            Página {currentPage} de {totalPages}
          </span>
          <small className="text-muted">
            ({dataLength} itens total)
          </small>
        </div>
        <Button 
          variant="outline-secondary" 
          size="sm" 
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Próxima →
        </Button>
      </div>
    )
  }
  
  // Função para carregar lançamentos detalhados
  const loadLancamentos = async (user: any, condominioId: string, page: number = 1) => {
    setLancamentosLoading(true)
    
    try {
      const params = new URLSearchParams({
        master_id: user.master_id || user.id,
        condominio_id: condominioId,
        page: page.toString(),
        limit: itemsPerPage.toString()
      })
      
      // Adicionar filtros se estiverem definidos
      if (lancamentosFilters.status) params.append('status', lancamentosFilters.status)
      if (lancamentosFilters.tipo) params.append('tipo', lancamentosFilters.tipo)
      if (lancamentosFilters.origem) params.append('origem', lancamentosFilters.origem)
      
      const response = await fetch(`/api/financeiro-unificado/lancamentos?${params}`)
      const data = await response.json()
      
      if (data.success) {
        setLancamentos(data.lancamentos)
        setLancamentosPagination(data.pagination)
        setLancamentosResumo(data.resumo)
        console.log('✅ Lançamentos carregados:', {
          total: data.pagination.total_items,
          pagina: data.pagination.current_page,
          filtros: lancamentosFilters
        })
      } else {
        console.error('❌ Erro na API de lançamentos:', data.error)
        setAlert({ type: 'danger', message: data.error || 'Erro ao carregar lançamentos' })
      }
    } catch (error) {
      console.error('❌ Erro ao carregar lançamentos:', error)
      setAlert({ type: 'danger', message: 'Erro de rede ao carregar lançamentos' })
    } finally {
      setLancamentosLoading(false)
    }
  }
  
  // Função para aplicar filtros de lançamentos
  const applyLancamentosFilters = () => {
    if (selectedCondominiumId && currentUser) {
      setLancamentosPage(1)
      loadLancamentos(currentUser, selectedCondominiumId, 1)
    }
  }
  
  // Função para limpar filtros de lançamentos
  const clearLancamentosFilters = () => {
    setLancamentosFilters({ status: '', tipo: '', origem: '' })
    if (selectedCondominiumId && currentUser) {
      setLancamentosPage(1)
      loadLancamentos(currentUser, selectedCondominiumId, 1)
    }
  }

  // Dados unificados em tempo real
  const dadosUnificados = resumoUnificado?.dados_unificados
  const resumoGeral = resumoUnificado?.resumo_geral
  
  const moradoresEmDia = dadosUnificados?.moradores.em_dia || []
  const moradoresAtrasados = dadosUnificados?.moradores.atrasados || []
  const colaboradoresEmDia = dadosUnificados?.colaboradores.em_dia || []
  const colaboradoresPendentes = dadosUnificados?.colaboradores.pendentes || []
  const colaboradoresAtrasados = dadosUnificados?.colaboradores.atrasados || []
  const dadosCondominio = dadosUnificados?.condominio

  const totalAtrasadoMoradores = resumoGeral?.total_a_receber_moradores || 0
  const totalPendenteColaboradores = resumoGeral?.total_a_pagar_colaboradores || 0
  const totalAtrasadoColaboradores = colaboradoresAtrasados.reduce((sum, c) => sum + (c.total_atrasado || 0), 0)

  return (
    <>
      <Container fluid className="mt-4">
        {alert && (
          <Alert variant={alert.type} dismissible onClose={() => setAlert(null)}>
            {alert.message}
          </Alert>
        )}

        <Row className="mb-4">
          <Col>
            <div className="text-center">
              <h2 className="mb-1">💰 Resumo Financeiro Unificado</h2>
              <p className="text-muted mb-0">Dados em tempo real: moradores, colaboradores e condomínio</p>
              {lastUpdate && (
                <div className="mt-2">
                  <small className="text-success">
                    🔄 Última atualização: {lastUpdate}
                    {autoRefresh && <span className="ms-2 badge bg-success">Auto-refresh ativo</span>}
                  </small>
                  <Button 
                    variant="outline-primary" 
                    size="sm" 
                    className="ms-3"
                    onClick={() => setAutoRefresh(!autoRefresh)}
                  >
                    {autoRefresh ? '⏸️ Pausar' : '▶️ Ativar'} Auto-refresh
                  </Button>
                  <Button 
                    variant="outline-success" 
                    size="sm" 
                    className="ms-2"
                    onClick={() => selectedCondominiumId && currentUser && loadResumoUnificado(currentUser, selectedCondominiumId)}
                    disabled={loading}
                  >
                    🔄 Atualizar Agora
                  </Button>
                </div>
              )}
            </div>
          </Col>
        </Row>

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
                        <Form.Label>Selecionar Condomínio *</Form.Label>
                        <Form.Select
                          value={selectedCondominiumId}
                          onChange={(e) => handleCondominioChange(e.target.value)}
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
                            "Selecione o condomínio para visualizar o resumo financeiro"
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
                              🏢 <strong>Condomínio Ativo:</strong> {localStorage.getItem('activeCondominiumName') || 'Carregando...'}
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

        {!selectedCondominiumId ? (
          <Alert variant="info" className="text-center">
            <h5>🏢 Selecione um condomínio</h5>
            <p className="mb-0">{currentUser?.tipo === 'master' ? 'Selecione um condomínio acima para ver o resumo financeiro' : 'Vá para qualquer página do sistema e selecione um condomínio para ver o resumo financeiro'}</p>
          </Alert>
        ) : loading ? (
          <Alert variant="info" className="text-center">
            <div className="spinner-border spinner-border-sm me-2"></div>
            Carregando dados financeiros...
          </Alert>
        ) : (
          <>
            {/* Alertas de Status */}
            {(moradoresAtrasados.length > 0 || colaboradoresAtrasados.length > 0 || colaboradoresPendentes.length > 0) && (
              <Row className="mb-4">
                <Col>
                  <Alert 
                    variant={(moradoresAtrasados.length > 0 || colaboradoresAtrasados.length > 0) ? "danger" : "warning"} 
                    className="d-flex align-items-center"
                  >
                    <div className="me-3">
                      {(moradoresAtrasados.length > 0 || colaboradoresAtrasados.length > 0) ? (
                        <i className="fas fa-exclamation-triangle fa-2x"></i>
                      ) : (
                        <i className="fas fa-hourglass-half fa-2x"></i>
                      )}
                    </div>
                    <div className="flex-grow-1">
                      <h6 className="alert-heading mb-2">
                        {(moradoresAtrasados.length > 0 || colaboradoresAtrasados.length > 0) ? 
                          '🚨 Atenção! Existem itens em atraso' : 
                          '⏰ Colaboradores pendentes de pagamento'}
                      </h6>
                      <div className="mb-0">
                        {moradoresAtrasados.length > 0 && (
                          <p className="mb-1">
                            <strong>{moradoresAtrasados.length} unidade(s)</strong> em atraso totalizando <strong>{formatCurrencyDisplay(totalAtrasadoMoradores)}</strong>
                          </p>
                        )}
                        {colaboradoresAtrasados.length > 0 && (
                          <p className="mb-1">
                            <strong>{colaboradoresAtrasados.length} colaborador(es)</strong> em atraso totalizando <strong>{formatCurrencyDisplay(totalAtrasadoColaboradores)}</strong>
                          </p>
                        )}
                        {colaboradoresPendentes.length > 0 && (
                          <p className="mb-1">
                            <strong>{colaboradoresPendentes.length} colaborador(es)</strong> pendente(s) totalizando <strong>{formatCurrencyDisplay(totalPendenteColaboradores)}</strong>
                          </p>
                        )}
                        <small>Verifique os detalhes abaixo para tomar as ações necessárias.</small>
                      </div>
                    </div>
                  </Alert>
                </Col>
              </Row>
            )}

            {/* Alerta de sucesso quando tudo está em dia */}
            {moradoresAtrasados.length === 0 && colaboradoresAtrasados.length === 0 && colaboradoresPendentes.length === 0 && moradoresEmDia.length > 0 && (
              <Row className="mb-4">
                <Col>
                  <Alert variant="success" className="d-flex align-items-center">
                    <div className="me-3">
                      <i className="fas fa-check-circle fa-2x"></i>
                    </div>
                    <div className="flex-grow-1">
                      <h6 className="alert-heading mb-2">🎉 Parabéns! Situação financeira excelente!</h6>
                      <div className="mb-0">
                        <p className="mb-1">
                          <strong>Todas as {moradoresEmDia.length} unidades</strong> estão em dia com os pagamentos
                        </p>
                        <p className="mb-1">
                          <strong>Todos os {colaboradoresEmDia.length} colaboradores</strong> foram pagos corretamente
                        </p>
                        <small>Continue assim! O condomínio está com a gestão financeira em ordem.</small>
                      </div>
                    </div>
                  </Alert>
                </Col>
              </Row>
            )}

            {/* Cards de Resumo */}
            <Row className="mb-4">
              <Col md={3}>
                <Card className={`border-success ${moradoresEmDia.length === 0 ? 'bg-light' : ''}`}>
                  <Card.Body className="text-center position-relative">
                    <div className="text-success display-6 mb-2">✅</div>
                    <h6 className="text-muted">Unidades em Dia</h6>
                    <h4 className="text-success">{moradoresEmDia.length}</h4>
                    <small className="text-muted">
                      de {moradoresEmDia.length + moradoresAtrasados.length} unidades
                    </small>
                    {moradoresEmDia.length === (moradoresEmDia.length + moradoresAtrasados.length) && 
                     moradoresEmDia.length > 0 && (
                      <div className="position-absolute top-0 end-0 p-2">
                        <Badge bg="success">100%</Badge>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card className={`border-danger ${moradoresAtrasados.length === 0 ? 'bg-light' : ''}`}>
                  <Card.Body className="text-center position-relative">
                    <div className="text-danger display-6 mb-2">⚠️</div>
                    <h6 className="text-muted">Unidades Atrasadas</h6>
                    <h4 className="text-danger">{moradoresAtrasados.length}</h4>
                    <small className="text-muted">{formatCurrencyDisplay(totalAtrasadoMoradores)}</small>
                    {moradoresAtrasados.length > 0 && (
                      <div className="position-absolute top-0 end-0 p-2">
                        <Badge bg="danger">URGENTE</Badge>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card className={`border-info ${colaboradoresEmDia.length === 0 ? 'bg-light' : ''}`}>
                  <Card.Body className="text-center position-relative">
                    <div className="text-info display-6 mb-2">👥</div>
                    <h6 className="text-muted">Colaboradores em Dia</h6>
                    <h4 className="text-info">{colaboradoresEmDia.length}</h4>
                    <small className="text-muted">
                      de {colaboradoresEmDia.length + colaboradoresAtrasados.length + colaboradoresPendentes.length} colaboradores
                    </small>
                    {colaboradoresEmDia.length === (colaboradoresEmDia.length + colaboradoresAtrasados.length + colaboradoresPendentes.length) && 
                     colaboradoresEmDia.length > 0 && (
                      <div className="position-absolute top-0 end-0 p-2">
                        <Badge bg="info">100%</Badge>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card className={`border-warning ${colaboradoresPendentes.length === 0 ? 'bg-light' : ''}`}>
                  <Card.Body className="text-center position-relative">
                    <div className="text-warning display-6 mb-2">💸</div>
                    <h6 className="text-muted">A Pagar Colaboradores</h6>
                    <h4 className="text-warning">{colaboradoresAtrasados.length + colaboradoresPendentes.length}</h4>
                    <small className="text-muted">{formatCurrencyDisplay(totalAtrasadoColaboradores + totalPendenteColaboradores)}</small>
                    {(colaboradoresAtrasados.length > 0 || colaboradoresPendentes.length > 0) && (
                      <div className="position-absolute top-0 end-0 p-2">
                        <Badge bg="warning">PAGAR</Badge>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {/* Cards do Condomínio */}
            {dadosCondominio && (
              <Row className="mb-4">
                <Col>
                  <h5 className="text-primary mb-3">🏢 Situação Financeira do Condomínio</h5>
                </Col>
              </Row>
            )}
            
            {dadosCondominio && (
              <Row className="mb-4">
                <Col md={3}>
                  <Card className="border-success">
                    <Card.Body className="text-center">
                      <div className="text-success display-6 mb-2">💰</div>
                      <h6 className="text-muted">Receitas Totais</h6>
                      <h4 className="text-success">{formatCurrencyDisplay(dadosCondominio.receitas.total)}</h4>
                      <small className="text-muted">
                        {dadosCondominio.receitas.count_pendentes > 0 && 
                          `${dadosCondominio.receitas.count_pendentes} pendente(s)`
                        }
                      </small>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={3}>
                  <Card className="border-danger">
                    <Card.Body className="text-center">
                      <div className="text-danger display-6 mb-2">💸</div>
                      <h6 className="text-muted">Despesas Totais</h6>
                      <h4 className="text-danger">{formatCurrencyDisplay(dadosCondominio.despesas.total)}</h4>
                      <small className="text-muted">
                        {dadosCondominio.despesas.count_pendentes > 0 && 
                          `${dadosCondominio.despesas.count_pendentes} pendente(s)`
                        }
                      </small>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={3}>
                  <Card className={`border-${dadosCondominio.saldo_liquido >= 0 ? 'info' : 'warning'}`}>
                    <Card.Body className="text-center">
                      <div className={`text-${dadosCondominio.saldo_liquido >= 0 ? 'info' : 'warning'} display-6 mb-2`}>
                        {dadosCondominio.saldo_liquido >= 0 ? '📈' : '📉'}
                      </div>
                      <h6 className="text-muted">Saldo Líquido</h6>
                      <h4 className={`text-${dadosCondominio.saldo_liquido >= 0 ? 'info' : 'warning'}`}>
                        {formatCurrencyDisplay(dadosCondominio.saldo_liquido)}
                      </h4>
                      <small className="text-muted">
                        {dadosCondominio.saldo_liquido >= 0 ? 'Superávit' : 'Déficit'}
                      </small>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={3}>
                  <Card className="border-primary">
                    <Card.Body className="text-center">
                      <div className="text-primary display-6 mb-2">🧮</div>
                      <h6 className="text-muted">Resultado Líquido</h6>
                      <h4 className={`text-${resumoGeral?.resultado_liquido >= 0 ? 'success' : 'danger'}`}>
                        {formatCurrencyDisplay(resumoGeral?.resultado_liquido || 0)}
                      </h4>
                      <small className="text-muted">
                        Moradores - Colaboradores
                      </small>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            )}

            {/* Gráficos */}
            <Row className="mb-4">
              <Col md={6}>
                <Card>
                  <Card.Header>
                    <h6 className="mb-0">📊 Status das Unidades</h6>
                  </Card.Header>
                  <Card.Body>
                    {moradoresEmDia.length > 0 || moradoresAtrasados.length > 0 ? (
                      <Doughnut
                        data={{
                          labels: ['Unidades em Dia', 'Unidades Atrasadas'],
                          datasets: [{
                            data: [moradoresEmDia.length, moradoresAtrasados.length],
                            backgroundColor: ['#28a745', '#dc3545']
                          }]
                        }}
                        options={{
                          responsive: true,
                          plugins: {
                            legend: {
                              position: 'bottom'
                            }
                          }
                        }}
                      />
                    ) : (
                      <div className="text-center text-muted py-4">
                        <p>Nenhum dado encontrado</p>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </Col>
              <Col md={6}>
                <Card>
                  <Card.Header>
                    <h6 className="mb-0">📊 Status dos Colaboradores</h6>
                  </Card.Header>
                  <Card.Body>
                    {colaboradoresEmDia.length > 0 || colaboradoresPendentes.length > 0 || colaboradoresAtrasados.length > 0 ? (
                      <Doughnut
                        data={{
                          labels: ['Em Dia', 'Pendentes'],
                          datasets: [{
                            data: [colaboradoresEmDia.length, colaboradoresPendentes.length],
                            backgroundColor: ['#17a2b8', '#ffc107']
                          }]
                        }}
                        options={{
                          responsive: true,
                          plugins: {
                            legend: {
                              position: 'bottom'
                            }
                          }
                        }}
                      />
                    ) : (
                      <div className="text-center text-muted py-4">
                        <p>Nenhum dado encontrado</p>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {/* Listas Detalhadas */}
            <Row className="mb-4">
              <Col>
                <Card>
                  <Card.Header>
                    <div className="d-flex justify-content-between align-items-center">
                      <h6 className="mb-0">📊 Status Detalhado - Moradores e Colaboradores</h6>
                      <div>
                        <Badge bg="success" className="me-2">
                          {moradoresEmDia.length + colaboradoresEmDia.length} Em Dia
                        </Badge>
                        <Badge bg="danger" className="me-2">
                          {moradoresAtrasados.length + colaboradoresAtrasados.length} Atrasados
                        </Badge>
                        <Badge bg="warning">
                          {colaboradoresPendentes.length} Pendentes
                        </Badge>
                      </div>
                    </div>
                  </Card.Header>
                  <Card.Body>
                    <Row>
                      <Col md={6}>
                        <h6 className="text-danger mb-3">
                          <i className="fas fa-exclamation-triangle me-2"></i>
                          Unidades com Atraso ({moradoresAtrasados.length})
                          {moradoresAtrasados.length > itemsPerPage && (
                            <small className="text-muted ms-2">
                              (Mostrando {itemsPerPage} por página)
                            </small>
                          )}
                        </h6>
                        <div className="table-responsive" style={{maxHeight: '350px', overflowY: 'auto'}}>
                          <Table striped hover size="sm">
                            <thead className="table-light sticky-top">
                              <tr>
                                <th>Status</th>
                                <th>Morador</th>
                                <th>Unidade</th>
                                <th>Valor</th>
                                <th>Dias</th>
                              </tr>
                            </thead>
                            <tbody>
                              {moradoresEmDia.length === 0 && moradoresAtrasados.length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="text-center text-muted py-3">
                                    📭 Nenhuma unidade encontrada neste condomínio
                                  </td>
                                </tr>
                              ) : moradoresAtrasados.length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="text-center text-success py-3">
                                    <i className="fas fa-check-circle fa-2x mb-2 text-success"></i>
                                    <br />
                                    <strong>🎉 Parabéns! Nenhuma unidade em atraso!</strong>
                                    <br />
                                    <small>Todas as {moradoresEmDia.length} unidades estão em dia</small>
                                  </td>
                                </tr>
                              ) : (
                                getPaginatedData(moradoresAtrasados, moradoresAtrasadosPage, itemsPerPage).map((unidade) => (
                                  <tr key={unidade._id}>
                                    <td>
                                      <Badge bg="danger" className="d-flex align-items-center" style={{fontSize: '10px'}}>
                                        <i className="fas fa-clock me-1"></i>
                                        ATRASO
                                      </Badge>
                                    </td>
                                    <td>
                                      <div>
                                        <strong>{unidade.nome}</strong>
                                        {unidade.moradores_na_unidade > 1 && (
                                          <div className="mt-1">
                                            <Badge bg="info" size="sm">
                                              +{unidade.moradores_na_unidade - 1} moradores
                                            </Badge>
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                    <td>
                                      <strong>{unidade.bloco ? `${unidade.bloco}-` : ''}{unidade.unidade}</strong>
                                      <br />
                                      <small className="text-muted">{unidade.tipo}</small>
                                    </td>
                                    <td className="text-danger">
                                      <strong>{formatCurrencyDisplay(unidade.total_atrasado || 0)}</strong>
                                      <br/>
                                      <small>{unidade.count_atrasados} lançamento(s)</small>
                                    </td>
                                    <td className="text-center">
                                      <Badge bg="dark" size="sm">
                                        {unidade.dias_atraso || 'N/A'}d
                                      </Badge>
                                    </td>
                                  </tr>
                                ))
                              )}
                              
                              {/* Controles de paginação para moradores atrasados */}
                              {moradoresAtrasados.length > 0 && (
                                <tr>
                                  <td colSpan={5}>
                                    {renderPaginationControls(
                                      moradoresAtrasadosPage,
                                      getTotalPages(moradoresAtrasados.length, itemsPerPage),
                                      setMoradoresAtrasadosPage,
                                      moradoresAtrasados.length
                                    )}
                                  </td>
                                </tr>
                              )}
                              
                              {/* Mostrar algumas unidades em dia para comparação */}
                              {moradoresEmDia.length > 0 && (
                                <>
                                  <tr>
                                    <td colSpan={5} className="bg-light">
                                      <small className="text-success fw-bold">
                                        <i className="fas fa-check me-1"></i>
                                        Unidades em dia (mostrando {Math.min(itemsPerPage, moradoresEmDia.length)} de {moradoresEmDia.length}):
                                      </small>
                                    </td>
                                  </tr>
                                  {getPaginatedData(moradoresEmDia, moradoresEmDiaPage, itemsPerPage).map((unidade) => (
                                    <tr key={`em_dia_${unidade._id}`} className="table-light">
                                      <td>
                                        <Badge bg="success" className="d-flex align-items-center" style={{fontSize: '10px'}}>
                                          <i className="fas fa-check me-1"></i>
                                          EM DIA
                                        </Badge>
                                      </td>
                                      <td>
                                        <strong>{unidade.nome}</strong>
                                        {unidade.moradores_na_unidade > 1 && (
                                          <div className="mt-1">
                                            <Badge bg="info" size="sm">
                                              +{unidade.moradores_na_unidade - 1} moradores
                                            </Badge>
                                          </div>
                                        )}
                                      </td>
                                      <td>
                                        <strong>{unidade.bloco ? `${unidade.bloco}-` : ''}{unidade.unidade}</strong>
                                        <br />
                                        <small className="text-muted">{unidade.tipo}</small>
                                      </td>
                                      <td className="text-success">
                                        <strong>✅ Em dia</strong>
                                      </td>
                                      <td className="text-center">
                                        <Badge bg="success" size="sm">
                                          OK
                                        </Badge>
                                      </td>
                                    </tr>
                                  ))}
                                  {moradoresEmDia.length > itemsPerPage && (
                                    <tr className="table-light">
                                      <td colSpan={5}>
                                        <small className="text-success fw-bold">📊 Moradores em Dia:</small>
                                        {renderPaginationControls(
                                          moradoresEmDiaPage,
                                          getTotalPages(moradoresEmDia.length, itemsPerPage),
                                          setMoradoresEmDiaPage,
                                          moradoresEmDia.length
                                        )}
                                      </td>
                                    </tr>
                                  )}
                                </>
                              )}
                            </tbody>
                          </Table>
                        </div>
                      </Col>
                      
                      <Col md={6}>
                        <h6 className="text-warning mb-3">
                          <i className="fas fa-user-clock me-2"></i>
                          Colaboradores Pendentes/Atrasados ({colaboradoresAtrasados.length + colaboradoresPendentes.length})
                          {(colaboradoresAtrasados.length + colaboradoresPendentes.length) > itemsPerPage && (
                            <small className="text-muted ms-2">
                              (Mostrando {itemsPerPage} por página)
                            </small>
                          )}
                        </h6>
                        <div className="table-responsive" style={{maxHeight: '350px', overflowY: 'auto'}}>
                          <Table striped hover size="sm">
                            <thead className="table-light sticky-top">
                              <tr>
                                <th>Status</th>
                                <th>Nome</th>
                                <th>Cargo</th>
                                <th>Valor</th>
                              </tr>
                            </thead>
                            <tbody>
                              {colaboradoresEmDia.length === 0 && colaboradoresPendentes.length === 0 && colaboradoresAtrasados.length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="text-center text-muted py-3">
                                    👥 Nenhum colaborador encontrado neste condomínio
                                  </td>
                                </tr>
                              ) : (colaboradoresPendentes.length === 0 && colaboradoresAtrasados.length === 0) ? (
                                <tr>
                                  <td colSpan={4} className="text-center text-success py-3">
                                    <i className="fas fa-user-check fa-2x mb-2 text-success"></i>
                                    <br />
                                    <strong>🎉 Excelente! Todos os colaboradores estão em dia!</strong>
                                    <br />
                                    <small>Todos os {colaboradoresEmDia.length} colaboradores foram pagos</small>
                                  </td>
                                </tr>
                              ) : (
                                <>
                                  {/* Colaboradores atrasados primeiro */}
                                  {getPaginatedData(colaboradoresAtrasados, colaboradoresAtrasadosPage, itemsPerPage).map((colaborador) => (
                                    <tr key={colaborador._id}>
                                      <td>
                                        <Badge bg="danger" className="d-flex align-items-center" style={{fontSize: '10px'}}>
                                          <i className="fas fa-clock me-1"></i>
                                          ATRASADO
                                        </Badge>
                                      </td>
                                      <td>
                                        <strong>{colaborador.nome}</strong>
                                        {colaborador.cpf && (
                                          <>
                                            <br />
                                            <small className="text-muted">
                                              CPF: {colaborador.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}
                                            </small>
                                          </>
                                        )}
                                      </td>
                                      <td>
                                        <span className="badge bg-secondary">
                                          {colaborador.cargo || 'Não informado'}
                                        </span>
                                      </td>
                                      <td className="text-danger">
                                        <strong>{formatCurrencyDisplay(colaborador.total_atrasado || 0)}</strong>
                                        <br/>
                                        <small>{colaborador.count_atrasados} lançamento(s) atrasado(s)</small>
                                      </td>
                                    </tr>
                                  ))}
                                  {/* Colaboradores pendentes */}
                                  {getPaginatedData(colaboradoresPendentes, colaboradoresPendentesPage, itemsPerPage).map((colaborador) => (
                                    <tr key={colaborador._id}>
                                      <td>
                                        <Badge bg="warning" className="d-flex align-items-center" style={{fontSize: '10px'}}>
                                          <i className="fas fa-hourglass-half me-1"></i>
                                          PENDENTE
                                        </Badge>
                                      </td>
                                      <td>
                                        <strong>{colaborador.nome}</strong>
                                        {colaborador.cpf && (
                                          <>
                                            <br />
                                            <small className="text-muted">
                                              CPF: {colaborador.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}
                                            </small>
                                          </>
                                        )}
                                      </td>
                                      <td>
                                        <span className="badge bg-secondary">
                                          {colaborador.cargo || 'Não informado'}
                                        </span>
                                      </td>
                                      <td className="text-warning">
                                        <strong>{formatCurrencyDisplay(colaborador.total_a_receber || 0)}</strong>
                                        <br/>
                                        <small>{colaborador.count_pendentes} lançamento(s)</small>
                                      </td>
                                    </tr>
                                  ))}
                                  
                                  {/* Controles de paginação para colaboradores */}
                                  {(colaboradoresAtrasados.length > 0 || colaboradoresPendentes.length > 0) && (
                                    <tr>
                                      <td colSpan={4}>
                                        <div className="mb-2">
                                          {colaboradoresAtrasados.length > itemsPerPage && (
                                            <div className="mb-2">
                                              <small className="text-danger fw-bold">📊 Colaboradores Atrasados:</small>
                                              {renderPaginationControls(
                                                colaboradoresAtrasadosPage,
                                                getTotalPages(colaboradoresAtrasados.length, itemsPerPage),
                                                setColaboradoresAtrasadosPage,
                                                colaboradoresAtrasados.length
                                              )}
                                            </div>
                                          )}
                                          {colaboradoresPendentes.length > itemsPerPage && (
                                            <div>
                                              <small className="text-warning fw-bold">📊 Colaboradores Pendentes:</small>
                                              {renderPaginationControls(
                                                colaboradoresPendentesPage,
                                                getTotalPages(colaboradoresPendentes.length, itemsPerPage),
                                                setColaboradoresPendentesPage,
                                                colaboradoresPendentes.length
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </>
                              )}
                              
                              {/* Mostrar alguns colaboradores em dia para comparação */}
                              {colaboradoresEmDia.length > 0 && (
                                <>
                                  <tr>
                                    <td colSpan={4} className="bg-light">
                                      <small className="text-success fw-bold">
                                        <i className="fas fa-check me-1"></i>
                                        Colaboradores em dia (mostrando {Math.min(itemsPerPage, colaboradoresEmDia.length)} de {colaboradoresEmDia.length}):
                                      </small>
                                    </td>
                                  </tr>
                                  {getPaginatedData(colaboradoresEmDia, colaboradoresEmDiaPage, itemsPerPage).map((colaborador) => (
                                    <tr key={`em_dia_colab_${colaborador._id}`} className="table-light">
                                      <td>
                                        <Badge bg="success" className="d-flex align-items-center" style={{fontSize: '10px'}}>
                                          <i className="fas fa-check me-1"></i>
                                          EM DIA
                                        </Badge>
                                      </td>
                                      <td>
                                        <strong>{colaborador.nome}</strong>
                                        {colaborador.cpf && (
                                          <>
                                            <br />
                                            <small className="text-muted">
                                              CPF: {colaborador.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}
                                            </small>
                                          </>
                                        )}
                                      </td>
                                      <td>
                                        <span className="badge bg-info">
                                          {colaborador.cargo || 'Não informado'}
                                        </span>
                                      </td>
                                      <td className="text-success">
                                        <strong>✅ Em dia</strong>
                                      </td>
                                    </tr>
                                  ))}
                                  {colaboradoresEmDia.length > itemsPerPage && (
                                    <tr className="table-light">
                                      <td colSpan={4}>
                                        <small className="text-success fw-bold">📊 Colaboradores em Dia:</small>
                                        {renderPaginationControls(
                                          colaboradoresEmDiaPage,
                                          getTotalPages(colaboradoresEmDia.length, itemsPerPage),
                                          setColaboradoresEmDiaPage,
                                          colaboradoresEmDia.length
                                        )}
                                      </td>
                                    </tr>
                                  )}
                                </>
                              )}
                            </tbody>
                          </Table>
                        </div>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {/* Resumo Total Unificado */}
            <Row className="mt-4">
              <Col>
                <Card className="border-primary">
                  <Card.Header className="bg-primary text-white">
                    <h6 className="mb-0">💰 Resumo Financeiro Total Unificado</h6>
                  </Card.Header>
                  <Card.Body>
                    <Row>
                      <Col md={4}>
                        <h6 className="text-danger">📥 A Receber de Unidades:</h6>
                        <h4 className="text-danger">{formatCurrencyDisplay(totalAtrasadoMoradores)}</h4>
                        <small className="text-muted">{moradoresAtrasados.length} unidade(s) em atraso</small>
                      </Col>
                      <Col md={4}>
                        <h6 className="text-warning">📤 A Pagar para Colaboradores:</h6>
                        <h4 className="text-warning">{formatCurrencyDisplay(totalPendenteColaboradores)}</h4>
                        <small className="text-muted">
                          {colaboradoresAtrasados.length > 0 && (
                            <span className="text-danger">{colaboradoresAtrasados.length} atrasados, </span>
                          )}
                          {colaboradoresPendentes.length} pendentes
                        </small>
                      </Col>
                      <Col md={4}>
                        <h6 className="text-info">🏢 Saldo do Condomínio:</h6>
                        <h4 className={`text-${dadosCondominio?.saldo_liquido >= 0 ? 'info' : 'warning'}`}>
                          {formatCurrencyDisplay(dadosCondominio?.saldo_liquido || 0)}
                        </h4>
                        <small className="text-muted">
                          Receitas - Despesas
                        </small>
                      </Col>
                    </Row>
                    <hr/>
                    <Row>
                      <Col md={6} className="text-center">
                        <h6 className="text-success">💼 Resultado Operacional:</h6>
                        <h3 className={resumoGeral?.resultado_liquido >= 0 ? 'text-success' : 'text-danger'}>
                          {formatCurrencyDisplay(resumoGeral?.resultado_liquido || 0)}
                        </h3>
                        <small className="text-muted">
                          A Receber - A Pagar
                        </small>
                      </Col>
                      <Col md={6} className="text-center">
                        <h6 className="text-primary">🔄 Situação Geral:</h6>
                        <div className="mt-2">
                          <Badge 
                            bg={resumoGeral?.situacao_financeira.moradores_ok ? 'success' : 'danger'} 
                            className="me-2 mb-2"
                          >
                            {resumoGeral?.situacao_financeira.moradores_ok ? '✅' : '⚠️'} Moradores
                          </Badge>
                          <Badge 
                            bg={resumoGeral?.situacao_financeira.colaboradores_ok ? 'success' : 'warning'} 
                            className="me-2 mb-2"
                          >
                            {resumoGeral?.situacao_financeira.colaboradores_ok ? '✅' : '⏳'} Colaboradores
                          </Badge>
                          <Badge 
                            bg={resumoGeral?.situacao_financeira.condominio_ok ? 'success' : 'info'} 
                            className="mb-2"
                          >
                            {resumoGeral?.situacao_financeira.condominio_ok ? '✅' : 'ℹ️'} Condomínio
                          </Badge>
                        </div>
                        <small className="text-muted d-block mt-2">
                          {lastUpdate && `Atualizado: ${lastUpdate}`}
                        </small>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
            
            {/* Nova seção de lançamentos detalhados */}
            <Row className="mt-4">
              <Col>
                <Card className="border-info">
                  <Card.Header className="bg-info text-white d-flex justify-content-between align-items-center">
                    <h6 className="mb-0">📊 Todos os Lançamentos Financeiros</h6>
                    <Button 
                      variant={showLancamentos ? 'light' : 'outline-light'}
                      size="sm"
                      onClick={() => {
                        setShowLancamentos(!showLancamentos)
                        if (!showLancamentos && selectedCondominiumId && currentUser) {
                          loadLancamentos(currentUser, selectedCondominiumId, 1)
                        }
                      }}
                    >
                      {showLancamentos ? '🔼 Ocultar' : '🔽 Mostrar'} Lançamentos
                    </Button>
                  </Card.Header>
                  
                  {showLancamentos && (
                    <Card.Body>
                      {/* Filtros */}
                      <Row className="mb-3">
                        <Col md={3}>
                          <Form.Group>
                            <Form.Label>Status</Form.Label>
                            <Form.Select
                              value={lancamentosFilters.status}
                              onChange={(e) => setLancamentosFilters({...lancamentosFilters, status: e.target.value})}
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
                            <Form.Label>Tipo</Form.Label>
                            <Form.Select
                              value={lancamentosFilters.tipo}
                              onChange={(e) => setLancamentosFilters({...lancamentosFilters, tipo: e.target.value})}
                            >
                              <option value="">Receitas e Despesas</option>
                              <option value="receita">Apenas Receitas</option>
                              <option value="despesa">Apenas Despesas</option>
                            </Form.Select>
                          </Form.Group>
                        </Col>
                        <Col md={3}>
                          <Form.Group>
                            <Form.Label>Origem</Form.Label>
                            <Form.Select
                              value={lancamentosFilters.origem}
                              onChange={(e) => setLancamentosFilters({...lancamentosFilters, origem: e.target.value})}
                            >
                              <option value="">Todas as origens</option>
                              <option value="morador">Moradores</option>
                              <option value="colaborador">Colaboradores</option>
                              <option value="condominio">Condomínio</option>
                            </Form.Select>
                          </Form.Group>
                        </Col>
                        <Col md={3} className="d-flex align-items-end">
                          <div className="w-100">
                            <Button 
                              variant="primary" 
                              className="me-2"
                              onClick={applyLancamentosFilters}
                              disabled={lancamentosLoading}
                            >
                              🔍 Filtrar
                            </Button>
                            <Button 
                              variant="outline-secondary"
                              onClick={clearLancamentosFilters}
                              disabled={lancamentosLoading}
                            >
                              🧹 Limpar
                            </Button>
                          </div>
                        </Col>
                      </Row>
                      
                      {/* Resumo dos lançamentos */}
                      {lancamentosResumo && (
                        <Row className="mb-3">
                          <Col md={3}>
                            <div className="text-center p-2 bg-success bg-opacity-10 rounded">
                              <small className="text-muted">Receitas</small>
                              <div className="h6 text-success">{formatCurrencyDisplay(lancamentosResumo.total_receitas)}</div>
                            </div>
                          </Col>
                          <Col md={3}>
                            <div className="text-center p-2 bg-danger bg-opacity-10 rounded">
                              <small className="text-muted">Despesas</small>
                              <div className="h6 text-danger">{formatCurrencyDisplay(lancamentosResumo.total_despesas)}</div>
                            </div>
                          </Col>
                          <Col md={3}>
                            <div className="text-center p-2 bg-warning bg-opacity-10 rounded">
                              <small className="text-muted">Pendente</small>
                              <div className="h6 text-warning">{formatCurrencyDisplay(lancamentosResumo.total_pendente)}</div>
                            </div>
                          </Col>
                          <Col md={3}>
                            <div className="text-center p-2 bg-info bg-opacity-10 rounded">
                              <small className="text-muted">Pago</small>
                              <div className="h6 text-info">{formatCurrencyDisplay(lancamentosResumo.total_pago)}</div>
                            </div>
                          </Col>
                        </Row>
                      )}
                      
                      {/* Tabela de lançamentos */}
                      {lancamentosLoading ? (
                        <div className="text-center py-4">
                          <div className="spinner-border spinner-border-sm me-2"></div>
                          Carregando lançamentos...
                        </div>
                      ) : (
                        <>
                          <div className="table-responsive">
                            <Table striped hover>
                              <thead className="table-light">
                                <tr>
                                  <th>Data</th>
                                  <th>Origem</th>
                                  <th>Pessoa/Local</th>
                                  <th>Descrição</th>
                                  <th>Categoria</th>
                                  <th>Tipo</th>
                                  <th>Valor</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {lancamentos.length === 0 ? (
                                  <tr>
                                    <td colSpan={8} className="text-center text-muted py-4">
                                      📝 Nenhum lançamento encontrado
                                    </td>
                                  </tr>
                                ) : (
                                  lancamentos.map((lancamento, index) => (
                                    <tr key={`${lancamento._id}_${index}`}>
                                      <td>
                                        <div>
                                          <strong>{new Date(lancamento.data_vencimento).toLocaleDateString('pt-BR')}</strong>
                                          {lancamento.data_pagamento && (
                                            <><br /><small className="text-muted">Pago: {new Date(lancamento.data_pagamento).toLocaleDateString('pt-BR')}</small></>
                                          )}
                                        </div>
                                      </td>
                                      <td>
                                        <Badge bg={lancamento.origem_sistema === 'morador' ? 'primary' : 
                                                   lancamento.origem_sistema === 'colaborador' ? 'secondary' : 'info'}>
                                          {lancamento.origem_nome}
                                        </Badge>
                                      </td>
                                      <td>
                                        <div>
                                          <strong>{lancamento.pessoa_nome}</strong>
                                          {(lancamento.bloco || lancamento.unidade) && (
                                            <><br /><small className="text-muted">
                                              {lancamento.bloco ? `${lancamento.bloco}-` : ''}{lancamento.unidade}
                                            </small></>
                                          )}
                                          {lancamento.cargo && (
                                            <><br /><small className="text-muted">{lancamento.cargo}</small></>
                                          )}
                                        </div>
                                      </td>
                                      <td>{lancamento.descricao}</td>
                                      <td>
                                        <span className="badge bg-light text-dark">
                                          {lancamento.categoria_display || lancamento.categoria}
                                        </span>
                                      </td>
                                      <td>
                                        <Badge bg={lancamento.tipo === 'receita' ? 'success' : 'danger'}>
                                          {lancamento.tipo === 'receita' ? '➕ Receita' : '➖ Despesa'}
                                        </Badge>
                                      </td>
                                      <td className={`text-${lancamento.tipo === 'receita' ? 'success' : 'danger'}`}>
                                        <strong>{formatCurrencyDisplay(lancamento.valor)}</strong>
                                      </td>
                                      <td>
                                        <Badge bg={
                                          lancamento.status === 'pago' ? 'success' :
                                          lancamento.status === 'pendente' ? 'warning' :
                                          lancamento.status === 'atrasado' ? 'danger' : 'secondary'
                                        }>
                                          {lancamento.status === 'pago' ? '✓ Pago' :
                                           lancamento.status === 'pendente' ? '🕰️ Pendente' :
                                           lancamento.status === 'atrasado' ? '⚠️ Atrasado' : lancamento.status}
                                        </Badge>
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </Table>
                          </div>
                          
                          {/* Controles de paginação */}
                          {lancamentosPagination && lancamentosPagination.total_pages > 1 && (
                            <div className="d-flex justify-content-between align-items-center mt-3">
                              <Button 
                                variant="outline-primary" 
                                size="sm" 
                                disabled={lancamentosPage === 1 || lancamentosLoading}
                                onClick={() => {
                                  const newPage = lancamentosPage - 1
                                  setLancamentosPage(newPage)
                                  loadLancamentos(currentUser, selectedCondominiumId, newPage)
                                }}
                              >
                                ← Anterior
                              </Button>
                              <div className="text-center">
                                <span className="badge bg-primary me-2">
                                  Página {lancamentosPagination.current_page} de {lancamentosPagination.total_pages}
                                </span>
                                <small className="text-muted">
                                  ({lancamentosPagination.total_items} lançamentos total)
                                </small>
                              </div>
                              <Button 
                                variant="outline-primary" 
                                size="sm" 
                                disabled={lancamentosPage === lancamentosPagination.total_pages || lancamentosLoading}
                                onClick={() => {
                                  const newPage = lancamentosPage + 1
                                  setLancamentosPage(newPage)
                                  loadLancamentos(currentUser, selectedCondominiumId, newPage)
                                }}
                              >
                                Próxima →
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </Card.Body>
                  )}
                </Card>
              </Col>
            </Row>
          </>
        )}
      </Container>
    </>
  )
}