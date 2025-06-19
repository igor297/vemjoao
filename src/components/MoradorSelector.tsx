'use client'

import { useState, useEffect } from 'react'
import { Modal, Form, Button, Table, Alert, Badge } from 'react-bootstrap'

interface Morador {
  _id: string
  nome: string
  cpf: string
  data_nasc: string
  celular1: string
  celular2?: string
  email: string
  tipo: 'proprietario' | 'inquilino' | 'dependente'
  unidade: string
  bloco?: string
  condominio_id: string
  condominio_nome: string
  master_id: string
  ativo: boolean
}

interface MoradorSelectorProps {
  show: boolean
  onHide: () => void
  onSelect: (morador: Morador) => void
  condominioId: string
  masterId: string
}

export default function MoradorSelector({ show, onHide, onSelect, condominioId, masterId }: MoradorSelectorProps) {
  const [moradores, setMoradores] = useState<Morador[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (show && condominioId && masterId) {
      fetchMoradores()
    }
  }, [show, condominioId, masterId])

  const fetchMoradores = async () => {
    try {
      setLoading(true)
      setError('')
      
      const response = await fetch(`/api/moradores?master_id=${masterId}&condominio_id=${condominioId}`)
      const data = await response.json()
      
      if (data.success) {
        // Filtrar apenas proprietários e inquilinos ativos
        const moradoresValidos = data.moradores.filter((m: Morador) => 
          (m.tipo === 'proprietario' || m.tipo === 'inquilino') && m.ativo
        )
        setMoradores(moradoresValidos)
      } else {
        setError(data.error || 'Erro ao carregar moradores')
      }
    } catch (error) {
      setError('Erro ao carregar moradores')
    } finally {
      setLoading(false)
    }
  }

  const filteredMoradores = moradores.filter(morador =>
    morador.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    morador.cpf.includes(searchTerm) ||
    morador.unidade.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (morador.bloco && morador.bloco.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const handleSelect = (morador: Morador) => {
    onSelect(morador)
    onHide()
  }

  const getTipoBadge = (tipo: string) => {
    return (
      <Badge bg={tipo === 'proprietario' ? 'primary' : 'warning'}>
        {tipo === 'proprietario' ? 'Proprietário' : 'Inquilino'}
      </Badge>
    )
  }

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>
          🔍 Selecionar Morador Interno
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Alert variant="info" className="mb-3">
          <strong>📋 Instruções:</strong><br/>
          • Selecione um morador/inquilino ativo do condomínio<br/>
          • Os dados serão preenchidos automaticamente<br/>
          • Apenas o tipo de administrador poderá ser alterado
        </Alert>

        <Form.Group className="mb-3">
          <Form.Label>🔍 Buscar Morador</Form.Label>
          <Form.Control
            type="text"
            placeholder="Digite nome, CPF, unidade ou bloco..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </Form.Group>

        {error && (
          <Alert variant="danger" className="mb-3">
            {error}
          </Alert>
        )}

        {loading ? (
          <div className="text-center p-4">
            <div className="spinner-border" role="status">
              <span className="visually-hidden">Carregando...</span>
            </div>
            <p className="mt-2 text-muted">Carregando moradores...</p>
          </div>
        ) : filteredMoradores.length === 0 ? (
          <Alert variant="secondary" className="text-center">
            <h6>📋 Nenhum morador encontrado</h6>
            <p className="mb-0">
              {searchTerm ? 'Nenhum morador corresponde à busca' : 'Nenhum morador ativo encontrado neste condomínio'}
            </p>
          </Alert>
        ) : (
          <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <Table hover size="sm">
              <thead className="table-light sticky-top">
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Unidade</th>
                  <th>CPF</th>
                  <th>Email</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {filteredMoradores.map((morador) => (
                  <tr key={morador._id}>
                    <td className="fw-semibold">{morador.nome}</td>
                    <td>{getTipoBadge(morador.tipo)}</td>
                    <td>
                      {morador.bloco ? `${morador.bloco} - ` : ''}{morador.unidade}
                    </td>
                    <td>
                      <code className="bg-light px-1 rounded">
                        {morador.cpf}
                      </code>
                    </td>
                    <td>{morador.email}</td>
                    <td>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleSelect(morador)}
                      >
                        Selecionar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}

        <div className="mt-3">
          <small className="text-muted">
            <strong>Total de moradores:</strong> {filteredMoradores.length}
            {searchTerm && ` (filtrados de ${moradores.length})`}
          </small>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cancelar
        </Button>
      </Modal.Footer>
    </Modal>
  )
}