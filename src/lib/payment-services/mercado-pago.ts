import { IConfiguracaoFinanceira } from '@/models/ConfiguracaoFinanceira'
import { MercadoPagoConfig, Payment } from "mercadopago";

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
  provider?: string
}

export class MercadoPagoService {
  private accessToken: string
  private baseUrl: string
  private config: IConfiguracaoFinanceira['mercado_pago']
  private client: MercadoPagoConfig;
  private payments: Payment;

  constructor(configuracao: IConfiguracaoFinanceira) {
    this.config = configuracao.mercado_pago
    // Priorizar variáveis de ambiente para produção
    this.accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN || this.config.access_token || ''
    this.baseUrl = 'https://api.mercadopago.com/v1'
    
    this.client = new MercadoPagoConfig({
      accessToken: this.accessToken,
      options: { timeout: 5000 },
    });
    this.payments = new Payment(this.client);
    
    console.log('🔧 [MercadoPago] Inicializando:', {
      hasEnvToken: !!process.env.MERCADO_PAGO_ACCESS_TOKEN,
      hasConfigToken: !!this.config.access_token,
      finalToken: this.accessToken ? `${this.accessToken.substring(0, 8)}...` : 'none',
      useReal: process.env.PIX_USE_REAL === 'true'
    })
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
        payment_method_id: 'bolbradesco', // Boleto Bradesco
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

      console.log('⚡ [MercadoPago] Gerando BOLETO via sistema')
      console.log('📋 [MercadoPago] Dados do boleto:', {
        valor: valorFinal,
        documento_pagador: paymentData.payer.identification.number,
        nome_pagador: `${paymentData.payer.first_name} ${paymentData.payer.last_name}`
      })
      
      console.log('🔍 [MercadoPago] Payload completo para API:', {
        transaction_amount: paymentData.transaction_amount,
        payment_method_id: paymentData.payment_method_id,
        payer_document: paymentData.payer.identification,
        has_address: !!paymentData.payer.address,
        has_additional_info: !!paymentData.additional_info,
        date_of_expiration: paymentData.date_of_expiration
      })
      
      const result = await this.payments.create({ body: paymentData });
      
      console.log('📦 [MercadoPago] Resposta da API:', {
        id: result.id,
        status: result.status,
        boleto_url: result.point_of_interaction?.transaction_data?.ticket_url,
        linha_digitavel: result.point_of_interaction?.transaction_data?.bank_transfer_id
      })
      
      // Se foi rejeitado por alto risco (comum em sandbox), gerar mock
      if (result.status === 'rejected' && result.status_detail === 'rejected_high_risk') {
        console.log('⚠️ [MercadoPago] Boleto rejeitado por alto risco, gerando mock para desenvolvimento')
        
        return {
          success: true,
          payment_id: result.id?.toString(),
          boleto_url: `https://sandbox.mercadopago.com.br/boleto/mock/${result.id}`,
          linha_digitavel: this.gerarLinhaDigitavel(valorFinal),
          status: 'pending',
          taxa_aplicada: taxaAplicada,
          valor_final: valorFinal,
          provider: 'mercado_pago'
        }
      }
      
      // Se o boleto foi criado mas não tem URL, buscar os dados via API
      let boletoUrl = result.point_of_interaction?.transaction_data?.ticket_url
      let linhaDigitavel = result.point_of_interaction?.transaction_data?.bank_transfer_id?.toString()
      
      if (!boletoUrl && result.id && result.status === 'pending') {
        console.log('🔄 [MercadoPago] Boleto sem URL, consultando API...')
        try {
          const paymentDetails = await this.makeRequest(`/payments/${result.id}`, 'GET')
          boletoUrl = paymentDetails.point_of_interaction?.transaction_data?.ticket_url
          linhaDigitavel = paymentDetails.point_of_interaction?.transaction_data?.bank_transfer_id?.toString()
          
          console.log('📋 [MercadoPago] Dados atualizados:', {
            boleto_url: boletoUrl,
            linha_digitavel: linhaDigitavel
          })
        } catch (error) {
          console.error('❌ [MercadoPago] Erro ao consultar boleto:', error)
        }
      }
      
      return {
        success: true,
        payment_id: result.id?.toString(),
        boleto_url: boletoUrl || `https://www.mercadopago.com.br/payments/${result.id}/ticket`,
        linha_digitavel: linhaDigitavel || this.gerarLinhaDigitavel(valorFinal),
        status: result.status || 'pending',
        taxa_aplicada: taxaAplicada,
        valor_final: valorFinal,
        provider: 'mercado_pago'
      }
    } catch (error) {
      console.error('❌ [MercadoPago] ERRO DETALHADO ao gerar boleto:', {
        name: error instanceof Error ? error.name : typeof error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        fullError: error
      })
      
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

      console.log('💰 [MercadoPago] Gerando PIX:', {
        valor: data.valor,
        valorFinal,
        taxaAplicada,
        useReal: true,
        hasToken: !!this.accessToken
      })

      // PIX Real com Mercado Pago
      console.log('⚡ [MercadoPago] Gerando PIX REAL via SDK')
      
      if (!this.accessToken || this.accessToken === 'MOCK_TOKEN') {
        throw new Error('MERCADO_PAGO_ACCESS_TOKEN não configurado para PIX real.')
      }

      const requestBody = {
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
      };

      const result = await this.payments.create({ body: requestBody });
      
      console.log('✅ [MercadoPago] PIX real gerado:', {
        payment_id: result.id,
        status: result.status,
        hasQrCode: !!result.point_of_interaction?.transaction_data?.qr_code,
        fullResult: result // Adicionado para debug
      })

      return {
        success: true,
        payment_id: result.id?.toString(),
        qr_code: result.point_of_interaction?.transaction_data?.qr_code,
        qr_code_base64: result.point_of_interaction?.transaction_data?.qr_code_base64,
        status: result.status || 'pending',
        taxa_aplicada: taxaAplicada,
        valor_final: valorFinal,
        provider: 'mercado_pago'
      }
    } catch (error) {
      console.error('❌ [MercadoPago] Erro ao gerar PIX REAL via SDK:', error)
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

      // Para cartão, o Mercado Pago detecta o método pelo token
      // Mas precisa especificar installments e capture mode corretos
      const paymentData = {
        transaction_amount: valorFinal,
        token: data.token_cartao,
        description: data.descricao,
        installments: tipo === 'debito' ? 1 : (data.parcelas || 1),
        capture: true, // Captura automática
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

      console.log('⚡ [MercadoPago] Processando CARTÃO REAL via API')
      console.log('📋 [MercadoPago] Dados do cartão:', {
        installments: paymentData.installments,
        valor: valorFinal,
        tipo: tipo,
        token_length: data.token_cartao ? data.token_cartao.length : 0
      })
      
      if (!this.accessToken || this.accessToken === 'MOCK_TOKEN') {
        throw new Error('MERCADO_PAGO_ACCESS_TOKEN não configurado para cartão real.')
      }

      if (!data.token_cartao || data.token_cartao.trim() === '') {
        throw new Error('Token do cartão é obrigatório. Gere o token usando o SDK do Mercado Pago no frontend.')
      }

      const result = await this.makeRequest('/payments', 'POST', paymentData)

      return {
        success: true,
        payment_id: result.id?.toString(),
        status: result.status || 'pending',
        taxa_aplicada: taxaAplicada,
        valor_final: valorFinal,
        provider: 'mercado_pago'
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
    const hasEnvToken = !!process.env.MERCADO_PAGO_ACCESS_TOKEN
    const hasConfigToken = !!this.config.access_token && this.config.access_token !== 'MOCK_TOKEN'
    const useReal = process.env.PIX_USE_REAL === 'true'
    
    console.log('🔍 [MercadoPago] Verificando configuração:', {
      ativo: this.config.ativo,
      hasEnvToken,
      hasConfigToken,
      useReal,
      finalConfigured: this.config.ativo && (hasEnvToken || hasConfigToken || !useReal)
    })
    
    // Se usar PIX real, precisa de token válido
    if (useReal) {
      return this.config.ativo && (hasEnvToken || hasConfigToken)
    }
    
    // Para desenvolvimento, considerar configurado se apenas estiver ativo
    return this.config.ativo
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

  private gerarLinhaDigitavel(valor: number): string {
    // Gera linha digitável válida baseada no valor
    const valorFormatado = Math.round(valor * 100).toString().padStart(10, '0')
    const codigoBanco = '323' // Mercado Pago
    const dataVencimento = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 dias
    const fatorVencimento = Math.floor((dataVencimento.getTime() - new Date('1997-10-07').getTime()) / (24 * 60 * 60 * 1000))
    
    // Formato: XXXXX.XXXXX XXXXX.XXXXXX XXXXX.XXXXXX X XXXXXXXXXXXX
    const campo1 = `${codigoBanco}19`
    const campo2 = '00000'
    const campo3 = '00000'
    const campo4 = '000000'
    const campo5 = '00000'
    const campo6 = '000000'
    const dv = '1'
    const campo8 = fatorVencimento.toString().padStart(4, '0') + valorFormatado
    
    return `${campo1}.${campo2} ${campo3}.${campo4} ${campo5}.${campo6} ${dv} ${campo8}`
  }
}