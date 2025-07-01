'use client'

import { useState, useEffect } from 'react'
import { Container, Row, Col, Card, Alert, Badge, Table, Button } from 'react-bootstrap'

interface FinanceiroColaborador {
  _id: string
  id_financeiro: string
  tipo: 'salario' | 'bonus' | 'desconto' | 'vale' | 'comissao' | 'hora_extra' | 'ferias' | 'decimo_terceiro'
  descricao: string
  valor: number
  data_vencimento: string
  data_pagamento?: string
  status: 'pendente' | 'pago' | 'atrasado' | 'cancelado'
  colaborador_id: string
  colaborador_nome: string
  condominio_id: string
  observacoes?: string
  mes_referencia?: string
  horas_trabalhadas?: number
}

export default function ColaboradorFinancasPage() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [financeiro, setFinanceiro] = useState<FinanceiroColaborador[]>([])
  const [loading, setLoading] = useState(false)
  const [alert, setAlert] = useState<{type: string, message: string} | null>(null)
  const [totalPendente, setTotalPendente] = useState(0)
  const [totalPago, setTotalPago] = useState(0)

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
      
      if (user.tipo === 'colaborador') {
        loadFinanceiro(user)
      } else {
        showAlert('warning', 'Acesso negado: Esta página é apenas para colaboradores')
      }
    }
  }, [])

  const loadFinanceiro = async (user: any) => {
    try {
      setLoading(true)
      
      const response = await fetch(`/api/financeiro-colaboradores?master_id=${user.master_id}&condominio_id=${user.condominio_id}&tipo_usuario=${user.tipo}&usuario_id=${user.id}`)
      const data = await response.json()
      
      if (data.success) {
        setFinanceiro(data.financeiro)
        calculateTotals(data.financeiro)
      } else {
        showAlert('danger', data.error || 'Erro ao carregar dados financeiros')
      }
    } catch (error) {
      showAlert('danger', 'Erro ao carregar dados financeiros')
    } finally {
      setLoading(false)
    }
  }

  const calculateTotals = (data: FinanceiroColaborador[]) => {
    const pendente = data
      .filter(item => item.status === 'pendente')
      .reduce((sum, item) => sum + item.valor, 0)
    
    const pago = data
      .filter(item => item.status === 'pago')
      .reduce((sum, item) => sum + item.valor, 0)
    
    setTotalPendente(pendente)
    setTotalPago(pago)
  }

  const showAlert = (type: string, message: string) => {
    setAlert({ type, message })
    setTimeout(() => setAlert(null), 5000)
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
      cancelado: { bg: 'secondary', text: 'Cancelado' }
    }
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pendente
    return <Badge bg={config.bg}>{config.text}</Badge>
  }

  const getTipoBadge = (tipo: string) => {
    const tipoConfig = {
      salario: { bg: 'primary', text: 'Salário' },
      bonus: { bg: 'success', text: 'Bônus' },
      desconto: { bg: 'warning', text: 'Desconto' },
      vale: { bg: 'info', text: 'Vale' },
      comissao: { bg: 'secondary', text: 'Comissão' },
      hora_extra: { bg: 'primary', text: 'Hora Extra' },
      ferias: { bg: 'success', text: 'Férias' },
      decimo_terceiro: { bg: 'primary', text: '13º Salário' }
    }
    const config = tipoConfig[tipo as keyof typeof tipoConfig] || { bg: 'secondary', text: tipo }
    return <Badge bg={config.bg}>{config.text}</Badge>
  }

  const openTicket = () => {
    // Simulação de abertura de ticket
    showAlert('info', 'Sistema de tickets será implementado em breve. Entre em contato com a administração para dúvidas.')
  }

  if (loading) {
    return (
      <>
        <Container fluid className="py-4">
          <Alert variant="info" className="text-center">
            <h5>⏳ Carregando suas informações financeiras...</h5>
            <p className="mb-0">Aguarde um momento</p>
          </Alert>
        </Container>
      </>
    )
  }

  return (
    <>
      <Container fluid className="py-4">
        {alert && (
          <Alert variant={alert.type} dismissible onClose={() => setAlert(null)}>
            {alert.message}
          </Alert>
        )}

        <Row className="mb-4">
          <Col>
            <Card>
              <Card.Header>
                <h4 className="mb-0">💰 Minhas Finanças</h4>
                {currentUser && (
                  <small className="text-muted">
                    Colaborador: {currentUser.nome} - Visualização apenas
                  </small>
                )}
              </Card.Header>
            </Card>
          </Col>
        </Row>

        {/* Resumo Financeiro */}
        <Row className="mb-4">
          <Col md={4}>
            <Card className="text-center">
              <Card.Body>
                <h5 className="text-success">💰 Total Recebido</h5>
                <h3 className="text-success">{formatCurrency(totalPago)}</h3>
                <small className="text-muted">Valores já pagos</small>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="text-center">
              <Card.Body>
                <h5 className="text-warning">⏳ Pendente</h5>
                <h3 className="text-warning">{formatCurrency(totalPendente)}</h3>
                <small className="text-muted">Aguardando pagamento</small>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="text-center">
              <Card.Body>
                <h5 className="text-info">❓ Dúvidas</h5>
                <Button variant="outline-info" onClick={openTicket}>
                  Abrir Ticket
                </Button>
                <br />
                <small className="text-muted">Tire suas dúvidas</small>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Tabela de Registros Financeiros */}
        <Row>
          <Col>
            <Card>
              <Card.Header>
                <h5 className="mb-0">📊 Histórico Financeiro</h5>
              </Card.Header>
              <Card.Body>
                {financeiro.length === 0 ? (
                  <Alert variant="info" className="text-center">
                    <h6>📊 Nenhum registro encontrado</h6>
                    <p className="mb-0">Não há registros financeiros para exibir</p>
                  </Alert>
                ) : (
                  <Table responsive striped>
                    <thead>
                      <tr>
                        <th>Tipo</th>
                        <th>Descrição</th>
                        <th>Valor</th>
                        <th>Vencimento</th>
                        <th>Pagamento</th>
                        <th>Status</th>
                        <th>Observações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {financeiro.map((item) => (
                        <tr key={item._id}>
                          <td>{getTipoBadge(item.tipo)}</td>
                          <td>{item.descricao}</td>
                          <td className="fw-bold">{formatCurrency(item.valor)}</td>
                          <td>{formatDate(item.data_vencimento)}</td>
                          <td>
                            {item.data_pagamento ? formatDate(item.data_pagamento) : '-'}
                          </td>
                          <td>{getStatusBadge(item.status)}</td>
                          <td>
                            <small className="text-muted">
                              {item.observacoes || '-'}
                              {item.mes_referencia && (
                                <><br />Ref: {item.mes_referencia}</>
                              )}
                              {item.horas_trabalhadas && (
                                <><br />Horas: {item.horas_trabalhadas}h</>
                              )}
                            </small>
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

        {/* Informações Importantes */}
        <Row className="mt-4">
          <Col>
            <Alert variant="info">
              <h6>ℹ️ Informações Importantes</h6>
              <ul className="mb-0">
                <li>Esta página exibe apenas seus dados financeiros pessoais</li>
                <li>Você não pode criar, editar ou excluir registros</li>
                <li>Para dúvidas sobre pagamentos, use o botão "Abrir Ticket"</li>
                <li>Os dados são atualizados automaticamente pela administração</li>
              </ul>
            </Alert>
          </Col>
        </Row>
      </Container>
    </>
  )
}