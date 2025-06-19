import { IConfiguracaoFinanceira } from '@/models/ConfiguracaoFinanceira'

export interface PagSeguroBoletoData {
  valor: number
  vencimento: Date
  descricao: string
  pagador: {
    nome: string
    documento: string
    email: string
    telefone: string
    endereco: {
      logradouro: string
      numero: string
      bairro: string
      cidade: string
      uf: string
      cep: string
    }
  }
  instrucoes: string[]
}

export interface PagSeguroPixData {
  valor: number
  descricao: string
  expiracao_segundos?: number
  pagador: {
    nome: string
    documento: string
    email: string
  }
}

export interface PagSeguroCartaoData {
  valor: number
  descricao: string
  hash_cartao: string
  parcelas: number
  pagador: {
    nome: string
    documento: string
    email: string
    telefone: string
    endereco: {
      logradouro: string
      numero: string
      bairro: string
      cidade: string
      uf: string
      cep: string
    }
  }
}

export interface PagSeguroResponse {
  success: boolean
  transaction_id?: string
  qr_code?: string
  boleto_url?: string
  linha_digitavel?: string
  status?: string
  error?: string
  taxa_aplicada?: number
  valor_final?: number
  link_pagamento?: string
}

export class PagSeguroService {
  private email: string
  private token: string
  private baseUrl: string
  private config: IConfiguracaoFinanceira['pagseguro']
  private sandbox: boolean = false

  constructor(configuracao: IConfiguracaoFinanceira) {
    this.config = configuracao.pagseguro
    this.email = this.config.email || ''
    this.token = this.config.token || ''
    this.baseUrl = this.sandbox 
      ? 'https://ws.sandbox.pagseguro.uol.com.br' 
      : 'https://ws.pagseguro.uol.com.br'
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

  private async makeRequest(endpoint: string, method: 'GET' | 'POST' | 'PUT' = 'POST', data?: any, contentType = 'application/json') {
    try {
      const url = `${this.baseUrl}${endpoint}`
      const headers: any = {
        'Accept': 'application/json'
      }

      let body: string | undefined

      if (contentType === 'application/x-www-form-urlencoded') {
        headers['Content-Type'] = 'application/x-www-form-urlencoded'
        if (data) {
          const params = new URLSearchParams()
          Object.keys(data).forEach(key => {
            if (typeof data[key] === 'object') {
              Object.keys(data[key]).forEach(subKey => {
                params.append(`${key}.${subKey}`, data[key][subKey])
              })
            } else {
              params.append(key, data[key])
            }
          })
          body = params.toString()
        }
      } else {
        headers['Content-Type'] = 'application/json'
        body = data ? JSON.stringify(data) : undefined
      }

      const response = await fetch(url, {
        method,
        headers,
        body
      })

      const result = await response.text()
      let jsonResult

      try {
        jsonResult = JSON.parse(result)
      } catch {
        // Se não conseguir fazer parse JSON, tenta XML para alguns endpoints do PagSeguro
        if (result.includes('<?xml')) {
          throw new Error('Resposta em XML - implementar parser se necessário')
        }
        throw new Error('Resposta inválida da API')
      }

      if (!response.ok) {
        throw new Error(jsonResult.message || jsonResult.error || 'Erro na API do PagSeguro')
      }

      return jsonResult
    } catch (error) {
      console.error('Erro PagSeguro:', error)
      throw error
    }
  }

  async gerarBoleto(data: PagSeguroBoletoData): Promise<PagSeguroResponse> {
    try {
      if (!this.config.ativo) {
        throw new Error('PagSeguro não está ativo')
      }

      const { valorFinal, taxaAplicada } = this.calcularValorFinal(data.valor, 'boleto')

      // PagSeguro usa formato específico para boletos
      const boletoData = {
        email: this.email,
        token: this.token,
        currency: 'BRL',
        itemId1: '0001',
        itemDescription1: data.descricao,
        itemAmount1: valorFinal.toFixed(2),
        itemQuantity1: '1',
        senderName: data.pagador.nome,
        senderEmail: data.pagador.email,
        senderPhone: data.pagador.telefone,
        senderDocument: data.pagador.documento.replace(/\D/g, ''),
        shippingAddressStreet: data.pagador.endereco.logradouro,
        shippingAddressNumber: data.pagador.endereco.numero,
        shippingAddressDistrict: data.pagador.endereco.bairro,
        shippingAddressCity: data.pagador.endereco.cidade,
        shippingAddressState: data.pagador.endereco.uf,
        shippingAddressPostalCode: data.pagador.endereco.cep.replace(/\D/g, ''),
        shippingAddressCountry: 'BRA',
        paymentMethod: 'boleto',
        extraAmount: '0.00',
        reference: `boleto-${Date.now()}`,
        timeout: 14400 // 4 horas em segundos
      }

      const result = await this.makeRequest('/v2/transactions', 'POST', boletoData, 'application/x-www-form-urlencoded')

      return {
        success: true,
        transaction_id: result.code,
        boleto_url: result.paymentLink,
        status: result.status,
        taxa_aplicada: taxaAplicada,
        valor_final: valorFinal
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido ao gerar boleto PagSeguro'
      }
    }
  }

  async gerarPix(data: PagSeguroPixData): Promise<PagSeguroResponse> {
    try {
      if (!this.config.ativo) {
        throw new Error('PagSeguro não está ativo')
      }

      const { valorFinal, taxaAplicada } = this.calcularValorFinal(data.valor, 'pix')

      // PagSeguro PIX usa API específica
      const pixData = {
        reference_id: `pix-${Date.now()}`,
        description: data.descricao,
        amount: {
          value: Math.round(valorFinal * 100), // centavos
          currency: 'BRL'
        },
        payment_method: {
          type: 'PIX'
        },
        customer: {
          name: data.pagador.nome,
          email: data.pagador.email,
          tax_id: data.pagador.documento.replace(/\D/g, '')
        },
        expiration_date: new Date(Date.now() + (data.expiracao_segundos || 3600) * 1000).toISOString()
      }

      const result = await this.makeRequest('/orders', 'POST', pixData)

      return {
        success: true,
        transaction_id: result.id,
        qr_code: result.qr_codes?.[0]?.text,
        link_pagamento: result.links?.find((l: any) => l.rel === 'SELF')?.href,
        status: result.status,
        taxa_aplicada: taxaAplicada,
        valor_final: valorFinal
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido ao gerar PIX PagSeguro'
      }
    }
  }

  async processarCartao(data: PagSeguroCartaoData, tipo: 'debito' | 'credito'): Promise<PagSeguroResponse> {
    try {
      if (!this.config.ativo) {
        throw new Error('PagSeguro não está ativo')
      }

      const metodo = tipo === 'debito' ? 'cartao_debito' : 'cartao_credito'
      const { valorFinal, taxaAplicada } = this.calcularValorFinal(data.valor, metodo)

      const cartaoData = {
        email: this.email,
        token: this.token,
        currency: 'BRL',
        itemId1: '0001',
        itemDescription1: data.descricao,
        itemAmount1: valorFinal.toFixed(2),
        itemQuantity1: '1',
        senderName: data.pagador.nome,
        senderEmail: data.pagador.email,
        senderPhone: data.pagador.telefone,
        senderDocument: data.pagador.documento.replace(/\D/g, ''),
        senderHash: data.hash_cartao,
        creditCardToken: data.hash_cartao,
        installmentQuantity: data.parcelas,
        installmentValue: (valorFinal / data.parcelas).toFixed(2),
        noInterestInstallmentQuantity: data.parcelas <= 3 ? data.parcelas : 3,
        billingAddressStreet: data.pagador.endereco.logradouro,
        billingAddressNumber: data.pagador.endereco.numero,
        billingAddressDistrict: data.pagador.endereco.bairro,
        billingAddressCity: data.pagador.endereco.cidade,
        billingAddressState: data.pagador.endereco.uf,
        billingAddressPostalCode: data.pagador.endereco.cep.replace(/\D/g, ''),
        billingAddressCountry: 'BRA',
        reference: `cartao-${Date.now()}`
      }

      const result = await this.makeRequest('/v2/transactions', 'POST', cartaoData, 'application/x-www-form-urlencoded')

      return {
        success: true,
        transaction_id: result.code,
        status: result.status,
        taxa_aplicada: taxaAplicada,
        valor_final: valorFinal
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido ao processar cartão PagSeguro'
      }
    }
  }

  async consultarTransacao(transactionId: string) {
    try {
      const result = await this.makeRequest(`/v3/transactions/${transactionId}?email=${this.email}&token=${this.token}`, 'GET')
      
      return {
        success: true,
        status: result.status,
        valor: parseFloat(result.grossAmount),
        data_criacao: result.date,
        data_aprovacao: result.lastEventDate,
        tipo_pagamento: result.paymentMethod?.type
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao consultar transação PagSeguro'
      }
    }
  }

  async estornarTransacao(transactionId: string) {
    try {
      const estornoData = {
        email: this.email,
        token: this.token
      }

      const result = await this.makeRequest(`/v2/transactions/refunds`, 'POST', estornoData, 'application/x-www-form-urlencoded')
      
      return {
        success: true,
        refund_id: result.transactionCode,
        status: result.status
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao estornar transação PagSeguro'
      }
    }
  }

  async obterSessao() {
    try {
      const result = await this.makeRequest(`/v2/sessions?email=${this.email}&token=${this.token}`, 'POST', null, 'application/x-www-form-urlencoded')
      return {
        success: true,
        session_id: result.id
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao obter sessão PagSeguro'
      }
    }
  }

  isConfigured(): boolean {
    return this.config.ativo && !!this.config.email && !!this.config.token
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
        min: 5.00,
        max: 100000.00
      },
      pix: {
        min: 0.01,
        max: 50000.00
      },
      cartao: {
        min: 1.00,
        max: 30000.00
      }
    }
  }

  getStatusMapeamento() {
    return {
      1: 'Aguardando pagamento',
      2: 'Em análise',
      3: 'Pago',
      4: 'Disponível',
      5: 'Em disputa',
      6: 'Devolvido',
      7: 'Cancelado'
    }
  }
}