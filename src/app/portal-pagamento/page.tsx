'use client'

import { useState, useEffect } from 'react'
import { Container, Row, Col, Card, Button, Modal, Form, Alert, Badge, Table, Spinner } from 'react-bootstrap'

// CSS styles para o componente
const styles = `
  .payment-method-card {
    transition: all 0.3s ease;
    border: 2px solid #dee2e6;
  }
  
  .payment-method-card:hover {
    border-color: #0d6efd;
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  }
  
  .payment-method-card.selected {
    border-color: #0d6efd !important;
    background-color: #f8f9fa !important;
  }
`

interface FinanceiroMorador {
  _id: string
  id_financeiro: string
  tipo: string
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
  master_id: string
  observacoes?: string
  mes_referencia?: string
  multa_atraso?: number
  juros_atraso?: number
  codigo_barras?: string
}

interface PaymentMethod {
  type: 'boleto' | 'pix' | 'cartao_credito' | 'cartao_debito'
  name: string
  icon: string
  description: string
  available: boolean
}

export default function PortalPagamentoPage() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [pendencias, setPendencias] = useState<FinanceiroMorador[]>([])
  const [historico, setHistorico] = useState<FinanceiroMorador[]>([])
  const [loading, setLoading] = useState(false)
  const [alert, setAlert] = useState<{type: string, message: string} | null>(null)
  
  // Modal de pagamento
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState<FinanceiroMorador | null>(null)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('')
  const [processandoPagamento, setProcessandoPagamento] = useState(false)
  
  // Modal de QR Code PIX
  const [showQrModal, setShowQrModal] = useState(false)
  const [qrCodeData, setQrCodeData] = useState<{
    qr_code: string
    qr_code_base64: string
    valor: number
    payment_id: string
  } | null>(null)

  // Modal de Boleto
  const [showBoletoModal, setShowBoletoModal] = useState(false)
  const [boletoData, setBoletoData] = useState<{
    boleto_url: string
    linha_digitavel: string
    payment_id: string
    valor: number
  } | null>(null)
  
  // Aba ativa
  const [activeTab, setActiveTab] = useState<'pendencias' | 'historico'>('pendencias')
  
  // Dados do cartão
  const [dadosCartao, setDadosCartao] = useState({
    numero: '',
    cvv: '',
    mes_vencimento: '',
    ano_vencimento: '',
    parcelas: 1
  })

  const paymentMethods: PaymentMethod[] = [
    {
      type: 'pix',
      name: 'PIX',
      icon: '⚡',
      description: 'Instantâneo, disponível 24h',
      available: true
    },
    {
      type: 'boleto',
      name: 'Boleto Bancário',
      icon: '🧾',
      description: 'Vencimento em 1 dia útil',
      available: true
    },
    {
      type: 'cartao_credito',
      name: 'Cartão de Crédito',
      icon: '💳',
      description: 'Parcelamento disponível',
      available: true
    },
    {
      type: 'cartao_debito',
      name: 'Cartão de Débito',
      icon: '💳',
      description: 'Débito imediato na conta',
      available: true
    }
  ]

  useEffect(() => {
    const userData = localStorage.getItem('userData')
    if (userData) {
      const user = JSON.parse(userData)
      setCurrentUser(user)
      loadFinanceiroDados(user.id, user.condominio_id)
    }
  }, [])

  const loadFinanceiroDados = async (moradorId: string, condominioId: string) => {
    try {
      setLoading(true)
      
      // Carregar pendências
      const pendenciasResponse = await fetch(`/api/portal-pagamento?morador_id=${moradorId}&condominio_id=${condominioId}&status=pendente,atrasado`)
      const pendenciasData = await pendenciasResponse.json()
      
      if (pendenciasData.success) {
        setPendencias(pendenciasData.financeiros)
      }
      
      // Carregar histórico (últimos 6 meses)
      const historicoResponse = await fetch(`/api/portal-pagamento?morador_id=${moradorId}&condominio_id=${condominioId}&status=pago&limit=20`)
      const historicoData = await historicoResponse.json()
      
      if (historicoData.success) {
        setHistorico(historicoData.financeiros)
      }
      
    } catch (error) {
      showAlert('danger', 'Erro ao carregar dados financeiros')
    } finally {
      setLoading(false)
    }
  }

  const showAlert = (type: string, message: string) => {
    setAlert({ type, message })
    setTimeout(() => setAlert(null), 5000)
  }

  const handlePagarClick = (item: FinanceiroMorador) => {
    setSelectedItem(item)
    setSelectedPaymentMethod('')
    setShowPaymentModal(true)
  }

  const handleClosePaymentModal = () => {
    setShowPaymentModal(false)
    setSelectedItem(null)
    setSelectedPaymentMethod('')
    setProcessandoPagamento(false)
    // Limpar dados do cartão
    setDadosCartao({
      numero: '',
      cvv: '',
      mes_vencimento: '',
      ano_vencimento: '',
      parcelas: 1
    })
  }

  const handleProcessPayment = async () => {
    if (!selectedItem || !selectedPaymentMethod) {
      showAlert('warning', 'Selecione um método de pagamento')
      return
    }

    // Validar dados do cartão se método for cartão
    if (selectedPaymentMethod.includes('cartao')) {
      if (!dadosCartao.numero || !dadosCartao.cvv || !dadosCartao.mes_vencimento || !dadosCartao.ano_vencimento) {
        showAlert('warning', 'Preencha todos os dados do cartão')
        return
      }
      
      // Validar se cartão não está vencido
      const mesAtual = new Date().getMonth() + 1
      const anoAtual = new Date().getFullYear()
      const mesVencimento = parseInt(dadosCartao.mes_vencimento)
      const anoVencimento = parseInt(dadosCartao.ano_vencimento)
      
      if (anoVencimento < anoAtual || (anoVencimento === anoAtual && mesVencimento < mesAtual)) {
        showAlert('error', 'Cartão vencido')
        return
      }
    }

    try {
      setProcessandoPagamento(true)
      
      const paymentData = {
        financeiro_id: selectedItem._id,
        morador_id: currentUser.id,
        condominio_id: currentUser.condominio_id,
        master_id: selectedItem.master_id,
        valor: selectedItem.valor,
        metodo_pagamento: selectedPaymentMethod,
        descricao: selectedItem.descricao,
        // Incluir dados do cartão se método for cartão
        ...(selectedPaymentMethod.includes('cartao') && {
          dados_cartao: dadosCartao
        })
      }

      const response = await fetch('/api/portal-pagamento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData)
      })

      const data = await response.json()
      
      if (data.success) {
        showAlert('success', data.message || 'Pagamento processado com sucesso!')
        
        // Se for PIX, mostrar QR Code
        if (selectedPaymentMethod === 'pix' && data.qr_code) {
          setQrCodeData({
            qr_code: data.qr_code,
            qr_code_base64: data.qr_code_base64,
            valor: data.valor,
            payment_id: data.payment_id
          })
          setShowQrModal(true)
          showAlert('success', 'QR Code PIX gerado! Escaneie para pagar.')
        }
        
        // Se for boleto, mostrar dados do boleto
        if (selectedPaymentMethod === 'boleto' && data.boleto_url) {
          setBoletoData({
            boleto_url: data.boleto_url,
            linha_digitavel: data.linha_digitavel,
            payment_id: data.payment_id,
            valor: data.valor_final || data.valor
          })
          setShowBoletoModal(true)
          showAlert('success', 'Boleto gerado com sucesso!')
        }
        
        // Se for cartão e foi aprovado imediatamente
        if ((selectedPaymentMethod === 'cartao_credito' || selectedPaymentMethod === 'cartao_debito') && data.status === 'aprovado') {
          showAlert('success', 'Pagamento aprovado! Sua conta foi atualizada.')
        }
        
        handleClosePaymentModal()
        
        // Recarregar dados após um pequeno delay para permitir que o backend processe
        setTimeout(() => {
          loadFinanceiroDados(currentUser.id, currentUser.condominio_id)
        }, 1000)
      } else {
        showAlert('danger', data.error || 'Erro ao processar pagamento')
      }
      
    } catch (error) {
      showAlert('danger', 'Erro ao processar pagamento')
    } finally {
      setProcessandoPagamento(false)
    }
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

  const getStatusBadge = (status: string, dataVencimento: string) => {
    const hoje = new Date()
    const vencimento = new Date(dataVencimento)
    
    if (status === 'pago') {
      return <Badge bg="success">✅ Pago</Badge>
    } else if (status === 'cancelado') {
      return <Badge bg="secondary">❌ Cancelado</Badge>
    } else if (vencimento < hoje) {
      return <Badge bg="danger">🔴 Atrasado</Badge>
    } else if (status === 'pendente') {
      return <Badge bg="warning">⏳ Pendente</Badge>
    }
    return <Badge bg="secondary">{status}</Badge>
  }

  const getTipoIcon = (tipo: string) => {
    const icons: Record<string, string> = {
      'taxa_condominio': '🏢',
      'multa': '⚠️',
      'servico_extra': '🔧',
      'fundo_obras': '🏗️',
      'fundo_reserva': '💰',
      'taxa_extraordinaria': '📋',
      'agua_individual': '💧',
      'gas_individual': '🔥'
    }
    return icons[tipo] || '📄'
  }

  const calcularValorTotal = () => {
    return pendencias.reduce((total, item) => total + item.valor, 0)
  }

  if (!currentUser) {
    return (
      <Container className="mt-5">
        <Alert variant="warning" className="text-center">
          <h5>Acesso Restrito</h5>
          <p>Você precisa estar logado como morador para acessar o portal de pagamentos.</p>
        </Alert>
      </Container>
    )
  }

  return (
    <>
      <style>{styles}</style>
      <Container fluid className="py-4">
        {alert && (
          <Alert variant={alert.type} dismissible onClose={() => setAlert(null)}>
            {alert.message}
          </Alert>
        )}

        {/* Header do Portal */}
        <Row className="mb-4">
          <Col>
            <Card className="bg-primary text-white">
              <Card.Body>
                <Row className="align-items-center">
                  <Col md={8}>
                    <h3 className="mb-1">💳 Portal de Pagamentos</h3>
                    <p className="mb-2">
                      <strong>{currentUser.nome}</strong> - Apartamento {currentUser.apartamento}
                      {currentUser.bloco && ` - Bloco ${currentUser.bloco}`}
                    </p>
                    <small className="opacity-75">{currentUser.condominio_nome}</small>
                  </Col>
                  <Col md={4} className="text-end">
                    <div className="mb-2">
                      <h5 className="mb-0">Total Pendente</h5>
                      <h3 className="mb-0">{formatCurrency(calcularValorTotal())}</h3>
                    </div>
                    {pendencias.length > 0 && (
                      <Badge bg="warning" className="p-2">
                        {pendencias.length} pendência(s)
                      </Badge>
                    )}
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Navegação */}
        <Row className="mb-4">
          <Col>
            <Card>
              <Card.Header>
                <nav className="nav nav-pills">
                  <button
                    className={`nav-link ${activeTab === 'pendencias' ? 'active' : ''}`}
                    onClick={() => setActiveTab('pendencias')}
                  >
                    📋 Pendências ({pendencias.length})
                  </button>
                  <button
                    className={`nav-link ${activeTab === 'historico' ? 'active' : ''}`}
                    onClick={() => setActiveTab('historico')}
                  >
                    📊 Histórico ({historico.length})
                  </button>
                </nav>
              </Card.Header>

              <Card.Body>
                {loading ? (
                  <div className="text-center py-4">
                    <Spinner animation="border" variant="primary" />
                    <p className="mt-2">Carregando dados financeiros...</p>
                  </div>
                ) : (
                  <>
                    {/* Aba de Pendências */}
                    {activeTab === 'pendencias' && (
                      <>
                        {pendencias.length === 0 ? (
                          <Alert variant="success" className="text-center">
                            <h5>🎉 Parabéns!</h5>
                            <p className="mb-0">Você não possui pendências financeiras.</p>
                          </Alert>
                        ) : (
                          <Table responsive striped hover>
                            <thead>
                              <tr>
                                <th>Tipo</th>
                                <th>Descrição</th>
                                <th>Vencimento</th>
                                <th>Valor</th>
                                <th>Status</th>
                                <th>Ações</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pendencias.map((item) => (
                                <tr key={item._id}>
                                  <td>
                                    <span className="me-2">{getTipoIcon(item.tipo)}</span>
                                    {item.tipo.replace('_', ' ').toUpperCase()}
                                  </td>
                                  <td>
                                    <strong>{item.descricao}</strong>
                                    {item.mes_referencia && (
                                      <><br /><small className="text-muted">Ref: {item.mes_referencia}</small></>
                                    )}
                                  </td>
                                  <td>
                                    {formatDate(item.data_vencimento)}
                                    {new Date(item.data_vencimento) < new Date() && (
                                      <><br /><small className="text-danger">⚠️ Vencido</small></>
                                    )}
                                  </td>
                                  <td>
                                    <strong className="text-primary">{formatCurrency(item.valor)}</strong>
                                    {item.multa_atraso && item.multa_atraso > 0 && (
                                      <><br /><small className="text-danger">+ Multa: {formatCurrency(item.multa_atraso)}</small></>
                                    )}
                                  </td>
                                  <td>
                                    {getStatusBadge(item.status, item.data_vencimento)}
                                  </td>
                                  <td>
                                    <Button
                                      variant="success"
                                      size="sm"
                                      onClick={() => handlePagarClick(item)}
                                    >
                                      💳 Pagar
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        )}
                      </>
                    )}

                    {/* Aba de Histórico */}
                    {activeTab === 'historico' && (
                      <>
                        {historico.length === 0 ? (
                          <Alert variant="info" className="text-center">
                            <h5>📊 Histórico</h5>
                            <p className="mb-0">Nenhum pagamento encontrado no histórico.</p>
                          </Alert>
                        ) : (
                          <Table responsive striped hover>
                            <thead>
                              <tr>
                                <th>Tipo</th>
                                <th>Descrição</th>
                                <th>Vencimento</th>
                                <th>Pagamento</th>
                                <th>Valor</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {historico.map((item) => (
                                <tr key={item._id}>
                                  <td>
                                    <span className="me-2">{getTipoIcon(item.tipo)}</span>
                                    {item.tipo.replace('_', ' ').toUpperCase()}
                                  </td>
                                  <td>
                                    <strong>{item.descricao}</strong>
                                    {item.mes_referencia && (
                                      <><br /><small className="text-muted">Ref: {item.mes_referencia}</small></>
                                    )}
                                  </td>
                                  <td>{formatDate(item.data_vencimento)}</td>
                                  <td>
                                    {item.data_pagamento ? formatDate(item.data_pagamento) : '-'}
                                  </td>
                                  <td>
                                    <strong>{formatCurrency(item.valor)}</strong>
                                  </td>
                                  <td>
                                    {getStatusBadge(item.status, item.data_vencimento)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        )}
                      </>
                    )}
                  </>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Modal de Pagamento */}
        <Modal show={showPaymentModal} onHide={handleClosePaymentModal} size="lg">
          <Modal.Header closeButton>
            <Modal.Title>💳 Realizar Pagamento</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {selectedItem && (
              <>
                {/* Dados da cobrança */}
                <Card className="mb-4">
                  <Card.Header><h6 className="mb-0">📋 Dados da Cobrança</h6></Card.Header>
                  <Card.Body>
                    <Row>
                      <Col md={6}>
                        <p><strong>Descrição:</strong> {selectedItem.descricao}</p>
                        <p><strong>Tipo:</strong> {getTipoIcon(selectedItem.tipo)} {selectedItem.tipo.replace('_', ' ').toUpperCase()}</p>
                        {selectedItem.mes_referencia && (
                          <p><strong>Referência:</strong> {selectedItem.mes_referencia}</p>
                        )}
                      </Col>
                      <Col md={6}>
                        <p><strong>Vencimento:</strong> {formatDate(selectedItem.data_vencimento)}</p>
                        <p><strong>Valor:</strong> <span className="text-primary fs-5">{formatCurrency(selectedItem.valor)}</span></p>
                        {selectedItem.observacoes && (
                          <p><strong>Observações:</strong> {selectedItem.observacoes}</p>
                        )}
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>

                {/* Métodos de pagamento */}
                <Card>
                  <Card.Header><h6 className="mb-0">💳 Escolha o Método de Pagamento</h6></Card.Header>
                  <Card.Body>
                    <Row>
                      {paymentMethods.filter(method => method.available).map((method) => (
                        <Col md={6} key={method.type} className="mb-3">
                          <Card 
                            className={`payment-method-card ${selectedPaymentMethod === method.type ? 'selected' : ''}`}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setSelectedPaymentMethod(method.type)}
                          >
                            <Card.Body className="text-center">
                              <div className="fs-1 mb-2">{method.icon}</div>
                              <h6 className="mb-1">{method.name}</h6>
                              <small className="text-muted">{method.description}</small>
                              {selectedPaymentMethod === method.type && (
                                <div className="mt-2">
                                  <Badge bg="primary">✓ Selecionado</Badge>
                                </div>
                              )}
                            </Card.Body>
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  </Card.Body>
                </Card>

                {/* Interface de dados do cartão */}
                {selectedPaymentMethod.includes('cartao') && (
                  <Card className="mt-4">
                    <Card.Header><h6 className="mb-0">💳 Dados do Cartão</h6></Card.Header>
                    <Card.Body>
                      <Row>
                        <Col md={12} className="mb-3">
                          <Form.Group>
                            <Form.Label>Número do Cartão</Form.Label>
                            <Form.Control
                              type="text"
                              placeholder="1234 5678 9012 3456"
                              value={dadosCartao.numero}
                              onChange={(e) => {
                                // Formatar número do cartão
                                let valor = e.target.value.replace(/\D/g, '').substring(0, 16)
                                valor = valor.replace(/(\d{4})(?=\d)/g, '$1 ')
                                setDadosCartao(prev => ({ ...prev, numero: valor }))
                              }}
                              maxLength={19}
                            />
                          </Form.Group>
                        </Col>
                        <Col md={4} className="mb-3">
                          <Form.Group>
                            <Form.Label>CVV</Form.Label>
                            <Form.Control
                              type="text"
                              placeholder="123"
                              value={dadosCartao.cvv}
                              onChange={(e) => {
                                const valor = e.target.value.replace(/\D/g, '').substring(0, 4)
                                setDadosCartao(prev => ({ ...prev, cvv: valor }))
                              }}
                              maxLength={4}
                            />
                          </Form.Group>
                        </Col>
                        <Col md={4} className="mb-3">
                          <Form.Group>
                            <Form.Label>Mês/Ano</Form.Label>
                            <Row>
                              <Col xs={6}>
                                <Form.Select
                                  value={dadosCartao.mes_vencimento}
                                  onChange={(e) => setDadosCartao(prev => ({ ...prev, mes_vencimento: e.target.value }))}
                                >
                                  <option value="">Mês</option>
                                  {Array.from({ length: 12 }, (_, i) => (
                                    <option key={i + 1} value={String(i + 1).padStart(2, '0')}>
                                      {String(i + 1).padStart(2, '0')}
                                    </option>
                                  ))}
                                </Form.Select>
                              </Col>
                              <Col xs={6}>
                                <Form.Select
                                  value={dadosCartao.ano_vencimento}
                                  onChange={(e) => setDadosCartao(prev => ({ ...prev, ano_vencimento: e.target.value }))}
                                >
                                  <option value="">Ano</option>
                                  {Array.from({ length: 10 }, (_, i) => {
                                    const ano = new Date().getFullYear() + i
                                    return (
                                      <option key={ano} value={ano}>{ano}</option>
                                    )
                                  })}
                                </Form.Select>
                              </Col>
                            </Row>
                          </Form.Group>
                        </Col>
                        {selectedPaymentMethod === 'cartao_credito' && (
                          <Col md={4} className="mb-3">
                            <Form.Group>
                              <Form.Label>Parcelas</Form.Label>
                              <Form.Select
                                value={dadosCartao.parcelas}
                                onChange={(e) => setDadosCartao(prev => ({ ...prev, parcelas: parseInt(e.target.value) }))}
                              >
                                {Array.from({ length: 12 }, (_, i) => (
                                  <option key={i + 1} value={i + 1}>
                                    {i + 1}x {i === 0 ? 'à vista' : `de ${formatCurrency(selectedItem.valor / (i + 1))}`}
                                  </option>
                                ))}
                              </Form.Select>
                            </Form.Group>
                          </Col>
                        )}
                      </Row>
                    </Card.Body>
                  </Card>
                )}
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleClosePaymentModal}>
              Cancelar
            </Button>
            <Button 
              variant="success" 
              onClick={handleProcessPayment}
              disabled={!selectedPaymentMethod || processandoPagamento}
            >
              {processandoPagamento ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Processando...
                </>
              ) : (
                `💳 Pagar ${selectedItem ? formatCurrency(selectedItem.valor) : ''}`
              )}
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Modal QR Code PIX */}
        <Modal show={showQrModal} onHide={() => setShowQrModal(false)} size="lg" centered>
          <Modal.Header closeButton>
            <Modal.Title>
              ⚡ Pagamento PIX - {qrCodeData ? formatCurrency(qrCodeData.valor) : ''}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="text-center">
            {qrCodeData && (
              <>
                <Alert variant="info" className="mb-4">
                  <h6>📱 Como pagar com PIX:</h6>
                  <ol className="text-start mb-0">
                    <li>Abra o app do seu banco</li>
                    <li>Escolha a opção PIX</li>
                    <li>Escaneie o QR Code abaixo ou copie o código</li>
                    <li>Confirme o pagamento</li>
                  </ol>
                </Alert>

                <Card className="mb-4">
                  <Card.Body>
                    <h5 className="mb-3">QR Code PIX</h5>
                    <div className="d-flex justify-content-center mb-3">
                      <div style={{
                        padding: '20px',
                        backgroundColor: 'white',
                        border: '2px solid #dee2e6',
                        borderRadius: '8px',
                        display: 'inline-block'
                      }}>
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCodeData.qr_code)}`}
                          alt="QR Code PIX"
                          style={{
                            width: '200px',
                            height: '200px',
                            border: '2px solid #000'
                          }}
                          onError={(e) => {
                            // Fallback se a API não funcionar
                            e.currentTarget.style.display = 'none'
                            e.currentTarget.nextElementSibling.style.display = 'flex'
                          }}
                        />
                        <div 
                          style={{
                            width: '200px',
                            height: '200px',
                            backgroundColor: '#f8f9fa',
                            border: '2px solid #000',
                            display: 'none',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '48px',
                            flexDirection: 'column'
                          }}
                        >
                          📱<br />
                          <small style={{fontSize: '12px'}}>QR Code</small>
                        </div>
                      </div>
                    </div>
                    <p className="text-muted">
                      QR Code gerado para pagamento de <strong>{formatCurrency(qrCodeData.valor)}</strong>
                    </p>
                  </Card.Body>
                </Card>

                <Card>
                  <Card.Header>
                    <h6 className="mb-0">📋 Código PIX para Cópia e Cola</h6>
                  </Card.Header>
                  <Card.Body>
                    <Form.Control
                      as="textarea"
                      rows={4}
                      value={qrCodeData.qr_code}
                      readOnly
                      className="font-monospace small"
                    />
                    <Button
                      variant="outline-primary"
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        navigator.clipboard.writeText(qrCodeData.qr_code)
                        showAlert('success', 'Código PIX copiado para a área de transferência!')
                      }}
                    >
                      📋 Copiar Código PIX
                    </Button>
                  </Card.Body>
                </Card>

                <Alert variant="warning" className="mt-3">
                  <small>
                    <strong>⏰ Atenção:</strong> Este QR Code expira em 30 minutos. 
                    ID do pagamento: <code>{qrCodeData.payment_id}</code>
                  </small>
                </Alert>
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowQrModal(false)}>
              Fechar
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Modal do Boleto */}
        <Modal show={showBoletoModal} onHide={() => setShowBoletoModal(false)} size="lg" centered>
          <Modal.Header closeButton>
            <Modal.Title>
              🧾 Boleto Bancário - {boletoData ? formatCurrency(boletoData.valor) : ''}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="text-center">
            {boletoData && (
              <>
                <Alert variant="success" className="mb-4">
                  <h6>✅ Boleto gerado com sucesso!</h6>
                  <p className="mb-0">Você pode pagar no banco, lotérica, caixa eletrônico ou internet banking.</p>
                </Alert>

                <Card className="mb-4">
                  <Card.Body>
                    <h5 className="mb-3">Dados do Boleto</h5>
                    
                    <div className="mb-3">
                      <strong>Payment ID:</strong>
                      <br />
                      <code>{boletoData.payment_id}</code>
                    </div>

                    {boletoData.linha_digitavel && (
                      <div className="mb-3">
                        <strong>Linha Digitável:</strong>
                        <br />
                        <code style={{ fontSize: '0.9em', wordBreak: 'break-all' }}>
                          {boletoData.linha_digitavel}
                        </code>
                        <br />
                        <small className="text-muted">Use este código para pagar no internet banking</small>
                      </div>
                    )}

                    <div className="d-grid gap-2">
                      <Button 
                        variant="primary" 
                        onClick={() => window.open(boletoData.boleto_url, '_blank')}
                        size="lg"
                      >
                        🖨️ Visualizar e Imprimir Boleto
                      </Button>
                      
                      {boletoData.linha_digitavel && (
                        <Button 
                          variant="outline-secondary"
                          onClick={() => {
                            navigator.clipboard.writeText(boletoData.linha_digitavel)
                            showAlert('info', 'Linha digitável copiada!')
                          }}
                        >
                          📋 Copiar Linha Digitável
                        </Button>
                      )}
                    </div>
                  </Card.Body>
                </Card>

                <Alert variant="info" className="mt-3">
                  <small>
                    <strong>💡 Dica:</strong> O pagamento pode levar até 3 dias úteis para ser confirmado.
                    <br />
                    <strong>📱 Status:</strong> Acompanhe o status do pagamento nesta mesma tela.
                  </small>
                </Alert>
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowBoletoModal(false)}>
              Fechar
            </Button>
            {boletoData && (
              <Button 
                variant="primary" 
                onClick={() => window.open(boletoData.boleto_url, '_blank')}
              >
                🖨️ Abrir Boleto
              </Button>
            )}
          </Modal.Footer>
        </Modal>
      </Container>
    </>
  )
}