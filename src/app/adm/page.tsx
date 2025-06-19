'use client'

import { useState, useEffect } from 'react'
import { Container, Row, Col, Card, Button, Form, Modal, Table, Alert, Badge } from 'react-bootstrap'
import Header from '@/components/Header'
import MoradorSelector from '@/components/MoradorSelector'
import DateInput from '@/components/DateInput'
import { formatDateISO } from '@/utils/dateUtils'

interface Adm {
  _id?: string
  nome: string
  cpf: string
  data_nasc: string
  tipo: 'sindico' | 'subsindico' | 'conselheiro'
  email: string
  senha: string
  data_inicio: string
  data_fim?: string
  condominio_id: string
  bloco?: string
  unidade?: string
  celular1?: string
  celular2?: string
  // Campos de endereço para ADM não-interno
  cep?: string
  logradouro?: string
  estado?: string
  cidade?: string
  numero?: string
  complemento?: string
  observacoes?: string
  adm_interno: boolean
  morador_origem_id?: string
}

interface Condominium {
  _id: string
  nome: string
}

export default function AdmPage() {
  const [adms, setAdms] = useState<Adm[]>([])
  const [condominiums, setCondominiums] = useState<Condominium[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [alert, setAlert] = useState<{type: string, message: string} | null>(null)
  const [currentUser, setCurrentUser] = useState<{id: string, tipo: string, email: string} | null>(null)
  const [selectedCondominiumId, setSelectedCondominiumId] = useState<string>('')
  const [showMoradorSelector, setShowMoradorSelector] = useState(false)
  const [isAdmInterno, setIsAdmInterno] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const [calculatedAge, setCalculatedAge] = useState<number | null>(null)

  // Função auxiliar para acessar localStorage com segurança
  const getLocalStorage = (key: string) => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(key)
    }
    return null
  }

  // Função para buscar endereço via CEP
  const buscarCep = async (cep: string) => {
    try {
      const cepLimpo = cep.replace(/\D/g, '')
      if (cepLimpo.length !== 8) return
      
      setLoading(true)
      const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`)
      const data = await response.json()
      
      if (data.erro) {
        showAlert('warning', 'CEP não encontrado')
        return
      }
      
      setFormData(prev => ({
        ...prev,
        logradouro: data.logradouro || '',
        estado: data.uf || '',
        cidade: data.localidade || ''
      }))
      
      showAlert('success', 'Endereço preenchido automaticamente!')
      
    } catch (error) {
      console.error('Erro ao buscar CEP:', error)
      showAlert('warning', 'Erro ao consultar CEP. Preencha manualmente.')
    } finally {
      setLoading(false)
    }
  }
  
  const [formData, setFormData] = useState<Adm>({
    nome: '',
    cpf: '',
    data_nasc: '',
    tipo: 'sindico',
    email: '',
    senha: '',
    data_inicio: '',
    data_fim: '',
    condominio_id: '',
    bloco: '',
    unidade: '',
    celular1: '',
    celular2: '',
    // Campos de endereço
    cep: '',
    logradouro: '',
    estado: '',
    cidade: '',
    numero: '',
    complemento: '',
    observacoes: '',
    adm_interno: false,
    morador_origem_id: ''
  })

  useEffect(() => {
    setIsClient(true)
    
    const userData = getLocalStorage('userData')
    if (userData) {
      const user = JSON.parse(userData)
      setCurrentUser(user)
      loadCondominiums(user.id)
      
      // Se for master, verificar condomínio ativo
      if (user.tipo === 'master') {
        const activeCondominiumId = getLocalStorage('activeCondominio')
        if (activeCondominiumId) {
          setSelectedCondominiumId(activeCondominiumId)
          loadAdms(user.id, activeCondominiumId)
        } else {
          loadAdms(user.id)
        }
      } else {
        loadAdms(user.id)
      }
    }

    // Listener para mudanças no condomínio ativo
    const handleStorageChange = () => {
      const userData = getLocalStorage('userData')
      if (userData) {
        const user = JSON.parse(userData)
        if (user.tipo === 'master') {
          const activeCondominiumId = getLocalStorage('activeCondominio')
          if (activeCondominiumId && activeCondominiumId !== selectedCondominiumId) {
            setSelectedCondominiumId(activeCondominiumId)
            loadAdms(user.id, activeCondominiumId)
          }
        }
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange)
      window.addEventListener('condominioChanged', handleStorageChange)

      return () => {
        window.removeEventListener('storage', handleStorageChange)
        window.removeEventListener('condominioChanged', handleStorageChange)
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

  const loadAdms = async (masterId: string, condominioId?: string) => {
    try {
      let url = `/api/adms?master_id=${encodeURIComponent(masterId)}`
      if (condominioId) {
        url += `&condominio_id=${encodeURIComponent(condominioId)}`
      }
      
      const response = await fetch(url)
      const data = await response.json()
      if (data.success) {
        setAdms(data.adms)
      } else {
        showAlert('danger', data.error || 'Erro ao carregar administradores')
      }
    } catch (err) {
      console.error('Erro ao carregar administradores:', err)
      showAlert('danger', 'Erro ao carregar administradores')
    }
  }

  const showAlert = (type: string, message: string) => {
    setAlert({ type, message })
    setTimeout(() => setAlert(null), 5000)
  }


  const handleCondominiumChange = (condominioId: string) => {
    setSelectedCondominiumId(condominioId)
    if (condominioId && currentUser) {
      loadAdms(currentUser.id, condominioId)
    } else if (currentUser) {
      loadAdms(currentUser.id)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    
    if (name === 'cpf') {
      // Máscara CPF
      let cpf = value.replace(/\D/g, '')
      if (cpf.length <= 11) {
        cpf = cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
        setFormData(prev => ({ ...prev, cpf }))
      }
      return
    }
    
    if (name === 'cep') {
      // Máscara CEP
      let cep = value.replace(/\D/g, '')
      if (cep.length <= 8) {
        cep = cep.replace(/(\d{5})(\d{3})/, '$1-$2')
        setFormData(prev => ({ ...prev, cep }))
        
        // Buscar endereço automaticamente quando CEP tiver 8 dígitos
        if (cep.replace(/\D/g, '').length === 8) {
          buscarCep(cep)
        }
      }
      return
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const url = editingId ? `/api/adms/${editingId}` : '/api/adms'
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
        showAlert('success', editingId ? 'Administrador atualizado!' : 'Administrador criado!')
        handleCloseModal()
        loadAdms(currentUser?.id)
      } else {
        showAlert('danger', data.error || 'Erro ao salvar administrador')
      }
    } catch (err) {
      console.error('Erro ao salvar administrador:', err)
      showAlert('danger', 'Erro ao salvar administrador')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (adm: Adm) => {
    setFormData({
      nome: adm.nome,
      cpf: adm.cpf,
      data_nasc: formatDateISO(adm.data_nasc) || '',
      tipo: adm.tipo,
      email: adm.email,
      senha: '',
      data_inicio: formatDateISO(adm.data_inicio) || '',
      data_fim: formatDateISO(adm.data_fim) || '',
      condominio_id: adm.condominio_id,
      bloco: adm.bloco || '',
      unidade: adm.unidade || '',
      celular1: adm.celular1 || '',
      celular2: adm.celular2 || '',
      // Campos de endereço
      cep: adm.cep || '',
      logradouro: adm.logradouro || '',
      estado: adm.estado || '',
      cidade: adm.cidade || '',
      numero: adm.numero || '',
      complemento: adm.complemento || '',
      observacoes: adm.observacoes || '',
      adm_interno: adm.adm_interno || false,
      morador_origem_id: adm.morador_origem_id || ''
    })
    setIsAdmInterno(adm.adm_interno || false)
    setEditingId(adm._id || null)
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este administrador?')) return

    try {
      const response = await fetch(`/api/adms/${id}?master_id=${encodeURIComponent(currentUser?.email)}`, {
        method: 'DELETE'
      })

      const data = await response.json()
      
      if (data.success) {
        showAlert('success', 'Administrador excluído!')
        loadAdms(currentUser?.id)
      } else {
        showAlert('danger', data.error || 'Erro ao excluir administrador')
      }
    } catch (error) {
      showAlert('danger', 'Erro ao excluir administrador')
    }
  }

  const handleNewAdm = () => {
    // Usar condomínio ativo se disponível, senão usar o selecionado
    const activeCondominiumId = getLocalStorage('activeCondominium') || selectedCondominiumId
    
    setFormData({
      nome: '',
      cpf: '',
      data_nasc: '',
      tipo: 'sindico',
      email: '',
      senha: '',
      data_inicio: '',
      data_fim: '',
      condominio_id: activeCondominiumId,
      bloco: '',
      unidade: '',
      celular1: '',
      celular2: '',
      // Campos de endereço
      cep: '',
      logradouro: '',
      estado: '',
      cidade: '',
      numero: '',
      complemento: '',
      observacoes: '',
      adm_interno: false,
      morador_origem_id: ''
    })
    setIsAdmInterno(false)
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingId(null)
    setIsAdmInterno(false)
    setFormData({
      nome: '',
      cpf: '',
      data_nasc: '',
      tipo: 'sindico',
      email: '',
      senha: '',
      data_inicio: '',
      data_fim: '',
      condominio_id: '',
      bloco: '',
      unidade: '',
      celular1: '',
      celular2: '',
      // Campos de endereço
      cep: '',
      logradouro: '',
      estado: '',
      cidade: '',
      numero: '',
      complemento: '',
      observacoes: '',
      adm_interno: false,
      morador_origem_id: ''
    })
  }

  const getCondominiumName = (condominioId: string) => {
    const cond = condominiums.find(c => c._id === condominioId)
    return cond?.nome || 'N/A'
  }

  const getTipoBadge = (tipo: string) => {
    const colors = {
      sindico: 'primary',
      subsindico: 'secondary', 
      conselheiro: 'info'
    }
    return <Badge bg={colors[tipo as keyof typeof colors]}>{tipo.charAt(0).toUpperCase() + tipo.slice(1)}</Badge>
  }

  const handleMoradorSelect = (morador: any) => {
    setFormData(prev => ({
      ...prev,
      nome: morador.nome,
      cpf: morador.cpf,
      data_nasc: new Date(morador.data_nasc).toISOString().split('T')[0],
      email: morador.email,
      bloco: morador.bloco || '',
      unidade: morador.unidade,
      celular1: morador.celular1,
      celular2: morador.celular2 || '',
      adm_interno: true,
      morador_origem_id: morador._id
    }))
    setIsAdmInterno(true)
  }

  const handleAdmInternoChange = (checked: boolean) => {
    setIsAdmInterno(checked)
    if (checked) {
      setShowMoradorSelector(true)
    } else {
      // Limpar campos quando desmarcar
      setFormData(prev => ({
        ...prev,
        nome: '',
        cpf: '',
        data_nasc: '',
        email: '',
        bloco: '',
        unidade: '',
        celular1: '',
        celular2: '',
        // Manter campos de endereço se já preenchidos
        adm_interno: false,
        morador_origem_id: ''
      }))
    }
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
                <h4 className="mb-0">Gerenciar Administradores</h4>
                <Button variant="primary" onClick={handleNewAdm} disabled={!selectedCondominiumId}>
                  <i className="bi bi-plus-circle me-2"></i>
                  Novo Administrador
                </Button>
              </Card.Header>
              <Card.Body>
                {/* Filtro por condomínio */}
                <Row className="mb-3">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Selecione o Condomínio *</Form.Label>
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
                      <Form.Text className="text-muted">
                        {isClient && getLocalStorage('activeCondominium') && getLocalStorage('activeCondominium') === selectedCondominiumId ? (
                          <span className="text-success">
                            ✅ Condomínio ativo selecionado automaticamente
                          </span>
                        ) : (
                          "Selecione o condomínio para visualizar e gerenciar seus administradores"
                        )}
                      </Form.Text>
                    </Form.Group>
                  </Col>
                  <Col md={6} className="d-flex align-items-end">
                    <div className="w-100">
                      <small className="text-muted">
                        <strong>Total de administradores:</strong> {adms.length}
                      </small>
                      {isClient && getLocalStorage('activeCondominium') && (
                        <div className="mt-1">
                          <small className="text-success">
                            🏢 <strong>Condomínio Ativo:</strong> {getLocalStorage('activeCondominiumName') || 'Carregando...'}
                          </small>
                        </div>
                      )}
                    </div>
                  </Col>
                </Row>
                {!selectedCondominiumId ? (
                  <Alert variant="info" className="text-center">
                    <h5>👆 Selecione um condomínio acima</h5>
                    <p className="mb-0">Escolha o condomínio para visualizar e gerenciar seus administradores</p>
                  </Alert>
                ) : (
                  <Table responsive striped hover>
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>CPF</th>
                        <th>Tipo</th>
                        <th>Email</th>
                        <th>Condomínio</th>
                        <th>Data Início</th>
                        <th>Data Fim</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adms.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center text-muted">
                            Nenhum administrador encontrado para este condomínio
                          </td>
                        </tr>
                    ) : (
                      adms.map((adm) => (
                        <tr key={adm._id}>
                          <td>{adm.nome}</td>
                          <td>{adm.cpf}</td>
                          <td>{getTipoBadge(adm.tipo)}</td>
                          <td>{adm.email}</td>
                          <td>{getCondominiumName(adm.condominio_id)}</td>
                          <td>{new Date(adm.data_inicio).toLocaleDateString('pt-BR')}</td>
                          <td>{adm.data_fim ? new Date(adm.data_fim).toLocaleDateString('pt-BR') : 'Ativo'}</td>
                          <td>
                            <Button 
                              variant="outline-primary" 
                              size="sm" 
                              className="me-2"
                              onClick={() => handleEdit(adm)}
                            >
                              Editar
                            </Button>
                            <Button 
                              variant="outline-danger" 
                              size="sm"
                              onClick={() => handleDelete(adm._id!)}
                            >
                              Excluir
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                    </tbody>
                  </Table>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <Modal show={showModal} onHide={handleCloseModal} size="lg">
          <Modal.Header closeButton>
            <Modal.Title>
              {editingId ? 'Editar Administrador' : 'Novo Administrador'}
            </Modal.Title>
          </Modal.Header>
          <Form onSubmit={handleSubmit}>
            <Modal.Body>
              {!editingId && (
                <Alert variant="info" className="mb-3">
                  <Form.Check
                    type="checkbox"
                    id="adm-interno-check"
                    label="🏠 Administrador Interno (selecionar de morador existente)"
                    checked={isAdmInterno}
                    onChange={(e) => handleAdmInternoChange(e.target.checked)}
                    className="fw-semibold"
                  />
                  <Form.Text className="text-muted d-block mt-1">
                    Marque esta opção para selecionar um morador/inquilino existente como administrador.
                    Os dados serão preenchidos automaticamente.
                  </Form.Text>
                </Alert>
              )}

              {isAdmInterno && formData.nome && (
                <Alert variant="success" className="mb-3">
                  <strong>✅ Morador Selecionado:</strong><br/>
                  <strong>👤 Nome:</strong> {formData.nome}<br/>
                  <strong>🏠 Unidade:</strong> {formData.bloco ? `${formData.bloco} - ` : ''}{formData.unidade}<br/>
                  <strong>📧 Email:</strong> {formData.email}<br/>
                  <small className="text-muted">Apenas o tipo de administrador pode ser alterado</small>
                </Alert>
              )}

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Nome *</Form.Label>
                    <Form.Control
                      type="text"
                      name="nome"
                      value={formData.nome}
                      onChange={handleInputChange}
                      required
                      disabled={isAdmInterno}
                      className={isAdmInterno ? 'bg-light' : ''}
                    />
                    {isAdmInterno && (
                      <Form.Text className="text-success">
                        🔒 Preenchido automaticamente do morador selecionado
                      </Form.Text>
                    )}
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>CPF *</Form.Label>
                    <Form.Control
                      type="text"
                      name="cpf"
                      value={formData.cpf}
                      onChange={handleInputChange}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      required
                      disabled={isAdmInterno}
                      className={isAdmInterno ? 'bg-light' : ''}
                    />
                    {isAdmInterno && (
                      <Form.Text className="text-success">
                        🔒 Preenchido automaticamente do morador selecionado
                      </Form.Text>
                    )}
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <DateInput
                    name="data_nasc"
                    value={formData.data_nasc}
                    onChange={(name, value) => setFormData(prev => ({ ...prev, [name]: value }))}
                    label="Data de Nascimento"
                    required
                    disabled={isAdmInterno}
                    className={isAdmInterno ? 'bg-light' : ''}
                    showAge={true}
                    onAgeCalculated={setCalculatedAge}
                  />
                  {isAdmInterno && (
                    <Form.Text className="text-success">
                      🔒 Preenchido automaticamente do morador selecionado
                    </Form.Text>
                  )}
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Tipo *</Form.Label>
                    <Form.Select
                      name="tipo"
                      value={formData.tipo}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="sindico">Síndico</option>
                      <option value="subsindico">Subsíndico</option>
                      <option value="conselheiro">Conselheiro</option>
                    </Form.Select>
                    {isAdmInterno && (
                      <Form.Text className="text-info">
                        ✏️ Este campo pode ser alterado
                      </Form.Text>
                    )}
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Email *</Form.Label>
                    <Form.Control
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      disabled={isAdmInterno}
                      className={isAdmInterno ? 'bg-light' : ''}
                    />
                    {isAdmInterno && (
                      <Form.Text className="text-success">
                        🔒 Preenchido automaticamente do morador selecionado
                      </Form.Text>
                    )}
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Senha *</Form.Label>
                    <Form.Control
                      type="password"
                      name="senha"
                      value={formData.senha}
                      onChange={handleInputChange}
                      required={!editingId}
                      placeholder={editingId ? "Deixe em branco para manter" : ""}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Condomínio *</Form.Label>
                    <Form.Select
                      name="condominio_id"
                      value={formData.condominio_id}
                      onChange={handleInputChange}
                      required
                      disabled={!!formData.condominio_id && (getLocalStorage('activeCondominium') || selectedCondominiumId)}
                    >
                      <option value="">Selecione...</option>
                      {condominiums.map(cond => (
                        <option key={cond._id} value={cond._id}>
                          {cond.nome}
                        </option>
                      ))}
                    </Form.Select>
                    {isClient && formData.condominio_id && (getLocalStorage('activeCondominium') || selectedCondominiumId) && (
                      <Form.Text className="text-success">
                        {getLocalStorage('activeCondominium') === formData.condominio_id ? (
                          <span>✅ Condomínio ativo preenchido automaticamente</span>
                        ) : (
                          <span>🔒 Condomínio selecionado automaticamente</span>
                        )}
                      </Form.Text>
                    )}
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Bloco</Form.Label>
                    <Form.Control
                      type="text"
                      name="bloco"
                      value={formData.bloco}
                      onChange={handleInputChange}
                      placeholder="Ex: A, Torre 1"
                      disabled={isAdmInterno}
                      className={isAdmInterno ? 'bg-light' : ''}
                    />
                    {isAdmInterno && (
                      <Form.Text className="text-success">
                        🔒 Preenchido automaticamente do morador selecionado
                      </Form.Text>
                    )}
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Unidade</Form.Label>
                    <Form.Control
                      type="text"
                      name="unidade"
                      value={formData.unidade}
                      onChange={handleInputChange}
                      placeholder="Ex: 101, Casa 15"
                      disabled={isAdmInterno}
                      className={isAdmInterno ? 'bg-light' : ''}
                    />
                    {isAdmInterno && (
                      <Form.Text className="text-success">
                        🔒 Preenchido automaticamente do morador selecionado
                      </Form.Text>
                    )}
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Celular Principal</Form.Label>
                    <Form.Control
                      type="text"
                      name="celular1"
                      value={formData.celular1}
                      onChange={handleInputChange}
                      placeholder="(85) 99999-9999"
                      disabled={isAdmInterno}
                      className={isAdmInterno ? 'bg-light' : ''}
                    />
                    {isAdmInterno && (
                      <Form.Text className="text-success">
                        🔒 Preenchido automaticamente do morador selecionado
                      </Form.Text>
                    )}
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Celular Secundário</Form.Label>
                    <Form.Control
                      type="text"
                      name="celular2"
                      value={formData.celular2}
                      onChange={handleInputChange}
                      placeholder="(85) 99999-9999"
                      disabled={isAdmInterno}
                      className={isAdmInterno ? 'bg-light' : ''}
                    />
                    {isAdmInterno && (
                      <Form.Text className="text-success">
                        🔒 Preenchido automaticamente do morador selecionado
                      </Form.Text>
                    )}
                  </Form.Group>
                </Col>
              </Row>

              {/* Campos de endereço - apenas para ADM não-interno */}
              {!isAdmInterno && (
                <>
                  <Alert variant="info" className="mb-3">
                    <h6 className="mb-2">📍 Endereço Residencial</h6>
                    <small>Preencha o CEP para preenchimento automático ou insira os dados manualmente</small>
                  </Alert>

                  <Row>
                    <Col md={3}>
                      <Form.Group className="mb-3">
                        <Form.Label>CEP</Form.Label>
                        <Form.Control
                          type="text"
                          name="cep"
                          value={formData.cep}
                          onChange={handleInputChange}
                          placeholder="12345-678"
                          maxLength={9}
                        />
                        <Form.Text className="text-muted">
                          Digite o CEP para preenchimento automático
                        </Form.Text>
                      </Form.Group>
                    </Col>
                    <Col md={5}>
                      <Form.Group className="mb-3">
                        <Form.Label>Logradouro (Av/Rua)</Form.Label>
                        <Form.Control
                          type="text"
                          name="logradouro"
                          value={formData.logradouro}
                          onChange={handleInputChange}
                          placeholder="Avenida Paulista, Rua das Flores..."
                        />
                      </Form.Group>
                    </Col>
                    <Col md={2}>
                      <Form.Group className="mb-3">
                        <Form.Label>Estado (UF)</Form.Label>
                        <Form.Control
                          type="text"
                          name="estado"
                          value={formData.estado}
                          onChange={handleInputChange}
                          placeholder="CE"
                          maxLength={2}
                          style={{textTransform: 'uppercase'}}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={2}>
                      <Form.Group className="mb-3">
                        <Form.Label>Cidade</Form.Label>
                        <Form.Control
                          type="text"
                          name="cidade"
                          value={formData.cidade}
                          onChange={handleInputChange}
                          placeholder="Fortaleza"
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Número</Form.Label>
                        <Form.Control
                          type="text"
                          name="numero"
                          value={formData.numero}
                          onChange={handleInputChange}
                          placeholder="123"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Complemento</Form.Label>
                        <Form.Control
                          type="text"
                          name="complemento"
                          value={formData.complemento}
                          onChange={handleInputChange}
                          placeholder="Apto 45, Bloco B, etc."
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  <Row>
                    <Col>
                      <Form.Group className="mb-3">
                        <Form.Label>Observações</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={3}
                          name="observacoes"
                          value={formData.observacoes}
                          onChange={handleInputChange}
                          placeholder="Informações adicionais sobre o endereço ou outras observações..."
                          maxLength={500}
                        />
                        <Form.Text className="text-muted">
                          Máximo 500 caracteres
                        </Form.Text>
                      </Form.Group>
                    </Col>
                  </Row>
                </>
              )}

              <Row>
                <Col md={6}>
                  <DateInput
                    name="data_inicio"
                    value={formData.data_inicio}
                    onChange={(name, value) => setFormData(prev => ({ ...prev, [name]: value }))}
                    label="Data Início"
                    required
                  />
                </Col>
                <Col md={6}>
                  <DateInput
                    name="data_fim"
                    value={formData.data_fim}
                    onChange={(name, value) => setFormData(prev => ({ ...prev, [name]: value }))}
                    label="Data Fim"
                  />
                </Col>
              </Row>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={handleCloseModal}>
                Cancelar
              </Button>
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? 'Salvando...' : (editingId ? 'Atualizar' : 'Salvar')}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>

        {/* Modal para seleção de morador */}
        <MoradorSelector
          show={showMoradorSelector}
          onHide={() => setShowMoradorSelector(false)}
          onSelect={handleMoradorSelect}
          condominioId={formData.condominio_id}
          masterId={currentUser?.id || ''}
        />
      </Container>
    </>
  )
}