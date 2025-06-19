import { IConfiguracaoFinanceira } from '@/models/ConfiguracaoFinanceira'

export interface StoneBoletoData {
  valor: number
  vencimento: Date
  descricao: string
  pagador: {
    nome: string
    documento: string
    email: string
    endereco: {
      logradouro: string
      numero: string
      bairro: string
      cidade: string
      uf: string
      cep: string
    }
  }
  beneficiario: {
    nome: string
    documento: string
    conta_banco: string
    agencia: string
  }
  instrucoes: string[]
}

export interface StonePixData {
  valor: number
  descricao: string
  chave_pix: string
  expiracao_minutos?: number
  pagador: {
    nome: string
    documento: string
    email: string
  }
}

export interface StoneCartaoData {
  valor: number
  descricao: string
  numero_cartao: string
  cvv: string
  validade_mes: string
  validade_ano: string
  nome_portador: string
  documento_portador: string
  parcelas: number
}

export interface StonePaymentResponse {
  success: boolean
  transaction_id?: string
  qr_code?: string
  boleto_url?: string
  linha_digitavel?: string
  status?: string
  error?: string
  taxa_aplicada?: number
  valor_final?: number
  authorization_code?: string
}

export class StoneService {
  private apiKey: string
  private secretKey: string
  private baseUrl: string
  private config: IConfiguracaoFinanceira['stone']

  constructor(configuracao: IConfiguracaoFinanceira) {
    this.config = configuracao.stone
    this.apiKey = this.config.api_key || ''
    this.secretKey = this.config.secret_key || ''
    this.baseUrl = 'https://api.stone.com.br/v1'
  }

  private calcularTaxa(valor: number, metodo: 'boleto' | 'pix' | 'cartao_debito' | 'cartao_credito'): number {
    const taxaConfig = this.config[`taxa_${metodo}`] || 0
    
    if (this.config.tipo_taxa === 'percentual') {
      return valor * (taxaConfig / 100)
    } else {
      return taxaConfig
    }
  }

  private calcularValorFinal(valor: number, metodo: 'boleto' | 'pix' | 'cartao_debito' | 'cartao_credito'): { valorFinal: number, taxaAplicada: number } {
    const taxaAplicada = this.calcularTaxa(valor, metodo)
    return {
      valorFinal: valor + taxaAplicada,
      taxaAplicada
    }
  }

  private async makeRequest(endpoint: string, method: 'GET' | 'POST' | 'PUT' = 'POST', data?: any) {
    try {
      const auth = Buffer.from(`${this.apiKey}:${this.secretKey}`).toString('base64')
      
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: data ? JSON.stringify(data) : undefined
      })

      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.message || result.error || 'Erro na API da Stone')
      }

      return result
    } catch (error) {
      console.error('Erro Stone:', error)
      throw error
    }
  }

  async gerarBoleto(data: StoneBoletoData): Promise<StonePaymentResponse> {
    try {
      if (!this.config.ativo) {
        throw new Error('Stone não está ativo')
      }

      const { valorFinal, taxaAplicada } = this.calcularValorFinal(data.valor, 'boleto')

      const boletoData = {
        amount: Math.round(valorFinal * 100), // Stone usa centavos
        description: data.descricao,
        due_date: data.vencimento.toISOString().split('T')[0],
        customer: {
          name: data.pagador.nome,
          document: data.pagador.documento.replace(/\D/g, ''),
          email: data.pagador.email,
          address: {
            street: data.pagador.endereco.logradouro,
            number: data.pagador.endereco.numero,
            neighborhood: data.pagador.endereco.bairro,
            city: data.pagador.endereco.cidade,
            state: data.pagador.endereco.uf,
            zip_code: data.pagador.endereco.cep.replace(/\D/g, '')
          }
        },
        fine: {
          amount: 0,
          days: 1
        },
        interest: {
          amount: 0,
          days: 1
        },
        instructions: data.instrucoes
      }

      const result = await this.makeRequest('/boletos', 'POST', boletoData)

      return {
        success: true,
        transaction_id: result.id,
        boleto_url: result.url,
        linha_digitavel: result.barcode,
        status: result.status,
        taxa_aplicada: taxaAplicada,
        valor_final: valorFinal
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido ao gerar boleto Stone'
      }
    }
  }

  async gerarPix(data: StonePixData): Promise<StonePaymentResponse> {
    try {
      if (!this.config.ativo) {
        throw new Error('Stone não está ativo')
      }

      const { valorFinal, taxaAplicada } = this.calcularValorFinal(data.valor, 'pix')

      const pixData = {
        amount: Math.round(valorFinal * 100),
        description: data.descricao,
        expiration: data.expiracao_minutos || 60,
        customer: {
          name: data.pagador.nome,
          document: data.pagador.documento.replace(/\D/g, ''),
          email: data.pagador.email
        }
      }

      const result = await this.makeRequest('/pix/charges', 'POST', pixData)

      return {
        success: true,
        transaction_id: result.id,
        qr_code: result.qr_code,
        status: result.status,
        taxa_aplicada: taxaAplicada,
        valor_final: valorFinal
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido ao gerar PIX Stone'
      }
    }
  }

  async processarCartao(data: StoneCartaoData, tipo: 'debito' | 'credito'): Promise<StonePaymentResponse> {
    try {
      if (!this.config.ativo) {
        throw new Error('Stone não está ativo')
      }

      const metodo = tipo === 'debito' ? 'cartao_debito' : 'cartao_credito'
      const { valorFinal, taxaAplicada } = this.calcularValorFinal(data.valor, metodo)

      const cartaoData = {
        amount: Math.round(valorFinal * 100),
        description: data.descricao,
        installments: data.parcelas,
        capture: true,
        card: {
          number: data.numero_cartao.replace(/\s/g, ''),
          cvv: data.cvv,
          expiration_month: data.validade_mes,
          expiration_year: data.validade_ano,
          holder_name: data.nome_portador,
          holder_document: data.documento_portador.replace(/\D/g, '')
        }
      }

      const result = await this.makeRequest('/transactions', 'POST', cartaoData)

      return {
        success: true,
        transaction_id: result.id,
        status: result.status,
        authorization_code: result.authorization_code,
        taxa_aplicada: taxaAplicada,
        valor_final: valorFinal
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido ao processar cartão Stone'
      }
    }
  }

  async consultarTransacao(transactionId: string) {
    try {
      const result = await this.makeRequest(`/transactions/${transactionId}`, 'GET')
      return {
        success: true,
        status: result.status,
        valor: result.amount / 100,
        data_criacao: result.created_at,
        data_captura: result.captured_at
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao consultar transação Stone'
      }
    }
  }

  async consultarBoleto(boletoId: string) {
    try {
      const result = await this.makeRequest(`/boletos/${boletoId}`, 'GET')
      return {
        success: true,
        status: result.status,
        valor: result.amount / 100,
        vencimento: result.due_date,
        data_pagamento: result.paid_at
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao consultar boleto Stone'
      }
    }
  }

  async consultarPix(pixId: string) {
    try {
      const result = await this.makeRequest(`/pix/charges/${pixId}`, 'GET')
      return {
        success: true,
        status: result.status,
        valor: result.amount / 100,
        data_pagamento: result.paid_at
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao consultar PIX Stone'
      }
    }
  }

  async estornarTransacao(transactionId: string, valor?: number) {
    try {
      const estornoData = valor ? { amount: Math.round(valor * 100) } : {}
      const result = await this.makeRequest(`/transactions/${transactionId}/refunds`, 'POST', estornoData)
      
      return {
        success: true,
        refund_id: result.id,
        status: result.status,
        valor_estornado: result.amount / 100
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao estornar transação Stone'
      }
    }
  }

  isConfigured(): boolean {
    return this.config.ativo && !!this.config.api_key && !!this.config.secret_key
  }

  getTaxas() {
    return {
      boleto: this.config.taxa_boleto || 0,
      pix: this.config.taxa_pix || 0,
      cartao_debito: this.config.taxa_cartao_debito || 0,
      cartao_credito: this.config.taxa_cartao_credito || 0,
      tipo: this.config.tipo_taxa
    }
  }

  getLimites() {
    return {
      boleto: {
        min: 1.00,
        max: 100000.00
      },
      pix: {
        min: 0.01,
        max: 50000.00
      },
      cartao: {
        min: 0.50,
        max: 50000.00
      }
    }
  }
}