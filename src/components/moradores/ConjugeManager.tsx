'use client'

import { useState, useEffect } from 'react'
import { Modal, Form, Button, Alert, Table, Badge } from 'react-bootstrap'
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

interface Conjuge {
  _id: string
  nome: string
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
}

interface ConjugeManagerProps {
  show: boolean
  onHide: () => void
  morador: Morador
  onSuccess: (message: string) => void
  onError: (message: string) => void
  onBack?: () => void
}

export default function ConjugeManager({ show, onHide, morador, onSuccess, onError, onBack }: ConjugeManagerProps) {
  const [conjuges, setConjuges] = useState<Conjuge[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingConjuge, setEditingConjuge] = useState<Conjuge | null>(null)
  const [loading, setLoading] = useState(false)
  const { theme } = useTheme()
  
  // Mapear tema do contexto para Bootstrap
  const getBootstrapTheme = () => {
    if (theme === 'dark' || theme === 'comfort') return 'dark'
    return 'light'
  }

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    password: '',
    observacoes: ''
  })

  useEffect(() => {
    if (show && morador) {
      fetchConjuges()
    }
  }, [show, morador])

  const fetchConjuges = async () => {
    try {
      setLoading(true)
      const moradorParam = morador.tipo === 'inquilino' ? 'inquilino_id' : 'morador_id'
      const response = await fetch(`/api/conjuges?master_id=${morador.master_id}&${moradorParam}=${morador._id}`)
      const data = await response.json()
      
      if (data.success) {
        setConjuges(data.conjuges)
      } else {
        onError(data.error)
      }
    } catch (error) {
      onError('Erro ao carregar cônjuges')
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
      const url = '/api/conjuges'
      const method = editingConjuge ? 'PUT' : 'POST'
      
      const payload = {
        ...formData,
        condominio_id: morador.condominio_id,
        unidade: morador.unidade,
        bloco: morador.bloco || '',
        master_id: morador.master_id,
        [morador.tipo === 'inquilino' ? 'inquilino_id' : 'morador_id']: morador._id,
        ...(editingConjuge && { _id: editingConjuge._id })
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (data.success) {
        onSuccess(editingConjuge ? 'Cônjuge atualizado com sucesso!' : 'Cônjuge cadastrado com sucesso!')
        resetForm()
        setShowForm(false)
        fetchConjuges()
      } else {
        onError(data.error)
      }
    } catch (error) {
      onError('Erro ao salvar cônjuge')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (conjuge: Conjuge) => {
    setEditingConjuge(conjuge)
    setFormData({
      nome: conjuge.nome,
      email: conjuge.email || '',
      password: '', // Não preencher senha na edição
      observacoes: conjuge.observacoes || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este cônjuge?')) return

    try {
      setLoading(true)
      const response = await fetch(`/api/conjuges?id=${id}&master_id=${morador.master_id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        onSuccess('Cônjuge excluído com sucesso!')
        fetchConjuges()
      } else {
        onError(data.error)
      }
    } catch (error) {
      onError('Erro ao excluir cônjuge')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      nome: '',
      email: '',
      password: '',
      observacoes: ''
    })
    setEditingConjuge(null)
  }

  const handleNewConjuge = () => {
    resetForm()
    setShowForm(true)
  }

  return (
    <Modal show={show} onHide={onHide} size="lg" data-bs-theme={getBootstrapTheme()}>
      <Modal.Header closeButton>
        <Modal.Title>
          💍 Gerenciar Cônjuge - {morador?.nome}
        </Modal.Title>
      </Modal.Header>
      
      {!showForm ? (
        <>
          <Modal.Body>
            <Alert variant="info" className="mb-3">
              <strong>📋 Informações:</strong><br/>
              • Cada morador/inquilino pode ter apenas um cônjuge<br/>
              • O cônjuge herda automaticamente os dados de localização<br/>
              • Email e senha são opcionais
            </Alert>

            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="mb-0">Lista de Cônjuges ({conjuges.length})</h6>
              {conjuges.length === 0 && (
                <Button 
                  variant="primary" 
                  size="sm"
                  onClick={handleNewConjuge}
                  disabled={loading}
                >
                  Novo Cônjuge
                </Button>
              )}
            </div>
            
            {loading ? (
              <div className="text-center p-4">
                <div className="spinner-border" role="status">
                  <span className="visually-hidden">Carregando...</span>
                </div>
              </div>
            ) : conjuges.length === 0 ? (
              <Alert variant="secondary" className="text-center">
                <h6>📋 Nenhum cônjuge cadastrado</h6>
                <p className="mb-0">Clique em "Novo Cônjuge" para adicionar</p>
              </Alert>
            ) : (
              <div className="table-responsive">
                <Table hover size="sm" data-bs-theme={getBootstrapTheme()}>
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conjuges.map((conjuge) => (
                      <tr key={conjuge._id}>
                        <td className="fw-semibold">{conjuge.nome}</td>
                        <td>{conjuge.email || 'N/A'}</td>
                        <td>
                          <Badge bg={conjuge.ativo ? 'success' : 'secondary'}>
                            {conjuge.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </td>
                        <td>
                          <div className="btn-group btn-group-sm">
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => handleEdit(conjuge)}
                              title="Editar"
                            >
                              ✏️
                            </Button>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => handleDelete(conjuge._id)}
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

              <Form.Group className="mb-3">
                <Form.Label>Nome Completo *</Form.Label>
                <Form.Control
                  type="text"
                  name="nome"
                  value={formData.nome}
                  onChange={handleInputChange}
                  required
                  placeholder="Digite o nome completo do cônjuge"
                />
              </Form.Group>

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

              <Form.Group className="mb-3">
                <Form.Label>Senha {editingConjuge ? '(deixe vazio para manter)' : ''}</Form.Label>
                <Form.Control
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder={editingConjuge ? "Deixe vazio para manter a senha atual" : "Mínimo 6 caracteres (opcional)"}
                  minLength={6}
                />
                <Form.Text className="text-muted">
                  {editingConjuge ? 'Deixe vazio para manter a senha atual' : 'Opcional - Necessário apenas se email for fornecido'}
                </Form.Text>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Observações</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  name="observacoes"
                  value={formData.observacoes}
                  onChange={handleInputChange}
                  placeholder="Informações adicionais sobre o cônjuge..."
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
                {loading ? 'Salvando...' : (editingConjuge ? 'Atualizar' : 'Cadastrar')}
              </Button>
            </Modal.Footer>
          </Form>
        </>
      )}
    </Modal>
  )
}
