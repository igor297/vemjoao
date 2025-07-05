'use client'

import { useState } from 'react'

export default function TestPaymentPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [pendingTransactions, setPendingTransactions] = useState<any[]>([])

  const loadPendingTransactions = async () => {
    try {
      const response = await fetch('/api/simulate-payment-confirmation')
      const data = await response.json()
      setPendingTransactions(data.transacoes_pendentes || [])
    } catch (error) {
      console.error('Erro ao carregar transações:', error)
    }
  }

  const confirmPayment = async (paymentId: string = 'ultimo_pix_gerado') => {
    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch('/api/simulate-payment-confirmation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          payment_id: paymentId,
          status: 'approved'
        })
      })
      
      const data = await response.json()
      setResult(data)
      
      // Recarregar transações pendentes
      await loadPendingTransactions()
      
    } catch (error) {
      setResult({ error: 'Erro ao confirmar pagamento' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          🧪 Teste de Confirmação de Pagamento
        </h1>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Confirmar Último PIX</h2>
          <p className="text-gray-600 mb-4">
            Simula a confirmação do pagamento PIX mais recente que está pendente.
          </p>
          
          <button
            onClick={() => confirmPayment()}
            disabled={loading}
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Confirmando...' : '✅ Confirmar Pagamento'}
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Transações Pendentes</h2>
          
          <button
            onClick={loadPendingTransactions}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 mb-4"
          >
            🔄 Recarregar Lista
          </button>
          
          {pendingTransactions.length > 0 ? (
            <div className="space-y-3">
              {pendingTransactions.map((tx) => (
                <div key={tx.id_transacao} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">ID: {tx.id_transacao}</p>
                      <p className="text-sm text-gray-600">
                        Valor: R$ {tx.valor_final} | 
                        Data: {new Date(tx.data_processamento).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => confirmPayment(tx.payment_id)}
                      disabled={loading}
                      className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      Confirmar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">Nenhuma transação pendente encontrada.</p>
          )}
        </div>
        
        {result && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Resultado</h2>
            <pre className="bg-gray-100 p-4 rounded-lg overflow-auto text-sm">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}