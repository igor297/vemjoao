'use client'

import { useState, useEffect } from 'react'
import { Container, Row, Col, Card, Button, Form, Alert, Badge, Modal } from 'react-bootstrap'

interface ConfiguracaoFinanceira {
  _id?: string
  id_configuracao: string
  condominio_id: string
  master_id: string
  cobranca_automatica_ativa: boolean
  mercado_pago: {
    ativo: boolean
    access_token?: string
    public_key?: string
    taxa_boleto: number
    taxa_pix: number
    taxa_cartao_debito: number
    taxa_cartao_credito: number
    tipo_taxa: 'percentual' | 'fixo'
  }
  stone: {
    ativo: boolean
    api_key?: string
    secret_key?: string
    taxa_boleto: number
    taxa_pix: number
    taxa_cartao_debito: number
    taxa_cartao_credito: number
    tipo_taxa: 'percentual' | 'fixo'
  }
  pagseguro: {
    ativo: boolean
    email?: string
    token?: string
    taxa_boleto: number
    taxa_pix: number
    taxa_cartao_debito: number
    taxa_cartao_credito: number
    tipo_taxa: 'percentual' | 'fixo'
  }
  configuracoes_gerais: {
    dias_vencimento_boleto: number
    dias_vencimento_pix: number
    juros_atraso_mes: number
    multa_atraso: number
    descricao_padrao_boleto: string
    instrucoes_boleto: string
  }
}

interface Condominium {
  _id: string
  nome: string
}

export default function MasterConfigFinanceiroPage() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [condominiums, setCondominiums] = useState<Condominium[]>([])
  const [selectedCondominiumId, setSelectedCondominiumId] = useState<string>('')
  const [configuracao, setConfiguracao] = useState<ConfiguracaoFinanceira | null>(null)
  const [loading, setLoading] = useState(false)
  const [alert, setAlert] = useState<{type: string, message: string} | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [activeProvider, setActiveProvider] = useState<'mercado_pago' | 'stone' | 'pagseguro' | null>(null)

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
      
      if (user.tipo !== 'master') {
        showAlert('danger', 'Acesso negado: Esta página é exclusiva para Masters')
        return
      }
      
      loadCondominiums(user.id)
      const activeCondominiumId = getLocalStorage('activeCondominium')
      if (activeCondominiumId) {
        setSelectedCondominiumId(activeCondominiumId)
        loadConfiguracao(user, activeCondominiumId)
      }
    }
  }, [])

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

  const loadConfiguracao = async (user: any, condominioId: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/configuracao-financeira?master_id=${user.id}&condominio_id=${condominioId}&tipo_usuario=${user.tipo}`)
      const data = await response.json()
      
      if (data.success) {
        setConfiguracao(data.configuracao)
      } else {
        showAlert('danger', data.error || 'Erro ao carregar configuração')
      }
    } catch (error) {
      showAlert('danger', 'Erro ao carregar configuração financeira')
    } finally {
      setLoading(false)
    }
  }

  const handleCondominiumChange = (condominioId: string) => {
    setSelectedCondominiumId(condominioId)
    if (condominioId && currentUser) {
      loadConfiguracao(currentUser, condominioId)
    }
  }

  const showAlert = (type: string, message: string) => {
    setAlert({ type, message })
    setTimeout(() => setAlert(null), 5000)
  }

  const getCondominiumName = (condominioId: string) => {
    const cond = condominiums.find(c => c._id === condominioId)
    return cond?.nome || 'N/A'
  }

  const toggleCobrancaAutomatica = async () => {
    if (!configuracao || !currentUser || !selectedCondominiumId) return
    
    try {
      setLoading(true)
      const novoStatus = !configuracao.cobranca_automatica_ativa
      
      const updateData = {
        ...configuracao,
        cobranca_automatica_ativa: novoStatus,
        tipo_usuario: currentUser.tipo
      }
      
      const method = configuracao._id ? 'PUT' : 'POST'
      const url = '/api/configuracao-financeira'
      
      if (!configuracao._id) {
        updateData.condominio_id = selectedCondominiumId
        updateData.master_id = currentUser.id
        updateData.criado_por_id = currentUser.id
        updateData.criado_por_nome = currentUser.nome || currentUser.email
      }
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })
      
      const data = await response.json()
      
      if (data.success) {
        showAlert('success', `Cobrança automática ${novoStatus ? 'ATIVADA' : 'DESATIVADA'} com sucesso!`)
        loadConfiguracao(currentUser, selectedCondominiumId)
      } else {
        showAlert('danger', data.error || 'Erro ao atualizar configuração')
      }
    } catch (error) {
      showAlert('danger', 'Erro ao atualizar configuração')
    } finally {
      setLoading(false)
    }
  }

  const handleProviderConfig = (provider: 'mercado_pago' | 'stone' | 'pagseguro') => {
    setActiveProvider(provider)
    setShowModal(true)
  }

  const toggleProvider = async (provider: 'mercado_pago' | 'stone' | 'pagseguro') => {
    if (!configuracao || !currentUser) return
    
    try {
      setLoading(true)
      const novoStatus = !configuracao[provider].ativo
      
      const updateData = {
        ...configuracao,
        [provider]: {
          ...configuracao[provider],
          ativo: novoStatus
        },
        tipo_usuario: currentUser.tipo
      }
      
      const method = configuracao._id ? 'PUT' : 'POST'
      const url = '/api/configuracao-financeira'
      
      if (!configuracao._id) {
        updateData.condominio_id = selectedCondominiumId
        updateData.master_id = currentUser.id
        updateData.criado_por_id = currentUser.id
        updateData.criado_por_nome = currentUser.nome || currentUser.email
      }
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })
      
      const data = await response.json()
      
      if (data.success) {
        const providerNames = {
          mercado_pago: 'Mercado Pago',
          stone: 'Stone',
          pagseguro: 'PagSeguro'
        }
        showAlert('success', `${providerNames[provider]} ${novoStatus ? 'ATIVADO' : 'DESATIVADO'} com sucesso!`)
        loadConfiguracao(currentUser, selectedCondominiumId)
      } else {
        showAlert('danger', data.error || 'Erro ao atualizar configuração')
      }
    } catch (error) {
      showAlert('danger', 'Erro ao atualizar configuração')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor)
  }

  if (loading && !configuracao) {
    return (
      <>
        <Container fluid className="py-4">
          <Alert variant="info" className="text-center">
            <h5>⏳ Carregando configurações financeiras...</h5>
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
            <Card className="border-warning">
              <Card.Header className="bg-warning text-dark">
                <h4 className="mb-0">⚙️ Configurações Financeiras - ÁREA RESTRITA</h4>
                <small>⚠️ Esta página é exclusiva para Masters - Configurações avançadas do sistema de cobrança</small>
              </Card.Header>
            </Card>
          </Col>
        </Row>

        {/* Seletor de Condomínio */}
        <Row className="mb-4">
          <Col md={6}>
            <Card>
              <Card.Header>
                <h5 className="mb-0">🏢 Selecionar Condomínio</h5>
              </Card.Header>
              <Card.Body>
                <Form.Group>
                  <Form.Label>Condomínio *</Form.Label>
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
                </Form.Group>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {!selectedCondominiumId ? (
          <Alert variant="info" className="text-center">
            <h5>👆 Selecione um condomínio acima</h5>
            <p className="mb-0">Escolha o condomínio para configurar o sistema de cobrança</p>
          </Alert>
        ) : (
          <>
            {/* Toggle Principal - Cobrança Automática */}
            <Row className="mb-4">
              <Col>
                <Card className={`border-3 ${configuracao?.cobranca_automatica_ativa ? 'border-success' : 'border-secondary'}`}>
                  <Card.Header className={configuracao?.cobranca_automatica_ativa ? 'bg-success text-white' : 'bg-secondary text-white'}>
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <h5 className="mb-0">
                          {configuracao?.cobranca_automatica_ativa ? '✅' : '❌'} Sistema de Cobrança Automática
                        </h5>
                        <small>
                          {configuracao?.cobranca_automatica_ativa 
                            ? 'ATIVO - Boletos e PIX são gerados automaticamente' 
                            : 'INATIVO - Cobrança manual apenas'
                          }
                        </small>
                      </div>
                      <Button
                        variant={configuracao?.cobranca_automatica_ativa ? 'outline-light' : 'outline-primary'}
                        size="lg"
                        onClick={toggleCobrancaAutomatica}
                        disabled={loading}
                      >
                        {loading ? 'Processando...' : (configuracao?.cobranca_automatica_ativa ? 'DESATIVAR' : 'ATIVAR')}
                      </Button>
                    </div>
                  </Card.Header>
                  <Card.Body>
                    <Alert variant={configuracao?.cobranca_automatica_ativa ? 'success' : 'warning'}>
                      <h6>
                        {configuracao?.cobranca_automatica_ativa ? '✅' : '⚠️'} 
                        {' '}O que acontece quando {configuracao?.cobranca_automatica_ativa ? 'ATIVO' : 'ATIVADO'}:
                      </h6>
                      <ul className="mb-0">
                        <li>Boletos são gerados automaticamente para todas as taxas condominiais</li>
                        <li>PIX é disponibilizado para pagamento instantâneo</li>
                        <li>Cartões de débito e crédito ficam disponíveis para os moradores</li>
                        <li>Taxas adicionais podem ser aplicadas conforme configurado</li>
                        <li>Notificações automáticas de vencimento são enviadas</li>
                        <li>Integração com APIs de pagamento habilitadas</li>
                      </ul>
                    </Alert>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {/* APIs de Pagamento */}
            {configuracao?.cobranca_automatica_ativa && (
              <Row className="mb-4">
                <Col>
                  <h5 className="mb-3">💳 APIs de Pagamento Disponíveis</h5>
                </Col>
                
                {/* Mercado Pago */}
                <Col md={4} className="mb-3">
                  <Card className={`h-100 border-2 ${configuracao.mercado_pago.ativo ? 'border-primary' : 'border-light'}`}>
                    <Card.Header className={configuracao.mercado_pago.ativo ? 'bg-primary text-white' : 'bg-light'}>
                      <div className="d-flex justify-content-between align-items-center">
                        <h6 className="mb-0">💙 Mercado Pago</h6>
                        <Badge bg={configuracao.mercado_pago.ativo ? 'success' : 'secondary'}>
                          {configuracao.mercado_pago.ativo ? 'ATIVO' : 'INATIVO'}
                        </Badge>
                      </div>
                    </Card.Header>
                    <Card.Body className="text-center">
                      <p>
                        <strong>Aceita:</strong><br />
                        🧾 Boleto Bancário<br />
                        ⚡ PIX Instantâneo<br />
                        💳 Cartão Débito/Crédito
                      </p>
                      
                      {configuracao.mercado_pago.ativo && (
                        <div className="mb-3">
                          <small className="text-muted">Taxas configuradas:</small><br />
                          <small>
                            Boleto: {configuracao.mercado_pago.taxa_boleto}
                            {configuracao.mercado_pago.tipo_taxa === 'percentual' ? '%' : ' R$'}<br />
                            PIX: {configuracao.mercado_pago.taxa_pix}
                            {configuracao.mercado_pago.tipo_taxa === 'percentual' ? '%' : ' R$'}<br />
                            Débito: {configuracao.mercado_pago.taxa_cartao_debito}
                            {configuracao.mercado_pago.tipo_taxa === 'percentual' ? '%' : ' R$'}<br />
                            Crédito: {configuracao.mercado_pago.taxa_cartao_credito}
                            {configuracao.mercado_pago.tipo_taxa === 'percentual' ? '%' : ' R$'}
                          </small>
                        </div>
                      )}
                      
                      <div className="d-grid gap-2">
                        <Button 
                          variant={configuracao.mercado_pago.ativo ? 'outline-primary' : 'primary'}
                          onClick={() => toggleProvider('mercado_pago')}
                          disabled={loading}
                        >
                          {configuracao.mercado_pago.ativo ? 'DESATIVAR' : 'ATIVAR'}
                        </Button>
                        <Button 
                          variant="outline-secondary" 
                          size="sm"
                          onClick={() => handleProviderConfig('mercado_pago')}
                        >
                          ⚙️ Configurar Taxas
                        </Button>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>

                {/* Stone */}
                <Col md={4} className="mb-3">
                  <Card className={`h-100 border-2 ${configuracao.stone.ativo ? 'border-success' : 'border-light'}`}>
                    <Card.Header className={configuracao.stone.ativo ? 'bg-success text-white' : 'bg-light'}>
                      <div className="d-flex justify-content-between align-items-center">
                        <h6 className="mb-0">💚 Stone</h6>
                        <Badge bg={configuracao.stone.ativo ? 'success' : 'secondary'}>
                          {configuracao.stone.ativo ? 'ATIVO' : 'INATIVO'}
                        </Badge>
                      </div>
                    </Card.Header>
                    <Card.Body className="text-center">
                      <p>
                        <strong>Aceita:</strong><br />
                        🧾 Boleto Bancário<br />
                        ⚡ PIX Instantâneo<br />
                        💳 Cartão Débito/Crédito
                      </p>
                      
                      {configuracao.stone.ativo && (
                        <div className="mb-3">
                          <small className="text-muted">Taxas configuradas:</small><br />
                          <small>
                            Boleto: {configuracao.stone.taxa_boleto}
                            {configuracao.stone.tipo_taxa === 'percentual' ? '%' : ' R$'}<br />
                            PIX: {configuracao.stone.taxa_pix}
                            {configuracao.stone.tipo_taxa === 'percentual' ? '%' : ' R$'}<br />
                            Débito: {configuracao.stone.taxa_cartao_debito}
                            {configuracao.stone.tipo_taxa === 'percentual' ? '%' : ' R$'}<br />
                            Crédito: {configuracao.stone.taxa_cartao_credito}
                            {configuracao.stone.tipo_taxa === 'percentual' ? '%' : ' R$'}
                          </small>
                        </div>
                      )}
                      
                      <div className="d-grid gap-2">
                        <Button 
                          variant={configuracao.stone.ativo ? 'outline-success' : 'success'}
                          onClick={() => toggleProvider('stone')}
                          disabled={loading}
                        >
                          {configuracao.stone.ativo ? 'DESATIVAR' : 'ATIVAR'}
                        </Button>
                        <Button 
                          variant="outline-secondary" 
                          size="sm"
                          onClick={() => handleProviderConfig('stone')}
                        >
                          ⚙️ Configurar Taxas
                        </Button>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>

                {/* PagSeguro */}
                <Col md={4} className="mb-3">
                  <Card className={`h-100 border-2 ${configuracao.pagseguro.ativo ? 'border-warning' : 'border-light'}`}>
                    <Card.Header className={configuracao.pagseguro.ativo ? 'bg-warning text-dark' : 'bg-light'}>
                      <div className="d-flex justify-content-between align-items-center">
                        <h6 className="mb-0">🟡 PagSeguro</h6>
                        <Badge bg={configuracao.pagseguro.ativo ? 'success' : 'secondary'}>
                          {configuracao.pagseguro.ativo ? 'ATIVO' : 'INATIVO'}
                        </Badge>
                      </div>
                    </Card.Header>
                    <Card.Body className="text-center">
                      <p>
                        <strong>Aceita:</strong><br />
                        🧾 Boleto Bancário<br />
                        ⚡ PIX Instantâneo<br />
                        💳 Cartão Débito/Crédito
                      </p>
                      
                      {configuracao.pagseguro.ativo && (
                        <div className="mb-3">
                          <small className="text-muted">Taxas configuradas:</small><br />
                          <small>
                            Boleto: {configuracao.pagseguro.taxa_boleto}
                            {configuracao.pagseguro.tipo_taxa === 'percentual' ? '%' : ' R$'}<br />
                            PIX: {configuracao.pagseguro.taxa_pix}
                            {configuracao.pagseguro.tipo_taxa === 'percentual' ? '%' : ' R$'}<br />
                            Débito: {configuracao.pagseguro.taxa_cartao_debito}
                            {configuracao.pagseguro.tipo_taxa === 'percentual' ? '%' : ' R$'}<br />
                            Crédito: {configuracao.pagseguro.taxa_cartao_credito}
                            {configuracao.pagseguro.tipo_taxa === 'percentual' ? '%' : ' R$'}
                          </small>
                        </div>
                      )}
                      
                      <div className="d-grid gap-2">
                        <Button 
                          variant={configuracao.pagseguro.ativo ? 'outline-warning' : 'warning'}
                          onClick={() => toggleProvider('pagseguro')}
                          disabled={loading}
                        >
                          {configuracao.pagseguro.ativo ? 'DESATIVAR' : 'ATIVAR'}
                        </Button>
                        <Button 
                          variant="outline-secondary" 
                          size="sm"
                          onClick={() => handleProviderConfig('pagseguro')}
                        >
                          ⚙️ Configurar Taxas
                        </Button>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            )}

            {/* Configurações Gerais */}
            {configuracao?.cobranca_automatica_ativa && (
              <Row className="mb-4">
                <Col>
                  <Card>
                    <Card.Header>
                      <h5 className="mb-0">📋 Configurações Gerais</h5>
                    </Card.Header>
                    <Card.Body>
                      <Row>
                        <Col md={6}>
                          <p><strong>Vencimento Boleto:</strong> {configuracao.configuracoes_gerais.dias_vencimento_boleto} dias</p>
                          <p><strong>Vencimento PIX:</strong> {configuracao.configuracoes_gerais.dias_vencimento_pix} dia(s)</p>
                          <p><strong>Juros Atraso:</strong> {configuracao.configuracoes_gerais.juros_atraso_mes}% ao mês</p>
                        </Col>
                        <Col md={6}>
                          <p><strong>Multa Atraso:</strong> {configuracao.configuracoes_gerais.multa_atraso}%</p>
                          <p><strong>Descrição Padrão:</strong> {configuracao.configuracoes_gerais.descricao_padrao_boleto}</p>
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            )}
          </>
        )}

        {/* Modal de Configuração de Taxas */}
        <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
          <Modal.Header closeButton>
            <Modal.Title>⚙️ Configurar Taxas - {activeProvider}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Alert variant="info">
              <h6>💡 Configuração de Taxas</h6>
              <p className="mb-0">
                Defina as taxas que serão aplicadas para cada método de pagamento. 
                As taxas podem ser em percentual (%) ou valor fixo (R$).
              </p>
            </Alert>
            <p className="text-center"><strong>Em desenvolvimento...</strong></p>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Fechar
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Informações de Segurança */}
        <Row className="mt-4">
          <Col>
            <Alert variant="warning">
              <h6>⚠️ Informações Importantes</h6>
              <ul className="mb-0">
                <li>Esta página é exclusiva para Masters e contém configurações críticas do sistema</li>
                <li>Alterações nas APIs de pagamento afetam todos os moradores do condomínio selecionado</li>
                <li>As taxas configuradas são aplicadas automaticamente em todos os pagamentos</li>
                <li>Mantenha as chaves de API seguras e não compartilhe com terceiros</li>
                <li>Teste as configurações antes de ativar para todos os moradores</li>
              </ul>
            </Alert>
          </Col>
        </Row>
      </Container>
    </>
  )
}