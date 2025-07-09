'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Container, Row, Col, Card, Badge, Alert, Table, Form, Button, Spinner, Dropdown } from 'react-bootstrap'
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
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { Document, Packer, Paragraph, Table as DocxTable, TableRow, TableCell, WidthType } from 'docx'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

ChartJS.register(
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  ArcElement
)

//<editor-fold desc="Interfaces">
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
//</editor-fold>

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value)
}

const PageHeader = ({ lastUpdate, autoRefresh, onToggleAutoRefresh, onManualRefresh, loading, selectedCondominiumId, currentUser }) => (
  <Row className="mb-4 align-items-center">
    <Col md={6}>
      <h1 className="h2 mb-0">Dashboard Financeiro</h1>
      <p className="text-muted mb-0">Visão consolidada das finanças do condomínio.</p>
    </Col>
    <Col md={6} className="text-md-end">
      {lastUpdate && (
        <div className="d-flex align-items-center justify-content-md-end">
          <small className="text-muted me-3">
            Última atualização: {lastUpdate}
          </small>
          <Button variant="outline-secondary" size="sm" onClick={onToggleAutoRefresh} className="me-2">
            <i className={`fas ${autoRefresh ? 'fa-pause' : 'fa-play'} me-1`}></i>
            {autoRefresh ? 'Pausar' : 'Auto'}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => selectedCondominiumId && currentUser && onManualRefresh(currentUser, selectedCondominiumId)}
            disabled={loading}
          >
            {loading ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> : <i className="fas fa-sync-alt"></i>}
            <span className="ms-1">Atualizar</span>
          </Button>
        </div>
      )}
    </Col>
  </Row>
);

const CondominiumSelector = ({ condominiums, selectedCondominiumId, onCondominioChange, currentUser }) => {
    if (currentUser?.tipo !== 'master') return null;

    return (
        <Card className="shadow-sm mb-4">
            <Card.Body>
                <Row className="align-items-center">
                    <Col md={2}>
                        <h5 className="mb-0 text-primary">
                            <i className="fas fa-building me-2"></i>
                            Condomínio
                        </h5>
                    </Col>
                    <Col md={5}>
                        <Form.Select
                            value={selectedCondominiumId}
                            onChange={(e) => onCondominioChange(e.target.value)}
                            aria-label="Selecionar Condomínio"
                        >
                            <option value="">Selecione um condomínio...</option>
                            {condominiums.map((cond) => (
                                <option key={cond._id} value={cond._id}>
                                    {cond.nome}
                                </option>
                            ))}
                        </Form.Select>
                    </Col>
                    <Col md={5}>
                        {localStorage.getItem('activeCondominio') && localStorage.getItem('activeCondominio') === selectedCondominiumId && (
                            <div className="d-flex align-items-center text-success">
                                <i className="fas fa-check-circle me-2"></i>
                                <small>Condomínio ativo selecionado.</small>
                            </div>
                        )}
                    </Col>
                </Row>
            </Card.Body>
        </Card>
    );
};

const SummaryCard = ({ title, value, icon, variant, subValue, badgeText, badgeVariant }) => (
    <Card className={`shadow-sm h-100 border-start border-${variant} border-4 position-relative overflow-hidden`}>
        <Card.Body>
            <Row className="align-items-center">
                <Col xs={3}>
                    <div className={`text-${variant} display-6`}>
                        <i className={`fas ${icon}`}></i>
                    </div>
                </Col>
                <Col xs={9}>
                    <h6 className="text-muted mb-1">{title}</h6>
                    <h4 className={`mb-0 text-${variant}`}>{value}</h4>
                    {subValue && <small className="text-muted">{subValue}</small>}
                </Col>
            </Row>
            {badgeText && (
                <Badge pill bg={badgeVariant || variant} className="position-absolute top-0 end-0 m-2">
                    {badgeText}
                </Badge>
            )}
        </Card.Body>
        {/* Efeito de gradiente sutil */}
        <div className={`position-absolute bottom-0 end-0 w-25 h-25 opacity-10 bg-${variant}`} style={{
            background: `linear-gradient(45deg, transparent, var(--bs-${variant}))`,
            borderRadius: '50% 0 0 0'
        }}></div>
    </Card>
);

const FinancialAlerts = ({ moradoresAtrasados, colaboradoresAtrasados, colaboradoresPendentes, totalAtrasadoMoradores, totalAtrasadoColaboradores, totalPendenteColaboradores }) => {
    const hasAlerts = moradoresAtrasados.length > 0 || colaboradoresAtrasados.length > 0 || colaboradoresPendentes.length > 0;
    if (!hasAlerts) {
        return (
            <Alert variant="success" className="d-flex align-items-center shadow-sm">
                <i className="fas fa-check-circle fa-2x me-3"></i>
                <div>
                    <Alert.Heading>Parabéns! Situação financeira excelente!</Alert.Heading>
                    <p className="mb-0">Não há pendências financeiras no momento.</p>
                </div>
            </Alert>
        );
    }

    const isUrgent = moradoresAtrasados.length > 0 || colaboradoresAtrasados.length > 0;

    return (
        <Alert variant={isUrgent ? "danger" : "warning"} className="d-flex align-items-center shadow-sm">
            <i className={`fas ${isUrgent ? 'fa-exclamation-triangle' : 'fa-hourglass-half'} fa-2x me-3`}></i>
            <div>
                <Alert.Heading>{isUrgent ? 'Atenção! Existem itens em atraso' : 'Colaboradores com pagamentos pendentes'}</Alert.Heading>
                {moradoresAtrasados.length > 0 && (
                    <p className="mb-1">
                        <strong>{moradoresAtrasados.length} unidade(s)</strong> em atraso, totalizando <strong>{formatCurrency(totalAtrasadoMoradores)}</strong>.
                    </p>
                )}
                {colaboradoresAtrasados.length > 0 && (
                    <p className="mb-1">
                        <strong>{colaboradoresAtrasados.length} colaborador(es)</strong> em atraso, totalizando <strong>{formatCurrency(totalAtrasadoColaboradores)}</strong>.
                    </p>
                )}
                {colaboradoresPendentes.length > 0 && (
                    <p className="mb-1">
                        <strong>{colaboradoresPendentes.length} colaborador(es)</strong> pendente(s), totalizando <strong>{formatCurrency(totalPendenteColaboradores)}</strong>.
                    </p>
                )}
            </div>
        </Alert>
    );
};

const DetailedTable = ({ title, icon, variant, items, columns, type, onPageChange, currentPage, totalPages, totalItems, itemsPerPage }) => {
    const renderPagination = () => {
        if (totalPages <= 1) return null;
        return (
            <div className="d-flex justify-content-between align-items-center mt-3">
                <Button variant="outline-secondary" size="sm" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}>
                    <i className="fas fa-chevron-left"></i>
                </Button>
                <small className="text-muted">Página {currentPage} de {totalPages}</small>
                <Button variant="outline-secondary" size="sm" disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)}>
                    <i className="fas fa-chevron-right"></i>
                </Button>
            </div>
        );
    };

    return (
        <Card className="shadow-sm h-100">
            <Card.Header className={`bg-${variant}-light`}>
                <h6 className={`mb-0 text-${variant}`}>
                    <i className={`fas ${icon} me-2`}></i>
                    {title} ({totalItems})
                </h6>
            </Card.Header>
            <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <Table hover size="sm" className="mb-0">
                    <thead className="table-light sticky-top">
                        <tr>
                            {columns.map(col => <th key={col.key}>{col.label}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {items.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="text-center text-muted py-4">
                                    <i className="fas fa-check-circle fa-2x text-success mb-2"></i>
                                    <p className="mb-0">Nenhum item nesta categoria.</p>
                                </td>
                            </tr>
                        ) : (
                            items.map(item => (
                                <tr key={item._id}>
                                    {columns.map(col => <td key={col.key}>{col.render(item)}</td>)}
                                </tr>
                            ))
                        )}
                    </tbody>
                </Table>
            </div>
            {renderPagination()}
        </Card>
    );
};

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
  const [colaboradoresPendentesPage, setColaboradoresPendentesPage] = useState(1)
  const itemsPerPage = 10
  
  // Lançamentos detalhados
  const [showLancamentos, setShowLancamentos] = useState(false)
  const [lancamentos, setLancamentos] = useState<any[]>([])
  const [lancamentosPage, setLancamentosPage] = useState(1)
  const [lancamentosLoading, setLancamentosLoading] = useState(false)
  const [lancamentosPagination, setLancamentosPagination] = useState<any>(null)
  const [lancamentosFilters, setLancamentosFilters] = useState({
    status: '',
    tipo: '',
    origem: ''
  })

  // Estados para controle de período de exportação
  const [dataInicial, setDataInicial] = useState<Date | null>(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [dataFinal, setDataFinal] = useState<Date | null>(new Date())

  const loadResumoUnificado = useCallback(async (user: any, condominioId: string) => {
    setLoading(true)
    setAlert(null)
    try {
      const response = await fetch(
        `/api/financeiro-unificado/resumo?master_id=${user.master_id || user.id}&condominio_id=${condominioId}&tipo_usuario=${user.tipo}`
      )
      const data = await response.json()
      if (data.success) {
        setResumoUnificado(data)
        setLastUpdate(new Date(data.timestamp).toLocaleString('pt-BR'))
      } else {
        setAlert({ type: 'danger', message: data.error || 'Erro ao carregar dados financeiros' })
      }
    } catch (error) {
      setAlert({ type: 'danger', message: 'Erro de rede ao carregar dados financeiros' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const userData = localStorage.getItem('userData')
    if (userData) {
      const user = JSON.parse(userData)
      setCurrentUser(user)
      if (user.tipo === 'master') {
        const loadCondos = async (masterId) => {
            try {
                const response = await fetch(`/api/condominios?master_id=${encodeURIComponent(masterId)}`);
                const data = await response.json();
                if (data.success) setCondominiums(data.condominios);
            } catch (e) { console.error(e); }
        }
        loadCondos(user.id);
        const activeCondoId = localStorage.getItem('activeCondominio');
        if (activeCondoId) {
            setSelectedCondominiumId(activeCondoId);
            loadResumoUnificado(user, activeCondoId);
        }
      } else if (user.condominio_id) {
        setSelectedCondominiumId(user.condominio_id)
        loadResumoUnificado(user, user.condominio_id)
      }
    }

    const handleStorageChange = () => {
        const activeCondoId = localStorage.getItem('activeCondominio');
        if (activeCondoId && activeCondoId !== selectedCondominiumId) {
            const user = JSON.parse(localStorage.getItem('userData') || '{}');
            setSelectedCondominiumId(activeCondoId);
            if(user) loadResumoUnificado(user, activeCondoId);
        }
    }
    window.addEventListener('condominioChanged', handleStorageChange)
    return () => window.removeEventListener('condominioChanged', handleStorageChange)
  }, [loadResumoUnificado, selectedCondominiumId])

  useEffect(() => {
    if (autoRefresh && selectedCondominiumId && currentUser) {
      const interval = setInterval(() => {
        loadResumoUnificado(currentUser, selectedCondominiumId)
      }, 30000)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, selectedCondominiumId, currentUser, loadResumoUnificado])

  const handleCondominioChange = (condominioId: string) => {
    setSelectedCondominiumId(condominioId)
    localStorage.setItem('activeCondominio', condominioId);
    const condo = condominiums.find(c => c._id === condominioId);
    if(condo) localStorage.setItem('activeCondominiumName', condo.nome);

    if (condominioId && currentUser) {
      loadResumoUnificado(currentUser, condominioId)
    } else {
      setResumoUnificado(null)
    }
  }

  const getPaginatedData = (data: any[], page: number) => {
    const startIndex = (page - 1) * itemsPerPage;
    return data.slice(startIndex, startIndex + itemsPerPage);
  }

  const getTotalPages = (totalItems: number) => Math.ceil(totalItems / itemsPerPage);

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
      
      if (lancamentosFilters.status) params.append('status', lancamentosFilters.status)
      if (lancamentosFilters.tipo) params.append('tipo', lancamentosFilters.tipo)
      if (lancamentosFilters.origem) params.append('origem', lancamentosFilters.origem)
      
      const response = await fetch(`/api/financeiro-unificado/lancamentos?${params}`)
      const data = await response.json()
      
      if (data.success) {
        setLancamentos(data.lancamentos)
        setLancamentosPagination(data.pagination)
      } else {
        setAlert({ type: 'danger', message: data.error || 'Erro ao carregar lançamentos' })
      }
    } catch (error) {
      setAlert({ type: 'danger', message: 'Erro de rede ao carregar lançamentos' })
    } finally {
      setLancamentosLoading(false)
    }
  }

  // Função para atualizar status de lançamento rapidamente
  const handleQuickStatusUpdate = async (lancamento: any, newStatus: string) => {
    setLancamentosLoading(true)
    setAlert(null)

    try {
      let updateData: any = {
        status: newStatus,
        data_pagamento: newStatus === 'pago' ? new Date().toISOString().split('T')[0] : lancamento.data_pagamento,
        tipo_usuario: currentUser.tipo
      }

      let apiUrl = ''
      
      if (lancamento.origem_sistema === 'morador') {
        apiUrl = `/api/financeiro-morador/${lancamento._id}`
      } else if (lancamento.origem_sistema === 'colaborador') {
        apiUrl = `/api/financeiro-colaboradores`
        updateData._id = lancamento._id
      } else if (lancamento.origem_sistema === 'condominio') {
        apiUrl = `/api/financeiro-condominio/${lancamento._id}`
      } else {
        throw new Error('Origem do lançamento não identificada')
      }

      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      })

      const result = await response.json()
      if (result.success) {
        setAlert({ type: 'success', message: `Status atualizado para "${newStatus}" com sucesso!` })
        loadLancamentos(currentUser, selectedCondominiumId, lancamentosPage)
        loadResumoUnificado(currentUser, selectedCondominiumId)
      } else {
        setAlert({ type: 'danger', message: result.error || 'Erro ao atualizar status.' })
      }
    } catch (error) {
      setAlert({ type: 'danger', message: 'Erro de rede ao atualizar status.' })
    } finally {
      setLancamentosLoading(false)
    }
  }

  // Funções de Exportação
  const exportToExcel = () => {
    if (!resumoUnificado || !dadosUnificados) {
      setAlert({ type: 'warning', message: 'Nenhum dado disponível para exportação' })
      return
    }

    if (!dataInicial || !dataFinal) {
      setAlert({ type: 'warning', message: 'Por favor, selecione o período para exportação' })
      return
    }

    const wb = XLSX.utils.book_new()
    
    // Aba 1: Resumo Geral
    const resumoData = [
      ['RELATÓRIO FINANCEIRO - RESUMO GERAL'],
      ['Data de Geração:', new Date().toLocaleDateString('pt-BR')],
      ['Período:', `${dataInicial.toLocaleDateString('pt-BR')} até ${dataFinal.toLocaleDateString('pt-BR')}`],
      [''],
      ['RECEITAS E DESPESAS'],
      ['A Receber (Moradores):', formatCurrency(totalAtrasadoMoradores)],
      ['A Pagar (Colaboradores):', formatCurrency(totalPendenteColaboradores + totalAtrasadoColaboradores)],
      ['Saldo Líquido Condomínio:', formatCurrency(dadosUnificados?.condominio?.saldo_liquido || 0)],
      ['Resultado Operacional:', formatCurrency(resumoGeral?.resultado_liquido || 0)],
      [''],
      ['ESTATÍSTICAS DE UNIDADES'],
      ['Total de Unidades:', dadosUnificados.moradores.estatisticas.total_unidades],
      ['Unidades em Dia:', dadosUnificados.moradores.em_dia.length],
      ['Unidades Atrasadas:', moradoresAtrasados.length],
      [''],
      ['ESTATÍSTICAS DE COLABORADORES'],
      ['Total de Colaboradores:', dadosUnificados.colaboradores.estatisticas.total],
      ['Em Dia:', dadosUnificados.colaboradores.em_dia.length],
      ['Pendentes:', colaboradoresPendentes.length],
      ['Atrasados:', colaboradoresAtrasados.length]
    ]
    const wsResumo = XLSX.utils.aoa_to_sheet(resumoData)
    XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo Geral')

    // Aba 2: Moradores Atrasados
    if (moradoresAtrasados.length > 0) {
      const moradoresData = [
        ['MORADORES COM ATRASO'],
        ['Nome', 'Unidade', 'Valor Devido', 'Dias Atraso'],
        ...moradoresAtrasados.map(m => [
          m.nome,
          `${m.bloco ? `${m.bloco}-` : ''}${m.unidade}`,
          m.total_atrasado || 0,
          m.dias_atraso || 'N/A'
        ])
      ]
      const wsMoradores = XLSX.utils.aoa_to_sheet(moradoresData)
      XLSX.utils.book_append_sheet(wb, wsMoradores, 'Moradores Atrasados')
    }

    // Aba 3: Colaboradores Pendentes
    if (colaboradoresPendentes.length > 0 || colaboradoresAtrasados.length > 0) {
      const colaboradoresData = [
        ['COLABORADORES COM PENDÊNCIAS'],
        ['Nome', 'Cargo', 'Status', 'Valor a Pagar'],
        ...colaboradoresPendentes.map(c => [
          c.nome,
          c.cargo || 'N/A',
          'Pendente',
          c.total_a_receber || 0
        ]),
        ...colaboradoresAtrasados.map(c => [
          c.nome,
          c.cargo || 'N/A',
          'Atrasado',
          c.total_atrasado || 0
        ])
      ]
      const wsColaboradores = XLSX.utils.aoa_to_sheet(colaboradoresData)
      XLSX.utils.book_append_sheet(wb, wsColaboradores, 'Colaboradores')
    }

    // Aba 4: Lançamentos (se disponíveis)
    if (lancamentos.length > 0) {
      const lancamentosData = [
        ['LANÇAMENTOS FINANCEIROS'],
        ['Data Vencimento', 'Origem', 'Pessoa/Local', 'Descrição', 'Tipo', 'Valor', 'Status'],
        ...lancamentos.map(l => [
          new Date(l.data_vencimento).toLocaleDateString('pt-BR'),
          l.origem_nome,
          l.pessoa_nome,
          l.descricao,
          l.tipo === 'receita' ? 'Receita' : 'Despesa',
          l.valor,
          l.status
        ])
      ]
      const wsLancamentos = XLSX.utils.aoa_to_sheet(lancamentosData)
      XLSX.utils.book_append_sheet(wb, wsLancamentos, 'Lançamentos')
    }

    const fileName = `relatorio-financeiro-${new Date().toISOString().split('T')[0]}.xlsx`
    XLSX.writeFile(wb, fileName)
    setAlert({ type: 'success', message: 'Relatório Excel exportado com sucesso!' })
  }

  const exportToPDF = () => {
    if (!resumoUnificado || !dadosUnificados) {
      setAlert({ type: 'warning', message: 'Nenhum dado disponível para exportação' })
      return
    }

    if (!dataInicial || !dataFinal) {
      setAlert({ type: 'warning', message: 'Por favor, selecione o período para exportação' })
      return
    }

    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    
    // Cabeçalho
    doc.setFontSize(18)
    doc.text('RELATÓRIO FINANCEIRO', pageWidth / 2, 20, { align: 'center' })
    
    doc.setFontSize(12)
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth / 2, 30, { align: 'center' })
    doc.text(`Período: ${dataInicial.toLocaleDateString('pt-BR')} até ${dataFinal.toLocaleDateString('pt-BR')}`, pageWidth / 2, 40, { align: 'center' })
    
    let yPosition = 60
    
    // Resumo Financeiro
    doc.setFontSize(14)
    doc.text('RESUMO FINANCEIRO', 20, yPosition)
    yPosition += 15
    
    doc.setFontSize(11)
    const resumoItems = [
      ['A Receber (Moradores):', formatCurrency(totalAtrasadoMoradores)],
      ['A Pagar (Colaboradores):', formatCurrency(totalPendenteColaboradores + totalAtrasadoColaboradores)],
      ['Saldo Líquido:', formatCurrency(dadosUnificados?.condominio?.saldo_liquido || 0)],
      ['Resultado:', formatCurrency(resumoGeral?.resultado_liquido || 0)]
    ]
    
    resumoItems.forEach(([label, value]) => {
      doc.text(label, 20, yPosition)
      doc.text(value, 120, yPosition)
      yPosition += 8
    })
    
    yPosition += 10
    
    // Estatísticas
    doc.setFontSize(14)
    doc.text('ESTATÍSTICAS', 20, yPosition)
    yPosition += 15
    
    doc.setFontSize(11)
    const estatisticas = [
      ['Unidades em Dia:', `${dadosUnificados.moradores.em_dia.length}/${dadosUnificados.moradores.estatisticas.total_unidades}`],
      ['Unidades Atrasadas:', moradoresAtrasados.length.toString()],
      ['Colaboradores em Dia:', dadosUnificados.colaboradores.em_dia.length.toString()],
      ['Colaboradores Pendentes:', (colaboradoresPendentes.length + colaboradoresAtrasados.length).toString()]
    ]
    
    estatisticas.forEach(([label, value]) => {
      doc.text(label, 20, yPosition)
      doc.text(value, 120, yPosition)
      yPosition += 8
    })
    
    // Tabela de Moradores Atrasados
    if (moradoresAtrasados.length > 0) {
      yPosition += 15
      doc.setFontSize(14)
      doc.text('MORADORES EM ATRASO', 20, yPosition)
      yPosition += 10
      
      const moradoresTableData = moradoresAtrasados.map(m => [
        m.nome,
        `${m.bloco ? `${m.bloco}-` : ''}${m.unidade}`,
        formatCurrency(m.total_atrasado || 0),
        `${m.dias_atraso || 'N/A'}d`
      ])
      
      ;(doc as any).autoTable({
        head: [['Nome', 'Unidade', 'Valor Devido', 'Dias Atraso']],
        body: moradoresTableData,
        startY: yPosition,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [220, 53, 69] }
      })
    }
    
    const fileName = `relatorio-financeiro-${new Date().toISOString().split('T')[0]}.pdf`
    doc.save(fileName)
    setAlert({ type: 'success', message: 'Relatório PDF exportado com sucesso!' })
  }

  const exportToWord = async () => {
    if (!resumoUnificado || !dadosUnificados) {
      setAlert({ type: 'warning', message: 'Nenhum dado disponível para exportação' })
      return
    }

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: 'RELATÓRIO FINANCEIRO',
            heading: 'Title',
            alignment: 'center'
          }),
          new Paragraph({
            text: `Data: ${new Date().toLocaleDateString('pt-BR')}`,
            alignment: 'center'
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            text: 'RESUMO FINANCEIRO',
            heading: 'Heading1'
          }),
          new Paragraph({
            text: `A Receber (Moradores): ${formatCurrency(totalAtrasadoMoradores)}`
          }),
          new Paragraph({
            text: `A Pagar (Colaboradores): ${formatCurrency(totalPendenteColaboradores + totalAtrasadoColaboradores)}`
          }),
          new Paragraph({
            text: `Saldo Líquido: ${formatCurrency(dadosUnificados?.condominio?.saldo_liquido || 0)}`
          }),
          new Paragraph({
            text: `Resultado: ${formatCurrency(resumoGeral?.resultado_liquido || 0)}`
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            text: 'ESTATÍSTICAS',
            heading: 'Heading1'
          }),
          new Paragraph({
            text: `Unidades em Dia: ${dadosUnificados.moradores.em_dia.length}/${dadosUnificados.moradores.estatisticas.total_unidades}`
          }),
          new Paragraph({
            text: `Unidades Atrasadas: ${moradoresAtrasados.length}`
          }),
          new Paragraph({
            text: `Colaboradores em Dia: ${dadosUnificados.colaboradores.em_dia.length}`
          }),
          new Paragraph({
            text: `Colaboradores Pendentes: ${colaboradoresPendentes.length + colaboradoresAtrasados.length}`
          })
        ]
      }]
    })

    try {
      const buffer = await Packer.toBuffer(doc)
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
      const fileName = `relatorio-financeiro-${new Date().toISOString().split('T')[0]}.docx`
      saveAs(blob, fileName)
      setAlert({ type: 'success', message: 'Relatório Word exportado com sucesso!' })
    } catch (error) {
      setAlert({ type: 'danger', message: 'Erro ao gerar arquivo Word' })
    }
  }

  const dadosUnificados = resumoUnificado?.dados_unificados
  const resumoGeral = resumoUnificado?.resumo_geral

  const moradoresAtrasados = dadosUnificados?.moradores.atrasados || []
  const colaboradoresPendentes = dadosUnificados?.colaboradores.pendentes || []
  const colaboradoresAtrasados = dadosUnificados?.colaboradores.atrasados || []

  const totalAtrasadoMoradores = resumoGeral?.total_a_receber_moradores || 0
  const totalPendenteColaboradores = resumoGeral?.total_a_pagar_colaboradores || 0
  const totalAtrasadoColaboradores = colaboradoresAtrasados.reduce((sum, c) => sum + (c.total_atrasado || 0), 0)

  const moradoresColumns = [
      { key: 'status', label: 'Status', render: (item) => <Badge bg="danger">Atrasado</Badge> },
      { key: 'nome', label: 'Morador', render: (item) => <strong>{item.nome}</strong> },
      { key: 'unidade', label: 'Unidade', render: (item) => <>{item.bloco ? `${item.bloco}-` : ''}{item.unidade}</> },
      { key: 'valor', label: 'Valor Devido', render: (item) => <span className="text-danger">{formatCurrency(item.total_atrasado || 0)}</span> },
      { key: 'dias', label: 'Dias Atraso', render: (item) => <Badge bg="dark">{item.dias_atraso || 'N/A'}d</Badge> },
  ];

  const colaboradoresColumns = [
      { key: 'status', label: 'Status', render: (item) => <Badge bg={item.status_pagamento === 'atrasado' ? 'danger' : 'warning'}>{item.status_pagamento.toUpperCase()}</Badge> },
      { key: 'nome', label: 'Colaborador', render: (item) => <strong>{item.nome}</strong> },
      { key: 'cargo', label: 'Cargo', render: (item) => item.cargo || 'N/A' },
      { key: 'valor', label: 'Valor a Pagar', render: (item) => <span className={item.status_pagamento === 'atrasado' ? 'text-danger' : 'text-warning'}>{formatCurrency(item.total_a_receber || item.total_atrasado || 0)}</span> },
  ];

  return (
    <Container fluid className="py-4">
      {alert && <Alert variant={alert.type} dismissible onClose={() => setAlert(null)}>{alert.message}</Alert>}

      <PageHeader
          lastUpdate={lastUpdate}
          autoRefresh={autoRefresh}
          onToggleAutoRefresh={() => setAutoRefresh(!autoRefresh)}
          onManualRefresh={loadResumoUnificado}
          loading={loading}
          selectedCondominiumId={selectedCondominiumId}
          currentUser={currentUser}
      />

      <CondominiumSelector
          condominiums={condominiums}
          selectedCondominiumId={selectedCondominiumId}
          onCondominioChange={handleCondominioChange}
          currentUser={currentUser}
      />

      {/* Seleção de Período para Exportação */}
      {selectedCondominiumId && resumoUnificado && (
        <Row className="mb-3">
          <Col>
            <Card className="shadow-sm border-info">
              <Card.Header className="bg-info text-white">
                <h6 className="mb-0">
                  <i className="fas fa-calendar-alt me-2"></i>
                  Período para Exportação
                </h6>
              </Card.Header>
              <Card.Body>
                <Row className="align-items-end">
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label className="small fw-bold">Data Inicial</Form.Label>
                      <DatePicker
                        selected={dataInicial}
                        onChange={(date) => setDataInicial(date)}
                        dateFormat="dd/MM/yyyy"
                        className="form-control"
                        placeholderText="Selecione a data inicial"
                        maxDate={dataFinal || new Date()}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label className="small fw-bold">Data Final</Form.Label>
                      <DatePicker
                        selected={dataFinal}
                        onChange={(date) => setDataFinal(date)}
                        dateFormat="dd/MM/yyyy"
                        className="form-control"
                        placeholderText="Selecione a data final"
                        minDate={dataInicial || undefined}
                        maxDate={new Date()}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <div className="d-flex gap-2">
                      <Button 
                        variant="outline-secondary" 
                        size="sm" 
                        onClick={() => {
                          const hoje = new Date()
                          setDataInicial(new Date(hoje.getFullYear(), hoje.getMonth(), 1))
                          setDataFinal(hoje)
                        }}
                      >
                        <i className="fas fa-calendar-week me-1"></i>
                        Mês Atual
                      </Button>
                      <Button 
                        variant="outline-secondary" 
                        size="sm" 
                        onClick={() => {
                          const hoje = new Date()
                          setDataInicial(new Date(hoje.getFullYear(), 0, 1))
                          setDataFinal(hoje)
                        }}
                      >
                        <i className="fas fa-calendar-year me-1"></i>
                        Ano Atual
                      </Button>
                    </div>
                  </Col>
                </Row>
                <Row className="mt-2">
                  <Col>
                    <small className="text-muted">
                      <i className="fas fa-info-circle me-1"></i>
                      Período selecionado: {dataInicial ? dataInicial.toLocaleDateString('pt-BR') : 'N/A'} até {dataFinal ? dataFinal.toLocaleDateString('pt-BR') : 'N/A'}
                    </small>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Botões de Exportação */}
      {selectedCondominiumId && resumoUnificado && (
        <Row className="mb-4">
          <Col>
            <Card className="shadow-sm border-primary">
              <Card.Header className="bg-primary text-white">
                <Row className="align-items-center">
                  <Col>
                    <h6 className="mb-0">
                      <i className="fas fa-download me-2"></i>
                      Exportar Relatórios Financeiros
                    </h6>
                  </Col>
                  <Col xs="auto">
                    <div className="d-flex gap-2">
                      <Button 
                        variant="success" 
                        size="sm" 
                        onClick={exportToExcel}
                        disabled={loading}
                      >
                        <i className="fas fa-file-excel me-1"></i>
                        Excel
                      </Button>
                      <Button 
                        variant="danger" 
                        size="sm" 
                        onClick={exportToPDF}
                        disabled={loading}
                      >
                        <i className="fas fa-file-pdf me-1"></i>
                        PDF
                      </Button>
                      <Button 
                        variant="info" 
                        size="sm" 
                        onClick={exportToWord}
                        disabled={loading}
                      >
                        <i className="fas fa-file-word me-1"></i>
                        Word
                      </Button>
                    </div>
                  </Col>
                </Row>
              </Card.Header>
              <Card.Body className="py-2">
                <small className="text-muted">
                  <i className="fas fa-info-circle me-1"></i>
                  Exporte os dados financeiros em diferentes formatos para análise e compartilhamento.
                  Os relatórios incluem resumo geral, moradores em atraso, colaboradores pendentes e lançamentos detalhados.
                </small>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {!selectedCondominiumId ? (
        <Alert variant="info" className="text-center shadow-sm">
          <h5 className="mb-0"><i className="fas fa-info-circle me-2"></i>Selecione um condomínio para visualizar os dados.</h5>
        </Alert>
      ) : loading && !resumoUnificado ? (
        <div className="text-center py-5">
            <Spinner animation="border" variant="primary" style={{ width: '3rem', height: '3rem' }}/>
            <h5 className="mt-3">Carregando dados financeiros...</h5>
        </div>
      ) : resumoUnificado && dadosUnificados && resumoGeral ? (
        <>
          <Row className="mb-4">
              <Col>
                  <FinancialAlerts
                      moradoresAtrasados={moradoresAtrasados}
                      colaboradoresAtrasados={colaboradoresAtrasados}
                      colaboradoresPendentes={colaboradoresPendentes}
                      totalAtrasadoMoradores={totalAtrasadoMoradores}
                      totalAtrasadoColaboradores={totalAtrasadoColaboradores}
                      totalPendenteColaboradores={totalPendenteColaboradores}
                  />
              </Col>
          </Row>

          <Row className="mb-4 g-4">
              <Col md={3}>
                  <SummaryCard title="Unidades em Dia" value={dadosUnificados.moradores.em_dia.length} icon="fa-check-circle" variant="success" subValue={`de ${dadosUnificados.moradores.estatisticas.total_unidades}`} />
              </Col>
              <Col md={3}>
                  <SummaryCard title="Unidades Atrasadas" value={moradoresAtrasados.length} icon="fa-exclamation-triangle" variant="danger" subValue={formatCurrency(totalAtrasadoMoradores)} badgeText={moradoresAtrasados.length > 0 ? "URGENTE" : undefined} badgeVariant="danger" />
              </Col>
              <Col md={3}>
                  <SummaryCard title="Colaboradores em Dia" value={dadosUnificados.colaboradores.em_dia.length} icon="fa-user-check" variant="info" subValue={`de ${dadosUnificados.colaboradores.estatisticas.total}`} />
              </Col>
              <Col md={3}>
                  <SummaryCard title="Pagamentos Pendentes" value={colaboradoresPendentes.length + colaboradoresAtrasados.length} icon="fa-hourglass-half" variant="warning" subValue={formatCurrency(totalPendenteColaboradores + totalAtrasadoColaboradores)} badgeText={(colaboradoresPendentes.length + colaboradoresAtrasados.length) > 0 ? "PAGAR" : undefined} badgeVariant="warning" />
              </Col>
          </Row>

          <Row className="mb-4 g-4">
              <Col md={6}>
                  <Card className="shadow-sm h-100">
                      <Card.Header><h6 className="mb-0"><i className="fas fa-chart-pie me-2"></i>Status das Unidades</h6></Card.Header>
                      <Card.Body>
                        <div style={{ maxHeight: '250px' }}>
                          <Doughnut data={{
                              labels: ['Em Dia', 'Atrasadas'],
                              datasets: [{
                                  data: [dadosUnificados.moradores.em_dia.length, moradoresAtrasados.length],
                                  backgroundColor: ['#198754', '#dc3545'],
                                  borderColor: '#fff',
                                  borderWidth: 2,
                              }]
                          }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} />
                        </div>
                      </Card.Body>
                  </Card>
              </Col>
              <Col md={6}>
                  <Card className="shadow-sm h-100">
                      <Card.Header><h6 className="mb-0"><i className="fas fa-users me-2"></i>Status dos Colaboradores</h6></Card.Header>
                      <Card.Body>
                        <div style={{ maxHeight: '250px' }}>
                          <Doughnut data={{
                              labels: ['Em Dia', 'Pendentes', 'Atrasados'],
                              datasets: [{
                                  data: [dadosUnificados.colaboradores.em_dia.length, colaboradoresPendentes.length, colaboradoresAtrasados.length],
                                  backgroundColor: ['#0dcaf0', '#ffc107', '#dc3545'],
                                  borderColor: '#fff',
                                  borderWidth: 2,
                              }]
                          }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} />
                        </div>
                      </Card.Body>
                  </Card>
              </Col>
          </Row>

          {/* Resumo Financeiro Total */}
          <Row className="mb-4">
              <Col>
                  <Card className="shadow-sm border-primary border-2">
                      <Card.Header className="bg-primary text-white">
                          <Row className="align-items-center">
                              <Col>
                                  <h5 className="mb-0">
                                      <i className="fas fa-calculator me-2"></i>
                                      Resumo Financeiro Consolidado
                                  </h5>
                              </Col>
                              <Col xs="auto">
                                  <Badge bg="light" text="dark" className="fs-6">
                                      {new Date().toLocaleDateString('pt-BR')}
                                  </Badge>
                              </Col>
                          </Row>
                      </Card.Header>
                      <Card.Body className="bg-light">
                          <Row className="g-3">
                              <Col md={3}>
                                  <div className="text-center p-3 bg-white rounded shadow-sm border-start border-success border-4">
                                      <div className="text-success display-6 mb-2">
                                          <i className="fas fa-arrow-up"></i>
                                      </div>
                                      <h6 className="text-muted">A Receber</h6>
                                      <h4 className="text-success mb-0">{formatCurrency(totalAtrasadoMoradores)}</h4>
                                      <small className="text-muted">{moradoresAtrasados.length} unidade(s)</small>
                                  </div>
                              </Col>
                              <Col md={3}>
                                  <div className="text-center p-3 bg-white rounded shadow-sm border-start border-warning border-4">
                                      <div className="text-warning display-6 mb-2">
                                          <i className="fas fa-arrow-down"></i>
                                      </div>
                                      <h6 className="text-muted">A Pagar</h6>
                                      <h4 className="text-warning mb-0">{formatCurrency(totalPendenteColaboradores + totalAtrasadoColaboradores)}</h4>
                                      <small className="text-muted">{colaboradoresPendentes.length + colaboradoresAtrasados.length} colaborador(es)</small>
                                  </div>
                              </Col>
                              <Col md={3}>
                                  <div className="text-center p-3 bg-white rounded shadow-sm border-start border-info border-4">
                                      <div className="text-info display-6 mb-2">
                                          <i className="fas fa-balance-scale"></i>
                                      </div>
                                      <h6 className="text-muted">Saldo Líquido</h6>
                                      <h4 className={`mb-0 ${(dadosUnificados?.condominio?.saldo_liquido || 0) >= 0 ? 'text-info' : 'text-danger'}`}>
                                          {formatCurrency(dadosUnificados?.condominio?.saldo_liquido || 0)}
                                      </h4>
                                      <small className="text-muted">Condomínio</small>
                                  </div>
                              </Col>
                              <Col md={3}>
                                  <div className="text-center p-3 bg-white rounded shadow-sm border-start border-primary border-4">
                                      <div className={`display-6 mb-2 ${(resumoGeral?.resultado_liquido || 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                                          <i className={`fas ${(resumoGeral?.resultado_liquido || 0) >= 0 ? 'fa-trending-up' : 'fa-trending-down'}`}></i>
                                      </div>
                                      <h6 className="text-muted">Resultado</h6>
                                      <h4 className={`mb-0 ${(resumoGeral?.resultado_liquido || 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                                          {formatCurrency(resumoGeral?.resultado_liquido || 0)}
                                      </h4>
                                      <small className="text-muted">Operacional</small>
                                  </div>
                              </Col>
                          </Row>
                      </Card.Body>
                  </Card>
              </Col>
          </Row>

          <Row className="g-4">
              <Col lg={6}>
                  <DetailedTable
                      title="Unidades com Atraso"
                      icon="fa-exclamation-circle"
                      variant="danger"
                      items={getPaginatedData(moradoresAtrasados, moradoresAtrasadosPage)}
                      columns={moradoresColumns}
                      type="moradores"
                      onPageChange={setMoradoresAtrasadosPage}
                      currentPage={moradoresAtrasadosPage}
                      totalPages={getTotalPages(moradoresAtrasados.length)}
                      totalItems={moradoresAtrasados.length}
                      itemsPerPage={itemsPerPage}
                  />
              </Col>
              <Col lg={6}>
                  <DetailedTable
                      title="Colaboradores com Pendências"
                      icon="fa-user-clock"
                      variant="warning"
                      items={getPaginatedData([...colaboradoresAtrasados, ...colaboradoresPendentes], colaboradoresPendentesPage)}
                      columns={colaboradoresColumns}
                      type="colaboradores"
                      onPageChange={setColaboradoresPendentesPage}
                      currentPage={colaboradoresPendentesPage}
                      totalPages={getTotalPages(colaboradoresAtrasados.length + colaboradoresPendentes.length)}
                      totalItems={colaboradoresAtrasados.length + colaboradoresPendentes.length}
                      itemsPerPage={itemsPerPage}
                  />
              </Col>
          </Row>

          {/* Seção de Lançamentos Detalhados */}
          <Row className="mt-4">
              <Col>
                  <Card className="shadow-sm border-info">
                      <Card.Header className="bg-info text-white d-flex justify-content-between align-items-center">
                          <h5 className="mb-0">
                              <i className="fas fa-list me-2"></i>
                              Todos os Lançamentos Financeiros
                          </h5>
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
                              <i className={`fas ${showLancamentos ? 'fa-chevron-up' : 'fa-chevron-down'} me-1`}></i>
                              {showLancamentos ? 'Ocultar' : 'Mostrar'} Lançamentos
                          </Button>
                      </Card.Header>
                      
                      {showLancamentos && (
                          <Card.Body>
                              {/* Filtros */}
                              <Row className="mb-3">
                                  <Col md={3}>
                                      <Form.Group>
                                          <Form.Label className="fw-bold">Status</Form.Label>
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
                                          <Form.Label className="fw-bold">Tipo</Form.Label>
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
                                          <Form.Label className="fw-bold">Origem</Form.Label>
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
                                      <div className="w-100 d-flex gap-2">
                                          <Button 
                                              variant="primary" 
                                              onClick={() => loadLancamentos(currentUser, selectedCondominiumId, 1)}
                                              disabled={lancamentosLoading}
                                              className="flex-fill"
                                          >
                                              <i className="fas fa-search me-1"></i>
                                              Filtrar
                                          </Button>
                                          <Button 
                                              variant="outline-secondary"
                                              onClick={() => {
                                                  setLancamentosFilters({ status: '', tipo: '', origem: '' })
                                                  loadLancamentos(currentUser, selectedCondominiumId, 1)
                                              }}
                                              disabled={lancamentosLoading}
                                          >
                                              <i className="fas fa-times"></i>
                                          </Button>
                                      </div>
                                  </Col>
                              </Row>
                              
                              {/* Tabela de lançamentos */}
                              {lancamentosLoading ? (
                                  <div className="text-center py-4">
                                      <Spinner animation="border" variant="primary" />
                                      <h6 className="mt-2">Carregando lançamentos...</h6>
                                  </div>
                              ) : (
                                  <>
                                      <div className="table-responsive">
                                          <Table striped hover>
                                              <thead className="table-dark">
                                                  <tr>
                                                      <th>Data</th>
                                                      <th>Origem</th>
                                                      <th>Pessoa/Local</th>
                                                      <th>Descrição</th>
                                                      <th>Tipo</th>
                                                      <th>Valor</th>
                                                      <th>Status</th>
                                                  </tr>
                                              </thead>
                                              <tbody>
                                                  {lancamentos.length === 0 ? (
                                                      <tr>
                                                          <td colSpan={7} className="text-center text-muted py-5">
                                                              <i className="fas fa-search fa-3x mb-3 text-muted"></i>
                                                              <h5>Nenhum lançamento encontrado</h5>
                                                              <p className="mb-0">Tente ajustar os filtros ou verificar se há dados disponíveis.</p>
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
                                                                      {lancamento.origem_sistema === 'morador' ? (
                                                                          <>
                                                                              {/* Informações do morador específico do lançamento */}
                                                                              <div className="d-flex align-items-center mb-1">
                                                                                  <strong>{lancamento.pessoa_nome}</strong>
                                                                                  {lancamento.tipo_morador && (
                                                                                      <Badge 
                                                                                          bg={lancamento.tipo_morador === 'proprietario' ? 'primary' : 'info'} 
                                                                                          className="ms-2 small"
                                                                                      >
                                                                                          {lancamento.tipo_morador === 'proprietario' ? 'Proprietário' : 'Inquilino'}
                                                                                      </Badge>
                                                                                  )}
                                                                              </div>

                                                                              {/* Todos os moradores da unidade */}
                                                                              {lancamento.todos_moradores_unidade && lancamento.todos_moradores_unidade.length > 0 && (
                                                                                  <div className="mb-2">
                                                                                      <div className="text-muted small fw-bold mb-1">
                                                                                          <i className="fas fa-users me-1"></i>
                                                                                          Moradores da Unidade:
                                                                                      </div>
                                                                                      <div className="small">
                                                                                          {lancamento.todos_moradores_unidade.map((morador, idx) => (
                                                                                              <span key={morador._id || idx}>
                                                                                                  <strong>{morador.nome}</strong>
                                                                                                  <span className="text-muted"> ({morador.tipo || 'proprietario'})</span>
                                                                                                  {idx < lancamento.todos_moradores_unidade.length - 1 && ', '}
                                                                                              </span>
                                                                                          ))}
                                                                                      </div>
                                                                                  </div>
                                                                              )}

                                                                              {/* Informações da unidade */}
                                                                              {(lancamento.bloco || lancamento.unidade) && (
                                                                                  <div className="text-muted small">
                                                                                      <i className="fas fa-building me-1"></i>
                                                                                      Unidade: <strong>{lancamento.bloco ? `${lancamento.bloco}-` : ''}{lancamento.unidade}</strong>
                                                                                  </div>
                                                                              )}
                                                                              
                                                                              {/* Informações de contato */}
                                                                              {lancamento.cpf_morador && (
                                                                                  <div className="text-muted small">
                                                                                      <i className="fas fa-id-card me-1"></i>
                                                                                      CPF: {lancamento.cpf_morador}
                                                                                  </div>
                                                                              )}
                                                                              {lancamento.telefone_morador && (
                                                                                  <div className="text-muted small">
                                                                                      <i className="fas fa-phone me-1"></i>
                                                                                      {lancamento.telefone_morador}
                                                                                  </div>
                                                                              )}
                                                                          </>
                                                                      ) : lancamento.origem_sistema === 'colaborador' ? (
                                                                          <>
                                                                              <div className="d-flex align-items-center mb-1">
                                                                                  <strong>{lancamento.pessoa_nome}</strong>
                                                                                  <Badge bg="secondary" className="ms-2 small">
                                                                                      Colaborador
                                                                                  </Badge>
                                                                              </div>
                                                                              {lancamento.cargo && (
                                                                                  <div className="text-muted small">
                                                                                      <i className="fas fa-user-tie me-1"></i>
                                                                                      Cargo: {lancamento.cargo}
                                                                                  </div>
                                                                              )}
                                                                          </>
                                                                      ) : (
                                                                          <>
                                                                              <div className="d-flex align-items-center mb-1">
                                                                                  <strong>{lancamento.pessoa_nome}</strong>
                                                                                  <Badge bg="info" className="ms-2 small">
                                                                                      Condomínio
                                                                                  </Badge>
                                                                              </div>
                                                                              {(lancamento.bloco || lancamento.unidade) && (
                                                                                  <div className="text-muted small">
                                                                                      <i className="fas fa-building me-1"></i>
                                                                                      Local: {lancamento.bloco ? `${lancamento.bloco}-` : ''}{lancamento.unidade}
                                                                                  </div>
                                                                              )}
                                                                          </>
                                                                      )}
                                                                  </div>
                                                              </td>
                                                              <td>{lancamento.descricao}</td>
                                                              <td>
                                                                  <Badge bg={lancamento.tipo === 'receita' ? 'success' : 'danger'}>
                                                                      <i className={`fas ${lancamento.tipo === 'receita' ? 'fa-plus' : 'fa-minus'} me-1`}></i>
                                                                      {lancamento.tipo === 'receita' ? 'Receita' : 'Despesa'}
                                                                  </Badge>
                                                              </td>
                                                              <td className={`text-${lancamento.tipo === 'receita' ? 'success' : 'danger'}`}>
                                                                  <strong>{formatCurrency(lancamento.valor)}</strong>
                                                              </td>
                                                              <td>
                                                                  <Badge bg={
                                                                      lancamento.status === 'pago' ? 'success' :
                                                                      lancamento.status === 'pendente' ? 'warning' :
                                                                      lancamento.status === 'atrasado' ? 'danger' : 'secondary'
                                                                  }>
                                                                      <i className={`fas ${
                                                                          lancamento.status === 'pago' ? 'fa-check' :
                                                                          lancamento.status === 'pendente' ? 'fa-clock' :
                                                                          lancamento.status === 'atrasado' ? 'fa-exclamation-triangle' : 'fa-times'
                                                                      } me-1`}></i>
                                                                      {lancamento.status === 'pago' ? 'Pago' :
                                                                       lancamento.status === 'pendente' ? 'Pendente' :
                                                                       lancamento.status === 'atrasado' ? 'Atrasado' : 'Cancelado'}
                                                                  </Badge>
                                                              </td>
                                                          </tr>
                                                      ))
                                                  )}
                                              </tbody>
                                          </Table>
                                      </div>
                                      
                                      {/* Paginação */}
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
                                                  <i className="fas fa-chevron-left me-1"></i>
                                                  Anterior
                                              </Button>
                                              <div className="text-center">
                                                  <Badge bg="primary" className="fs-6">
                                                      Página {lancamentosPagination.current_page} de {lancamentosPagination.total_pages}
                                                  </Badge>
                                                  <div className="mt-1">
                                                      <small className="text-muted">
                                                          ({lancamentosPagination.total_items} lançamentos total)
                                                      </small>
                                                  </div>
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
                                                  Próxima
                                                  <i className="fas fa-chevron-right ms-1"></i>
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
      ) : null}
    </Container>
  )
}
