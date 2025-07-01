'use client'

import { useState } from 'react'
import { Container, Button, Alert } from 'react-bootstrap'

export default function TestColaboradorAPI() {
  const [result, setResult] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const testAPI = async () => {
    setLoading(true)
    try {
      // Simular dados de usuário colaborador
      const testUser = {
        id: '674ede4f0c5c2b7efdbf85e6', // ID de exemplo
        master_id: '674ede4f0c5c2b7efdbf85e4',
        condominio_id: '674ede4f0c5c2b7efdbf85e5',
        tipo: 'colaborador'
      }

      const params = new URLSearchParams({
        master_id: testUser.master_id,
        condominio_id: testUser.condominio_id,
        usuario_id: testUser.id,
        tipo_usuario: testUser.tipo
      })

      const response = await fetch(`/api/financeiro-colaboradores?${params}`)
      const data = await response.json()
      
      setResult(JSON.stringify(data, null, 2))
    } catch (error) {
      setResult(`Erro: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container className="py-4">
      <h2>Teste API Financeiro Colaborador</h2>
      
      <Button 
        variant="primary" 
        onClick={testAPI}
        disabled={loading}
        className="mb-3"
      >
        {loading ? 'Testando...' : 'Testar API'}
      </Button>

      {result && (
        <Alert variant="info">
          <h6>Resultado da API:</h6>
          <pre style={{ fontSize: '12px', maxHeight: '400px', overflow: 'auto' }}>
            {result}
          </pre>
        </Alert>
      )}
    </Container>
  )
}