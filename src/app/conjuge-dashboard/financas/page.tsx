'use client'

import { useState, useEffect } from 'react'
import { Container, Row, Col, Card, Alert, Badge, Button, Table } from 'react-bootstrap'

interface ConjugeInfo {
  id: string;
  nome: string;
  email: string;
  tipo: 'conjuge';
  unidade: string;
  condominio_id: string;
  condominio_nome: string;
  master_id: string;
  morador_responsavel?: string;
}

interface FinanceiroItem {
  _id: string;
  descricao: string;
  valor: number;
  status: 'pendente' | 'pago' | 'vencido';
  data_vencimento: string;
  data_pagamento?: string;
  tipo: string;
}

export default function ConjugeFinancasPage() {
  const [userInfo, setUserInfo] = useState<ConjugeInfo | null>(null)
  const [financeiro, setFinanceiro] = useState<FinanceiroItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const userData = localStorage.getItem('userData')
    if (userData) {
      try {
        const user = JSON.parse(userData)
        if (user.tipo !== 'conjuge') {
          window.location.href = '/login'
          return
        }
        setUserInfo(user)
        fetchFinanceiro(user)
      } catch (error) {
        console.error('Error parsing user data:', error)
        window.location.href = '/login'
      }
    } else {
      window.location.href = '/login'
    }
  }, [])

  const fetchFinanceiro = async (user: ConjugeInfo) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/financeiro-morador?condominio_id=${user.condominio_id}&unidade=${user.unidade}`)
      const data = await response.json()
      
      if (data.success) {
        setFinanceiro(data.financeiro || [])
      } else {
        setError('Erro ao carregar dados financeiros')
      }
    } catch (error) {
      console.error('Error fetching financeiro:', error)
      setError('Erro ao carregar dados financeiros')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const colors = {
      'pago': 'success',
      'pendente': 'warning',
      'vencido': 'danger'
    }
    const labels = {
      'pago': 'Pago',
      'pendente': 'Pendente',
      'vencido': 'Vencido'
    }
    return (
      <Badge bg={colors[status as keyof typeof colors] || 'secondary'}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
    )
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR')
  }

  const totalPendente = financeiro
    .filter(item => item.status === 'pendente' || item.status === 'vencido')
    .reduce((sum, item) => sum + item.valor, 0)

  const totalPago = financeiro
    .filter(item => item.status === 'pago')
    .reduce((sum, item) => sum + item.valor, 0)

  if (!userInfo) {
    return (
      <Container className="mt-5">
        <div className="text-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Carregando...</span>
          </div>
        </div>
      </Container>
    )
  }

  return (
    <Container fluid className="py-4">
      <Row className="mb-4">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h2 className="mb-0">💰 Finanças do Cônjuge</h2>
              <p className="text-muted mb-0">
                Extrato financeiro da unidade {userInfo.unidade} - {userInfo.condominio_nome}
              </p>
            </div>
            <Button variant="outline-secondary" href="/conjuge-dashboard">
              ← Voltar ao Dashboard
            </Button>
          </div>
        </Col>
      </Row>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Row className="mb-4">
        <Col md={4}>
          <Card className="border-warning">
            <Card.Body className="text-center">
              <h5 className="text-warning">💸 Pendente</h5>
              <h3 className="mb-0">{formatCurrency(totalPendente)}</h3>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="border-success">
            <Card.Body className="text-center">
              <h5 className="text-success">✅ Pago</h5>
              <h3 className="mb-0">{formatCurrency(totalPago)}</h3>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="border-info">
            <Card.Body className="text-center">
              <h5 className="text-info">📊 Total</h5>
              <h3 className="mb-0">{formatCurrency(totalPendente + totalPago)}</h3>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card>
        <Card.Header>
          <h5 className="mb-0">📋 Extrato Financeiro</h5>
        </Card.Header>
        <Card.Body>
          {loading ? (
            <div className="text-center">
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Carregando...</span>
              </div>
            </div>
          ) : financeiro.length === 0 ? (
            <Alert variant="info" className="text-center">
              <h6>📋 Nenhum registro financeiro encontrado</h6>
              <p className="mb-0">Não há movimentações financeiras para esta unidade.</p>
            </Alert>
          ) : (
            <div className="table-responsive">
              <Table hover>
                <thead className="table-light">
                  <tr>
                    <th>Descrição</th>
                    <th>Tipo</th>
                    <th>Valor</th>
                    <th>Vencimento</th>
                    <th>Pagamento</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {financeiro.map((item) => (
                    <tr key={item._id}>
                      <td className="fw-semibold">{item.descricao}</td>
                      <td>
                        <Badge bg="secondary" className="text-uppercase">
                          {item.tipo}
                        </Badge>
                      </td>
                      <td className="fw-bold">{formatCurrency(item.valor)}</td>
                      <td>{formatDate(item.data_vencimento)}</td>
                      <td>
                        {item.data_pagamento 
                          ? formatDate(item.data_pagamento) 
                          : <span className="text-muted">-</span>
                        }
                      </td>
                      <td>{getStatusBadge(item.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      <Row className="mt-4">
        <Col>
          <Alert variant="info">
            <h6>ℹ️ Informação Importante</h6>
            <p className="mb-0">
              Como cônjuge, você tem acesso de <strong>visualização</strong> aos dados financeiros 
              da unidade. Para realizar pagamentos ou alterações, entre em contato com o morador 
              responsável: <strong>{userInfo.morador_responsavel}</strong>.
            </p>
          </Alert>
        </Col>
      </Row>
    </Container>
  )
}