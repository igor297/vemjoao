'use client'

import { useState, useEffect } from 'react'
import { Container, Row, Col, Card, Alert, Badge, Table, Button } from 'react-bootstrap'
import Header from '@/components/Header'

interface FinanceiroMorador {
  _id: string
  id_financeiro: string
  tipo: 'taxa_condominio' | 'multa' | 'servico_extra' | 'fundo_obras' | 'fundo_reserva' | 'taxa_extraordinaria' | 'agua_individual' | 'gas_individual'
  descricao: string
  valor: number
  data_vencimento: string
  data_pagamento?: string
  status: 'pendente' | 'pago' | 'atrasado' | 'cancelado'
  morador_id: string
  morador_nome: string
  apartamento: string
  bloco?: string
  condominio_id: string
  observacoes?: string
  mes_referencia?: string
  multa_atraso?: number
  juros_atraso?: number
  codigo_barras?: string
}

export default function MoradorFinancasPage() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [financeiro, setFinanceiro] = useState<FinanceiroMorador[]>([])
  const [loading, setLoading] = useState(false)
  const [alert, setAlert] = useState<{type: string, message: string} | null>(null)
  const [totalPendente, setTotalPendente] = useState(0)
  const [totalPago, setTotalPago] = useState(0)
  const [totalAtrasado, setTotalAtrasado] = useState(0)

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
      
      if (['morador', 'inquilino', 'conjuge', 'dependente'].includes(user.tipo)) {
        loadFinanceiro(user)
      } else {
        showAlert('warning', 'Acesso negado: Esta página é apenas para moradores e família')
      }
    }
  }, [])

  const loadFinanceiro = async (user: any) => {
    try {
      setLoading(true)
      
      const response = await fetch(`/api/financeiro-morador?master_id=${user.master_id}&condominio_id=${user.condominio_id}&tipo_usuario=${user.tipo}&usuario_id=${user.id}`)
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

  const calculateTotals = (data: FinanceiroMorador[]) => {
    const pendente = data
      .filter(item => item.status === 'pendente')
      .reduce((sum, item) => sum + item.valor + (item.multa_atraso || 0), 0)
    
    const pago = data
      .filter(item => item.status === 'pago')
      .reduce((sum, item) => sum + item.valor, 0)
      
    const atrasado = data
      .filter(item => item.status === 'atrasado')
      .reduce((sum, item) => sum + item.valor + (item.multa_atraso || 0), 0)
    
    setTotalPendente(pendente)
    setTotalPago(pago)
    setTotalAtrasado(atrasado)
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
      taxa_condominio: { bg: 'primary', text: 'Taxa Condomínio' },
      multa: { bg: 'danger', text: 'Multa' },
      servico_extra: { bg: 'warning', text: 'Serviço Extra' },
      fundo_obras: { bg: 'info', text: 'Fundo de Obras' },
      fundo_reserva: { bg: 'secondary', text: 'Fundo de Reserva' },
      taxa_extraordinaria: { bg: 'warning', text: 'Taxa Extraordinária' },
      agua_individual: { bg: 'info', text: 'Água Individual' },
      gas_individual: { bg: 'success', text: 'Gás Individual' }
    }
    const config = tipoConfig[tipo as keyof typeof tipoConfig] || { bg: 'secondary', text: tipo }
    return <Badge bg={config.bg}>{config.text}</Badge>
  }

  const openTicket = () => {
    // Simulação de abertura de ticket
    showAlert('info', 'Sistema de tickets será implementado em breve. Entre em contato com a administração para dúvidas.')
  }

  const isVencido = (dataVencimento: string, status: string) => {
    const hoje = new Date()
    const vencimento = new Date(dataVencimento)
    return status === 'pendente' && vencimento < hoje
  }

  if (loading) {
    return (
      <>
        <Header />
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
      <Header />
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
                <h4 className="mb-0">🏠 Minhas Finanças</h4>
                {currentUser && (
                  <small className="text-muted">
                    {currentUser.tipo === 'morador' ? 'Morador' : 
                     currentUser.tipo === 'inquilino' ? 'Inquilino' :
                     currentUser.tipo === 'conjuge' ? 'Cônjuge' : 'Dependente'}: {currentUser.nome}
                    {currentUser.apartamento && ` - Apto ${currentUser.apartamento}`}
                    {currentUser.bloco && ` - Bloco ${currentUser.bloco}`}
                  </small>
                )}
              </Card.Header>
            </Card>
          </Col>
        </Row>

        {/* Resumo Financeiro */}
        <Row className="mb-4">
          <Col md={3}>
            <Card className="text-center">
              <Card.Body>
                <h5 className="text-success">✅ Pago</h5>
                <h3 className="text-success">{formatCurrency(totalPago)}</h3>
                <small className="text-muted">Valores quitados</small>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3}>
            <Card className="text-center">
              <Card.Body>
                <h5 className="text-warning">⏳ Pendente</h5>
                <h3 className="text-warning">{formatCurrency(totalPendente)}</h3>
                <small className="text-muted">Aguardando pagamento</small>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3}>
            <Card className="text-center">
              <Card.Body>
                <h5 className="text-danger">⚠️ Atrasado</h5>
                <h3 className="text-danger">{formatCurrency(totalAtrasado)}</h3>
                <small className="text-muted">Vencidos</small>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3}>
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

        {/* Alertas Importantes */}
        {totalAtrasado > 0 && (
          <Alert variant="danger">
            <h6>⚠️ Atenção: Você possui débitos em atraso!</h6>
            <p className="mb-0">
              Total em atraso: <strong>{formatCurrency(totalAtrasado)}</strong>
              <br />
              Entre em contato com a administração para regularizar sua situação.
            </p>
          </Alert>
        )}

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
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {financeiro.map((item) => (
                        <tr key={item._id} className={isVencido(item.data_vencimento, item.status) ? 'table-danger' : ''}>
                          <td>{getTipoBadge(item.tipo)}</td>
                          <td>
                            {item.descricao}
                            {item.mes_referencia && (
                              <><br /><small className="text-muted">Ref: {item.mes_referencia}</small></>
                            )}
                          </td>
                          <td className="fw-bold">
                            {formatCurrency(item.valor)}
                            {item.multa_atraso && item.multa_atraso > 0 && (
                              <>
                                <br />
                                <small className="text-danger">
                                  + Multa: {formatCurrency(item.multa_atraso)}
                                </small>
                              </>
                            )}
                          </td>
                          <td>
                            {formatDate(item.data_vencimento)}
                            {isVencido(item.data_vencimento, item.status) && (
                              <><br /><small className="text-danger">⚠️ Vencido</small></>
                            )}
                          </td>
                          <td>
                            {item.data_pagamento ? formatDate(item.data_pagamento) : '-'}
                          </td>
                          <td>{getStatusBadge(item.status)}</td>
                          <td>
                            {item.codigo_barras && (
                              <Button variant="outline-primary" size="sm" title="Ver Código de Barras">
                                📄 Boleto
                              </Button>
                            )}
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
                <li>Esta página exibe apenas os dados financeiros do seu apartamento</li>
                <li>Valores em vermelho indicam débitos vencidos</li>
                <li>Para dúvidas sobre cobranças, use o botão "Abrir Ticket"</li>
                <li>Mantenha seus dados de contato atualizados para receber avisos de vencimento</li>
                <li>Os boletos podem ser acessados clicando no botão "📄 Boleto" quando disponível</li>
              </ul>
            </Alert>
          </Col>
        </Row>
      </Container>
    </>
  )
}