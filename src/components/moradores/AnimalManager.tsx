'use client'

import { useState, useEffect } from 'react'
import { Modal, Form, Button, Alert, Table, Badge, Row, Col } from 'react-bootstrap'

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

interface Animal {
  _id: string
  tipo: 'cao' | 'gato' | 'passaro' | 'peixe' | 'outro'
  nome: string
  raca?: string
  idade?: number
  observacoes?: string
  condominio_id: string
  condominio_nome?: string
  bloco?: string
  unidade: string
  morador_id?: string
  inquilino_id?: string
  master_id: string
  ativo: boolean
}

interface AnimalManagerProps {
  show: boolean
  onHide: () => void
  morador: Morador
  onSuccess: (message: string) => void
  onError: (message: string) => void
  onBack?: () => void
}

export default function AnimalManager({ show, onHide, morador, onSuccess, onError, onBack }: AnimalManagerProps) {
  const [animais, setAnimais] = useState<Animal[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingAnimal, setEditingAnimal] = useState<Animal | null>(null)
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState({
    tipo: 'cao' as 'cao' | 'gato' | 'passaro' | 'peixe' | 'outro',
    nome: '',
    raca: '',
    idade: '',
    observacoes: ''
  })

  useEffect(() => {
    if (show && morador) {
      fetchAnimais()
    }
  }, [show, morador])

  const fetchAnimais = async () => {
    try {
      setLoading(true)
      const moradorParam = morador.subtipo === 'inquilino' ? 'inquilino_id' : 'morador_id'
      const response = await fetch(`/api/animais?master_id=${morador.master_id}&${moradorParam}=${morador._id}`)
      const data = await response.json()
      
      if (data.success) {
        setAnimais(data.animais)
      } else {
        onError(data.error)
      }
    } catch (error) {
      onError('Erro ao carregar animais')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    
    // Validar idade (apenas números)
    if (name === 'idade') {
      const idade = value.replace(/[^0-9]/g, '')
      if (parseInt(idade) <= 50 || idade === '') {
        setFormData(prev => ({ ...prev, idade }))
      }
      return
    }
    
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const url = '/api/animais'
      const method = editingAnimal ? 'PUT' : 'POST'
      
      const payload = {
        ...formData,
        idade: formData.idade ? parseInt(formData.idade) : undefined,
        condominio_id: morador.condominio_id,
        unidade: morador.unidade,
        bloco: morador.bloco || '',
        master_id: morador.master_id,
        [morador.tipo === 'inquilino' ? 'inquilino_id' : 'morador_id']: morador._id,
        ...(editingAnimal && { _id: editingAnimal._id })
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (data.success) {
        onSuccess(editingAnimal ? 'Animal atualizado com sucesso!' : 'Animal cadastrado com sucesso!')
        resetForm()
        setShowForm(false)
        fetchAnimais()
      } else {
        onError(data.error)
      }
    } catch (error) {
      onError('Erro ao salvar animal')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (animal: Animal) => {
    setEditingAnimal(animal)
    setFormData({
      tipo: animal.tipo,
      nome: animal.nome,
      raca: animal.raca || '',
      idade: animal.idade ? animal.idade.toString() : '',
      observacoes: animal.observacoes || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este animal?')) return

    try {
      setLoading(true)
      const response = await fetch(`/api/animais?id=${id}&master_id=${morador.master_id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        onSuccess('Animal excluído com sucesso!')
        fetchAnimais()
      } else {
        onError(data.error)
      }
    } catch (error) {
      onError('Erro ao excluir animal')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      tipo: 'cao',
      nome: '',
      raca: '',
      idade: '',
      observacoes: ''
    })
    setEditingAnimal(null)
  }

  const handleNewAnimal = () => {
    resetForm()
    setShowForm(true)
  }

  const getTipoBadge = (tipo: string) => {
    const colors = {
      cao: 'primary',
      gato: 'warning',
      passaro: 'info',
      peixe: 'success',
      outro: 'secondary'
    }
    const icons = {
      cao: '🐕',
      gato: '🐱',
      passaro: '🐦',
      peixe: '🐠',
      outro: '🐾'
    }
    const labels = {
      cao: 'Cão',
      gato: 'Gato',
      passaro: 'Pássaro',
      peixe: 'Peixe',
      outro: 'Outro'
    }
    return (
      <Badge bg={colors[tipo as keyof typeof colors]}>
        {icons[tipo as keyof typeof icons]} {labels[tipo as keyof typeof labels]}
      </Badge>
    )
  }

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>
          🐕 Gerenciar Animais - {morador?.nome}
        </Modal.Title>
      </Modal.Header>
      
      {!showForm ? (
        <>
          <Modal.Body>
            <Alert variant="info" className="mb-3">
              <strong>📋 Informações:</strong><br/>
              • Cada morador/inquilino pode ter múltiplos animais<br/>
              • Registre pets para controle condominial<br/>
              • Informações de raça e idade são opcionais
            </Alert>

            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="mb-0">Lista de Animais ({animais.length})</h6>
              <Button 
                variant="primary" 
                size="sm"
                onClick={handleNewAnimal}
                disabled={loading}
              >
                Novo Animal
              </Button>
            </div>
            
            {loading ? (
              <div className="text-center p-4">
                <div className="spinner-border" role="status">
                  <span className="visually-hidden">Carregando...</span>
                </div>
              </div>
            ) : animais.length === 0 ? (
              <Alert variant="secondary" className="text-center">
                <h6>📋 Nenhum animal cadastrado</h6>
                <p className="mb-0">Clique em "Novo Animal" para adicionar</p>
              </Alert>
            ) : (
              <div className="table-responsive">
                <Table hover size="sm">
                  <thead className="table-light">
                    <tr>
                      <th>Tipo</th>
                      <th>Nome</th>
                      <th>Raça</th>
                      <th>Idade</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {animais.map((animal) => (
                      <tr key={animal._id}>
                        <td>{getTipoBadge(animal.tipo)}</td>
                        <td className="fw-semibold">{animal.nome}</td>
                        <td>{animal.raca || 'N/A'}</td>
                        <td>{animal.idade ? `${animal.idade} anos` : 'N/A'}</td>
                        <td>
                          <Badge bg={animal.ativo ? 'success' : 'secondary'}>
                            {animal.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </td>
                        <td>
                          <div className="btn-group btn-group-sm">
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => handleEdit(animal)}
                              title="Editar"
                            >
                              ✏️
                            </Button>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => handleDelete(animal._id)}
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
                    <Form.Label>Tipo de Animal *</Form.Label>
                    <Form.Select
                      name="tipo"
                      value={formData.tipo}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="cao">🐕 Cão</option>
                      <option value="gato">🐱 Gato</option>
                      <option value="passaro">🐦 Pássaro</option>
                      <option value="peixe">🐠 Peixe</option>
                      <option value="outro">🐾 Outro</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Nome do Animal *</Form.Label>
                    <Form.Control
                      type="text"
                      name="nome"
                      value={formData.nome}
                      onChange={handleInputChange}
                      required
                      placeholder="Ex: Rex, Mimi, Piu-piu"
                      maxLength={50}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Raça</Form.Label>
                    <Form.Control
                      type="text"
                      name="raca"
                      value={formData.raca}
                      onChange={handleInputChange}
                      placeholder="Ex: Labrador, Persa, Canário"
                      maxLength={50}
                    />
                    <Form.Text className="text-muted">
                      Opcional
                    </Form.Text>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Idade</Form.Label>
                    <Form.Control
                      type="text"
                      name="idade"
                      value={formData.idade}
                      onChange={handleInputChange}
                      placeholder="Ex: 3"
                      maxLength={2}
                    />
                    <Form.Text className="text-muted">
                      Idade em anos (opcional, máximo 50)
                    </Form.Text>
                  </Form.Group>
                </Col>
              </Row>

              <Form.Group className="mb-3">
                <Form.Label>Observações</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  name="observacoes"
                  value={formData.observacoes}
                  onChange={handleInputChange}
                  placeholder="Informações adicionais sobre o animal (temperamento, cuidados especiais, etc.)..."
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
                {loading ? 'Salvando...' : (editingAnimal ? 'Atualizar' : 'Cadastrar')}
              </Button>
            </Modal.Footer>
          </Form>
        </>
      )}
    </Modal>
  )
}