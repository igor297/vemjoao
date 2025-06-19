import { IConfiguracaoFinanceira } from '@/models/ConfiguracaoFinanceira'
import { MercadoPagoService, BoletoData as MPBoletoData, PixData as MPPixData, CartaoData as MPCartaoData } from './mercado-pago'
import { StoneService, StoneBoletoData, StonePixData, StoneCartaoData } from './stone'
import { PagSeguroService, PagSeguroBoletoData, PagSeguroPixData, PagSeguroCartaoData } from './pagseguro'

export type PaymentProvider = 'mercado_pago' | 'stone' | 'pagseguro'
export type PaymentMethod = 'boleto' | 'pix' | 'cartao_debito' | 'cartao_credito'

export interface UnifiedBoletoData {
  valor: number
  vencimento: Date
  descricao: string
  referencia: string
  pagador: {
    nome: string
    documento: string
    email: string
    telefone?: string
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

export interface UnifiedPixData {
  valor: number
  descricao: string
  referencia: string
  expiracao_minutos?: number
  pagador: {
    nome: string
    documento: string
    email: string
  }
}

export interface UnifiedCartaoData {
  valor: number
  descricao: string
  referencia: string
  parcelas: number
  pagador: {
    nome: string
    documento: string
    email: string
    telefone?: string
    endereco?: {
      logradouro: string
      numero: string
      bairro: string
      cidade: string
      uf: string
      cep: string
    }
  }
  cartao: {
    numero?: string
    cvv?: string
    validade_mes?: string
    validade_ano?: string
    nome_portador?: string
    token?: string
    hash?: string
  }
}

export interface UnifiedPaymentResponse {
  success: boolean
  provider: PaymentProvider
  payment_id?: string
  transaction_id?: string
  qr_code?: string
  qr_code_base64?: string
  boleto_url?: string
  linha_digitavel?: string
  link_pagamento?: string
  status?: string
  error?: string
  taxa_aplicada?: number
  valor_original: number
  valor_final?: number
  metodo_pagamento: PaymentMethod
}

export interface PaymentStatusResponse {
  success: boolean
  status: string
  valor: number
  data_criacao: string
  data_aprovacao?: string
  provider: PaymentProvider
  error?: string
}

export class PaymentManager {
  private configuracao: IConfiguracaoFinanceira
  private mercadoPago?: MercadoPagoService
  private stone?: StoneService
  private pagseguro?: PagSeguroService

  constructor(configuracao: IConfiguracaoFinanceira) {
    this.configuracao = configuracao
    this.initializeServices()
  }

  private initializeServices() {
    if (this.configuracao.mercado_pago.ativo) {
      this.mercadoPago = new MercadoPagoService(this.configuracao)
    }
    
    if (this.configuracao.stone.ativo) {
      this.stone = new StoneService(this.configuracao)
    }
    
    if (this.configuracao.pagseguro.ativo) {
      this.pagseguro = new PagSeguroService(this.configuracao)
    }
  }

  getActiveProviders(): PaymentProvider[] {
    const providers: PaymentProvider[] = []
    
    if (this.configuracao.mercado_pago.ativo && this.mercadoPago?.isConfigured()) {
      providers.push('mercado_pago')
    }
    
    if (this.configuracao.stone.ativo && this.stone?.isConfigured()) {
      providers.push('stone')
    }
    
    if (this.configuracao.pagseguro.ativo && this.pagseguro?.isConfigured()) {
      providers.push('pagseguro')
    }
    
    return providers
  }

  isMethodAvailable(provider: PaymentProvider, method: PaymentMethod): boolean {
    const activeProviders = this.getActiveProviders()
    return activeProviders.includes(provider)
  }

  getTaxasPorProvider(provider: PaymentProvider) {
    switch (provider) {
      case 'mercado_pago':
        return this.mercadoPago?.getTaxas()
      case 'stone':
        return this.stone?.getTaxas()
      case 'pagseguro':
        return this.pagseguro?.getTaxas()
      default:
        return null
    }
  }

  calcularMelhorProvider(valor: number, metodo: PaymentMethod): { provider: PaymentProvider, taxaAplicada: number, valorFinal: number } | null {
    const activeProviders = this.getActiveProviders()
    let melhorOpcao: { provider: PaymentProvider, taxaAplicada: number, valorFinal: number } | null = null
    
    for (const provider of activeProviders) {
      const taxas = this.getTaxasPorProvider(provider)
      if (!taxas) continue
      
      const configProvider = this.configuracao[provider]
      const taxaConfig = taxas[metodo] || 0
      
      let taxaAplicada: number
      if (configProvider.tipo_taxa === 'percentual') {
        taxaAplicada = valor * (taxaConfig / 100)
      } else {
        taxaAplicada = taxaConfig
      }
      
      const valorFinal = valor + taxaAplicada
      
      if (!melhorOpcao || valorFinal < melhorOpcao.valorFinal) {
        melhorOpcao = { provider, taxaAplicada, valorFinal }
      }
    }
    
    return melhorOpcao
  }

  async gerarBoleto(data: UnifiedBoletoData, provider?: PaymentProvider): Promise<UnifiedPaymentResponse> {
    try {
      // Se não especificado, escolhe o melhor provider
      const selectedProvider = provider || this.calcularMelhorProvider(data.valor, 'boleto')?.provider
      
      if (!selectedProvider) {
        return {
          success: false,
          error: 'Nenhum provedor disponível para boleto',
          provider: 'mercado_pago',
          valor_original: data.valor,
          metodo_pagamento: 'boleto'
        }
      }

      let result: any

      switch (selectedProvider) {
        case 'mercado_pago':
          if (!this.mercadoPago) throw new Error('Mercado Pago não inicializado')
          
          const mpData: MPBoletoData = {
            valor: data.valor,
            vencimento: data.vencimento,
            descricao: data.descricao,
            pagador: data.pagador,
            beneficiario: data.beneficiario,
            instrucoes: data.instrucoes
          }
          result = await this.mercadoPago.gerarBoleto(mpData)
          break

        case 'stone':
          if (!this.stone) throw new Error('Stone não inicializado')
          
          const stoneData: StoneBoletoData = {
            valor: data.valor,
            vencimento: data.vencimento,
            descricao: data.descricao,
            pagador: data.pagador,
            beneficiario: {
              ...data.beneficiario,
              conta_banco: '12345',
              agencia: '1234'
            },
            instrucoes: data.instrucoes
          }
          result = await this.stone.gerarBoleto(stoneData)
          break

        case 'pagseguro':
          if (!this.pagseguro) throw new Error('PagSeguro não inicializado')
          
          const psData: PagSeguroBoletoData = {
            valor: data.valor,
            vencimento: data.vencimento,
            descricao: data.descricao,
            pagador: {
              ...data.pagador,
              telefone: data.pagador.telefone || '11999999999'
            },
            instrucoes: data.instrucoes
          }
          result = await this.pagseguro.gerarBoleto(psData)
          break

        default:
          throw new Error('Provider não suportado')
      }

      return {
        ...result,
        provider: selectedProvider,
        valor_original: data.valor,
        metodo_pagamento: 'boleto'
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        provider: provider || 'mercado_pago',
        valor_original: data.valor,
        metodo_pagamento: 'boleto'
      }
    }
  }

  async gerarPix(data: UnifiedPixData, provider?: PaymentProvider): Promise<UnifiedPaymentResponse> {
    try {
      const selectedProvider = provider || this.calcularMelhorProvider(data.valor, 'pix')?.provider
      
      if (!selectedProvider) {
        return {
          success: false,
          error: 'Nenhum provedor disponível para PIX',
          provider: 'mercado_pago',
          valor_original: data.valor,
          metodo_pagamento: 'pix'
        }
      }

      let result: any

      switch (selectedProvider) {
        case 'mercado_pago':
          if (!this.mercadoPago) throw new Error('Mercado Pago não inicializado')
          
          const mpData: MPPixData = {
            valor: data.valor,
            descricao: data.descricao,
            chave_pix: 'auto',
            expiracao_minutos: data.expiracao_minutos,
            pagador: data.pagador
          }
          result = await this.mercadoPago.gerarPix(mpData)
          break

        case 'stone':
          if (!this.stone) throw new Error('Stone não inicializado')
          
          const stoneData: StonePixData = {
            valor: data.valor,
            descricao: data.descricao,
            chave_pix: 'auto',
            expiracao_minutos: data.expiracao_minutos,
            pagador: data.pagador
          }
          result = await this.stone.gerarPix(stoneData)
          break

        case 'pagseguro':
          if (!this.pagseguro) throw new Error('PagSeguro não inicializado')
          
          const psData: PagSeguroPixData = {
            valor: data.valor,
            descricao: data.descricao,
            expiracao_segundos: (data.expiracao_minutos || 60) * 60,
            pagador: data.pagador
          }
          result = await this.pagseguro.gerarPix(psData)
          break

        default:
          throw new Error('Provider não suportado')
      }

      return {
        ...result,
        provider: selectedProvider,
        valor_original: data.valor,
        metodo_pagamento: 'pix'
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        provider: provider || 'mercado_pago',
        valor_original: data.valor,
        metodo_pagamento: 'pix'
      }
    }
  }

  async processarCartao(data: UnifiedCartaoData, tipo: 'debito' | 'credito', provider?: PaymentProvider): Promise<UnifiedPaymentResponse> {
    try {
      const metodo = tipo === 'debito' ? 'cartao_debito' : 'cartao_credito'
      const selectedProvider = provider || this.calcularMelhorProvider(data.valor, metodo)?.provider
      
      if (!selectedProvider) {
        return {
          success: false,
          error: `Nenhum provedor disponível para cartão de ${tipo}`,
          provider: 'mercado_pago',
          valor_original: data.valor,
          metodo_pagamento: metodo
        }
      }

      let result: any

      switch (selectedProvider) {
        case 'mercado_pago':
          if (!this.mercadoPago) throw new Error('Mercado Pago não inicializado')
          
          const mpData: MPCartaoData = {
            valor: data.valor,
            descricao: data.descricao,
            token_cartao: data.cartao.token || '',
            parcelas: data.parcelas,
            pagador: data.pagador
          }
          result = await this.mercadoPago.processarCartao(mpData, tipo)
          break

        case 'stone':
          if (!this.stone) throw new Error('Stone não inicializado')
          
          const stoneData: StoneCartaoData = {
            valor: data.valor,
            descricao: data.descricao,
            numero_cartao: data.cartao.numero || '',
            cvv: data.cartao.cvv || '',
            validade_mes: data.cartao.validade_mes || '',
            validade_ano: data.cartao.validade_ano || '',
            nome_portador: data.cartao.nome_portador || data.pagador.nome,
            documento_portador: data.pagador.documento,
            parcelas: data.parcelas
          }
          result = await this.stone.processarCartao(stoneData, tipo)
          break

        case 'pagseguro':
          if (!this.pagseguro) throw new Error('PagSeguro não inicializado')
          
          const psData: PagSeguroCartaoData = {
            valor: data.valor,
            descricao: data.descricao,
            hash_cartao: data.cartao.hash || '',
            parcelas: data.parcelas,
            pagador: {
              ...data.pagador,
              telefone: data.pagador.telefone || '11999999999',
              endereco: data.pagador.endereco || {
                logradouro: '',
                numero: '',
                bairro: '',
                cidade: '',
                uf: '',
                cep: ''
              }
            }
          }
          result = await this.pagseguro.processarCartao(psData, tipo)
          break

        default:
          throw new Error('Provider não suportado')
      }

      return {
        ...result,
        provider: selectedProvider,
        valor_original: data.valor,
        metodo_pagamento: metodo
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        provider: provider || 'mercado_pago',
        valor_original: data.valor,
        metodo_pagamento: tipo === 'debito' ? 'cartao_debito' : 'cartao_credito'
      }
    }
  }

  async consultarStatus(paymentId: string, provider: PaymentProvider): Promise<PaymentStatusResponse> {
    try {
      let result: any

      switch (provider) {
        case 'mercado_pago':
          if (!this.mercadoPago) throw new Error('Mercado Pago não inicializado')
          result = await this.mercadoPago.consultarPagamento(paymentId)
          break

        case 'stone':
          if (!this.stone) throw new Error('Stone não inicializado')
          result = await this.stone.consultarTransacao(paymentId)
          break

        case 'pagseguro':
          if (!this.pagseguro) throw new Error('PagSeguro não inicializado')
          result = await this.pagseguro.consultarTransacao(paymentId)
          break

        default:
          throw new Error('Provider não suportado')
      }

      return {
        ...result,
        provider
      }

    } catch (error) {
      return {
        success: false,
        status: 'error',
        valor: 0,
        data_criacao: '',
        provider,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }
    }
  }

  async estornarPagamento(paymentId: string, provider: PaymentProvider, valor?: number) {
    try {
      let result: any

      switch (provider) {
        case 'mercado_pago':
          if (!this.mercadoPago) throw new Error('Mercado Pago não inicializado')
          result = await this.mercadoPago.estornarPagamento(paymentId)
          break

        case 'stone':
          if (!this.stone) throw new Error('Stone não inicializado')
          result = await this.stone.estornarTransacao(paymentId, valor)
          break

        case 'pagseguro':
          if (!this.pagseguro) throw new Error('PagSeguro não inicializado')
          result = await this.pagseguro.estornarTransacao(paymentId)
          break

        default:
          throw new Error('Provider não suportado')
      }

      return {
        ...result,
        provider
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        provider
      }
    }
  }

  getResumoConfiguracao() {
    const activeProviders = this.getActiveProviders()
    const resumo = {
      cobranca_automatica_ativa: this.configuracao.cobranca_automatica_ativa,
      providers_ativos: activeProviders.length,
      providers_disponiveis: activeProviders,
      configuracoes_gerais: this.configuracao.configuracoes_gerais,
      taxas_por_provider: {} as any
    }

    activeProviders.forEach(provider => {
      resumo.taxas_por_provider[provider] = this.getTaxasPorProvider(provider)
    })

    return resumo
  }
}