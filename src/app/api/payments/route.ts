import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import ConfiguracaoFinanceira from '@/models/ConfiguracaoFinanceira'
import mongoose from 'mongoose'
import { PaymentManager, UnifiedBoletoData, UnifiedPixData, UnifiedCartaoData, PaymentProvider, PaymentMethod } from '@/lib/payment-services/payment-manager'

export async function POST(request: NextRequest) {
  try {
    const { action, data, provider, metodo, tipo_cartao } = await request.json()
    
    if (!action || !data) {
      return NextResponse.json(
        { error: 'Ação e dados são obrigatórios' },
        { status: 400 }
      )
    }

    await connectDB()
    // Buscar configuração financeira
    const configuracao = await configuracoes.findOne({
      condominio_id: data.condominio_id,
      master_id: data.master_id,
      ativo: true
    })
    
    if (!configuracao) {
      return NextResponse.json(
        { error: 'Configuração financeira não encontrada' },
        { status: 404 }
      )
    }

    if (!configuracao.cobranca_automatica_ativa) {
      return NextResponse.json(
        { error: 'Sistema de cobrança automática não está ativo' },
        { status: 400 }
      )
    }

    const paymentManager = new PaymentManager(configuracao)
    let result: any

    switch (action) {
      case 'gerar_boleto':
        const boletoData: UnifiedBoletoData = {
          valor: data.valor,
          vencimento: new Date(data.vencimento),
          descricao: data.descricao,
          referencia: data.referencia || `BOL-${Date.now()}`,
          pagador: data.pagador,
          beneficiario: data.beneficiario || {
            nome: 'Condomínio',
            documento: '00000000000'
          },
          instrucoes: data.instrucoes || ['Pagamento de taxa condominial']
        }
        
        result = await paymentManager.gerarBoleto(boletoData, provider)
        break

      case 'gerar_pix':
        const pixData: UnifiedPixData = {
          valor: data.valor,
          descricao: data.descricao,
          referencia: data.referencia || `PIX-${Date.now()}`,
          expiracao_minutos: data.expiracao_minutos || 60,
          pagador: data.pagador
        }
        
        result = await paymentManager.gerarPix(pixData, provider)
        break

      case 'processar_cartao':
        if (!tipo_cartao || !['debito', 'credito'].includes(tipo_cartao)) {
          return NextResponse.json(
            { error: 'Tipo de cartão inválido (debito ou credito)' },
            { status: 400 }
          )
        }

        const cartaoData: UnifiedCartaoData = {
          valor: data.valor,
          descricao: data.descricao,
          referencia: data.referencia || `CART-${Date.now()}`,
          parcelas: data.parcelas || 1,
          pagador: data.pagador,
          cartao: data.cartao
        }
        
        result = await paymentManager.processarCartao(cartaoData, tipo_cartao, provider)
        break

      case 'consultar_status':
        if (!data.payment_id || !data.provider) {
          return NextResponse.json(
            { error: 'ID do pagamento e provider são obrigatórios' },
            { status: 400 }
          )
        }
        
        result = await paymentManager.consultarStatus(data.payment_id, data.provider)
        break

      case 'estornar':
        if (!data.payment_id || !data.provider) {
          return NextResponse.json(
            { error: 'ID do pagamento e provider são obrigatórios' },
            { status: 400 }
          )
        }
        
        result = await paymentManager.estornarPagamento(data.payment_id, data.provider, data.valor)
        break

      case 'listar_providers':
        const activeProviders = paymentManager.getActiveProviders()
        const resumo = paymentManager.getResumoConfiguracao()
        
        return NextResponse.json({
          success: true,
          providers_ativos: activeProviders,
          resumo_configuracao: resumo
        })

      case 'calcular_melhor_taxa':
        if (!data.valor || !metodo) {
          return NextResponse.json(
            { error: 'Valor e método de pagamento são obrigatórios' },
            { status: 400 }
          )
        }
        
        const melhorOpcao = paymentManager.calcularMelhorProvider(data.valor, metodo as PaymentMethod)
        
        return NextResponse.json({
          success: true,
          melhor_opcao: melhorOpcao,
          todas_opcoes: paymentManager.getActiveProviders().map(prov => ({
            provider: prov,
            taxas: paymentManager.getTaxasPorProvider(prov)
          }))
        })

      default:
        return NextResponse.json(
          { error: 'Ação não reconhecida' },
          { status: 400 }
        )
    }

    // Salvar registro da transação
    if (result.success && ['gerar_boleto', 'gerar_pix', 'processar_cartao'].includes(action)) {
      const transacao = {
        id_transacao: `TXN${Date.now()}`,
        condominio_id: data.condominio_id,
        master_id: data.master_id,
        tipo_pagamento: action.replace('gerar_', '').replace('processar_', ''),
        provider: result.provider,
        payment_id: result.payment_id || result.transaction_id,
        valor_original: result.valor_original,
        valor_final: result.valor_final,
        taxa_aplicada: result.taxa_aplicada,
        status: result.status || 'pendente',
        metodo_pagamento: result.metodo_pagamento,
        dados_pagamento: {
          qr_code: result.qr_code,
          boleto_url: result.boleto_url,
          linha_digitavel: result.linha_digitavel,
          link_pagamento: result.link_pagamento
        },
        dados_pagador: data.pagador,
        descricao: data.descricao,
        referencia: data.referencia,
        data_criacao: new Date(),
        data_atualizacao: new Date(),
        ativo: true
      }
      
      await transacoes.insertOne(transacao)
      
      // Adicionar ID da transação ao resultado
      result.transacao_id = transacao.id_transacao
    }

    return NextResponse.json({
      success: true,
      result
    })
    
  } catch (error) {
    console.error('Error processing payment:', error)
    return NextResponse.json(
      { error: 'Erro ao processar pagamento' },
      { status: 500 }
    )
  }

}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const action = url.searchParams.get('action')
    const condominioId = url.searchParams.get('condominio_id')
    const masterId = url.searchParams.get('master_id')
    
    if (!condominioId || !masterId) {
      return NextResponse.json(
        { error: 'Condomínio ID e Master ID são obrigatórios' },
        { status: 400 }
      )
    }

    await connectDB()
    switch (action) {
      case 'listar_transacoes':
        const lista = await transacoes.find({
          condominio_id: condominioId,
          master_id: masterId,
          ativo: true
        }).sort({ data_criacao: -1 }).limit(50).toArray()
        
        return NextResponse.json({
          success: true,
          transacoes: lista
        })

      case 'verificar_configuracao':
        const config = await configuracoes.findOne({
          condominio_id: condominioId,
          master_id: masterId,
          ativo: true
        })
        
        if (!config) {
          return NextResponse.json({
            success: false,
            error: 'Configuração não encontrada'
          })
        }
        
        const paymentManager = new PaymentManager(config)
        const resumo = paymentManager.getResumoConfiguracao()
        
        return NextResponse.json({
          success: true,
          configuracao_ativa: config.cobranca_automatica_ativa,
          resumo
        })

      case 'estatisticas':
        const stats = await transacoesStats.aggregate([
          {
            $match: {
              condominio_id: condominioId,
              master_id: masterId,
              ativo: true
            }
          },
          {
            $group: {
              _id: '$provider',
              total_transacoes: { $sum: 1 },
              valor_total: { $sum: '$valor_final' },
              taxa_total: { $sum: '$taxa_aplicada' }
            }
          }
        ]).toArray()
        
        return NextResponse.json({
          success: true,
          estatisticas: stats
        })

      default:
        return NextResponse.json(
          { error: 'Ação não reconhecida' },
          { status: 400 }
        )
    }
    
  } catch (error) {
    console.error('Error fetching payment data:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar dados de pagamento' },
      { status: 500 }
    )
  }
}