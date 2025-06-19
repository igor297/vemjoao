'use client'

import { useState, useEffect } from 'react'
import { Container, Row, Col, Card, Button, Form, Modal, Table, Alert } from 'react-bootstrap'
import Header from '@/components/Header'
import FieldExplanation from '@/components/FieldExplanation'

interface Condominio {
  _id?: string
  nome: string
  cep: string
  estado: string
  cidade: string
  bairro: string
  rua: string
  numero: string
  complemento: string
  
  // Configurações de pagamento
  valor_taxa_condominio: number
  dia_vencimento: number
  aceita_pagamento_automatico: boolean
  
  // Dados para recebimento
  razao_social: string
  cnpj: string
  banco: string
  agencia: string
  conta: string
  chave_pix: string
  
  // Configurações de cobrança
  multa_atraso: number
  juros_mes: number
  dias_aviso_vencimento: number
  
  // Observações
  observacoes_cobranca: string
}

interface StatusPagamentoMorador {
  _id: string
  id_status: string
  apartamento: string
  bloco?: string
  nome_morador: string
  tipo_morador: string
  status_pagamento: 'em_dia' | 'proximo_vencimento' | 'atrasado' | 'isento'
  valor_pendente: number
  dias_atraso: number
  descricao_situacao: string
  data_proximo_vencimento: string
}

interface ContaBancaria {
  _id: string
  nome_conta: string
  banco: string
  codigo_banco: string
  agencia: string
  numero_conta: string
  digito_conta: string
  tipo_conta: 'corrente' | 'poupanca'
  titular_nome: string
  titular_documento: string
  titular_tipo: 'cpf' | 'cnpj'
  chave_pix?: string
  tipo_chave_pix?: string
  ativa: boolean
  conta_principal: boolean
  aceita_boleto: boolean
  aceita_pix: boolean
  aceita_ted_doc: boolean
  observacoes?: string
}

export default function CondominioPage() {
  const [condominios, setCondominios] = useState<Condominio[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [alert, setAlert] = useState<{type: string, message: string} | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  
  // Estados para status de pagamento
  const [statusPagamentos, setStatusPagamentos] = useState<StatusPagamentoMorador[]>([])
  const [selectedCondominioForStatus, setSelectedCondominioForStatus] = useState<string>('')
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState(false)
  
  // Estados para contas bancárias
  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([])
  const [showContasModal, setShowContasModal] = useState(false)
  const [showContaForm, setShowContaForm] = useState(false)
  const [editingConta, setEditingConta] = useState<ContaBancaria | null>(null)
  const [selectedCondominioForContas, setSelectedCondominioForContas] = useState<string>('')
  const [loadingConta, setLoadingConta] = useState(false)
  
  // Formulário de conta bancária
  const [contaFormData, setContaFormData] = useState({
    nome_conta: '',
    banco: '',
    codigo_banco: '',
    agencia: '',
    numero_conta: '',
    digito_conta: '',
    tipo_conta: 'corrente' as 'corrente' | 'poupanca',
    titular_nome: '',
    titular_documento: '',
    titular_tipo: 'cnpj' as 'cpf' | 'cnpj',
    chave_pix: '',
    tipo_chave_pix: 'cnpj' as 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria',
    aceita_boleto: true,
    aceita_pix: true,
    aceita_ted_doc: true,
    limite_pix_diario: 0,
    observacoes: ''
  })
  
  const [formData, setFormData] = useState<Condominium>({
    nome: '',
    cep: '',
    estado: '',
    cidade: '',
    bairro: '',
    rua: '',
    numero: '',
    complemento: '',
    
    // Configurações de pagamento
    valor_taxa_condominio: 0,
    dia_vencimento: 10,
    aceita_pagamento_automatico: false,
    
    // Dados para recebimento (removidos - agora são gerenciados em contas bancárias)
    razao_social: '',
    cnpj: '',
    
    // Configurações de cobrança
    multa_atraso: 2.0,
    juros_mes: 1.0,
    dias_aviso_vencimento: 5,
    
    // Observações
    observacoes_cobranca: ''
  })

  useEffect(() => {
    // Verificar dados do usuário logado
    const userData = localStorage.getItem('userData')
    if (userData) {
      const user = JSON.parse(userData)
      setCurrentUser(user)
      loadCondominiums(user.id)
    }
  }, [])

  const loadCondominiums = async (masterId?: string) => {
    try {
      const id = masterId || currentUser?.id
      if (!id) return
      
      const response = await fetch(`/api/condominios?master_id=${encodeURIComponent(id)}`)
      const data = await response.json()
      if (data.success) {
        setCondominios(data.condominios)
      } else {
        showAlert('danger', data.error || 'Erro ao carregar condomínios')
      }
    } catch (error) {
      showAlert('danger', 'Erro ao carregar condomínios')
    }
  }

  const showAlert = (type: string, message: string) => {
    setAlert({ type, message })
    setTimeout(() => setAlert(null), 5000)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    
    let processedValue: any = value
    
    // Processar valores numéricos e booleanos
    if (type === 'number') {
      processedValue = parseFloat(value) || 0
    } else if (type === 'checkbox') {
      processedValue = (e.target as HTMLInputElement).checked
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: processedValue
    }))
  }

  const buscarCEP = async (cep: string) => {
    const cepLimpo = cep.replace(/\D/g, '')
    
    if (cepLimpo.length === 8) {
      try {
        setLoading(true)
        const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`)
        const data = await response.json()
        
        if (!data.erro) {
          setFormData(prev => ({
            ...prev,
            estado: data.uf || '',
            cidade: data.localidade || '',
            bairro: data.bairro || '',
            rua: data.logradouro || ''
          }))
          showAlert('success', 'CEP encontrado! Endereço preenchido automaticamente.')
        } else {
          showAlert('warning', 'CEP não encontrado')
        }
      } catch (error) {
        showAlert('danger', 'Erro ao buscar CEP')
      } finally {
        setLoading(false)
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const url = editingId ? `/api/condominios/${editingId}` : '/api/condominios'
      const method = editingId ? 'PUT' : 'POST'
      
      const dataToSend = {
        ...formData,
        master_id: currentUser?.id
      }
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend)
      })

      const data = await response.json()
      
      if (data.success) {
        showAlert('success', editingId ? 'Condomínio atualizado!' : 'Condomínio criado!')
        
        // Se aceita pagamento automático, atualizar status dos moradores
        if (formData.aceita_pagamento_automatico && data.condominium?._id) {
          try {
            const statusResponse = await fetch('/api/condominios/update-payment-status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                condominio_id: data.condominium._id,
                master_id: currentUser?.id,
                gerar_financeiro_automatico: !editingId // Gerar apenas se for novo condomínio
              })
            })
            
            const statusData = await statusResponse.json()
            if (statusData.success) {
              showAlert('info', `Status de pagamento atualizado para ${statusData.status_atualizados || 0} morador(es)`)
            }
          } catch (error) {
            console.log('Erro ao atualizar status, mas condomínio foi salvo')
          }
        }
        
        handleCloseModal()
        loadCondominiums()
      } else {
        showAlert('danger', data.error || 'Erro ao salvar condomínio')
      }
    } catch (error) {
      showAlert('danger', 'Erro ao salvar condomínio')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (condominium: Condominium) => {
    setFormData({
      nome: condominium.nome || '',
      cep: condominium.cep || '',
      estado: condominium.estado || '',
      cidade: condominium.cidade || '',
      bairro: condominium.bairro || '',
      rua: condominium.rua || '',
      numero: condominium.numero || '',
      complemento: condominium.complemento || '',
      
      // Configurações de pagamento
      valor_taxa_condominio: condominium.valor_taxa_condominio || 0,
      dia_vencimento: condominium.dia_vencimento || 10,
      aceita_pagamento_automatico: condominium.aceita_pagamento_automatico || false,
      
      // Dados para recebimento (removidos - agora são gerenciados em contas bancárias)
      razao_social: condominium.razao_social || '',
      cnpj: condominium.cnpj || '',
      
      // Configurações de cobrança
      multa_atraso: condominium.multa_atraso || 2.0,
      juros_mes: condominium.juros_mes || 1.0,
      dias_aviso_vencimento: condominium.dias_aviso_vencimento || 5,
      
      // Observações
      observacoes_cobranca: condominium.observacoes_cobranca || ''
    })
    setEditingId(condominium._id || null)
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este condomínio?')) return

    try {
      const response = await fetch(`/api/condominios/${id}?master_id=${encodeURIComponent(currentUser?.id)}`, {
        method: 'DELETE'
      })

      const data = await response.json()
      
      if (data.success) {
        showAlert('success', 'Condomínio excluído!')
        loadCondominiums()
      } else {
        showAlert('danger', data.error || 'Erro ao excluir condomínio')
      }
    } catch (error) {
      showAlert('danger', 'Erro ao excluir condomínio')
    }
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingId(null)
    setFormData({
      nome: '',
      cep: '',
      estado: '',
      cidade: '',
      bairro: '',
      rua: '',
      numero: '',
      complemento: '',
      
      // Configurações de pagamento
      valor_taxa_condominio: 0,
      dia_vencimento: 10,
      aceita_pagamento_automatico: false,
      
      // Dados para recebimento (removidos - agora são gerenciados em contas bancárias)
      razao_social: '',
      cnpj: '',
      
      // Configurações de cobrança
      multa_atraso: 2.0,
      juros_mes: 1.0,
      dias_aviso_vencimento: 5,
      
      // Observações
      observacoes_cobranca: ''
    })
  }

  // Funções para contas bancárias
  const loadContasBancarias = async (condominioId: string) => {
    try {
      const response = await fetch(`/api/contas-bancarias?condominio_id=${condominioId}&master_id=${currentUser?.id}`)
      const data = await response.json()
      
      if (data.success) {
        setContasBancarias(data.contas)
      } else {
        showAlert('danger', data.error || 'Erro ao carregar contas bancárias')
      }
    } catch (error) {
      showAlert('danger', 'Erro ao carregar contas bancárias')
    }
  }

  const handleViewContas = (condominioId: string) => {
    setSelectedCondominioForContas(condominioId)
    setShowContasModal(true)
    loadContasBancarias(condominioId)
  }

  const toggleContaPrincipal = async (contaId: string) => {
    try {
      const response = await fetch('/api/contas-bancarias', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _id: contaId,
          action: 'toggle_principal'
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        showAlert('success', data.message)
        loadContasBancarias(selectedCondominioForContas)
      } else {
        showAlert('danger', data.error || 'Erro ao alterar conta principal')
      }
    } catch (error) {
      showAlert('danger', 'Erro ao alterar conta principal')
    }
  }

  const toggleContaAtiva = async (contaId: string) => {
    try {
      const response = await fetch('/api/contas-bancarias', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _id: contaId,
          action: 'toggle_ativa'
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        showAlert('success', data.message)
        loadContasBancarias(selectedCondominioForContas)
      } else {
        showAlert('danger', data.error || 'Erro ao alterar status da conta')
      }
    } catch (error) {
      showAlert('danger', 'Erro ao alterar status da conta')
    }
  }

  const formatarConta = (numero: string, digito: string) => {
    return `${numero}-${digito}`
  }

  const formatarDocumento = (documento: string, tipo: string) => {
    const doc = documento.replace(/\D/g, '')
    if (tipo === 'cpf') {
      return doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    } else {
      return doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
    }
  }

  // Funções para formulário de conta bancária
  const resetContaForm = () => {
    setContaFormData({
      nome_conta: '',
      banco: '',
      codigo_banco: '',
      agencia: '',
      numero_conta: '',
      digito_conta: '',
      tipo_conta: 'corrente',
      titular_nome: '',
      titular_documento: '',
      titular_tipo: 'cnpj',
      chave_pix: '',
      tipo_chave_pix: 'cnpj',
      aceita_boleto: true,
      aceita_pix: true,
      aceita_ted_doc: true,
      limite_pix_diario: 0,
      observacoes: ''
    })
    setEditingConta(null)
  }

  const handleContaInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    
    let processedValue: any = value
    
    if (type === 'checkbox') {
      processedValue = (e.target as HTMLInputElement).checked
    } else if (type === 'number') {
      processedValue = parseFloat(value) || 0
    }
    
    setContaFormData(prev => ({
      ...prev,
      [name]: processedValue
    }))
  }

  const handleBancoSelect = (codigo: string, nome: string) => {
    setContaFormData(prev => ({
      ...prev,
      codigo_banco: codigo,
      banco: nome
    }))
  }

  const handleSubmitConta = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoadingConta(true)

    try {
      const method = editingConta ? 'PUT' : 'POST'
      const dataToSend = {
        ...contaFormData,
        condominio_id: selectedCondominioForContas,
        master_id: currentUser?.id,
        criado_por_id: currentUser?.id,
        criado_por_nome: currentUser?.nome || currentUser?.email,
        ...(editingConta && { _id: editingConta._id })
      }
      
      const response = await fetch('/api/contas-bancarias', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend)
      })

      const data = await response.json()
      
      if (data.success) {
        showAlert('success', editingConta ? 'Conta bancária atualizada!' : 'Conta bancária criada!')
        setShowContaForm(false)
        resetContaForm()
        loadContasBancarias(selectedCondominioForContas)
      } else {
        showAlert('danger', data.error || 'Erro ao salvar conta bancária')
      }
    } catch (error) {
      showAlert('danger', 'Erro ao salvar conta bancária')
    } finally {
      setLoadingConta(false)
    }
  }

  const handleEditConta = (conta: ContaBancaria) => {
    setContaFormData({
      nome_conta: conta.nome_conta,
      banco: conta.banco,
      codigo_banco: conta.codigo_banco,
      agencia: conta.agencia,
      numero_conta: conta.numero_conta,
      digito_conta: conta.digito_conta,
      tipo_conta: conta.tipo_conta,
      titular_nome: conta.titular_nome,
      titular_documento: conta.titular_documento,
      titular_tipo: conta.titular_tipo,
      chave_pix: conta.chave_pix || '',
      tipo_chave_pix: conta.tipo_chave_pix || 'cnpj',
      aceita_boleto: conta.aceita_boleto,
      aceita_pix: conta.aceita_pix,
      aceita_ted_doc: conta.aceita_ted_doc,
      limite_pix_diario: conta.limite_pix_diario || 0,
      observacoes: conta.observacoes || ''
    })
    setEditingConta(conta)
    setShowContaForm(true)
  }

  const deleteConta = async (contaId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta conta bancária?')) return

    try {
      const response = await fetch(`/api/contas-bancarias?conta_id=${contaId}&master_id=${currentUser?.id}`, {
        method: 'DELETE'
      })

      const data = await response.json()
      
      if (data.success) {
        showAlert('success', 'Conta bancária excluída!')
        loadContasBancarias(selectedCondominioForContas)
      } else {
        showAlert('danger', data.error || 'Erro ao excluir conta bancária')
      }
    } catch (error) {
      showAlert('danger', 'Erro ao excluir conta bancária')
    }
  }

  // Lista de bancos brasileiros
  const bancosBrasileiros = [
    { codigo: '001', nome: 'Banco do Brasil' },
    { codigo: '237', nome: 'Bradesco' },
    { codigo: '341', nome: 'Itaú' },
    { codigo: '104', nome: 'Caixa Econômica Federal' },
    { codigo: '033', nome: 'Santander' },
    { codigo: '745', nome: 'Citibank' },
    { codigo: '077', nome: 'Banco Inter' },
    { codigo: '260', nome: 'Nu Pagamentos (Nubank)' },
    { codigo: '323', nome: 'Mercado Pago' },
    { codigo: '290', nome: 'PagSeguro' },
    { codigo: '336', nome: 'C6 Bank' },
    { codigo: '380', nome: 'PicPay' }
  ]

  // Funções para status de pagamento
  const loadStatusPagamentos = async (condominioId: string) => {
    try {
      setLoadingStatus(true)
      const response = await fetch(`/api/status-pagamento-morador?condominio_id=${condominioId}&master_id=${currentUser?.id}`)
      const data = await response.json()
      
      if (data.success) {
        setStatusPagamentos(data.status_pagamentos)
      } else {
        showAlert('danger', data.error || 'Erro ao carregar status de pagamentos')
      }
    } catch (error) {
      showAlert('danger', 'Erro ao carregar status de pagamentos')
    } finally {
      setLoadingStatus(false)
    }
  }

  const atualizarTodosStatus = async (condominioId: string) => {
    try {
      setLoadingStatus(true)
      const response = await fetch(`/api/status-pagamento-morador?action=atualizar_todos&condominio_id=${condominioId}&master_id=${currentUser?.id}`)
      const data = await response.json()
      
      if (data.success) {
        showAlert('success', `Status atualizado para ${data.atualizados} morador(es)`)
        loadStatusPagamentos(condominioId)
      } else {
        showAlert('danger', data.error || 'Erro ao atualizar status')
      }
    } catch (error) {
      showAlert('danger', 'Erro ao atualizar status')
    } finally {
      setLoadingStatus(false)
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

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      em_dia: { bg: 'success', text: '✅ Em Dia', icon: '🟢' },
      proximo_vencimento: { bg: 'warning', text: '⚠️ Próximo Venc.', icon: '🟡' },
      atrasado: { bg: 'danger', text: '❌ Atrasado', icon: '🔴' },
      isento: { bg: 'info', text: '🚫 Isento', icon: '🔵' }
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.em_dia
    return `${config.icon} ${config.text}`
  }

  const handleViewStatus = (condominioId: string) => {
    setSelectedCondominioForStatus(condominioId)
    setShowStatusModal(true)
    loadStatusPagamentos(condominioId)
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
              <Card.Header className="d-flex justify-content-between align-items-center">
                <h4 className="mb-0">Gerenciar Condomínios</h4>
                <Button variant="primary" onClick={() => setShowModal(true)}>
                  <i className="bi bi-plus-circle me-2"></i>
                  Novo Condomínio
                </Button>
              </Card.Header>
              <Card.Body>
                <Table responsive striped hover>
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Endereço</th>
                      <th>Taxa Mensal</th>
                      <th>Vencimento</th>
                      <th>Pagamento Autom.</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!condominios || condominios.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center text-muted">
                          Nenhum condomínio encontrado
                        </td>
                      </tr>
                    ) : (
                      condominios.map((cond) => (
                        <tr key={cond._id}>
                          <td>
                            <strong>{cond.nome}</strong>
                            {cond.razao_social && (
                              <><br /><small className="text-muted">{cond.razao_social}</small></>
                            )}
                          </td>
                          <td>
                            {cond.rua ? `${cond.rua}, ${cond.numero}` : cond.numero}
                            {cond.bairro && <><br /><small>{cond.bairro} - {cond.cidade}/{cond.estado}</small></>}
                            {cond.cep && <><br /><small>CEP: {cond.cep}</small></>}
                          </td>
                          <td>
                            {cond.valor_taxa_condominio ? formatCurrency(cond.valor_taxa_condominio) : '-'}
                          </td>
                          <td>
                            Dia {cond.dia_vencimento || 10}
                          </td>
                          <td>
                            {cond.aceita_pagamento_automatico ? (
                              <span className="text-success">✅ Ativo</span>
                            ) : (
                              <span className="text-muted">❌ Inativo</span>
                            )}
                          </td>
                          <td>
                            <div className="btn-group-vertical btn-group-sm gap-1">
                              <Button 
                                variant="outline-primary" 
                                size="sm"
                                onClick={() => handleEdit(cond)}
                              >
                                ✏️ Editar
                              </Button>
                              <Button 
                                variant="outline-info" 
                                size="sm"
                                onClick={() => handleViewStatus(cond._id!)}
                              >
                                📈 Status Pagamentos
                              </Button>
                              <Button 
                                variant="outline-success" 
                                size="sm"
                                onClick={() => handleViewContas(cond._id!)}
                              >
                                🏦 Contas Bancárias
                              </Button>
                              <Button 
                                variant="outline-danger" 
                                size="sm"
                                onClick={() => handleDelete(cond._id!)}
                              >
                                🗑️ Excluir
                              </Button>
                            </div>
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

        <Modal show={showModal} onHide={handleCloseModal} size="xl">
          <Modal.Header closeButton>
            <Modal.Title>
              {editingId ? '✏️ Editar Condomínio' : '🏢 Novo Condomínio'}
            </Modal.Title>
          </Modal.Header>
          <Form onSubmit={handleSubmit}>
            <Modal.Body>
              <Alert variant="info" className="mb-4">
                <h6>📋 Informações do Formulário</h6>
                <ul className="mb-0">
                  <li><strong>Campos obrigatórios:</strong> Nome e Número</li>
                  <li><strong>CEP:</strong> Opcional - para preenchimento automático do endereço</li>
                  <li><strong>Configurações de Pagamento:</strong> Necessárias para cobrança automática</li>
                </ul>
              </Alert>
              
              {/* Seção 1: Dados Básicos */}
              <Card className="mb-4">
                <Card.Header><h6 className="mb-0">🏢 Dados Básicos do Condomínio</h6></Card.Header>
                <Card.Body>
                  <Row>
                    <Col md={8}>
                      <Form.Group className="mb-3">
                        <Form.Label>Nome do Condomínio *</Form.Label>
                        <Form.Control
                          type="text"
                          name="nome"
                          value={formData.nome}
                          onChange={handleInputChange}
                          required
                          placeholder="Ex: Residencial Jardim das Flores"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>CEP (opcional)</Form.Label>
                        <div className="d-flex">
                          <Form.Control
                            type="text"
                            name="cep"
                            value={formData.cep}
                            onChange={(e) => {
                              let value = e.target.value.replace(/\D/g, '')
                              if (value.length > 5) {
                                value = value.slice(0, 5) + '-' + value.slice(5, 8)
                              }
                              setFormData(prev => ({ ...prev, cep: value }))
                              
                              if (value.replace(/\D/g, '').length === 8) {
                                buscarCEP(value)
                              }
                            }}
                            placeholder="00000-000"
                            maxLength={9}
                          />
                          <Button 
                            type="button"
                            variant="outline-primary"
                            size="sm"
                            className="ms-2"
                            onClick={() => buscarCEP(formData.cep)}
                            disabled={formData.cep.replace(/\D/g, '').length < 8 || loading}
                            title="Buscar CEP"
                          >
                            🔍
                          </Button>
                        </div>
                      </Form.Group>
                    </Col>
                  </Row>

                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Estado</Form.Label>
                        <Form.Control
                          type="text"
                          name="estado"
                          value={formData.estado}
                          onChange={handleInputChange}
                          maxLength={2}
                          placeholder="SP"
                          style={{ textTransform: 'uppercase' }}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Cidade</Form.Label>
                        <Form.Control
                          type="text"
                          name="cidade"
                          value={formData.cidade}
                          onChange={handleInputChange}
                          placeholder="São Paulo"
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  <Row>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>Bairro</Form.Label>
                        <Form.Control
                          type="text"
                          name="bairro"
                          value={formData.bairro}
                          onChange={handleInputChange}
                          placeholder="Centro"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={5}>
                      <Form.Group className="mb-3">
                        <Form.Label>Rua</Form.Label>
                        <Form.Control
                          type="text"
                          name="rua"
                          value={formData.rua}
                          onChange={handleInputChange}
                          placeholder="Rua das Flores"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={3}>
                      <Form.Group className="mb-3">
                        <Form.Label>Número *</Form.Label>
                        <Form.Control
                          type="text"
                          name="numero"
                          value={formData.numero}
                          onChange={handleInputChange}
                          required
                          placeholder="123"
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Complemento</Form.Label>
                        <Form.Control
                          type="text"
                          name="complemento"
                          value={formData.complemento}
                          onChange={handleInputChange}
                          placeholder="Bloco A, Torre 1, etc."
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Razão Social (para CNPJ)</Form.Label>
                        <Form.Control
                          type="text"
                          name="razao_social"
                          value={formData.razao_social}
                          onChange={handleInputChange}
                          placeholder="Condomínio Residencial Jardim Ltda"
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              {/* Seção 2: Configurações de Pagamento */}
              <Card className="mb-4">
                <Card.Header><h6 className="mb-0">💰 Configurações de Pagamento</h6></Card.Header>
                <Card.Body>
                  <Row>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>
                          Valor da Taxa Condominial
                          <FieldExplanation 
                            title="Valor da Taxa Condominial"
                            explanation="Valor mensal que cada unidade (apartamento/casa) deve pagar. Este será o valor base usado para gerar as cobranças mensais. Exemplo: R$ 450,00"
                          />
                        </Form.Label>
                        <Form.Control
                          type="text"
                          name="valor_taxa_condominio"
                          value={formData.valor_taxa_condominio}
                          onChange={handleInputChange}
                          placeholder="450.00"
                          style={{ appearance: 'textfield' }}
                        />
                        <small className="text-muted">Valor padrão mensal por unidade</small>
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>
                          Dia de Vencimento
                          <FieldExplanation 
                            title="Dia de Vencimento"
                            explanation="Dia do mês em que todas as taxas condominiais vencem. Exemplo: Se escolher dia 10, todas as cobranças vencem no dia 10 de cada mês."
                          />
                        </Form.Label>
                        <Form.Select
                          name="dia_vencimento"
                          value={formData.dia_vencimento}
                          onChange={handleInputChange}
                        >
                          {[...Array(31)].map((_, i) => (
                            <option key={i + 1} value={i + 1}>
                              Dia {i + 1}
                            </option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label className="d-block">
                          Pagamento Automático
                          <FieldExplanation 
                            title="Aceita Pagamento Automático"
                            explanation="Quando ativado, o sistema pode gerar automaticamente boletos e códigos PIX para os moradores, facilitando o processo de cobrança."
                          />
                        </Form.Label>
                        <Form.Check 
                          type="checkbox"
                          name="aceita_pagamento_automatico"
                          checked={formData.aceita_pagamento_automatico}
                          onChange={handleInputChange}
                          label="Aceita Pagamento Automático"
                        />
                        <small className="text-muted d-block">Habilita geração automática de boletos/PIX</small>
                      </Form.Group>
                    </Col>
                  </Row>

                  <Row>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>
                          Multa por Atraso (%)
                          <FieldExplanation 
                            title="Multa por Atraso"
                            explanation="Percentual de multa aplicado sobre o valor da taxa quando o pagamento é feito após o vencimento. Por exemplo: 2% significa que uma taxa de R$ 500 terá multa de R$ 10 se paga em atraso."
                          />
                        </Form.Label>
                        <Form.Control
                          type="text"
                          name="multa_atraso"
                          value={formData.multa_atraso}
                          onChange={handleInputChange}
                          placeholder="2.0"
                          style={{ appearance: 'textfield' }}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>
                          Juros ao Mês (%)
                          <FieldExplanation 
                            title="Juros ao Mês"
                            explanation="Percentual de juros aplicado mensalmente sobre valores em atraso. Exemplo: 1% ao mês significa que após 2 meses de atraso, uma taxa de R$ 500 terá juros de R$ 10 (R$ 5 por mês)."
                          />
                        </Form.Label>
                        <Form.Control
                          type="text"
                          name="juros_mes"
                          value={formData.juros_mes}
                          onChange={handleInputChange}
                          placeholder="1.0"
                          style={{ appearance: 'textfield' }}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>
                          Dias de Aviso (Vencimento)
                          <FieldExplanation 
                            title="Dias de Aviso antes do Vencimento"
                            explanation="Quantos dias antes do vencimento o sistema deve enviar lembretes aos moradores. Exemplo: 5 dias significa que se a taxa vence dia 10, o aviso será enviado no dia 5."
                          />
                        </Form.Label>
                        <Form.Control
                          type="text"
                          name="dias_aviso_vencimento"
                          value={formData.dias_aviso_vencimento}
                          onChange={handleInputChange}
                          placeholder="5"
                          style={{ appearance: 'textfield' }}
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              {/* Seção 3: Dados da Empresa */}
              <Card className="mb-4">
                <Card.Header><h6 className="mb-0">🏢 Dados da Empresa</h6></Card.Header>
                <Card.Body>
                  <Alert variant="info">
                    <h6>🏦 Contas Bancárias</h6>
                    <p className="mb-2">As contas bancárias são gerenciadas separadamente.</p>
                    <p className="mb-0">Após salvar o condomínio, clique em "Contas Bancárias" para adicionar e gerenciar as contas.</p>
                  </Alert>
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Razão Social</Form.Label>
                        <Form.Control
                          type="text"
                          name="razao_social"
                          value={formData.razao_social}
                          onChange={handleInputChange}
                          placeholder="Condomínio Residencial Jardim Ltda"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>CNPJ</Form.Label>
                        <Form.Control
                          type="text"
                          name="cnpj"
                          value={formData.cnpj}
                          onChange={handleInputChange}
                          placeholder="00.000.000/0001-00"
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  <Row>
                    <Col md={12}>
                      <Form.Group className="mb-3">
                        <Form.Label>Observações para Cobrança</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={3}
                          name="observacoes_cobranca"
                          value={formData.observacoes_cobranca}
                          onChange={handleInputChange}
                          placeholder="Instruções especiais para cobrança, informações sobre desconto, etc."
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={handleCloseModal}>
                Cancelar
              </Button>
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? 'Salvando...' : (editingId ? '💾 Atualizar' : '💾 Salvar')}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>
        {/* Modal de Status de Pagamentos */}
        <Modal show={showStatusModal} onHide={() => setShowStatusModal(false)} size="xl">
          <Modal.Header closeButton>
            <Modal.Title>📊 Status de Pagamentos dos Moradores</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h6 className="mb-0">Condomínio Selecionado</h6>
                <small className="text-muted">
                  {condominios?.find(c => c._id === selectedCondominioForStatus)?.nome || 'N/A'}
                </small>
              </div>
              <Button 
                variant="outline-primary" 
                size="sm"
                onClick={() => atualizarTodosStatus(selectedCondominioForStatus)}
                disabled={loadingStatus}
              >
                {loadingStatus ? 'Atualizando...' : '🔄 Atualizar Status'}
              </Button>
            </div>

            {loadingStatus ? (
              <Alert variant="info" className="text-center">
                <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                Carregando status de pagamentos...
              </Alert>
            ) : statusPagamentos.length === 0 ? (
              <Alert variant="warning" className="text-center">
                <h6>⚠️ Nenhum status encontrado</h6>
                <p className="mb-2">Não há status de pagamento para este condomínio.</p>
                <Button 
                  variant="primary" 
                  size="sm"
                  onClick={() => atualizarTodosStatus(selectedCondominioForStatus)}
                >
                  🔄 Gerar Status Automaticamente
                </Button>
              </Alert>
            ) : (
              <>
                {/* Resumo por Status */}
                <Row className="mb-4">
                  <Col md={3}>
                    <Card className="text-center border-success">
                      <Card.Body>
                        <h3 className="text-success">{statusPagamentos.filter(s => s.status_pagamento === 'em_dia').length}</h3>
                        <small>🟢 Em Dia</small>
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col md={3}>
                    <Card className="text-center border-warning">
                      <Card.Body>
                        <h3 className="text-warning">{statusPagamentos.filter(s => s.status_pagamento === 'proximo_vencimento').length}</h3>
                        <small>🟡 Próximo Venc.</small>
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col md={3}>
                    <Card className="text-center border-danger">
                      <Card.Body>
                        <h3 className="text-danger">{statusPagamentos.filter(s => s.status_pagamento === 'atrasado').length}</h3>
                        <small>🔴 Atrasado</small>
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col md={3}>
                    <Card className="text-center border-info">
                      <Card.Body>
                        <h3 className="text-info">{statusPagamentos.filter(s => s.status_pagamento === 'isento').length}</h3>
                        <small>🔵 Isento</small>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>

                {/* Tabela de Status */}
                <Table responsive striped>
                  <thead>
                    <tr>
                      <th>Apartamento</th>
                      <th>Morador</th>
                      <th>Status</th>
                      <th>Valor Pendente</th>
                      <th>Próximo Venc.</th>
                      <th>Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statusPagamentos.map((status) => (
                      <tr key={status._id}>
                        <td>
                          <strong>{status.apartamento}</strong>
                          {status.bloco && <><br /><small>Bloco {status.bloco}</small></>}
                        </td>
                        <td>
                          {status.nome_morador}
                          <br />
                          <small className="text-muted">{status.tipo_morador}</small>
                        </td>
                        <td>
                          <span className={`badge ${
                            status.status_pagamento === 'em_dia' ? 'bg-success' :
                            status.status_pagamento === 'proximo_vencimento' ? 'bg-warning' :
                            status.status_pagamento === 'atrasado' ? 'bg-danger' : 'bg-info'
                          }`}>
                            {getStatusBadge(status.status_pagamento)}
                          </span>
                          {status.dias_atraso > 0 && (
                            <><br /><small className="text-danger">{status.dias_atraso} dia(s) atraso</small></>
                          )}
                        </td>
                        <td>
                          {status.valor_pendente > 0 ? (
                            <span className="text-danger fw-bold">
                              {formatCurrency(status.valor_pendente)}
                            </span>
                          ) : (
                            <span className="text-success">✅ Sem pendências</span>
                          )}
                        </td>
                        <td>
                          {formatDate(status.data_proximo_vencimento)}
                        </td>
                        <td>
                          <small>{status.descricao_situacao}</small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>

                <Alert variant="info" className="mt-3">
                  <h6>💡 Informações Importantes</h6>
                  <ul className="mb-0">
                    <li><strong>Em Dia:</strong> Moradores sem pendências ou com vencimento distante</li>
                    <li><strong>Próximo Vencimento:</strong> Vencimento em até 5 dias</li>
                    <li><strong>Atrasado:</strong> Pagamentos vencidos</li>
                    <li><strong>Isento:</strong> Moradores isentos de pagamento</li>
                  </ul>
                </Alert>
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowStatusModal(false)}>
              Fechar
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Modal de Contas Bancárias */}
        <Modal show={showContasModal} onHide={() => setShowContasModal(false)} size="xl">
          <Modal.Header closeButton>
            <Modal.Title>🏦 Contas Bancárias do Condomínio</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h6 className="mb-0">Condomínio Selecionado</h6>
                <small className="text-muted">
                  {condominios?.find(c => c._id === selectedCondominioForContas)?.nome || 'N/A'}
                </small>
              </div>
              <Button 
                variant="primary" 
                size="sm"
                onClick={() => setShowContaForm(true)}
              >
                ➕ Nova Conta Bancária
              </Button>
            </div>

            {contasBancarias.length === 0 ? (
              <Alert variant="info" className="text-center">
                <h6>🏦 Nenhuma conta bancária cadastrada</h6>
                <p className="mb-2">Este condomínio ainda não possui contas bancárias cadastradas.</p>
                <Button 
                  variant="primary" 
                  size="sm"
                  onClick={() => setShowContaForm(true)}
                >
                  ➕ Cadastrar Primeira Conta
                </Button>
              </Alert>
            ) : (
              <>
                {/* Resumo das Contas */}
                <Row className="mb-4">
                  <Col md={3}>
                    <Card className="text-center border-success">
                      <Card.Body>
                        <h3 className="text-success">{contasBancarias.filter(c => c.ativa).length}</h3>
                        <small>🟢 Contas Ativas</small>
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col md={3}>
                    <Card className="text-center border-primary">
                      <Card.Body>
                        <h3 className="text-primary">{contasBancarias.filter(c => c.conta_principal).length}</h3>
                        <small>⭐ Conta Principal</small>
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col md={3}>
                    <Card className="text-center border-info">
                      <Card.Body>
                        <h3 className="text-info">{contasBancarias.filter(c => c.aceita_pix).length}</h3>
                        <small>⚡ Com PIX</small>
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col md={3}>
                    <Card className="text-center border-warning">
                      <Card.Body>
                        <h3 className="text-warning">{contasBancarias.filter(c => !c.ativa).length}</h3>
                        <small>⚠️ Inativas</small>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>

                {/* Lista de Contas */}
                <div className="row">
                  {contasBancarias.map((conta) => (
                    <div key={conta._id} className="col-md-6 mb-3">
                      <Card className={`h-100 border-2 ${
                        conta.conta_principal ? 'border-primary' : 
                        conta.ativa ? 'border-success' : 'border-secondary'
                      }`}>
                        <Card.Header className={`d-flex justify-content-between align-items-center ${
                          conta.conta_principal ? 'bg-primary text-white' : 
                          conta.ativa ? 'bg-light' : 'bg-secondary text-white'
                        }`}>
                          <div>
                            <h6 className="mb-0">{conta.nome_conta}</h6>
                            <small>
                              {conta.conta_principal && '⭐ Principal'}
                              {conta.ativa && !conta.conta_principal && '🟢 Ativa'}
                              {!conta.ativa && '⚠️ Inativa'}
                            </small>
                          </div>
                          <div className="btn-group btn-group-sm">
                            <Button
                              variant={conta.conta_principal ? 'light' : 'outline-primary'}
                              size="sm"
                              onClick={() => toggleContaPrincipal(conta._id)}
                              title={conta.conta_principal ? 'Remover como principal' : 'Definir como principal'}
                            >
                              {conta.conta_principal ? '⭐' : '☆'}
                            </Button>
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              onClick={() => handleEditConta(conta)}
                              title="Editar conta"
                            >
                              ✏️
                            </Button>
                            <Button
                              variant={conta.ativa ? 'outline-warning' : 'outline-success'}
                              size="sm"
                              onClick={() => toggleContaAtiva(conta._id)}
                              title={conta.ativa ? 'Desativar conta' : 'Ativar conta'}
                            >
                              {conta.ativa ? '⏸️' : '▶️'}
                            </Button>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => deleteConta(conta._id)}
                              title="Excluir conta"
                            >
                              🗑️
                            </Button>
                          </div>
                        </Card.Header>
                        <Card.Body>
                          <div className="row">
                            <div className="col-12">
                              <p className="mb-1"><strong>Banco:</strong> {conta.banco} ({conta.codigo_banco})</p>
                              <p className="mb-1"><strong>Agência:</strong> {conta.agencia}</p>
                              <p className="mb-1"><strong>Conta:</strong> {formatarConta(conta.numero_conta, conta.digito_conta)} ({conta.tipo_conta})</p>
                              <p className="mb-1"><strong>Titular:</strong> {conta.titular_nome}</p>
                              <p className="mb-1"><strong>Documento:</strong> {formatarDocumento(conta.titular_documento, conta.titular_tipo)}</p>
                              
                              {conta.chave_pix && (
                                <p className="mb-1"><strong>PIX:</strong> {conta.chave_pix}</p>
                              )}
                              
                              <div className="d-flex gap-1 mt-2">
                                {conta.aceita_boleto && <span className="badge bg-info">🧾 Boleto</span>}
                                {conta.aceita_pix && <span className="badge bg-success">⚡ PIX</span>}
                                {conta.aceita_ted_doc && <span className="badge bg-warning">🏦 TED/DOC</span>}
                              </div>
                              
                              {conta.observacoes && (
                                <small className="text-muted d-block mt-2">{conta.observacoes}</small>
                              )}
                            </div>
                          </div>
                        </Card.Body>
                      </Card>
                    </div>
                  ))}
                </div>

                <Alert variant="warning" className="mt-3">
                  <h6>⚠️ Informações Importantes</h6>
                  <ul className="mb-0">
                    <li><strong>Conta Principal:</strong> É a conta que será usada para geração de boletos e recebimentos</li>
                    <li><strong>Apenas uma conta</strong> pode ser principal por vez</li>
                    <li><strong>Contas inativas</strong> não aparecem para os moradores</li>
                    <li><strong>Para alterar a conta principal:</strong> Clique na estrela (⭐) da conta desejada</li>
                  </ul>
                </Alert>
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowContasModal(false)}>
              Fechar
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Modal de Formulário de Conta Bancária */}
        <Modal show={showContaForm} onHide={() => setShowContaForm(false)} size="lg">
          <Modal.Header closeButton>
            <Modal.Title>🏦 {editingConta ? 'Editar' : 'Nova'} Conta Bancária</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Alert variant="info">
              <h6>📝 Informações sobre Contas Bancárias</h6>
              <p className="mb-0">
                Cadastre as contas bancárias do condomínio. Você pode ter várias contas e alternar qual é a principal.
                A conta principal será usada para geração de boletos e recebimentos.
              </p>
            </Alert>
            
            <Form onSubmit={handleSubmitConta}>
              {/* Dados Básicos da Conta */}
              <Card className="mb-4">
                <Card.Header><h6 className="mb-0">🏦 Dados da Conta Bancária</h6></Card.Header>
                <Card.Body>
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Nome Identificador da Conta *</Form.Label>
                        <Form.Control
                          type="text"
                          name="nome_conta"
                          value={contaFormData.nome_conta}
                          onChange={handleContaInputChange}
                          required
                          placeholder="Ex: Conta Principal, Conta Reserva"
                        />
                        <small className="text-muted">Nome para identificar esta conta internamente</small>
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Banco *</Form.Label>
                        <Form.Select
                          name="banco"
                          value={contaFormData.codigo_banco}
                          onChange={(e) => {
                            const banco = bancosBrasileiros.find(b => b.codigo === e.target.value)
                            if (banco) {
                              handleBancoSelect(banco.codigo, banco.nome)
                            }
                          }}
                          required
                        >
                          <option value="">Selecione o banco</option>
                          {bancosBrasileiros.map((banco) => (
                            <option key={banco.codigo} value={banco.codigo}>
                              {banco.codigo} - {banco.nome}
                            </option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                    </Col>
                  </Row>

                  <Row>
                    <Col md={3}>
                      <Form.Group className="mb-3">
                        <Form.Label>Agência *</Form.Label>
                        <Form.Control
                          type="text"
                          name="agencia"
                          value={contaFormData.agencia}
                          onChange={handleContaInputChange}
                          required
                          placeholder="1234"
                          maxLength={6}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>Número da Conta *</Form.Label>
                        <Form.Control
                          type="text"
                          name="numero_conta"
                          value={contaFormData.numero_conta}
                          onChange={handleContaInputChange}
                          required
                          placeholder="12345678"
                          maxLength={15}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={2}>
                      <Form.Group className="mb-3">
                        <Form.Label>Dígito *</Form.Label>
                        <Form.Control
                          type="text"
                          name="digito_conta"
                          value={contaFormData.digito_conta}
                          onChange={handleContaInputChange}
                          required
                          placeholder="0"
                          maxLength={2}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={3}>
                      <Form.Group className="mb-3">
                        <Form.Label>Tipo de Conta *</Form.Label>
                        <Form.Select
                          name="tipo_conta"
                          value={contaFormData.tipo_conta}
                          onChange={handleContaInputChange}
                          required
                        >
                          <option value="corrente">Conta Corrente</option>
                          <option value="poupanca">Conta Poupança</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              {/* Dados do Titular */}
              <Card className="mb-4">
                <Card.Header><h6 className="mb-0">👤 Dados do Titular</h6></Card.Header>
                <Card.Body>
                  <Row>
                    <Col md={8}>
                      <Form.Group className="mb-3">
                        <Form.Label>Nome Completo do Titular *</Form.Label>
                        <Form.Control
                          type="text"
                          name="titular_nome"
                          value={contaFormData.titular_nome}
                          onChange={handleContaInputChange}
                          required
                          placeholder="Nome completo ou razão social"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>Tipo de Documento *</Form.Label>
                        <Form.Select
                          name="titular_tipo"
                          value={contaFormData.titular_tipo}
                          onChange={handleContaInputChange}
                          required
                        >
                          <option value="cpf">CPF (Pessoa Física)</option>
                          <option value="cnpj">CNPJ (Pessoa Jurídica)</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                  </Row>

                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>
                          {contaFormData.titular_tipo === 'cpf' ? 'CPF *' : 'CNPJ *'}
                        </Form.Label>
                        <Form.Control
                          type="text"
                          name="titular_documento"
                          value={contaFormData.titular_documento}
                          onChange={(e) => {
                            let value = e.target.value.replace(/\D/g, '')
                            
                            if (contaFormData.titular_tipo === 'cpf') {
                              value = value.slice(0, 11)
                              if (value.length > 3) value = value.slice(0, 3) + '.' + value.slice(3)
                              if (value.length > 7) value = value.slice(0, 7) + '.' + value.slice(7)
                              if (value.length > 11) value = value.slice(0, 11) + '-' + value.slice(11)
                            } else {
                              value = value.slice(0, 14)
                              if (value.length > 2) value = value.slice(0, 2) + '.' + value.slice(2)
                              if (value.length > 6) value = value.slice(0, 6) + '.' + value.slice(6)
                              if (value.length > 10) value = value.slice(0, 10) + '/' + value.slice(10)
                              if (value.length > 15) value = value.slice(0, 15) + '-' + value.slice(15)
                            }
                            
                            setContaFormData(prev => ({ ...prev, titular_documento: value }))
                          }}
                          required
                          placeholder={contaFormData.titular_tipo === 'cpf' ? '000.000.000-00' : '00.000.000/0001-00'}
                          maxLength={contaFormData.titular_tipo === 'cpf' ? 14 : 18}
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              {/* Configurações PIX */}
              <Card className="mb-4">
                <Card.Header><h6 className="mb-0">⚡ Configurações PIX (Opcional)</h6></Card.Header>
                <Card.Body>
                  <Row>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>Tipo da Chave PIX</Form.Label>
                        <Form.Select
                          name="tipo_chave_pix"
                          value={contaFormData.tipo_chave_pix}
                          onChange={handleContaInputChange}
                        >
                          <option value="cpf">CPF</option>
                          <option value="cnpj">CNPJ</option>
                          <option value="email">E-mail</option>
                          <option value="telefone">Telefone</option>
                          <option value="aleatoria">Chave Aleatória</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                    <Col md={5}>
                      <Form.Group className="mb-3">
                        <Form.Label>Chave PIX</Form.Label>
                        <Form.Control
                          type="text"
                          name="chave_pix"
                          value={contaFormData.chave_pix}
                          onChange={handleContaInputChange}
                          placeholder={
                            contaFormData.tipo_chave_pix === 'email' ? 'exemplo@email.com' :
                            contaFormData.tipo_chave_pix === 'telefone' ? '(11) 99999-9999' :
                            contaFormData.tipo_chave_pix === 'aleatoria' ? 'Chave aleatória do banco' :
                            contaFormData.tipo_chave_pix === 'cpf' ? '000.000.000-00' :
                            '00.000.000/0001-00'
                          }
                        />
                        <small className="text-muted">
                          Deixe em branco se não deseja configurar PIX agora
                        </small>
                      </Form.Group>
                    </Col>
                    <Col md={3}>
                      <Form.Group className="mb-3">
                        <Form.Label>Limite PIX Diário</Form.Label>
                        <Form.Control
                          type="number"
                          name="limite_pix_diario"
                          value={contaFormData.limite_pix_diario}
                          onChange={handleContaInputChange}
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                        />
                        <small className="text-muted">R$ (0 = sem limite)</small>
                      </Form.Group>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              {/* Métodos de Pagamento Aceitos */}
              <Card className="mb-4">
                <Card.Header><h6 className="mb-0">💳 Métodos de Pagamento Aceitos</h6></Card.Header>
                <Card.Body>
                  <Row>
                    <Col md={4}>
                      <Form.Check
                        type="checkbox"
                        name="aceita_boleto"
                        checked={contaFormData.aceita_boleto}
                        onChange={handleContaInputChange}
                        label="🧾 Boleto Bancário"
                        className="mb-2"
                      />
                    </Col>
                    <Col md={4}>
                      <Form.Check
                        type="checkbox"
                        name="aceita_pix"
                        checked={contaFormData.aceita_pix}
                        onChange={handleContaInputChange}
                        label="⚡ PIX"
                        className="mb-2"
                      />
                    </Col>
                    <Col md={4}>
                      <Form.Check
                        type="checkbox"
                        name="aceita_ted_doc"
                        checked={contaFormData.aceita_ted_doc}
                        onChange={handleContaInputChange}
                        label="🏦 TED/DOC"
                        className="mb-2"
                      />
                    </Col>
                  </Row>
                  <Alert variant="info" className="mt-3">
                    <small>
                      <strong>Dica:</strong> Marque os métodos de pagamento que esta conta aceita. 
                      Pelo menos um método deve estar selecionado.
                    </small>
                  </Alert>
                </Card.Body>
              </Card>

              {/* Observações */}
              <Card className="mb-4">
                <Card.Header><h6 className="mb-0">📝 Observações</h6></Card.Header>
                <Card.Body>
                  <Form.Group className="mb-3">
                    <Form.Label>Observações Adicionais</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      name="observacoes"
                      value={contaFormData.observacoes}
                      onChange={handleContaInputChange}
                      placeholder="Informações adicionais sobre esta conta bancária..."
                    />
                  </Form.Group>
                </Card.Body>
              </Card>
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => {
              setShowContaForm(false)
              resetContaForm()
            }}>
              Cancelar
            </Button>
            <Button 
              variant="primary" 
              type="submit"
              disabled={loadingConta}
              onClick={(e) => {
                e.preventDefault()
                handleSubmitConta(e)
              }}
            >
              {loadingConta ? 'Salvando...' : (editingConta ? '💾 Atualizar Conta' : '💾 Salvar Conta')}
            </Button>
          </Modal.Footer>
        </Modal>
      </Container>
    </>
  )
}