'use client'

import React, { useState, useEffect } from 'react'
import { Container, Row, Col, Card, Badge, Alert, Table, Form } from 'react-bootstrap'
import Header from '@/components/Header'
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
  total_a_receber?: number
  count_pendentes?: number
  status_pagamento: 'em_dia' | 'pendente'
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
          status_pagamento: colaborador.total_pendentes > 0 ? 'pendente' : 'em_dia',
          total_a_receber: colaborador.total_pendentes || 0,
          count_pendentes: colaborador.count_pendentes || 0,
          nome: colaborador.colaborador_nome,
          _id: colaborador._id
        }))
        console.log('📊 Colaboradores processados:', {
          total: colaboradoresComStatus.length,
          em_dia: colaboradoresComStatus.filter(c => c.status_pagamento === 'em_dia').length,
          pendentes: colaboradoresComStatus.filter(c => c.status_pagamento === 'pendente').length
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

  const totalAtrasadoMoradores = moradoresAtrasados.reduce((sum, m) => sum + (m.total_atrasado || 0), 0)
  const totalPendenteColaboradores = colaboradoresPendentes.reduce((sum, c) => sum + (c.total_a_receber || 0), 0)

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
            {/* Cards de Resumo */}
            <Row className="mb-4">
              <Col md={3}>
                <Card className="border-success">
                  <Card.Body className="text-center">
                    <div className="text-success display-6 mb-2">✅</div>
                    <h6 className="text-muted">Unidades em Dia</h6>
                    <h4 className="text-success">{moradoresEmDia.length}</h4>
                    <small className="text-muted">de {moradoresEmDia.length + moradoresAtrasados.length} unidades</small>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card className="border-danger">
                  <Card.Body className="text-center">
                    <div className="text-danger display-6 mb-2">⚠️</div>
                    <h6 className="text-muted">Unidades Atrasadas</h6>
                    <h4 className="text-danger">{moradoresAtrasados.length}</h4>
                    <small className="text-muted">{formatCurrencyDisplay(totalAtrasadoMoradores)}</small>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card className="border-info">
                  <Card.Body className="text-center">
                    <div className="text-info display-6 mb-2">👥</div>
                    <h6 className="text-muted">Colaboradores em Dia</h6>
                    <h4 className="text-info">{colaboradoresEmDia.length}</h4>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card className="border-warning">
                  <Card.Body className="text-center">
                    <div className="text-warning display-6 mb-2">💸</div>
                    <h6 className="text-muted">A Pagar Colaboradores</h6>
                    <h4 className="text-warning">{colaboradoresPendentes.length}</h4>
                    <small className="text-muted">{formatCurrencyDisplay(totalPendenteColaboradores)}</small>
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
            <Row>
              <Col md={6}>
                <Card>
                  <Card.Header className="d-flex justify-content-between align-items-center">
                    <h6 className="mb-0">🏠 Unidades com Atraso</h6>
                    <Badge bg="danger">{moradoresAtrasados.length}</Badge>
                  </Card.Header>
                  <Card.Body>
                    <div className="table-responsive" style={{maxHeight: '400px', overflowY: 'auto'}}>
                      <Table striped hover size="sm">
                        <thead>
                          <tr>
                            <th>Moradores</th>
                            <th>Unidade</th>
                            <th>Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resumoMoradores.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="text-center text-muted py-3">
                                📭 Nenhuma unidade encontrada neste condomínio
                              </td>
                            </tr>
                          ) : moradoresAtrasados.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="text-center text-success py-3">
                                ✅ Nenhuma unidade em atraso!
                              </td>
                            </tr>
                          ) : (
                            moradoresAtrasados.map((unidade) => (
                              <tr key={unidade._id}>
                                <td>
                                  <div>
                                    <strong>{unidade.nome}</strong>
                                    {unidade.moradores_na_unidade > 1 && (
                                      <div className="mt-1">
                                        <Badge bg="info" size="sm">
                                          {unidade.moradores_na_unidade} moradores na unidade
                                        </Badge>
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td>{unidade.bloco ? `${unidade.bloco} - ` : ''}{unidade.unidade}</td>
                                <td className="text-danger">
                                  <strong>{formatCurrencyDisplay(unidade.total_atrasado || 0)}</strong>
                                  <br/>
                                  <small>{unidade.count_atrasados} lançamento(s)</small>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </Table>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={6}>
                <Card>
                  <Card.Header className="d-flex justify-content-between align-items-center">
                    <h6 className="mb-0">👥 Colaboradores Pendentes</h6>
                    <Badge bg="warning">{colaboradoresPendentes.length}</Badge>
                  </Card.Header>
                  <Card.Body>
                    <div className="table-responsive" style={{maxHeight: '400px', overflowY: 'auto'}}>
                      <Table striped hover size="sm">
                        <thead>
                          <tr>
                            <th>Nome</th>
                            <th>Cargo</th>
                            <th>Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resumoColaboradores.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="text-center text-muted py-3">
                                👥 Nenhum colaborador encontrado neste condomínio
                              </td>
                            </tr>
                          ) : colaboradoresPendentes.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="text-center text-success py-3">
                                ✅ Todos os colaboradores estão em dia!
                              </td>
                            </tr>
                          ) : (
                            colaboradoresPendentes.map((colaborador) => (
                              <tr key={colaborador._id}>
                                <td><strong>{colaborador.nome}</strong></td>
                                <td>{colaborador.cargo || 'N/A'}</td>
                                <td className="text-warning">
                                  <strong>{formatCurrencyDisplay(colaborador.total_a_receber || 0)}</strong>
                                  <br/>
                                  <small>{colaborador.count_pendentes} lançamento(s)</small>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </Table>
                    </div>
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
                        <h4 className="text-warning">{formatCurrencyDisplay(totalPendenteColaboradores)}</h4>
                        <small className="text-muted">{colaboradoresPendentes.length} colaboradores pendentes</small>
                      </Col>
                    </Row>
                    <hr/>
                    <Row>
                      <Col className="text-center">
                        <h6 className="text-primary">💼 Resultado Líquido:</h6>
                        <h3 className={totalAtrasadoMoradores - totalPendenteColaboradores >= 0 ? 'text-success' : 'text-danger'}>
                          {formatCurrencyDisplay(totalAtrasadoMoradores - totalPendenteColaboradores)}
                        </h3>
                        <small className="text-muted">
                          {totalAtrasadoMoradores - totalPendenteColaboradores >= 0 ? 'Saldo positivo' : 'Saldo negativo'}
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