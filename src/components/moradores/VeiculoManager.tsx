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

interface Veiculo {
  _id: string
  tipo: 'carro' | 'moto' | 'bicicleta' | 'outro'
  placa: string
  modelo?: string
  cor?: string
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

interface VeiculoManagerProps {
  show: boolean
  onHide: () => void
  morador: Morador
  onSuccess: (message: string) => void
  onError: (message: string) => void
  onBack?: () => void
}

export default function VeiculoManager({ show, onHide, morador, onSuccess, onError, onBack }: VeiculoManagerProps) {
  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingVeiculo, setEditingVeiculo] = useState<Veiculo | null>(null)
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState({
    tipo: 'carro' as 'carro' | 'moto' | 'bicicleta' | 'outro',
    placa: '',
    modelo: '',
    cor: '',
    observacoes: ''
  })

  useEffect(() => {
    if (show && morador) {
      fetchVeiculos()
    }
  }, [show, morador])

  const fetchVeiculos = async () => {
    try {
      setLoading(true)
      const moradorParam = morador.tipo === 'inquilino' ? 'inquilino_id' : 'morador_id'
      const response = await fetch(`/api/veiculos?master_id=${morador.master_id}&${moradorParam}=${morador._id}`)
      const data = await response.json()
      
      if (data.success) {
        setVeiculos(data.veiculos)
      } else {
        onError(data.error)
      }
    } catch (error) {
      onError('Erro ao carregar veículos')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    
    // Aplicar formatação na placa
    if (name === 'placa') {
      // Preservar hífen se já existir, apenas converter para maiúsculo e remover espaços
      let placa = value.toUpperCase().replace(/\s+/g, '')
      
      // Validar se não excede o tamanho máximo
      if (placa.length <= 8) {
        setFormData(prev => ({ ...prev, placa }))
      }
      return
    }
    
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const url = '/api/veiculos'
      const method = editingVeiculo ? 'PUT' : 'POST'
      
      const payload = {
        ...formData,
        condominio_id: morador.condominio_id,
        unidade: morador.unidade,
        bloco: morador.bloco || '',
        master_id: morador.master_id,
        [morador.tipo === 'inquilino' ? 'inquilino_id' : 'morador_id']: morador._id,
        ...(editingVeiculo && { _id: editingVeiculo._id })
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (data.success) {
        onSuccess(editingVeiculo ? 'Veículo atualizado com sucesso!' : 'Veículo cadastrado com sucesso!')
        resetForm()
        setShowForm(false)
        fetchVeiculos()
      } else {
        onError(data.error)
      }
    } catch (error) {
      onError('Erro ao salvar veículo')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (veiculo: Veiculo) => {
    setEditingVeiculo(veiculo)
    setFormData({
      tipo: veiculo.tipo,
      placa: veiculo.placa,
      modelo: veiculo.modelo || '',
      cor: veiculo.cor || '',
      observacoes: veiculo.observacoes || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este veículo?')) return

    try {
      setLoading(true)
      const response = await fetch(`/api/veiculos?id=${id}&master_id=${morador.master_id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        onSuccess('Veículo excluído com sucesso!')
        fetchVeiculos()
      } else {
        onError(data.error)
      }
    } catch (error) {
      onError('Erro ao excluir veículo')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      tipo: 'carro',
      placa: '',
      modelo: '',
      cor: '',
      observacoes: ''
    })
    setEditingVeiculo(null)
  }

  const handleNewVeiculo = () => {
    resetForm()
    setShowForm(true)
  }

  const getTipoBadge = (tipo: string) => {
    const colors = {
      carro: 'primary',
      moto: 'warning',
      bicicleta: 'success',
      outro: 'secondary'
    }
    const icons = {
      carro: '🚗',
      moto: '🏍️',
      bicicleta: '🚲',
      outro: '🚙'
    }
    return (
      <Badge bg={colors[tipo as keyof typeof colors]}>
        {icons[tipo as keyof typeof icons]} {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
      </Badge>
    )
  }

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>
          🚗 Gerenciar Veículos - {morador?.nome}
        </Modal.Title>
      </Modal.Header>
      
      {!showForm ? (
        <>
          <Modal.Body>
            <Alert variant="info" className="mb-3">
              <strong>📋 Informações:</strong><br/>
              • Cada morador/inquilino pode ter múltiplos veículos<br/>
              • Suporte a formatos de placa antigo (ABC-1234) e novo (ABC1D23)<br/>
              • Placa deve ser única no sistema
            </Alert>

            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="mb-0">Lista de Veículos ({veiculos.length})</h6>
              <Button 
                variant="primary" 
                size="sm"
                onClick={handleNewVeiculo}
                disabled={loading}
              >
                Novo Veículo
              </Button>
            </div>
            
            {loading ? (
              <div className="text-center p-4">
                <div className="spinner-border" role="status">
                  <span className="visually-hidden">Carregando...</span>
                </div>
              </div>
            ) : veiculos.length === 0 ? (
              <Alert variant="secondary" className="text-center">
                <h6>📋 Nenhum veículo cadastrado</h6>
                <p className="mb-0">Clique em "Novo Veículo" para adicionar</p>
              </Alert>
            ) : (
              <div className="table-responsive">
                <Table hover size="sm">
                  <thead className="table-light">
                    <tr>
                      <th>Tipo</th>
                      <th>Placa</th>
                      <th>Modelo</th>
                      <th>Cor</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {veiculos.map((veiculo) => (
                      <tr key={veiculo._id}>
                        <td>{getTipoBadge(veiculo.tipo)}</td>
                        <td className="fw-semibold">{veiculo.placa}</td>
                        <td>{veiculo.modelo || 'N/A'}</td>
                        <td>{veiculo.cor || 'N/A'}</td>
                        <td>
                          <Badge bg={veiculo.ativo ? 'success' : 'secondary'}>
                            {veiculo.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </td>
                        <td>
                          <div className="btn-group btn-group-sm">
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => handleEdit(veiculo)}
                              title="Editar"
                            >
                              ✏️
                            </Button>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => handleDelete(veiculo._id)}
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
                    <Form.Label>Tipo de Veículo *</Form.Label>
                    <Form.Select
                      name="tipo"
                      value={formData.tipo}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="carro">🚗 Carro</option>
                      <option value="moto">🏍️ Moto</option>
                      <option value="bicicleta">🚲 Bicicleta</option>
                      <option value="outro">🚙 Outro</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Placa *</Form.Label>
                    <Form.Control
                      type="text"
                      name="placa"
                      value={formData.placa}
                      onChange={handleInputChange}
                      required
                      placeholder="ABC-1234 ou ABC1D23"
                      maxLength={9}
                    />
                    <Form.Text className="text-muted">
                      Formato antigo (ABC-1234) ou novo (ABC1D23)
                    </Form.Text>
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Modelo</Form.Label>
                    <Form.Control
                      type="text"
                      name="modelo"
                      value={formData.modelo}
                      onChange={handleInputChange}
                      placeholder="Ex: Honda Civic, Yamaha Fazer"
                      maxLength={50}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Cor</Form.Label>
                    <Form.Control
                      type="text"
                      name="cor"
                      value={formData.cor}
                      onChange={handleInputChange}
                      placeholder="Ex: Branco, Preto, Azul"
                      maxLength={20}
                    />
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
                  placeholder="Informações adicionais sobre o veículo..."
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
                {loading ? 'Salvando...' : (editingVeiculo ? 'Atualizar' : 'Cadastrar')}
              </Button>
            </Modal.Footer>
          </Form>
        </>
      )}
    </Modal>
  )
}