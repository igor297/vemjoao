'use client'

import { useState, useEffect } from 'react'
import { Container, Row, Col, Card, Button, Table, Modal, Form, Alert, Badge } from 'react-bootstrap'

interface Inquilino {
  _id: string
  id_morador: string
  nome: string
  cpf: string
  data_nasc: string
  celular1: string
  celular2?: string
  email: string
  data_inicio: string
  data_fim?: string
  ativo: boolean
  imobiliaria_nome?: string
}

interface Imobiliaria {
  _id: string
  nome: string
}

export default function MeuInquilinoPage() {
  const [inquilinos, setInquilinos] = useState<Inquilino[]>([])
  const [imobiliarias, setImobiliarias] = useState<Imobiliaria[]>([])
  const [showModal, setShowModal] = useState(false)
  const [showImobiliariaModal, setShowImobiliariaModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [userInfo, setUserInfo] = useState<any>(null)

  const [formData, setFormData] = useState({
    nome: '',
    cpf: '',
    data_nasc: '',
    celular1: '',
    celular2: '',
    email: '',
    senha: '',
    data_inicio: '',
    data_fim: '',
    imobiliaria_id: '',
    observacoes: ''
  })

  const [imobiliariaData, setImobiliariaData] = useState({
    nome: '',
    cnpj: '',
    email: '',
    telefone1: '',
    telefone2: '',
    endereco: {
      cep: '',
      estado: '',
      cidade: '',
      bairro: '',
      rua: '',
      numero: '',
      complemento: ''
    },
    responsavel_nome: '',
    responsavel_celular: '',
    responsavel_email: '',
    observacoes: ''
  })

  useEffect(() => {
    const userData = localStorage.getItem('userData')
    if (userData) {
      try {
        const user = JSON.parse(userData)
        setUserInfo(user)
        
        // Só proprietários podem acessar esta página
        if (user.tipo !== 'morador' || user.subtipo !== 'proprietario') {
          setError('Acesso negado. Apenas proprietários podem gerenciar inquilinos.')
          return
        }
        
        fetchInquilinos(user.id)
        fetchImobiliarias(user)
      } catch (error) {
        console.error('Error parsing user data:', error)
        setError('Erro ao carregar dados do usuário')
      }
    }
  }, [])

  const fetchInquilinos = async (proprietarioId: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/moradores/inquilino?proprietario_id=${proprietarioId}`)
      const data = await response.json()
      
      if (data.success) {
        setInquilinos(data.inquilinos)
      } else {
        setError(data.error)
      }
    } catch (error) {
      setError('Erro ao carregar inquilinos')
    } finally {
      setLoading(false)
    }
  }

  const fetchImobiliarias = async (user: any) => {
    try {
      const response = await fetch(`/api/imobiliarias?master_id=${user.master_id}&condominio_id=${user.condominio_id}`)
      const data = await response.json()
      
      if (data.success) {
        setImobiliarias(data.imobiliarias)
      }
    } catch (error) {
      console.error('Error fetching imobiliarias:', error)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    
    // Aplicar máscaras
    if (name === 'cpf') {
      let cpf = value.replace(/\D/g, '')
      if (cpf.length <= 11) {
        cpf = cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
        setFormData(prev => ({ ...prev, cpf }))
      }
      return
    }
    
    if (name === 'celular1' || name === 'celular2') {
      let phone = value.replace(/\D/g, '')
      if (phone.length <= 11) {
        if (phone.length === 11) {
          phone = phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
        } else if (phone.length === 10) {
          phone = phone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
        }
        setFormData(prev => ({ ...prev, [name]: phone }))
      }
      return
    }

    
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleImobiliariaInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    
    if (name.startsWith('endereco.')) {
      const field = name.replace('endereco.', '')
      setImobiliariaData(prev => ({
        ...prev,
        endereco: { ...prev.endereco, [field]: value }
      }))
      return
    }

    // Aplicar máscaras
    if (name === 'cnpj') {
      let cnpj = value.replace(/\D/g, '')
      if (cnpj.length <= 14) {
        cnpj = cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
        setImobiliariaData(prev => ({ ...prev, cnpj }))
      }
      return
    }
    
    if (name === 'telefone1' || name === 'telefone2' || name === 'responsavel_celular') {
      let phone = value.replace(/\D/g, '')
      if (phone.length <= 11) {
        if (phone.length === 11) {
          phone = phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
        } else if (phone.length === 10) {
          phone = phone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
        }
        setImobiliariaData(prev => ({ ...prev, [name]: phone }))
      }
      return
    }

    if (name === 'endereco.cep') {
      let cep = value.replace(/\D/g, '')
      if (cep.length <= 8) {
        cep = cep.replace(/(\d{5})(\d{3})/, '$1-$2')
        setImobiliariaData(prev => ({
          ...prev,
          endereco: { ...prev.endereco, cep }
        }))
      }
      return
    }
    
    setImobiliariaData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmitInquilino = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const payload = {
        ...formData,
        proprietario_id: userInfo.id
      }

      const response = await fetch('/api/moradores/inquilino', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(data.message || 'Inquilino cadastrado com sucesso!')
        setShowModal(false)
        resetForm()
        fetchInquilinos(userInfo.id)
      } else {
        setError(data.error)
      }
    } catch (error) {
      setError('Erro ao cadastrar inquilino')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitImobiliaria = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const payload = {
        ...imobiliariaData,
        condominio_id: userInfo.condominio_id,
        master_id: userInfo.master_id
      }

      const response = await fetch('/api/imobiliarias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (data.success) {
        setSuccess('Imobiliária cadastrada com sucesso!')
        setShowImobiliariaModal(false)
        resetImobiliariaForm()
        fetchImobiliarias(userInfo)
      } else {
        setError(data.error)
      }
    } catch (error) {
      setError('Erro ao cadastrar imobiliária')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      nome: '',
      cpf: '',
      data_nasc: '',
      celular1: '',
      celular2: '',
      email: '',
      senha: '',
      data_inicio: '',
      data_fim: '',
      imobiliaria_id: '',
      observacoes: ''
    })
  }

  const resetImobiliariaForm = () => {
    setImobiliariaData({
      nome: '',
      cnpj: '',
      email: '',
      telefone1: '',
      telefone2: '',
      endereco: {
        cep: '',
        estado: '',
        cidade: '',
        bairro: '',
        rua: '',
        numero: '',
        complemento: ''
      },
      responsavel_nome: '',
      responsavel_celular: '',
      responsavel_email: '',
      observacoes: ''
    })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR')
  }

  const getStatusBadge = (inquilino: Inquilino) => {
    if (!inquilino.ativo) {
      return <Badge bg="secondary">Inativo</Badge>
    }
    
    if (inquilino.data_fim) {
      const dataFim = new Date(inquilino.data_fim)
      const now = new Date()
      
      if (dataFim < now) {
        return <Badge bg="danger">Expirado</Badge>
      }
    }
    
    return <Badge bg="success">Ativo</Badge>
  }

  if (userInfo?.tipo !== 'morador' || userInfo?.subtipo !== 'proprietario') {
    return (
      <>
        <Container className="py-5">
          <Alert variant="danger">
            <Alert.Heading>Acesso Negado</Alert.Heading>
            <p>Apenas proprietários podem acessar esta página.</p>
          </Alert>
        </Container>
      </>
    )
  }

  return (
    <>
      <Container fluid className="py-4">
        <Row className="mb-4">
          <Col>
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <h2 className="mb-0">🏠 Meus Inquilinos</h2>
                <p className="text-muted mb-0">
                  Gerencie os inquilinos da sua unidade: {userInfo?.bloco ? `${userInfo.bloco} - ` : ''}{userInfo?.unidade}
                </p>
              </div>
              <div>
                <Button 
                  variant="outline-primary" 
                  onClick={() => setShowImobiliariaModal(true)}
                  disabled={loading}
                  className="me-2"
                >
                  + Imobiliária
                </Button>
                <Button 
                  variant="primary" 
                  onClick={() => setShowModal(true)}
                  disabled={loading}
                >
                  Novo Inquilino
                </Button>
              </div>
            </div>
          </Col>
        </Row>

        {error && (
          <Alert variant="danger" dismissible onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert variant="success" dismissible onClose={() => setSuccess('')}>
            {success}
          </Alert>
        )}

        <Card className="shadow">
          <Card.Header className="bg-info text-white">
            <h5 className="mb-0">
              👥 Inquilinos da Unidade ({inquilinos.length})
            </h5>
          </Card.Header>
          <Card.Body className="p-0">
            {loading ? (
              <div className="text-center p-4">
                <div className="spinner-border" role="status">
                  <span className="visually-hidden">Carregando...</span>
                </div>
              </div>
            ) : inquilinos.length === 0 ? (
              <div className="text-center p-4">
                <i className="bi bi-house text-muted" style={{ fontSize: '3rem' }}></i>
                <p className="text-muted mt-2">Nenhum inquilino cadastrado</p>
                <p className="text-muted">Clique em "Novo Inquilino" para adicionar.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <Table hover className="mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Nome</th>
                      <th>Email</th>
                      <th>Celular</th>
                      <th>Data Início</th>
                      <th>Imobiliária</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inquilinos.map((inquilino) => (
                      <tr key={inquilino._id}>
                        <td className="fw-semibold">{inquilino.nome}</td>
                        <td>{inquilino.email}</td>
                        <td>{inquilino.celular1}</td>
                        <td>{formatDate(inquilino.data_inicio)}</td>
                        <td>
                          {inquilino.imobiliaria_nome ? (
                            <Badge bg="warning">
                              {inquilino.imobiliaria_nome}
                            </Badge>
                          ) : (
                            <Badge bg="secondary">Sem imobiliária</Badge>
                          )}
                        </td>
                        <td>{getStatusBadge(inquilino)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Card.Body>
        </Card>

        {/* Modal para cadastro de inquilino */}
        <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
          <Modal.Header closeButton>
            <Modal.Title>Cadastrar Inquilino</Modal.Title>
          </Modal.Header>
          <Form onSubmit={handleSubmitInquilino}>
            <Modal.Body>
              <Alert variant="info">
                <strong>ℹ️ Herança Automática:</strong> O inquilino herdará automaticamente o condomínio, bloco e unidade da sua propriedade.
              </Alert>
              
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Nome Completo *</Form.Label>
                    <Form.Control
                      type="text"
                      name="nome"
                      value={formData.nome}
                      onChange={handleInputChange}
                      required
                      placeholder="Digite o nome completo"
                    />
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
                      required
                      placeholder="000.000.000-00"
                      maxLength={14}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Data de Nascimento *</Form.Label>
                    <Form.Control
                      type="date"
                      name="data_nasc"
                      value={formData.data_nasc}
                      onChange={handleInputChange}
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Imobiliária</Form.Label>
                    <Form.Select
                      name="imobiliaria_id"
                      value={formData.imobiliaria_id}
                      onChange={handleInputChange}
                    >
                      <option value="">Sem imobiliária</option>
                      {imobiliarias.map((imob) => (
                        <option key={imob._id} value={imob._id}>
                          {imob.nome}
                        </option>
                      ))}
                    </Form.Select>
                    <Form.Text className="text-muted">
                      Opcional. Se não houver a imobiliária desejada, cadastre uma nova.
                    </Form.Text>
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Celular Principal *</Form.Label>
                    <Form.Control
                      type="text"
                      name="celular1"
                      value={formData.celular1}
                      onChange={handleInputChange}
                      required
                      placeholder="(85) 99999-9999"
                      maxLength={15}
                    />
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
                      maxLength={15}
                    />
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
                      placeholder="inquilino@exemplo.com"
                    />
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
                      required
                      placeholder="Mínimo 6 caracteres"
                      minLength={6}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Data de Início *</Form.Label>
                    <Form.Control
                      type="date"
                      name="data_inicio"
                      value={formData.data_inicio}
                      onChange={handleInputChange}
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Data de Término</Form.Label>
                    <Form.Control
                      type="date"
                      name="data_fim"
                      value={formData.data_fim}
                      onChange={handleInputChange}
                    />
                    <Form.Text className="text-muted">
                      Deixe vazio para contrato por tempo indeterminado
                    </Form.Text>
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
                      placeholder="Informações adicionais sobre o inquilino..."
                      maxLength={500}
                    />
                  </Form.Group>
                </Col>
              </Row>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? 'Cadastrando...' : 'Cadastrar Inquilino'}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>

        {/* Modal para cadastro de imobiliária */}
        <Modal show={showImobiliariaModal} onHide={() => setShowImobiliariaModal(false)} size="xl">
          <Modal.Header closeButton>
            <Modal.Title>Cadastrar Imobiliária</Modal.Title>
          </Modal.Header>
          <Form onSubmit={handleSubmitImobiliaria}>
            <Modal.Body>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Nome da Imobiliária *</Form.Label>
                    <Form.Control
                      type="text"
                      name="nome"
                      value={imobiliariaData.nome}
                      onChange={handleImobiliariaInputChange}
                      required
                      placeholder="Nome da empresa"
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>CNPJ *</Form.Label>
                    <Form.Control
                      type="text"
                      name="cnpj"
                      value={imobiliariaData.cnpj}
                      onChange={handleImobiliariaInputChange}
                      required
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Email *</Form.Label>
                    <Form.Control
                      type="email"
                      name="email"
                      value={imobiliariaData.email}
                      onChange={handleImobiliariaInputChange}
                      required
                      placeholder="contato@imobiliaria.com"
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Telefone Principal *</Form.Label>
                    <Form.Control
                      type="text"
                      name="telefone1"
                      value={imobiliariaData.telefone1}
                      onChange={handleImobiliariaInputChange}
                      required
                      placeholder="(85) 99999-9999"
                      maxLength={15}
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Telefone Secundário</Form.Label>
                    <Form.Control
                      type="text"
                      name="telefone2"
                      value={imobiliariaData.telefone2}
                      onChange={handleImobiliariaInputChange}
                      placeholder="(85) 99999-9999"
                      maxLength={15}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <hr />
              <h6>Endereço da Imobiliária</h6>
              
              <Row>
                <Col md={3}>
                  <Form.Group className="mb-3">
                    <Form.Label>CEP *</Form.Label>
                    <Form.Control
                      type="text"
                      name="endereco.cep"
                      value={imobiliariaData.endereco.cep}
                      onChange={handleImobiliariaInputChange}
                      required
                      placeholder="00000-000"
                      maxLength={9}
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group className="mb-3">
                    <Form.Label>Estado *</Form.Label>
                    <Form.Control
                      type="text"
                      name="endereco.estado"
                      value={imobiliariaData.endereco.estado}
                      onChange={handleImobiliariaInputChange}
                      required
                      placeholder="CE"
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group className="mb-3">
                    <Form.Label>Cidade *</Form.Label>
                    <Form.Control
                      type="text"
                      name="endereco.cidade"
                      value={imobiliariaData.endereco.cidade}
                      onChange={handleImobiliariaInputChange}
                      required
                      placeholder="Fortaleza"
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group className="mb-3">
                    <Form.Label>Bairro *</Form.Label>
                    <Form.Control
                      type="text"
                      name="endereco.bairro"
                      value={imobiliariaData.endereco.bairro}
                      onChange={handleImobiliariaInputChange}
                      required
                      placeholder="Meireles"
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Rua *</Form.Label>
                    <Form.Control
                      type="text"
                      name="endereco.rua"
                      value={imobiliariaData.endereco.rua}
                      onChange={handleImobiliariaInputChange}
                      required
                      placeholder="Rua das Imobiliárias"
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group className="mb-3">
                    <Form.Label>Número *</Form.Label>
                    <Form.Control
                      type="text"
                      name="endereco.numero"
                      value={imobiliariaData.endereco.numero}
                      onChange={handleImobiliariaInputChange}
                      required
                      placeholder="123"
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group className="mb-3">
                    <Form.Label>Complemento</Form.Label>
                    <Form.Control
                      type="text"
                      name="endereco.complemento"
                      value={imobiliariaData.endereco.complemento}
                      onChange={handleImobiliariaInputChange}
                      placeholder="Sala 45"
                    />
                  </Form.Group>
                </Col>
              </Row>

              <hr />
              <h6>Responsável</h6>
              
              <Row>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Nome do Responsável *</Form.Label>
                    <Form.Control
                      type="text"
                      name="responsavel_nome"
                      value={imobiliariaData.responsavel_nome}
                      onChange={handleImobiliariaInputChange}
                      required
                      placeholder="João Silva"
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Celular do Responsável *</Form.Label>
                    <Form.Control
                      type="text"
                      name="responsavel_celular"
                      value={imobiliariaData.responsavel_celular}
                      onChange={handleImobiliariaInputChange}
                      required
                      placeholder="(85) 99999-9999"
                      maxLength={15}
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Email do Responsável *</Form.Label>
                    <Form.Control
                      type="email"
                      name="responsavel_email"
                      value={imobiliariaData.responsavel_email}
                      onChange={handleImobiliariaInputChange}
                      required
                      placeholder="joao@imobiliaria.com"
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
                      value={imobiliariaData.observacoes}
                      onChange={handleImobiliariaInputChange}
                      placeholder="Informações adicionais sobre a imobiliária..."
                      maxLength={500}
                    />
                  </Form.Group>
                </Col>
              </Row>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowImobiliariaModal(false)}>
                Cancelar
              </Button>
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? 'Cadastrando...' : 'Cadastrar Imobiliária'}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>
      </Container>
    </>
  )
}