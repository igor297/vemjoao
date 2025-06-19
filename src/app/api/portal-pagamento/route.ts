import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import ContaBancaria from '@/models/ContaBancaria'
import ConfiguracaoFinanceira from '@/models/ConfiguracaoFinanceira'
import Morador from '@/models/Morador'
import FinanceiroMorador from '@/models/FinanceiroMorador'
import mongoose from 'mongoose'
import { PaymentManager, UnifiedBoletoData, UnifiedPixData, UnifiedCartaoData } from '@/lib/payment-services/payment-manager'

export async function POST(request: NextRequest) {
  try {
    const { 
      financeiro_id, 
      morador_id, 
      condominio_id, 
      master_id,
      valor, 
      metodo_pagamento, 
      descricao,
      dados_cartao 
    } = await request.json()
    
    if (!financeiro_id || !morador_id || !condominio_id || !valor || !metodo_pagamento) {
      return NextResponse.json(
        { error: 'Dados obrigatórios não fornecidos' },
        { status: 400 }
      )
    }

    await connectDB()
    // Buscar dados do financeiro
    const financeiroItem = await FinanceiroMorador.findOne({ 
      _id: new mongoose.Types.ObjectId(financeiro_id),
      morador_id: new mongoose.Types.ObjectId(morador_id),
      status: { $in: ['pendente', 'atrasado'] }
    })
    
    if (!financeiroItem) {
      return NextResponse.json(
        { error: 'Item financeiro não encontrado ou já pago' },
        { status: 404 }
      )
    }
    
    // Buscar dados do morador
    const morador = await Morador.findOne({ 
      _id: new mongoose.Types.ObjectId(morador_id),
      ativo: true 
    })
    
    if (!morador) {
      return NextResponse.json(
        { error: 'Morador não encontrado' },
        { status: 404 }
      )
    }
    
    // Buscar configuração financeira
    const configuracao = await ConfiguracaoFinanceira.findOne({
      condominio_id: new mongoose.Types.ObjectId(condominio_id),
      master_id: new mongoose.Types.ObjectId(master_id || financeiroItem.master_id),
      ativo: true
    })
    
    if (!configuracao || !configuracao.cobranca_automatica_ativa) {
      return NextResponse.json(
        { error: 'Sistema de pagamentos não configurado' },
        { status: 400 }
      )
    }

    // Buscar conta bancária principal
    const contaPrincipal = await ContaBancaria.findOne({
      condominio_id: new mongoose.Types.ObjectId(condominio_id),
      master_id: new mongoose.Types.ObjectId(master_id || financeiroItem.master_id),
      conta_principal: true,
      ativa: true,
      ativo: true
    })

    const paymentManager = new PaymentManager(configuracao)
    let paymentResult: any
    
    // Dados do pagador
    const dadosPagador = {
      nome: morador.nome,
      email: morador.email || '',
      telefone: morador.telefone || '',
      documento: morador.cpf || morador.documento || '',
      endereco: {
        cep: morador.cep || '',
        logradouro: morador.endereco || '',
        numero: morador.apartamento || '',
        bairro: morador.bairro || '',
        cidade: morador.cidade || '',
        uf: morador.estado || ''
      }
    }

    // Dados comuns
    const dadosComuns = {
      condominio_id: condominio_id,
      master_id: master_id || financeiroItem.master_id,
      valor: valor,
      descricao: descricao || financeiroItem.descricao,
      referencia: financeiroItem.id_financeiro,
      pagador: dadosPagador
    }

    switch (metodo_pagamento) {
      case 'pix':
        const pixData: UnifiedPixData = {
          ...dadosComuns,
          chave_pix: contaPrincipal?.chave_pix || '',
          expiracao_minutos: 30
        }
        paymentResult = await paymentManager.gerarPix(pixData)
        break

      case 'boleto':
        const boletoData: UnifiedBoletoData = {
          ...dadosComuns,
          vencimento: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 dia
          instrucoes: 'Pagamento da taxa condominial',
          conta_bancaria: contaPrincipal ? {
            banco: contaPrincipal.codigo_banco,
            agencia: contaPrincipal.agencia,
            conta: contaPrincipal.numero_conta,
            digito: contaPrincipal.digito_conta
          } : undefined
        }
        paymentResult = await paymentManager.gerarBoleto(boletoData)
        break

      case 'cartao_credito':
      case 'cartao_debito':
        if (!dados_cartao) {
          return NextResponse.json(
            { error: 'Dados do cartão são obrigatórios' },
            { status: 400 }
          )
        }
        
        const cartaoData: UnifiedCartaoData = {
          ...dadosComuns,
          tipo_cartao: metodo_pagamento === 'cartao_credito' ? 'credito' : 'debito',
          cartao: dados_cartao,
          parcelamento: dados_cartao.parcelas || 1
        }
        paymentResult = await paymentManager.processarCartao(cartaoData)
        break

      default:
        return NextResponse.json(
          { error: 'Método de pagamento não suportado' },
          { status: 400 }
        )
    }

    if (!paymentResult.success) {
      return NextResponse.json(
        { error: paymentResult.error || 'Erro ao processar pagamento' },
        { status: 400 }
      )
    }

    // Salvar transação
    const transacao = {
      id_transacao: `TXN${Date.now()}${Math.random().toString(36).substr(2, 4)}`,
      financeiro_id: financeiro_id,
      morador_id: morador_id,
      condominio_id: condominio_id,
      master_id: master_id || financeiroItem.master_id,
      tipo_pagamento: metodo_pagamento,
      provider: paymentResult.provider,
      payment_id: paymentResult.payment_id || paymentResult.transaction_id,
      valor_original: valor,
      valor_final: paymentResult.valor_final || valor,
      taxa_aplicada: paymentResult.taxa_aplicada || 0,
      status: paymentResult.status || 'pendente',
      metodo_pagamento: metodo_pagamento,
      dados_pagamento: {
        qr_code: paymentResult.qr_code,
        qr_code_base64: paymentResult.qr_code_base64,
        boleto_url: paymentResult.boleto_url,
        linha_digitavel: paymentResult.linha_digitavel,
        link_pagamento: paymentResult.link_pagamento,
        codigo_barras: paymentResult.codigo_barras
      },
      dados_pagador: dadosPagador,
      descricao: descricao || financeiroItem.descricao,
      referencia: financeiroItem.id_financeiro,
      apartamento: morador.apartamento,
      bloco: morador.bloco || '',
      data_criacao: new Date(),
      data_atualizacao: new Date(),
      ativo: true
    }
    
    // Salvar transação (comentado até criar modelo Transacao)
    // await TransacaoModel.create(transacao)
    
    // Se o pagamento foi aprovado imediatamente (cartão), atualizar status
    if (paymentResult.status === 'aprovado' || paymentResult.status === 'pago') {
      await FinanceiroMorador.updateOne(
        { _id: new mongoose.Types.ObjectId(financeiro_id) },
        {
          $set: {
            status: 'pago',
            data_pagamento: new Date(),
            data_atualizacao: new Date(),
            metodo_pagamento: metodo_pagamento,
            transacao_id: transacao.id_transacao
          }
        }
      )
    }

    return NextResponse.json({
      success: true,
      transacao_id: transacao.id_transacao,
      metodo_pagamento: metodo_pagamento,
      valor: valor,
      status: paymentResult.status,
      qr_code: paymentResult.qr_code,
      qr_code_base64: paymentResult.qr_code_base64,
      boleto_url: paymentResult.boleto_url,
      linha_digitavel: paymentResult.linha_digitavel,
      link_pagamento: paymentResult.link_pagamento,
      provider: paymentResult.provider,
      payment_id: paymentResult.payment_id || paymentResult.transaction_id,
      expires_at: paymentResult.expires_at,
      message: 'Pagamento processado com sucesso'
    })
    
  } catch (error) {
    console.error('Error processing portal payment:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }

}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const moradorId = url.searchParams.get('morador_id')
    const condominioId = url.searchParams.get('condominio_id')
    const status = url.searchParams.get('status') // 'pendente,atrasado' ou 'pago'
    const limit = parseInt(url.searchParams.get('limit') || '50')
    
    if (!moradorId || !condominioId) {
      return NextResponse.json(
        { error: 'Morador ID e Condomínio ID são obrigatórios' },
        { status: 400 }
      )
    }

    await connectDB()
    // Construir filtros
    const filters: any = {
      morador_id: new mongoose.Types.ObjectId(moradorId),
      condominio_id: new mongoose.Types.ObjectId(condominioId),
      ativo: true
    }
    
    if (status) {
      const statusArray = status.split(',')
      filters.status = { $in: statusArray }
    }
    
    // Buscar registros financeiros
    const financeiros = await FinanceiroMorador
      .find(filters)
      .sort({ data_vencimento: -1 })
      .limit(limit)
      .lean()
    
    return NextResponse.json({
      success: true,
      financeiros: financeiros,
      total: financeiros.length
    })
    
  } catch (error) {
    console.error('Error fetching portal payment data:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar dados financeiros' },
      { status: 500 }
    )
  }
}