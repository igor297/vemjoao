'use client'

import { useState, useEffect } from 'react'
import { Modal, Form, Button, Alert, Table, Badge, Row, Col } from 'react-bootstrap'
import { useTheme } from '@/context/ThemeContext'

interface Morador {
  _id: string
  nome: string
  tipo: 'proprietario' | 'inquilino' | 'dependente'
  unidade: string
  bloco?: string
  condominio_id: string
  condominio_nome: string
  master_id: string
}

interface Dependente {
  _id: string
  nome: string
  data_nasc: Date
  email?: string
  password?: string
  condominio_id: string
  condominio_nome?: string
  bloco?: string
  unidade: string
  morador_id?: string
  inquilino_id?: string
  master_id: string
  ativo: boolean
  observacoes?: string
  idade?: number
}

interface DependenteManagerProps {
  show: boolean
  onHide: () => void
  morador: Morador
  onSuccess: (message: string) => void
  onError: (message: string) => void
  onBack?: () => void
}

export default function DependenteManager({ show, onHide, morador, onSuccess, onError, onBack }: DependenteManagerProps) {
  const [dependentes, setDependentes] = useState<Dependente[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingDependente, setEditingDependente] = useState<Dependente | null>(null)
  const [loading, setLoading] = useState(false)
  const [calculatedAge, setCalculatedAge] = useState(0)
  const { theme } = useTheme()
  
  // Mapear tema do contexto para Bootstrap
  const getBootstrapTheme = () => {
    if (theme === 'dark' || theme === 'comfort') return 'dark'
    return 'light'
  }

  const [formData, setFormData] = useState({
    nome: '',
    data_nasc: '',
    email: '',
    password: '',
    observacoes: ''
  })

  useEffect(() => {
    if (show && morador) {
      fetchDependentes()
    }
  }, [show, morador])

  useEffect(() => {
    if (formData.data_nasc) {
      calculateAge(formData.data_nasc)
    }
  }, [formData.data_nasc])

  const calculateAge = (birthDate: string) => {
    const today = new Date()
    const birth = new Date(birthDate)
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    
    setCalculatedAge(age)
    
    // Se menor de 18, limpar email e senha
    if (age < 18) {
      setFormData(prev => ({
        ...prev,
        email: '',
        password: ''
      }))
    }
  }

  const fetchDependentes = async () => {
    try {
      setLoading(true)
      const moradorParam = morador.tipo === 'inquilino' ? 'inquilino_id' : 'morador_id'
      const response = await fetch(`/api/dependentes?master_id=${morador.master_id}&${moradorParam}=${morador._id}`)
      const data = await response.json()
      
      if (data.success) {
        setDependentes(data.dependentes)
      } else {
        onError(data.error)
      }
    } catch (error) {
      onError('Erro ao carregar dependentes')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const url = '/api/dependentes'
      const method = editingDependente ? 'PUT' : 'POST'
      
      const payload = {
        ...formData,
        condominio_id: morador.condominio_id,
        unidade: morador.unidade,
        bloco: morador.bloco || '',
        master_id: morador.master_id,
        [morador.tipo === 'inquilino' ? 'inquilino_id' : 'morador_id']: morador._id,
        ...(editingDependente && { _id: editingDependente._id })
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (data.success) {
        onSuccess(editingDependente ? 'Dependente atualizado com sucesso!' : 'Dependente cadastrado com sucesso!')
        resetForm()
        setShowForm(false)
        fetchDependentes()
      } else {
        onError(data.error)
      }
    } catch (error) {
      onError('Erro ao salvar dependente')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (dependente: Dependente) => {
    setEditingDependente(dependente)
    setFormData({
      nome: dependente.nome,
      data_nasc: new Date(dependente.data_nasc).toISOString().split('T')[0],
      email: dependente.email || '',
      password: '', // Não preencher senha na edição
      observacoes: dependente.observacoes || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este dependente?')) return

    try {
      setLoading(true)
      const response = await fetch(`/api/dependentes?id=${id}&master_id=${morador.master_id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        onSuccess('Dependente excluído com sucesso!')
        fetchDependentes()
      } else {
        onError(data.error)
      }
    } catch (error) {
      onError('Erro ao excluir dependente')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      nome: '',
      data_nasc: '',
      email: '',
      password: '',
      observacoes: ''
    })
    setEditingDependente(null)
    setCalculatedAge(0)
  }

  const handleNewDependente = () => {
    resetForm()
    setShowForm(true)
  }

  const getIdadeBadge = (idade: number) => {
    if (idade >= 18) {
      return <Badge bg="success">Maior de idade ({idade} anos)</Badge>
    } else {
      return <Badge bg="info">Menor de idade ({idade} anos)</Badge>
    }
  }

  return (
    <Modal show={show} onHide={onHide} size="lg" data-bs-theme={getBootstrapTheme()}>
      <Modal.Header closeButton>
        <Modal.Title>
          👨‍👩‍👧‍👦 Gerenciar Dependentes - {morador?.nome}
        </Modal.Title>
      </Modal.Header>
      
      {!showForm ? (
        <>
          <Modal.Body>
            <Alert variant="info" className="mb-3">
              <strong>📋 Informações:</strong><br/>
              • Cada morador/inquilino pode ter múltiplos dependentes<br/>
              • Dependentes ≥18 anos podem ter email e senha para acesso<br/>
              • Dependentes &lt;18 anos não podem ter credenciais de acesso
            </Alert>

            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="mb-0">Lista de Dependentes ({dependentes.length})</h6>
              <Button 
                variant="primary" 
                size="sm"
                onClick={handleNewDependente}
                disabled={loading}
              >
                Novo Dependente
              </Button>
            </div>
            
            {loading ? (
              <div className="text-center p-4">
                <div className="spinner-border" role="status">
                  <span className="visually-hidden">Carregando...</span>
                </div>
              </div>
            ) : dependentes.length === 0 ? (
              <Alert variant="secondary" className="text-center">
                <h6>📋 Nenhum dependente cadastrado</h6>
                <p className="mb-0">Clique em "Novo Dependente" para adicionar</p>
              </Alert>
            ) : (
              <div className="table-responsive">
                <Table hover size="sm" data-bs-theme={getBootstrapTheme()}>
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Idade</th>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dependentes.map((dependente) => (
                      <tr key={dependente._id}>
                        <td className="fw-semibold">{dependente.nome}</td>
                        <td>{getIdadeBadge(dependente.idade || 0)}</td>
                        <td>{dependente.email || 'N/A'}</td>
                        <td>
                          <Badge bg={dependente.ativo ? 'success' : 'secondary'}>
                            {dependente.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </td>
                        <td>
                          <div className="btn-group btn-group-sm">
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => handleEdit(dependente)}
                              title="Editar"
                            >
                              ✏️
                            </Button>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => handleDelete(dependente._id)}
                              title="Excluir"
                            >
                              🗑️
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            {onBack && (
              <Button variant="outline-secondary" onClick={onBack}>
                ← Voltar ao Menu
              </Button>
            )}
            <Button variant="secondary" onClick={onHide}>
              Fechar
            </Button>
          </Modal.Footer>
        </>
      ) : (
        <>
          <Form onSubmit={handleSubmit}>
            <Modal.Body>
              <Alert variant="info" className="mb-3">
                <strong>📋 Dados Herdados Automaticamente:</strong><br/>
                <strong>🏢 Condomínio:</strong> {morador.condominio_nome}<br/>
                <strong>🏗️ Bloco:</strong> {morador.bloco || 'Não informado'}<br/>
                <strong>🏠 Unidade:</strong> {morador.unidade}
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
                      placeholder="Digite o nome completo do dependente"
                    />
                  </Form.Group>
                </Col>
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
                    {formData.data_nasc && (
                      <Form.Text className={calculatedAge >= 18 ? 'text-success' : 'text-info'}>
                        {calculatedAge >= 18 ? 
                          `✅ Maior de idade (${calculatedAge} anos) - Pode ter email/senha` : 
                          `📅 Menor de idade (${calculatedAge} anos) - Não pode ter credenciais`
                        }
                      </Form.Text>
                    )}
                  </Form.Group>
                </Col>
              </Row>

              {calculatedAge >= 18 && (
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Email</Form.Label>
                      <Form.Control
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="email@exemplo.com (opcional)"
                      />
                      <Form.Text className="text-muted">
                        Opcional - Se fornecido, será usado para acesso ao sistema
                      </Form.Text>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Senha {editingDependente ? '(deixe vazio para manter)' : ''}</Form.Label>
                      <Form.Control
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        placeholder={editingDependente ? "Deixe vazio para manter a senha atual" : "Mínimo 6 caracteres (opcional)"}
                        minLength={6}
                      />
                      <Form.Text className="text-muted">
                        {editingDependente ? 'Deixe vazio para manter a senha atual' : 'Opcional - Necessário apenas se email for fornecido'}
                      </Form.Text>
                    </Form.Group>
                  </Col>
                </Row>
              )}

              {calculatedAge < 18 && calculatedAge > 0 && (
                <Alert variant="warning">
                  <strong>⚠️ Dependente menor de idade</strong><br/>
                  Dependentes menores de 18 anos não podem ter email e senha para acesso ao sistema.
                </Alert>
              )}

              <Form.Group className="mb-3">
                <Form.Label>Observações</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  name="observacoes"
                  value={formData.observacoes}
                  onChange={handleInputChange}
                  placeholder="Informações adicionais sobre o dependente..."
                  maxLength={500}
                />
              </Form.Group>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => {
                resetForm()
                setShowForm(false)
              }}>
                ← Voltar
              </Button>
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? 'Salvando...' : (editingDependente ? 'Atualizar' : 'Cadastrar')}
              </Button>
            </Modal.Footer>
          </Form>
        </>
      )}
    </Modal>
  )
}
