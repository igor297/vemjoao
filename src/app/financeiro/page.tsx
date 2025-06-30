'use client'

import React, { useState, useEffect } from 'react'
import { Container, Row, Col, Card, Badge, Alert, Table, Form } from 'react-bootstrap'
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

export default function FinanceiroPage() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [selectedCondominiumId, setSelectedCondominiumId] = useState<string>('')
  const [condominiums, setCondominiums] = useState<any[]>([])
  const [resumoMoradores, setResumoMoradores] = useState<ResumoMorador[]>([])
  const [resumoColaboradores, setResumoColaboradores] = useState<ResumoColaborador[]>([])
  const [loading, setLoading] = useState(false)
  const [alert, setAlert] = useState<{type: string, message: string} | null>(null)

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
            loadResumoGeral(user, activeCondominiumId)
          }
        } else {
          if (user.condominio_id) {
            setSelectedCondominiumId(user.condominio_id)
            loadResumoGeral(user, user.condominio_id)
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
            loadResumoGeral(user, activeCondominioId)
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
          loadResumoGeral(currentUser, activeCondominio)
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
      loadResumoGeral(currentUser, condominioId)
    } else {
      setResumoMoradores([])
      setResumoColaboradores([])
    }
  }

  const loadResumoGeral = async (user: any, condominioId: string) => {
    setLoading(true)
    try {
      // Carregar resumo dos moradores
      const moradorResponse = await fetch(
        `/api/financeiro-morador/status-moradores?master_id=${user.master_id || user.id}&condominio_id=${condominioId}&tipo_usuario=${user.tipo}`
      )
      const moradorData = await moradorResponse.json()
      
      if (moradorData.success) {
        // Processar moradores em dia
        const moradoresEmDiaProcessados = (moradorData.moradores_em_dia || []).map((morador: any) => ({
          ...morador,
          status_pagamento: 'em_dia',
          total_atrasado: 0,
          count_atrasados: 0
        }))
        
        // Processar moradores atrasados
        const moradoresAtrasadosProcessados = (moradorData.moradores_atrasados || []).map((morador: any) => ({
          ...morador,
          status_pagamento: 'atrasado'
        }))
        
        const todosMoradores = [...moradoresEmDiaProcessados, ...moradoresAtrasadosProcessados]
        console.log('📊 Moradores processados:', {
          em_dia: moradoresEmDiaProcessados.length,
          atrasados: moradoresAtrasadosProcessados.length,
          total: todosMoradores.length
        })
        setResumoMoradores(todosMoradores)
      } else {
        console.warn('⚠️ Erro ao carregar moradores:', moradorData.error)
      }

      // Carregar resumo dos colaboradores
      const colaboradorResponse = await fetch(
        `/api/financeiro-colaborador?master_id=${user.master_id || user.id}&condominio_id=${condominioId}&tipo_usuario=${user.tipo}&relatorio=por_colaborador`
      )
      const colaboradorData = await colaboradorResponse.json()
      
      if (colaboradorData.success) {
        // Transformar dados para o formato esperado
        const colaboradoresComStatus = (colaboradorData.colaboradores || []).map((colaborador: any) => ({
          ...colaborador,
          status_pagamento: (colaborador.pendentes > 0 || colaborador.atrasados > 0) ? 
            (colaborador.atrasados > 0 ? 'atrasado' : 'pendente') : 'em_dia',
          total_a_receber: colaborador.pendentes || 0,
          total_atrasado: colaborador.atrasados || 0,
          count_pendentes: colaborador.count_pendentes || 0,
          count_atrasados: colaborador.count_atrasados || 0,
          nome: colaborador.colaborador_nome,
          cargo: colaborador.colaborador_cargo,
          cpf: colaborador.colaborador_cpf,
          _id: colaborador._id
        }))
        console.log('📊 Colaboradores processados:', {
          total: colaboradoresComStatus.length,
          em_dia: colaboradoresComStatus.filter(c => c.status_pagamento === 'em_dia').length,
          pendentes: colaboradoresComStatus.filter(c => c.status_pagamento === 'pendente').length,
          atrasados: colaboradoresComStatus.filter(c => c.status_pagamento === 'atrasado').length
        })
        setResumoColaboradores(colaboradoresComStatus)
      } else {
        console.warn('⚠️ Erro ao carregar colaboradores:', colaboradorData.error)
      }
    } catch (error) {
      console.error('Erro ao carregar resumo geral:', error)
      setAlert({ type: 'error', message: 'Erro ao carregar dados financeiros' })
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

  const moradoresEmDia = resumoMoradores.filter(m => m.status_pagamento === 'em_dia')
  const moradoresAtrasados = resumoMoradores.filter(m => m.status_pagamento === 'atrasado')
  const colaboradoresEmDia = resumoColaboradores.filter(c => c.status_pagamento === 'em_dia')
  const colaboradoresPendentes = resumoColaboradores.filter(c => c.status_pagamento === 'pendente')
  const colaboradoresAtrasados = resumoColaboradores.filter(c => c.status_pagamento === 'atrasado')

  const totalAtrasadoMoradores = moradoresAtrasados.reduce((sum, m) => sum + (m.total_atrasado || 0), 0)
  const totalPendenteColaboradores = colaboradoresPendentes.reduce((sum, c) => sum + (c.total_a_receber || 0), 0)
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
              <h2 className="mb-1">💰 Resumo Financeiro Geral</h2>
              <p className="text-muted mb-0">Visão completa dos pagamentos de moradores e colaboradores</p>
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
            {moradoresAtrasados.length === 0 && colaboradoresAtrasados.length === 0 && colaboradoresPendentes.length === 0 && resumoMoradores.length > 0 && (
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

            {/* Gráficos */}
            <Row className="mb-4">
              <Col md={6}>
                <Card>
                  <Card.Header>
                    <h6 className="mb-0">📊 Status das Unidades</h6>
                  </Card.Header>
                  <Card.Body>
                    {resumoMoradores.length > 0 ? (
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
                    {resumoColaboradores.length > 0 ? (
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
                              {resumoMoradores.length === 0 ? (
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
                                moradoresAtrasados.map((unidade) => (
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
                              
                              {/* Mostrar algumas unidades em dia para comparação */}
                              {moradoresEmDia.length > 0 && (
                                <>
                                  <tr>
                                    <td colSpan={5} className="bg-light">
                                      <small className="text-success fw-bold">
                                        <i className="fas fa-check me-1"></i>
                                        Últimas {Math.min(3, moradoresEmDia.length)} unidades em dia:
                                      </small>
                                    </td>
                                  </tr>
                                  {moradoresEmDia.slice(0, 3).map((unidade) => (
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
                                  {moradoresEmDia.length > 3 && (
                                    <tr className="table-light">
                                      <td colSpan={5} className="text-center text-success">
                                        <small>... e mais {moradoresEmDia.length - 3} unidades em dia</small>
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
                              {resumoColaboradores.length === 0 ? (
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
                                  {colaboradoresAtrasados.map((colaborador) => (
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
                                  {colaboradoresPendentes.map((colaborador) => (
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
                                </>
                              )}
                              
                              {/* Mostrar alguns colaboradores em dia para comparação */}
                              {colaboradoresEmDia.length > 0 && (
                                <>
                                  <tr>
                                    <td colSpan={4} className="bg-light">
                                      <small className="text-success fw-bold">
                                        <i className="fas fa-check me-1"></i>
                                        Últimos {Math.min(3, colaboradoresEmDia.length)} colaboradores em dia:
                                      </small>
                                    </td>
                                  </tr>
                                  {colaboradoresEmDia.slice(0, 3).map((colaborador) => (
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
                                  {colaboradoresEmDia.length > 3 && (
                                    <tr className="table-light">
                                      <td colSpan={4} className="text-center text-success">
                                        <small>... e mais {colaboradoresEmDia.length - 3} colaboradores em dia</small>
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

            {/* Resumo Total */}
            <Row className="mt-4">
              <Col>
                <Card className="border-primary">
                  <Card.Header className="bg-primary text-white">
                    <h6 className="mb-0">💰 Resumo Financeiro Total</h6>
                  </Card.Header>
                  <Card.Body>
                    <Row>
                      <Col md={6}>
                        <h6 className="text-danger">📥 A Receber de Unidades:</h6>
                        <h4 className="text-danger">{formatCurrencyDisplay(totalAtrasadoMoradores)}</h4>
                        <small className="text-muted">{moradoresAtrasados.length} unidade(s) em atraso</small>
                      </Col>
                      <Col md={6}>
                        <h6 className="text-warning">📤 A Pagar para Colaboradores:</h6>
                        <h4 className="text-warning">{formatCurrencyDisplay(totalAtrasadoColaboradores + totalPendenteColaboradores)}</h4>
                        <small className="text-muted">
                          {colaboradoresAtrasados.length > 0 && (
                            <span className="text-danger">{colaboradoresAtrasados.length} atrasados, </span>
                          )}
                          {colaboradoresPendentes.length} pendentes
                        </small>
                      </Col>
                    </Row>
                    <hr/>
                    <Row>
                      <Col className="text-center">
                        <h6 className="text-primary">💼 Resultado Líquido:</h6>
                        <h3 className={totalAtrasadoMoradores - (totalAtrasadoColaboradores + totalPendenteColaboradores) >= 0 ? 'text-success' : 'text-danger'}>
                          {formatCurrencyDisplay(totalAtrasadoMoradores - (totalAtrasadoColaboradores + totalPendenteColaboradores))}
                        </h3>
                        <small className="text-muted">
                          {totalAtrasadoMoradores - (totalAtrasadoColaboradores + totalPendenteColaboradores) >= 0 ? 'Saldo positivo' : 'Saldo negativo'}
                        </small>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </>
        )}
      </Container>
    </>
  )
}