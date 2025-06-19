import { IConfiguracaoFinanceira } from '@/models/ConfiguracaoFinanceira'

export interface BoletoData {
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
  }
  instrucoes: string[]
}

export interface PixData {
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

export interface CartaoData {
  valor: number
  descricao: string
  token_cartao: string
  parcelas: number
  pagador: {
    nome: string
    documento: string
    email: string
  }
}

export interface PaymentResponse {
  success: boolean
  payment_id?: string
  qr_code?: string
  qr_code_base64?: string
  boleto_url?: string
  linha_digitavel?: string
  status?: string
  error?: string
  taxa_aplicada?: number
  valor_final?: number
}

export class MercadoPagoService {
  private accessToken: string
  private baseUrl: string
  private config: IConfiguracaoFinanceira['mercado_pago']

  constructor(configuracao: IConfiguracaoFinanceira) {
    this.config = configuracao.mercado_pago
    this.accessToken = this.config.access_token || ''
    this.baseUrl = 'https://api.mercadopago.com/v1'
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
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `${Date.now()}-${Math.random()}`
        },
        body: data ? JSON.stringify(data) : undefined
      })

      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.message || 'Erro na API do Mercado Pago')
      }

      return result
    } catch (error) {
      console.error('Erro Mercado Pago:', error)
      throw error
    }
  }

  async gerarBoleto(data: BoletoData): Promise<PaymentResponse> {
    try {
      if (!this.config.ativo) {
        throw new Error('Mercado Pago não está ativo')
      }

      const { valorFinal, taxaAplicada } = this.calcularValorFinal(data.valor, 'boleto')

      const paymentData = {
        transaction_amount: valorFinal,
        description: data.descricao,
        payment_method_id: 'bolbradesco',
        date_of_expiration: data.vencimento.toISOString(),
        payer: {
          first_name: data.pagador.nome.split(' ')[0],
          last_name: data.pagador.nome.split(' ').slice(1).join(' '),
          email: data.pagador.email,
          identification: {
            type: data.pagador.documento.length === 11 ? 'CPF' : 'CNPJ',
            number: data.pagador.documento.replace(/\D/g, '')
          },
          address: {
            street_name: data.pagador.endereco.logradouro,
            street_number: data.pagador.endereco.numero,
            neighborhood: data.pagador.endereco.bairro,
            city: data.pagador.endereco.cidade,
            federal_unit: data.pagador.endereco.uf,
            zip_code: data.pagador.endereco.cep.replace(/\D/g, '')
          }
        },
        additional_info: {
          items: [
            {
              id: 'condominio',
              title: data.descricao,
              description: data.instrucoes.join(' '),
              quantity: 1,
              unit_price: valorFinal
            }
          ]
        }
      }

      const result = await this.makeRequest('/payments', 'POST', paymentData)

      return {
        success: true,
        payment_id: result.id,
        boleto_url: result.transaction_details?.external_resource_url,
        linha_digitavel: result.barcode?.content,
        status: result.status,
        taxa_aplicada: taxaAplicada,
        valor_final: valorFinal
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido ao gerar boleto'
      }
    }
  }

  async gerarPix(data: PixData): Promise<PaymentResponse> {
    try {
      if (!this.config.ativo) {
        throw new Error('Mercado Pago não está ativo')
      }

      const { valorFinal, taxaAplicada } = this.calcularValorFinal(data.valor, 'pix')

      const paymentData = {
        transaction_amount: valorFinal,
        description: data.descricao,
        payment_method_id: 'pix',
        date_of_expiration: new Date(Date.now() + (data.expiracao_minutos || 60) * 60 * 1000).toISOString(),
        payer: {
          first_name: data.pagador.nome.split(' ')[0],
          last_name: data.pagador.nome.split(' ').slice(1).join(' '),
          email: data.pagador.email,
          identification: {
            type: data.pagador.documento.length === 11 ? 'CPF' : 'CNPJ',
            number: data.pagador.documento.replace(/\D/g, '')
          }
        }
      }

      const result = await this.makeRequest('/payments', 'POST', paymentData)

      return {
        success: true,
        payment_id: result.id,
        qr_code: result.point_of_interaction?.transaction_data?.qr_code,
        qr_code_base64: result.point_of_interaction?.transaction_data?.qr_code_base64,
        status: result.status,
        taxa_aplicada: taxaAplicada,
        valor_final: valorFinal
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido ao gerar PIX'
      }
    }
  }

  async processarCartao(data: CartaoData, tipo: 'debito' | 'credito'): Promise<PaymentResponse> {
    try {
      if (!this.config.ativo) {
        throw new Error('Mercado Pago não está ativo')
      }

      const metodo = tipo === 'debito' ? 'cartao_debito' : 'cartao_credito'
      const { valorFinal, taxaAplicada } = this.calcularValorFinal(data.valor, metodo)

      const paymentData = {
        transaction_amount: valorFinal,
        token: data.token_cartao,
        description: data.descricao,
        installments: data.parcelas,
        payment_method_id: tipo === 'debito' ? 'master' : 'master',
        payer: {
          first_name: data.pagador.nome.split(' ')[0],
          last_name: data.pagador.nome.split(' ').slice(1).join(' '),
          email: data.pagador.email,
          identification: {
            type: data.pagador.documento.length === 11 ? 'CPF' : 'CNPJ',
            number: data.pagador.documento.replace(/\D/g, '')
          }
        }
      }

      const result = await this.makeRequest('/payments', 'POST', paymentData)

      return {
        success: true,
        payment_id: result.id,
        status: result.status,
        taxa_aplicada: taxaAplicada,
        valor_final: valorFinal
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido ao processar cartão'
      }
    }
  }

  async consultarPagamento(paymentId: string) {
    try {
      const result = await this.makeRequest(`/payments/${paymentId}`, 'GET')
      return {
        success: true,
        status: result.status,
        status_detail: result.status_detail,
        valor: result.transaction_amount,
        data_criacao: result.date_created,
        data_aprovacao: result.date_approved
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao consultar pagamento'
      }
    }
  }

  async estornarPagamento(paymentId: string) {
    try {
      const result = await this.makeRequest(`/payments/${paymentId}/refunds`, 'POST')
      return {
        success: true,
        refund_id: result.id,
        status: result.status
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao estornar pagamento'
      }
    }
  }

  isConfigured(): boolean {
    return this.config.ativo && !!this.config.access_token && !!this.config.public_key
  }

  getPublicKey(): string {
    return this.config.public_key || ''
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
}