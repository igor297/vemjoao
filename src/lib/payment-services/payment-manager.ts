import { IConfiguracaoFinanceira } from '@/models/ConfiguracaoFinanceira'
import { MercadoPagoService, PixData, BoletoData, CartaoData, PaymentResponse } from './mercado-pago'

export interface UnifiedPixData {
  condominio_id: string
  master_id: string
  valor: number
  descricao: string
  referencia: string
  chave_pix: string
  expiracao_minutos?: number
  pagador: {
    nome: string
    email: string
    telefone: string
    documento: string
    endereco: {
      cep: string
      logradouro: string
      numero: string
      bairro: string
      cidade: string
      uf: string
    }
  }
}

export interface UnifiedBoletoData {
  condominio_id: string
  master_id: string
  valor: number
  descricao: string
  referencia: string
  vencimento: Date
  pagador: {
    nome: string
    email: string
    telefone: string
    documento: string
    endereco: {
      cep: string
      logradouro: string
      numero: string
      bairro: string
      cidade: string
      uf: string
    }
  }
  beneficiario: {
    nome: string
    documento: string
  }
  instrucoes: string[]
}

export interface UnifiedCartaoData {
  condominio_id: string
  master_id: string
  valor: number
  descricao: string
  referencia: string
  token_cartao: string
  parcelas: number
  pagador: {
    nome: string
    email: string
    telefone: string
    documento: string
    endereco: {
      cep: string
      logradouro: string
      numero: string
      bairro: string
      cidade: string
      uf: string
    }
  }
}

export class PaymentManager {
  private mercadoPagoService: MercadoPagoService

  constructor(configuracao: IConfiguracaoFinanceira) {
    this.mercadoPagoService = new MercadoPagoService(configuracao)
  }

  async gerarPix(data: UnifiedPixData): Promise<PaymentResponse> {
    console.log('<� [PaymentManager] Gerando PIX')
    
    const pixData: PixData = {
      valor: data.valor,
      descricao: data.descricao,
      chave_pix: data.chave_pix,
      expiracao_minutos: data.expiracao_minutos || 30,
      pagador: {
        nome: data.pagador.nome,
        documento: data.pagador.documento,
        email: data.pagador.email
      }
    }

    return await this.mercadoPagoService.gerarPix(pixData)
  }

  async gerarBoleto(data: UnifiedBoletoData): Promise<PaymentResponse> {
    console.log('<� [PaymentManager] Gerando Boleto')
    
    const boletoData: BoletoData = {
      valor: data.valor,
      vencimento: data.vencimento,
      descricao: data.descricao,
      pagador: {
        nome: data.pagador.nome,
        documento: data.pagador.documento,
        email: data.pagador.email,
        endereco: {
          logradouro: data.pagador.endereco.logradouro,
          numero: data.pagador.endereco.numero,
          bairro: data.pagador.endereco.bairro,
          cidade: data.pagador.endereco.cidade,
          uf: data.pagador.endereco.uf,
          cep: data.pagador.endereco.cep
        }
      },
      beneficiario: data.beneficiario,
      instrucoes: data.instrucoes || [
        'Pagamento referente a taxas condominiais',
        'N�o aceitar pagamento em cheque',
        'N�o receber ap�s o vencimento'
      ]
    }

    return await this.mercadoPagoService.gerarBoleto(boletoData)
  }

  async processarCartao(data: UnifiedCartaoData, tipo: 'debito' | 'credito'): Promise<PaymentResponse> {
    console.log('<� [PaymentManager] Processando Cart�o:', tipo)
    
    const cartaoData: CartaoData = {
      valor: data.valor,
      descricao: data.descricao,
      token_cartao: data.token_cartao,
      parcelas: data.parcelas,
      pagador: {
        nome: data.pagador.nome,
        documento: data.pagador.documento,
        email: data.pagador.email
      }
    }

    return await this.mercadoPagoService.processarCartao(cartaoData, tipo)
  }

  async consultarPagamento(paymentId: string) {
    return await this.mercadoPagoService.consultarPagamento(paymentId)
  }

  async estornarPagamento(paymentId: string) {
    return await this.mercadoPagoService.estornarPagamento(paymentId)
  }

  isConfigured(): boolean {
    return this.mercadoPagoService.isConfigured()
  }

  getPublicKey(): string {
    return this.mercadoPagoService.getPublicKey()
  }

  getTaxas() {
    return this.mercadoPagoService.getTaxas()
  }
}