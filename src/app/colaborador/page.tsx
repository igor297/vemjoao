'use client'

import { useState, useEffect } from 'react'
import { Container, Row, Col, Card, Button, Table, Modal, Form, Alert, Badge, Tabs, Tab, Image, Spinner } from 'react-bootstrap'
import DateInput from '@/components/DateInput'
import { formatDateISO } from '@/utils/dateUtils'

interface Colaborador {
  _id: string
  nome: string
  cpf: string
  data_nasc: string
  celular1: string
  celular2?: string
  email: string
  senha: string
  data_inicio: string
  data_fim?: string
  condominio_id: string
  condominio_nome: string
  // Campos de endereço
  cep?: string
  logradouro?: string
  estado?: string
  cidade?: string
  numero?: string
  complemento?: string
  observacoes?: string
  // Campos profissionais
  cargo?: string
  salario?: number
  tipo_contrato?: string
  jornada_trabalho?: string
  departamento?: string
  supervisor?: string
  // Dependentes
  dependentes?: string
  // Contato de emergência
  contato_emergencia_nome?: string
  contato_emergencia_telefone?: string
  contato_emergencia_parentesco?: string
  // Documentos e informações
  rg?: string
  pis?: string
  ctps?: string
  escolaridade?: string
  estado_civil?: string
  observacoes_profissionais?: string
  // Documentos digitalizados
  foto_perfil?: string
  foto_rg_frente?: string
  foto_rg_verso?: string
  foto_cpf?: string
  foto_ctps?: string
  foto_comprovante_residencia?: string
  outros_documentos?: string[]
  master_id: string
  ativo: boolean
}

interface Condominium {
  _id: string
  nome: string
}

export default function ColaboradorPage() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [condominiums, setCondominiums] = useState<Condominium[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingColaborador, setEditingColaborador] = useState<Colaborador | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState<{[key: string]: boolean}>({})
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [userInfo, setUserInfo] = useState<any>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [selectedCondominiumId, setSelectedCondominiumId] = useState<string>('')
  const [calculatedAge, setCalculatedAge] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState('personal')

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
    condominio_id: '',
    // Campos de endereço
    cep: '',
    logradouro: '',
    estado: '',
    cidade: '',
    numero: '',
    complemento: '',
    observacoes: '',
    // Campos profissionais
    cargo: '',
    salario: '',
    tipo_contrato: '',
    jornada_trabalho: '',
    departamento: '',
    supervisor: '',
    // Dependentes
    dependentes: '',
    // Contato de emergência
    contato_emergencia_nome: '',
    contato_emergencia_telefone: '',
    contato_emergencia_parentesco: '',
    // Documentos e informações
    rg: '',
    pis: '',
    ctps: '',
    escolaridade: '',
    estado_civil: '',
    observacoes_profissionais: '',
    // Documentos digitalizados
    foto_perfil: '',
    foto_rg_frente: '',
    foto_rg_verso: '',
    foto_cpf: '',
    foto_ctps: '',
    foto_comprovante_residencia: '',
    outros_documentos: [] as string[]
  })

  useEffect(() => {
    const userData = localStorage.getItem('userData')
    if (userData) {
      try {
        const user = JSON.parse(userData)
        setUserInfo(user)
        
        // Determinar permissões baseadas no tipo de usuário
        if (user.tipo === 'master') {
          setCanEdit(true)
        } else if (user.tipo === 'adm') {
          // Síndico e subsíndico podem tudo, conselheiro só pode ver
          setCanEdit(user.subtipo === 'sindico' || user.subtipo === 'subsindico')
        } else {
          setCanEdit(false)
        }
        
        if (user.tipo === 'master') {
          fetchCondominiums(user.id)
          // Verificar condomínio ativo
          const activeCondominiumId = localStorage.getItem('activeCondominio')
          if (activeCondominiumId) {
            setSelectedCondominiumId(activeCondominiumId)
            fetchColaboradoresByCondominium(user, activeCondominiumId)
          } else {
            fetchColaboradores(user)
          }
        } else {
          fetchColaboradores(user)
        }
      } catch (error) {
        console.error('Error parsing user data:', error)
        setError('Erro ao carregar dados do usuário')
      }
    }

    // Listener para mudanças no condomínio ativo
    const handleStorageChange = () => {
      const userData = localStorage.getItem('userData')
      if (userData) {
        const user = JSON.parse(userData)
        if (user.tipo === 'master') {
          const activeCondominiumId = localStorage.getItem('activeCondominio')
          if (activeCondominiumId && activeCondominiumId !== selectedCondominiumId) {
            setSelectedCondominiumId(activeCondominiumId)
            fetchColaboradoresByCondominium(user, activeCondominiumId)
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

  const fetchColaboradores = async (user: any) => {
    try {
      setLoading(true)
      let url = `/api/colaboradores?master_id=${user.master_id || user.id}`
      
      // Se não for master, filtrar pelo condomínio específico
      if (user.tipo !== 'master' && user.condominio_id) {
        url += `&condominio_id=${user.condominio_id}`
      }
      
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.success) {
        setColaboradores(data.colaboradores)
      } else {
        setError(data.error)
      }
    } catch (error) {
      setError('Erro ao carregar colaboradores')
    } finally {
      setLoading(false)
    }
  }

  const fetchColaboradoresByCondominium = async (user: any, condominioId: string) => {
    try {
      setLoading(true)
      let url = `/api/colaboradores?master_id=${user.master_id || user.id}`
      
      if (condominioId) {
        url += `&condominio_id=${condominioId}`
      }
      
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.success) {
        setColaboradores(data.colaboradores)
      } else {
        setError(data.error)
      }
    } catch (error) {
      setError('Erro ao carregar colaboradores')
    } finally {
      setLoading(false)
    }
  }

  const fetchCondominiums = async (masterId: string) => {
    try {
      const response = await fetch(`/api/condominios?master_id=${masterId}`)
      const data = await response.json()
      
      if (data.success) {
        setCondominiums(data.condominios)
      }
    } catch (error) {
      console.error('Error fetching condominiums:', error)
    }
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
        setError('CEP não encontrado')
        return
      }
      
      setFormData(prev => ({
        ...prev,
        logradouro: data.logradouro || '',
        estado: data.uf || '',
        cidade: data.localidade || ''
      }))
      
      setSuccess('Endereço preenchido automaticamente!')
      
    } catch (error) {
      console.error('Erro ao buscar CEP:', error)
      setError('Erro ao consultar CEP. Preencha manualmente.')
    } finally {
      setLoading(false)
    }
  }

  // Função para upload de arquivos
  const handleFileUpload = async (file: File, fieldName: string) => {
    if (!file) return

    // Validar tipo de arquivo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      setError('Tipo de arquivo não permitido. Use apenas: JPG, PNG, GIF ou PDF')
      return
    }

    // Validar tamanho do arquivo (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Arquivo muito grande. Tamanho máximo: 5MB')
      return
    }

    try {
      setUploadingFiles(prev => ({ ...prev, [fieldName]: true }))
      
      const formDataUpload = new FormData()
      formDataUpload.append('file', file)
      formDataUpload.append('fieldName', fieldName)
      formDataUpload.append('colaboradorId', editingColaborador?._id || 'new')
      
      const response = await fetch('/api/upload-documento', {
        method: 'POST',
        body: formDataUpload
      })

      const result = await response.json()

      if (result.success) {
        setFormData(prev => ({ 
          ...prev, 
          [fieldName]: result.fileUrl 
        }))
        setSuccess(`${getDocumentLabel(fieldName)} enviado com sucesso!`)
      } else {
        setError(result.error || 'Erro ao fazer upload do arquivo')
      }
    } catch (error) {
      console.error('Erro no upload:', error)
      setError('Erro ao fazer upload do arquivo')
    } finally {
      setUploadingFiles(prev => ({ ...prev, [fieldName]: false }))
    }
  }

  // Função para obter o rótulo do documento
  const getDocumentLabel = (fieldName: string) => {
    const labels: { [key: string]: string } = {
      foto_perfil: 'Foto de Perfil',
      foto_rg_frente: 'RG - Frente',
      foto_rg_verso: 'RG - Verso',
      foto_cpf: 'CPF',
      foto_ctps: 'CTPS',
      foto_comprovante_residencia: 'Comprovante de Residência'
    }
    return labels[fieldName] || fieldName
  }

  // Função para remover documento
  const handleRemoveDocument = async (fieldName: string) => {
    if (!confirm(`Tem certeza que deseja remover ${getDocumentLabel(fieldName)}?`)) return

    try {
      const response = await fetch('/api/remove-documento', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileUrl: formData[fieldName as keyof typeof formData],
          colaboradorId: editingColaborador?._id
        })
      })

      const result = await response.json()

      if (result.success) {
        setFormData(prev => ({ ...prev, [fieldName]: '' }))
        setSuccess(`${getDocumentLabel(fieldName)} removido com sucesso!`)
      } else {
        setError(result.error || 'Erro ao remover documento')
      }
    } catch (error) {
      console.error('Erro ao remover documento:', error)
      setError('Erro ao remover documento')
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

    if (name === 'rg') {
      let rg = value.replace(/\D/g, '')
      if (rg.length <= 9) {
        rg = rg.replace(/(\d{2})(\d{3})(\d{3})(\d{1})/, '$1.$2.$3-$4')
        setFormData(prev => ({ ...prev, rg }))
      }
      return
    }

    if (name === 'pis') {
      let pis = value.replace(/\D/g, '')
      if (pis.length <= 11) {
        pis = pis.replace(/(\d{3})(\d{5})(\d{2})(\d{1})/, '$1.$2.$3-$4')
        setFormData(prev => ({ ...prev, pis }))
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
    
    if (name === 'celular1' || name === 'celular2' || name === 'contato_emergencia_telefone') {
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

    if (name === 'salario') {
      // Formatar como moeda brasileira
      let salary = value.replace(/\D/g, '')
      if (salary) {
        salary = (parseInt(salary) / 100).toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        })
      }
      setFormData(prev => ({ ...prev, salario: salary }))
      return
    }
    
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const url = '/api/colaboradores'
      const method = editingColaborador ? 'PUT' : 'POST'
      
      // Converter salário para número
      const salarioNumerico = formData.salario 
        ? parseFloat(formData.salario.replace(/[^\d,]/g, '').replace(',', '.'))
        : undefined

      const payload = {
        ...formData,
        salario: salarioNumerico,
        master_id: userInfo?.master_id || userInfo?.id,
        ...(editingColaborador && { _id: editingColaborador._id })
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(editingColaborador ? 'Colaborador atualizado com sucesso!' : 'Colaborador cadastrado com sucesso!')
        setShowModal(false)
        resetForm()
        // Recarregar dados respeitando o condomínio ativo/selecionado
        if (userInfo?.tipo === 'master' && selectedCondominiumId) {
          fetchColaboradoresByCondominium(userInfo, selectedCondominiumId)
        } else {
          fetchColaboradores(userInfo)
        }
      } else {
        setError(data.error)
      }
    } catch (error) {
      setError('Erro ao salvar colaborador')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (colaborador: Colaborador) => {
    if (!canEdit) return
    
    setEditingColaborador(colaborador)
    setFormData({
      nome: colaborador.nome,
      cpf: colaborador.cpf,
      data_nasc: formatDateISO(colaborador.data_nasc) || '',
      celular1: colaborador.celular1,
      celular2: colaborador.celular2 || '',
      email: colaborador.email,
      senha: colaborador.senha,
      data_inicio: formatDateISO(colaborador.data_inicio) || '',
      data_fim: formatDateISO(colaborador.data_fim) || '',
      condominio_id: colaborador.condominio_id,
      // Campos de endereço
      cep: colaborador.cep || '',
      logradouro: colaborador.logradouro || '',
      estado: colaborador.estado || '',
      cidade: colaborador.cidade || '',
      numero: colaborador.numero || '',
      complemento: colaborador.complemento || '',
      observacoes: colaborador.observacoes || '',
      // Campos profissionais
      cargo: colaborador.cargo || '',
      salario: colaborador.salario ? colaborador.salario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '',
      tipo_contrato: colaborador.tipo_contrato || '',
      jornada_trabalho: colaborador.jornada_trabalho || '',
      departamento: colaborador.departamento || '',
      supervisor: colaborador.supervisor || '',
      // Dependentes
      dependentes: colaborador.dependentes || '',
      // Contato de emergência
      contato_emergencia_nome: colaborador.contato_emergencia_nome || '',
      contato_emergencia_telefone: colaborador.contato_emergencia_telefone || '',
      contato_emergencia_parentesco: colaborador.contato_emergencia_parentesco || '',
      // Documentos e informações
      rg: colaborador.rg || '',
      pis: colaborador.pis || '',
      ctps: colaborador.ctps || '',
      escolaridade: colaborador.escolaridade || '',
      estado_civil: colaborador.estado_civil || '',
      observacoes_profissionais: colaborador.observacoes_profissionais || '',
      // Documentos digitalizados
      foto_perfil: colaborador.foto_perfil || '',
      foto_rg_frente: colaborador.foto_rg_frente || '',
      foto_rg_verso: colaborador.foto_rg_verso || '',
      foto_cpf: colaborador.foto_cpf || '',
      foto_ctps: colaborador.foto_ctps || '',
      foto_comprovante_residencia: colaborador.foto_comprovante_residencia || '',
      outros_documentos: colaborador.outros_documentos || []
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!canEdit) return
    
    if (!confirm('Tem certeza que deseja excluir este colaborador?')) return

    try {
      setLoading(true)
      const response = await fetch(`/api/colaboradores?id=${id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        setSuccess('Colaborador excluído com sucesso!')
        // Recarregar dados respeitando o condomínio ativo/selecionado
        if (userInfo?.tipo === 'master' && selectedCondominiumId) {
          fetchColaboradoresByCondominium(userInfo, selectedCondominiumId)
        } else {
          fetchColaboradores(userInfo)
        }
      } else {
        setError(data.error)
      }
    } catch (error) {
      setError('Erro ao excluir colaborador')
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
      condominio_id: '',
      // Campos de endereço
      cep: '',
      logradouro: '',
      estado: '',
      cidade: '',
      numero: '',
      complemento: '',
      observacoes: '',
      // Campos profissionais
      cargo: '',
      salario: '',
      tipo_contrato: '',
      jornada_trabalho: '',
      departamento: '',
      supervisor: '',
      // Dependentes
      dependentes: '',
      // Contato de emergência
      contato_emergencia_nome: '',
      contato_emergencia_telefone: '',
      contato_emergencia_parentesco: '',
      // Documentos e informações
      rg: '',
      pis: '',
      ctps: '',
      escolaridade: '',
      estado_civil: '',
      observacoes_profissionais: '',
      // Documentos digitalizados
      foto_perfil: '',
      foto_rg_frente: '',
      foto_rg_verso: '',
      foto_cpf: '',
      foto_ctps: '',
      foto_comprovante_residencia: '',
      outros_documentos: []
    })
    setEditingColaborador(null)
    setActiveTab('personal')
  }

  const handleNewColaborador = () => {
    // Usar condomínio ativo se disponível, senão usar o selecionado
    const activeCondominiumId = localStorage.getItem('activeCondominium') || selectedCondominiumId
    
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
      condominio_id: activeCondominiumId,
      // Campos de endereço
      cep: '',
      logradouro: '',
      estado: '',
      cidade: '',
      numero: '',
      complemento: '',
      observacoes: '',
      // Campos profissionais
      cargo: '',
      salario: '',
      tipo_contrato: '',
      jornada_trabalho: '',
      departamento: '',
      supervisor: '',
      // Dependentes
      dependentes: '',
      // Contato de emergência
      contato_emergencia_nome: '',
      contato_emergencia_telefone: '',
      contato_emergencia_parentesco: '',
      // Documentos e informações
      rg: '',
      pis: '',
      ctps: '',
      escolaridade: '',
      estado_civil: '',
      observacoes_profissionais: '',
      // Documentos digitalizados
      foto_perfil: '',
      foto_rg_frente: '',
      foto_rg_verso: '',
      foto_cpf: '',
      foto_ctps: '',
      foto_comprovante_residencia: '',
      outros_documentos: []
    })
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    resetForm()
  }

  const handleCondominiumChange = (condominioId: string) => {
    setSelectedCondominiumId(condominioId)
    if (condominioId && userInfo) {
      fetchColaboradoresByCondominium(userInfo, condominioId)
    } else if (userInfo) {
      fetchColaboradores(userInfo)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR')
  }

  const getStatusBadge = (colaborador: Colaborador) => {
    if (!colaborador.ativo) {
      return <Badge bg="secondary">Inativo</Badge>
    }
    
    if (colaborador.data_fim) {
      const dataFim = new Date(colaborador.data_fim)
      const now = new Date()
      
      if (dataFim < now) {
        return <Badge bg="danger">Expirado</Badge>
      }
    }
    
    return <Badge bg="success">Ativo</Badge>
  }

  // Componente para upload de documentos
  const DocumentUpload = ({ fieldName, label, currentFile }: { fieldName: string, label: string, currentFile?: string }) => (
    <div className="border rounded p-3 mb-3">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <strong>{label}</strong>
        {uploadingFiles[fieldName] && <Spinner animation="border" size="sm" />}
      </div>
      
      {currentFile ? (
        <div className="mb-2">
          {currentFile.includes('.pdf') ? (
            <div className="d-flex align-items-center">
              <span className="me-2">📄</span>
              <a href={currentFile} target="_blank" rel="noopener noreferrer" className="text-decoration-none">
                Ver PDF
              </a>
            </div>
          ) : (
            <Image 
              src={currentFile} 
              alt={label}
              thumbnail
              style={{ maxWidth: '150px', maxHeight: '150px' }}
            />
          )}
          <div className="mt-2">
            <Button 
              variant="outline-danger" 
              size="sm"
              onClick={() => handleRemoveDocument(fieldName)}
            >
              🗑️ Remover
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-muted mb-2">Nenhum arquivo enviado</p>
      )}
      
      <Form.Control
        type="file"
        accept="image/*,.pdf"
        onChange={(e) => {
          const file = (e.target as HTMLInputElement).files?.[0]
          if (file) handleFileUpload(file, fieldName)
        }}
        disabled={uploadingFiles[fieldName]}
      />
      <Form.Text className="text-muted">
        Formatos aceitos: JPG, PNG, GIF, PDF (máx. 5MB)
      </Form.Text>
    </div>
  )

  return (
    <>
      <Container fluid className="py-4">
        <Row className="mb-4">
          <Col>
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <h2 className="mb-0">👷 Gestão de Colaboradores</h2>
                <p className="text-muted mb-0">
                  {userInfo?.tipo === 'master' 
                    ? 'Gerencie todos os colaboradores dos seus condomínios' 
                    : `Colaboradores do ${userInfo?.condominio_nome}`}
                </p>
              </div>
              {canEdit && (
                <Button 
                  variant="primary" 
                  onClick={handleNewColaborador}
                  disabled={loading}
                >
                  Novo Colaborador
                </Button>
              )}
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
          <Card.Header className="bg-primary text-white d-flex justify-content-between align-items-center">
            <h5 className="mb-0">
              Lista de Colaboradores ({colaboradores.length})
            </h5>
          </Card.Header>
          <Card.Body>
            {userInfo?.tipo === 'master' && (
              <Row className="mb-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Filtrar por Condomínio</Form.Label>
                    <Form.Select
                      value={selectedCondominiumId}
                      onChange={(e) => handleCondominiumChange(e.target.value)}
                    >
                      <option value="">Todos os condomínios</option>
                      {condominiums.map((cond) => (
                        <option key={cond._id} value={cond._id}>
                          {cond.nome}
                        </option>
                      ))}
                    </Form.Select>
                    <Form.Text className="text-muted">
                      {localStorage.getItem('activeCondominium') && localStorage.getItem('activeCondominium') === selectedCondominiumId ? (
                        <span className="text-success">
                          ✅ Condomínio ativo selecionado automaticamente
                        </span>
                      ) : (
                        "Selecione o condomínio para filtrar os colaboradores"
                      )}
                    </Form.Text>
                  </Form.Group>
                </Col>
                <Col md={6} className="d-flex align-items-end">
                  <div className="w-100">
                    <small className="text-muted">
                      <strong>Total de colaboradores:</strong> {colaboradores.length}
                    </small>
                    {localStorage.getItem('activeCondominium') && (
                      <div className="mt-1">
                        <small className="text-success">
                          🏢 <strong>Condomínio Ativo:</strong> {localStorage.getItem('activeCondominiumName') || 'Carregando...'}
                        </small>
                      </div>
                    )}
                  </div>
                </Col>
              </Row>
            )}
            {loading ? (
              <div className="text-center p-4">
                <div className="spinner-border" role="status">
                  <span className="visually-hidden">Carregando...</span>
                </div>
              </div>
            ) : colaboradores.length === 0 ? (
              <div className="text-center p-4">
                <p className="text-muted">Nenhum colaborador cadastrado</p>
              </div>
            ) : (
              <div className="table-responsive">
                <Table hover className="mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Foto</th>
                      <th>Nome</th>
                      <th>CPF</th>
                      <th>Email</th>
                      <th>Celular</th>
                      <th>Cargo</th>
                      <th>Condomínio</th>
                      <th>Data Início</th>
                      <th>Status</th>
                      {canEdit && <th>Ações</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {colaboradores.map((colaborador) => (
                      <tr key={colaborador._id}>
                        <td>
                          {colaborador.foto_perfil ? (
                            <Image 
                              src={colaborador.foto_perfil} 
                              alt="Foto"
                              roundedCircle
                              style={{ width: '40px', height: '40px', objectFit: 'cover' }}
                            />
                          ) : (
                            <div 
                              className="rounded-circle bg-secondary d-flex align-items-center justify-content-center text-white"
                              style={{ width: '40px', height: '40px' }}
                            >
                              👤
                            </div>
                          )}
                        </td>
                        <td className="fw-semibold">{colaborador.nome}</td>
                        <td>{colaborador.cpf}</td>
                        <td>{colaborador.email}</td>
                        <td>{colaborador.celular1}</td>
                        <td>
                          {colaborador.cargo ? (
                            <Badge bg="secondary">{colaborador.cargo}</Badge>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                        <td>
                          <Badge bg="info">
                            {colaborador.condominio_nome}
                          </Badge>
                        </td>
                        <td>{formatDate(colaborador.data_inicio)}</td>
                        <td>{getStatusBadge(colaborador)}</td>
                        {canEdit && (
                          <td>
                            <div className="btn-group btn-group-sm" role="group">
                              <Button
                                variant="outline-primary"
                                size="sm"
                                onClick={() => handleEdit(colaborador)}
                                title="Editar"
                              >
                                ✏️
                              </Button>
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => handleDelete(colaborador._id)}
                                title="Excluir"
                              >
                                🗑️
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Card.Body>
        </Card>

        {/* Modal para cadastro/edição */}
        <Modal show={showModal} onHide={handleCloseModal} size="xl">
          <Modal.Header closeButton>
            <Modal.Title>
              {editingColaborador ? 'Editar Colaborador' : 'Novo Colaborador'}
            </Modal.Title>
          </Modal.Header>
          <Form onSubmit={handleSubmit}>
            <Modal.Body>
              <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k || 'personal')} className="mb-3">
                
                {/* Aba Dados Pessoais */}
                <Tab eventKey="personal" title="👤 Dados Pessoais">
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
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>RG</Form.Label>
                        <Form.Control
                          type="text"
                          name="rg"
                          value={formData.rg}
                          onChange={handleInputChange}
                          placeholder="00.000.000-0"
                          maxLength={12}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <DateInput
                        name="data_nasc"
                        value={formData.data_nasc}
                        onChange={(name, value) => setFormData(prev => ({ ...prev, [name]: value }))}
                        label="Data de Nascimento"
                        required
                        showAge={true}
                        onAgeCalculated={setCalculatedAge}
                      />
                    </Col>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>Estado Civil</Form.Label>
                        <Form.Select
                          name="estado_civil"
                          value={formData.estado_civil}
                          onChange={handleInputChange}
                        >
                          <option value="">Selecione</option>
                          <option value="solteiro">Solteiro(a)</option>
                          <option value="casado">Casado(a)</option>
                          <option value="divorciado">Divorciado(a)</option>
                          <option value="viuvo">Viúvo(a)</option>
                          <option value="uniao_estavel">União Estável</option>
                        </Form.Select>
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
                          placeholder="colaborador@exemplo.com"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Escolaridade</Form.Label>
                        <Form.Select
                          name="escolaridade"
                          value={formData.escolaridade}
                          onChange={handleInputChange}
                        >
                          <option value="">Selecione</option>
                          <option value="fundamental_incompleto">Fundamental Incompleto</option>
                          <option value="fundamental_completo">Fundamental Completo</option>
                          <option value="medio_incompleto">Médio Incompleto</option>
                          <option value="medio_completo">Médio Completo</option>
                          <option value="superior_incompleto">Superior Incompleto</option>
                          <option value="superior_completo">Superior Completo</option>
                          <option value="pos_graduacao">Pós-graduação</option>
                          <option value="mestrado">Mestrado</option>
                          <option value="doutorado">Doutorado</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                  </Row>

                  <Row>
                    <Col>
                      <Form.Group className="mb-3">
                        <Form.Label>Dependentes</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={3}
                          name="dependentes"
                          value={formData.dependentes}
                          onChange={handleInputChange}
                          placeholder="Liste os dependentes (nome, idade, parentesco)..."
                        />
                        <Form.Text className="text-muted">
                          Ex: João Silva, 8 anos, filho; Maria Silva, 35 anos, esposa
                        </Form.Text>
                      </Form.Group>
                    </Col>
                  </Row>
                </Tab>

                {/* Aba Endereço */}
                <Tab eventKey="address" title="📍 Endereço">
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
                        <Form.Label>Observações sobre o Endereço</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={3}
                          name="observacoes"
                          value={formData.observacoes}
                          onChange={handleInputChange}
                          placeholder="Informações adicionais sobre o endereço..."
                          maxLength={500}
                        />
                        <Form.Text className="text-muted">
                          Máximo 500 caracteres
                        </Form.Text>
                      </Form.Group>
                    </Col>
                  </Row>
                </Tab>

                {/* Aba Dados Profissionais */}
                <Tab eventKey="professional" title="💼 Dados Profissionais">
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Condomínio *</Form.Label>
                        <Form.Select
                          name="condominio_id"
                          value={formData.condominio_id}
                          onChange={handleInputChange}
                          required
                          disabled={userInfo?.tipo !== 'master'}
                        >
                          <option value="">Selecione um condomínio</option>
                          {userInfo?.tipo === 'master' ? (
                            condominiums.map((cond) => (
                              <option key={cond._id} value={cond._id}>
                                {cond.nome}
                              </option>
                            ))
                          ) : (
                            <option value={userInfo?.condominio_id}>
                              {userInfo?.condominio_nome}
                            </option>
                          )}
                        </Form.Select>
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Cargo/Função</Form.Label>
                        <Form.Control
                          type="text"
                          name="cargo"
                          value={formData.cargo}
                          onChange={handleInputChange}
                          placeholder="Porteiro, Zelador, Faxineiro..."
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  <Row>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>Salário</Form.Label>
                        <Form.Control
                          type="text"
                          name="salario"
                          value={formData.salario}
                          onChange={handleInputChange}
                          placeholder="R$ 0,00"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>Tipo de Contrato</Form.Label>
                        <Form.Select
                          name="tipo_contrato"
                          value={formData.tipo_contrato}
                          onChange={handleInputChange}
                        >
                          <option value="">Selecione</option>
                          <option value="clt">CLT</option>
                          <option value="terceirizado">Terceirizado</option>
                          <option value="temporario">Temporário</option>
                          <option value="estagio">Estágio</option>
                          <option value="freelancer">Freelancer</option>
                          <option value="pj">Pessoa Jurídica</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>Jornada de Trabalho</Form.Label>
                        <Form.Select
                          name="jornada_trabalho"
                          value={formData.jornada_trabalho}
                          onChange={handleInputChange}
                        >
                          <option value="">Selecione</option>
                          <option value="44h">44 horas semanais</option>
                          <option value="40h">40 horas semanais</option>
                          <option value="36h">36 horas semanais</option>
                          <option value="30h">30 horas semanais</option>
                          <option value="20h">20 horas semanais</option>
                          <option value="12x36">12x36 horas</option>
                          <option value="meio_periodo">Meio período</option>
                          <option value="integral">Período integral</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                  </Row>

                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Departamento/Setor</Form.Label>
                        <Form.Control
                          type="text"
                          name="departamento"
                          value={formData.departamento}
                          onChange={handleInputChange}
                          placeholder="Portaria, Limpeza, Manutenção..."
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Supervisor/Responsável</Form.Label>
                        <Form.Control
                          type="text"
                          name="supervisor"
                          value={formData.supervisor}
                          onChange={handleInputChange}
                          placeholder="Nome do supervisor direto"
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  <Row>
                    <Col md={6}>
                      <DateInput
                        name="data_inicio"
                        value={formData.data_inicio}
                        onChange={(name, value) => setFormData(prev => ({ ...prev, [name]: value }))}
                        label="Data de Início *"
                        required
                      />
                    </Col>
                    <Col md={6}>
                      <DateInput
                        name="data_fim"
                        value={formData.data_fim}
                        onChange={(name, value) => setFormData(prev => ({ ...prev, [name]: value }))}
                        label="Data de Término"
                      />
                      <Form.Text className="text-muted">
                        Deixe vazio para colaborador sem data de término
                      </Form.Text>
                    </Col>
                  </Row>

                  <Row>
                    <Col>
                      <Form.Group className="mb-3">
                        <Form.Label>Observações Profissionais</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={3}
                          name="observacoes_profissionais"
                          value={formData.observacoes_profissionais}
                          onChange={handleInputChange}
                          placeholder="Informações adicionais sobre o trabalho, horários especiais, etc..."
                          maxLength={500}
                        />
                        <Form.Text className="text-muted">
                          Máximo 500 caracteres
                        </Form.Text>
                      </Form.Group>
                    </Col>
                  </Row>
                </Tab>

                {/* Aba Documentos */}
                <Tab eventKey="documents" title="📄 Documentos">
                  <Alert variant="info" className="mb-4">
                    <h6 className="mb-2">📄 Sistema de Documentos</h6>
                    <small>Faça upload dos documentos digitalizados do colaborador. Todos os arquivos são armazenados com segurança.</small>
                  </Alert>

                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Senha de Acesso *</Form.Label>
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
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>PIS/PASEP</Form.Label>
                        <Form.Control
                          type="text"
                          name="pis"
                          value={formData.pis}
                          onChange={handleInputChange}
                          placeholder="000.00000.00-0"
                          maxLength={14}
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>CTPS (Carteira de Trabalho)</Form.Label>
                        <Form.Control
                          type="text"
                          name="ctps"
                          value={formData.ctps}
                          onChange={handleInputChange}
                          placeholder="Número da CTPS"
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  <Alert variant="secondary" className="mt-4 mb-3">
                    <h6 className="mb-2">📁 Upload de Documentos</h6>
                    <small>Envie fotos ou PDFs dos documentos do colaborador</small>
                  </Alert>

                  <Row>
                    <Col md={6}>
                      <DocumentUpload
                        fieldName="foto_perfil"
                        label="📷 Foto de Perfil"
                        currentFile={formData.foto_perfil}
                      />
                    </Col>
                    <Col md={6}>
                      <DocumentUpload
                        fieldName="foto_rg_frente"
                        label="🆔 RG - Frente"
                        currentFile={formData.foto_rg_frente}
                      />
                    </Col>
                  </Row>

                  <Row>
                    <Col md={6}>
                      <DocumentUpload
                        fieldName="foto_rg_verso"
                        label="🆔 RG - Verso"
                        currentFile={formData.foto_rg_verso}
                      />
                    </Col>
                    <Col md={6}>
                      <DocumentUpload
                        fieldName="foto_cpf"
                        label="📋 CPF"
                        currentFile={formData.foto_cpf}
                      />
                    </Col>
                  </Row>

                  <Row>
                    <Col md={6}>
                      <DocumentUpload
                        fieldName="foto_ctps"
                        label="📘 CTPS"
                        currentFile={formData.foto_ctps}
                      />
                    </Col>
                    <Col md={6}>
                      <DocumentUpload
                        fieldName="foto_comprovante_residencia"
                        label="🏠 Comprovante de Residência"
                        currentFile={formData.foto_comprovante_residencia}
                      />
                    </Col>
                  </Row>
                </Tab>

                {/* Aba Contato de Emergência */}
                <Tab eventKey="emergency" title="🚨 Contato de Emergência">
                  <Alert variant="warning" className="mb-3">
                    <h6 className="mb-2">🚨 Informações de Emergência</h6>
                    <small>Pessoa para contato em caso de emergência ou acidente</small>
                  </Alert>

                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Nome Completo</Form.Label>
                        <Form.Control
                          type="text"
                          name="contato_emergencia_nome"
                          value={formData.contato_emergencia_nome}
                          onChange={handleInputChange}
                          placeholder="Nome da pessoa de contato"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Telefone</Form.Label>
                        <Form.Control
                          type="text"
                          name="contato_emergencia_telefone"
                          value={formData.contato_emergencia_telefone}
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
                        <Form.Label>Parentesco/Relação</Form.Label>
                        <Form.Select
                          name="contato_emergencia_parentesco"
                          value={formData.contato_emergencia_parentesco}
                          onChange={handleInputChange}
                        >
                          <option value="">Selecione</option>
                          <option value="pai">Pai</option>
                          <option value="mae">Mãe</option>
                          <option value="conjuge">Cônjuge</option>
                          <option value="filho">Filho(a)</option>
                          <option value="irmao">Irmão/Irmã</option>
                          <option value="amigo">Amigo(a)</option>
                          <option value="parente">Parente</option>
                          <option value="outro">Outro</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                  </Row>
                </Tab>

              </Tabs>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={handleCloseModal}>
                Cancelar
              </Button>
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? 'Salvando...' : (editingColaborador ? 'Atualizar' : 'Cadastrar')}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>
      </Container>
    </>
  )
}