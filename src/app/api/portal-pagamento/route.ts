import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import ContaBancaria from '@/models/ContaBancaria'
import ConfiguracaoFinanceira from '@/models/ConfiguracaoFinanceira'
import Morador from '@/models/Morador'
import FinanceiroMorador from '@/models/FinanceiroMorador'
import Transacao from '@/models/Transacao'
import Condominio from '@/models/condominios'
import mongoose from 'mongoose'
import { PaymentManager, UnifiedBoletoData, UnifiedPixData, UnifiedCartaoData } from '@/lib/payment-services/payment-manager'

export async function POST(request: NextRequest) {
  try {
    const requestData = await request.json()
    
    // Log dos dados recebidos para debug
    console.log('Dados recebidos no portal-pagamento:', {
      ...requestData,
      dados_cartao: requestData.dados_cartao ? '[DADOS MASCARADOS]' : undefined
    })
    
    const { 
      financeiro_id, 
      morador_id, 
      condominio_id, 
      master_id,
      valor, 
      metodo_pagamento, 
      descricao,
      dados_cartao 
    } = requestData
    
    // Validação detalhada
    const missingFields = []
    if (!financeiro_id) missingFields.push('financeiro_id')
    if (!morador_id) missingFields.push('morador_id') 
    if (!condominio_id) missingFields.push('condominio_id')
    if (!master_id) missingFields.push('master_id')
    if (valor === undefined || valor === null) missingFields.push('valor')
    if (!metodo_pagamento) missingFields.push('metodo_pagamento')
    
    if (missingFields.length > 0) {
      console.log('Campos obrigatórios faltando no portal-pagamento:', missingFields)
      return NextResponse.json(
        { 
          error: `Campos obrigatórios faltando: ${missingFields.join(', ')}`,
          missing_fields: missingFields
        },
        { status: 400 }
      )
    }
    
    if (valor <= 0) {
      console.log('Valor inválido:', valor)
      return NextResponse.json(
        { error: 'Valor deve ser positivo' },
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
      console.log('Item financeiro não encontrado:', { financeiro_id, morador_id })
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
      console.log('Morador não encontrado:', { morador_id })
      return NextResponse.json(
        { error: 'Morador não encontrado' },
        { status: 404 }
      )
    }
    
    // Buscar dados do condomínio para endereço do boleto
    const condominio = await Condominio.findById(condominio_id)
    
    if (!condominio) {
      console.log('Condomínio não encontrado:', { condominio_id })
      return NextResponse.json(
        { error: 'Condomínio não encontrado' },
        { status: 404 }
      )
    }
    
    // Buscar configuração financeira
    let configuracao = await ConfiguracaoFinanceira.findOne({
      condominio_id: new mongoose.Types.ObjectId(condominio_id),
      master_id: new mongoose.Types.ObjectId(master_id || financeiroItem.master_id),
      ativo: true
    })
    
    // Se não há configuração, criar uma configuração padrão básica
    if (!configuracao) {
      console.log('Criando configuração financeira padrão para:', { condominio_id, master_id })
      
      const novaConfiguracao = new ConfiguracaoFinanceira({
        condominio_id: new mongoose.Types.ObjectId(condominio_id),
        master_id: new mongoose.Types.ObjectId(master_id),
        cobranca_automatica_ativa: true,
        
        // Configuração básica para PIX (sem taxas)
        mercado_pago: {
          ativo: true,
          taxa_boleto: 0,
          taxa_pix: 0,
          taxa_cartao_debito: 0,
          taxa_cartao_credito: 0,
          tipo_taxa: 'percentual'
        },
        stone: {
          ativo: false,
          taxa_boleto: 0,
          taxa_pix: 0,
          taxa_cartao_debito: 0,
          taxa_cartao_credito: 0,
          tipo_taxa: 'percentual'
        },
        pagseguro: {
          ativo: false,
          taxa_boleto: 0,
          taxa_pix: 0,
          taxa_cartao_debito: 0,
          taxa_cartao_credito: 0,
          tipo_taxa: 'percentual'
        },
        configuracoes_gerais: {
          dias_vencimento_boleto: 10,
          dias_vencimento_pix: 1,
          juros_atraso_mes: 1,
          multa_atraso: 2,
          descricao_padrao_boleto: 'Taxa Condominial',
          instrucoes_boleto: 'Pagamento da taxa condominial conforme regulamento interno.'
        },
        
        // Controle básico
        ativo: true,
        criado_por_id: new mongoose.Types.ObjectId(master_id),
        criado_por_nome: 'Sistema (Auto-criado)',
        data_criacao: new Date(),
        data_atualizacao: new Date()
      })
      
      configuracao = await novaConfiguracao.save()
      console.log('Configuração financeira padrão criada com sucesso')
    }
    
    
    if (!configuracao.cobranca_automatica_ativa) {
      console.log('Sistema de pagamentos desativado:', { 
        cobranca_ativa: configuracao.cobranca_automatica_ativa,
        condominio_id,
        master_id
      })
      return NextResponse.json(
        { error: 'Sistema de pagamentos está desativado. Entre em contato com a administração.' },
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

    if (!contaPrincipal) {
      console.log('Conta bancária principal não configurada:', { condominio_id, master_id })
      return NextResponse.json(
        { error: 'Conta bancária principal não configurada' },
        { status: 400 }
      )
    }

    // Log da conta bancária encontrada
    console.log('Conta bancária principal encontrada:', {
      banco: contaPrincipal.banco,
      codigo_banco: contaPrincipal.codigo_banco,
      agencia: contaPrincipal.agencia,
      numero_conta: contaPrincipal.numero_conta,
      chave_pix: contaPrincipal.chave_pix ? '***PIX_CONFIGURADO***' : 'SEM_PIX',
      aceita_pix: contaPrincipal.aceita_pix,
      aceita_boleto: contaPrincipal.aceita_boleto,
      conta_principal: contaPrincipal.conta_principal,
      ativa: contaPrincipal.ativa
    })

    // Validações específicas por método de pagamento ANTES de processar
    if (metodo_pagamento === 'pix') {
      if (!contaPrincipal.chave_pix || contaPrincipal.chave_pix.trim() === '') {
        return NextResponse.json(
          { 
            error: 'Chave PIX não configurada na conta bancária principal',
            error_code: 'PIX_KEY_MISSING',
            details: 'Configure uma chave PIX válida na conta bancária para aceitar pagamentos PIX'
          },
          { status: 400 }
        )
      }
    }

    if (metodo_pagamento === 'boleto') {
      // Verificar se há dados suficientes para emissão de boleto
      if (!contaPrincipal.agencia || !contaPrincipal.numero_conta || !contaPrincipal.codigo_banco) {
        return NextResponse.json(
          { 
            error: 'Dados bancários incompletos para emissão de boleto',
            error_code: 'BANK_DATA_INCOMPLETE',
            details: 'Configure agência, conta e código do banco na conta bancária principal'
          },
          { status: 400 }
        )
      }

      // Verificar se algum gateway que suporta boleto está ativo
      const boletoDisponivel = configuracao.mercado_pago.ativo || 
                              configuracao.stone.ativo || 
                              configuracao.pagseguro.ativo
      
      if (!boletoDisponivel) {
        return NextResponse.json(
          { 
            error: 'Nenhum gateway de pagamento está ativo para boleto',
            error_code: 'BOLETO_DISABLED',
            details: 'Ative pelo menos um gateway (Mercado Pago, Stone ou PagSeguro) nas configurações financeiras'
          },
          { status: 400 }
        )
      }
    }

    if (metodo_pagamento.includes('cartao')) {
      // Verificar se algum gateway que suporta cartão está ativo
      const cartaoDisponivel = configuracao.mercado_pago.ativo || 
                              configuracao.stone.ativo || 
                              configuracao.pagseguro.ativo
      
      if (!cartaoDisponivel) {
        return NextResponse.json(
          { 
            error: 'Nenhum gateway de pagamento está ativo para cartão',
            error_code: 'CARD_DISABLED',
            details: 'Ative pelo menos um gateway (Mercado Pago, Stone ou PagSeguro) nas configurações financeiras'
          },
          { status: 400 }
        )
      }

      // Verificar dados do cartão
      if (!dados_cartao || !dados_cartao.numero || !dados_cartao.cvv || !dados_cartao.mes_vencimento || !dados_cartao.ano_vencimento) {
        return NextResponse.json(
          { 
            error: 'Dados do cartão incompletos',
            error_code: 'CARD_DATA_INCOMPLETE',
            details: 'Número, CVV e data de vencimento são obrigatórios'
          },
          { status: 400 }
        )
      }

      // Validar formato básico do cartão
      const numeroCartao = dados_cartao.numero.replace(/\D/g, '')
      if (numeroCartao.length < 13 || numeroCartao.length > 19) {
        return NextResponse.json(
          { 
            error: 'Número do cartão inválido',
            error_code: 'INVALID_CARD_NUMBER',
            details: 'Número do cartão deve ter entre 13 e 19 dígitos'
          },
          { status: 400 }
        )
      }

      // Validar CVV
      if (dados_cartao.cvv.length < 3 || dados_cartao.cvv.length > 4) {
        return NextResponse.json(
          { 
            error: 'CVV inválido',
            error_code: 'INVALID_CVV',
            details: 'CVV deve ter 3 ou 4 dígitos'
          },
          { status: 400 }
        )
      }

      // Validar data de vencimento
      const mesAtual = new Date().getMonth() + 1
      const anoAtual = new Date().getFullYear()
      const mesVencimento = parseInt(dados_cartao.mes_vencimento)
      const anoVencimento = parseInt(dados_cartao.ano_vencimento)

      if (anoVencimento < anoAtual || (anoVencimento === anoAtual && mesVencimento < mesAtual)) {
        return NextResponse.json(
          { 
            error: 'Cartão vencido',
            error_code: 'EXPIRED_CARD',
            details: 'A data de vencimento do cartão já passou'
          },
          { status: 400 }
        )
      }
    }

    const paymentManager = new PaymentManager(configuracao)
    let paymentResult: any
    
    console.log('Iniciando processamento de pagamento:', {
      metodo_pagamento,
      valor,
      banco: contaPrincipal.banco
    })
    
    // Dados do pagador (morador mora no condomínio)
    const dadosPagador = {
      nome: morador.nome,
      email: morador.email || 'contato@condominio.com',
      telefone: morador.celular1 || '',
      documento: morador.cpf ? morador.cpf.replace(/\D/g, '') : '',
      endereco: {
        cep: condominio.cep || '01310-100',
        logradouro: condominio.endereco || 'Rua do Condomínio',
        numero: morador.unidade || '1',
        bairro: condominio.bairro || 'Centro',
        cidade: condominio.cidade || 'São Paulo',
        uf: condominio.estado || 'SP'
      }
    }
    
    // Validar CPF antes de prosseguir
    if (!dadosPagador.documento || dadosPagador.documento.length !== 11) {
      console.log('CPF inválido ou faltando:', { 
        cpf_original: morador.cpf,
        cpf_limpo: dadosPagador.documento,
        morador_id: morador_id
      })
      return NextResponse.json(
        { 
          error: 'CPF do morador é obrigatório e deve ter 11 dígitos',
          error_code: 'INVALID_CPF',
          details: 'Configure um CPF válido no cadastro do morador'
        },
        { status: 400 }
      )
    }

    // Log dos dados do pagador para debug
    console.log('Dados do pagador validados:', {
      nome: dadosPagador.nome,
      email: dadosPagador.email || '[VAZIO]',
      documento: dadosPagador.documento ? `${dadosPagador.documento.substring(0, 3)}***${dadosPagador.documento.substring(8)}` : '[VAZIO]',
      telefone: dadosPagador.telefone || '[VAZIO]'
    })

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
        console.log('Gerando PIX...')
        const pixData: UnifiedPixData = {
          ...dadosComuns,
          chave_pix: contaPrincipal?.chave_pix || '',
          expiracao_minutos: 30
        }
        console.log('Dados PIX preparados:', { 
          valor: pixData.valor,
          chave_pix: pixData.chave_pix ? 'CONFIGURADA' : 'FALTANDO',
          descricao: pixData.descricao 
        })
        
        try {
          paymentResult = await paymentManager.gerarPix(pixData)
          console.log('PIX gerado com sucesso:', {
            status: paymentResult?.status,
            provider: paymentResult?.provider
          })
        } catch (error) {
          console.error('Erro ao gerar PIX:', error)
          return NextResponse.json(
            { error: 'Erro ao gerar PIX: ' + error.message },
            { status: 400 }
          )
        }
        break

      case 'boleto':
        console.log('Gerando Boleto...')
        const boletoData: UnifiedBoletoData = {
          ...dadosComuns,
          vencimento: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 dia
          instrucoes: [
            `Pagamento para ${condominio.nome || 'Condomínio'}`,
            `Referente a: ${financeiroItem.descricao || descricao}`,
            'Não aceitar pagamento após o vencimento',
            condominio.telefone ? `Contato: ${condominio.telefone}` : ''
          ].filter(Boolean),
          beneficiario: {
            nome: condominio.razao_social || condominio.nome || 'CONDOMINIO LTDA',
            documento: condominio.cnpj?.replace(/\D/g, '') || '12345678000195'
          }
        }
        console.log('Dados boleto preparados:', { 
          valor: boletoData.valor,
          vencimento: boletoData.vencimento,
          beneficiario: boletoData.beneficiario.nome 
        })
        
        try {
          paymentResult = await paymentManager.gerarBoleto(boletoData)
          console.log('Resultado bruto do paymentManager.gerarBoleto:', paymentResult)
          console.log('Boleto gerado com sucesso:', {
            status: paymentResult?.status,
            provider: paymentResult?.provider
          })
        } catch (error) {
          console.error('Erro ao gerar boleto:', error)
          return NextResponse.json(
            { error: 'Erro ao gerar boleto: ' + error.message },
            { status: 400 }
          )
        }
        break

      case 'cartao_credito':
      case 'cartao_debito':
        if (!dados_cartao) {
          return NextResponse.json(
            { error: 'Dados do cartão são obrigatórios' },
            { status: 400 }
          )
        }
        
        const tipoCartao = metodo_pagamento === 'cartao_credito' ? 'credito' : 'debito'
        const cartaoData: UnifiedCartaoData = {
          ...dadosComuns,
          parcelas: dados_cartao.parcelas || 1,
          cartao: dados_cartao
        }
        paymentResult = await paymentManager.processarCartao(cartaoData, tipoCartao)
        break

      default:
        return NextResponse.json(
          { error: 'Método de pagamento não suportado' },
          { status: 400 }
        )
    }

    console.log('Validando resultado do pagamento:', {
      error: paymentResult.error,
      status: paymentResult.status,
      success: paymentResult.success
    })

    if (paymentResult.error || (!paymentResult.success && (paymentResult.status !== 'pending' && paymentResult.status !== 'pendente' && paymentResult.status !== 'aprovado' && paymentResult.status !== 'pago'))) {
      return NextResponse.json(
        { error: paymentResult.error || `Erro ao processar pagamento ou status inesperado: ${paymentResult.status}` },
        { status: 400 }
      )
    }

    // Calcular data de vencimento (padrão: 1 dia para boleto, instantâneo para outros)
    const dataVencimento = metodo_pagamento === 'boleto' 
      ? new Date(Date.now() + 24 * 60 * 60 * 1000) // 1 dia
      : new Date(Date.now() + 30 * 60 * 1000) // 30 minutos
    
    // Criar estrutura de transação seguindo o modelo oficial
    const novaTransacao = new Transacao({
      tipo_origem: 'financeiro_morador',
      origem_id: new mongoose.Types.ObjectId(financeiro_id),
      condominio_id: new mongoose.Types.ObjectId(condominio_id),
      
      // Valores
      valor_original: valor,
      valor_final: paymentResult.valor_final || valor,
      valor_taxas: paymentResult.taxa_aplicada || 0,
      valor_desconto: 0,
      valor_juros: financeiroItem.juros_atraso || 0,
      valor_multa: financeiroItem.multa_atraso || 0,
      
      // Gateway e método
      gateway_provider: paymentResult.provider || 'mercado_pago',
      payment_id: paymentResult.payment_id || paymentResult.id, // <<-- AQUI A CORREÇÃO
      metodo_pagamento: metodo_pagamento,
      parcelas: dados_cartao?.parcelas || 1,
      
      // Status
      status: paymentResult.status === 'aprovado' ? 'aprovado' : 'pendente',
      status_detalhado: paymentResult.status_detalhado || paymentResult.status,
      tentativas_processamento: 1,
      
      // Dados do pagamento
      dados_pagamento: {
        qr_code: paymentResult.qr_code,
        linha_digitavel: paymentResult.linha_digitavel,
        codigo_barras: paymentResult.codigo_barras,
        link_pagamento: paymentResult.link_pagamento,
        token_cartao: dados_cartao?.token,
        nsu: paymentResult.nsu,
        tid: paymentResult.tid,
        authorization_code: paymentResult.authorization_code
      },
      
      // Datas
      data_vencimento: dataVencimento,
      data_processamento: new Date(),
      
      // Contabilidade
      categoria_contabil: financeiroItem.categoria || 'RECEITA_CONDOMINIO',
      observacoes: descricao || financeiroItem.descricao,
      
      // Metadata para auditoria
      metadata: {
        morador_id: morador_id,
        apartamento: morador.apartamento,
        bloco: morador.bloco || '',
        dados_pagador: dadosPagador,
        referencia_original: financeiroItem.id_financeiro,
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        user_agent: request.headers.get('user-agent')
      }
    })
    
    // Adicionar log inicial
    novaTransacao.adicionarLog(
      'TRANSACAO_CRIADA',
      {
        metodo_pagamento,
        valor_original: valor,
        gateway: paymentResult.provider,
        payment_id: paymentResult.payment_id
      },
      new mongoose.Types.ObjectId(morador_id),
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    )
    
    // Salvar transação na base de dados
    const transacaoSalva = await novaTransacao.save()
    
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
            transacao_id: transacaoSalva.id_transacao
          }
        }
      )
    }

    return NextResponse.json({
      success: true,
      transacao_id: transacaoSalva.id_transacao,
      metodo_pagamento: metodo_pagamento,
      valor: valor,
      valor_final: transacaoSalva.valor_final,
      valor_taxas: transacaoSalva.valor_taxas,
      status: paymentResult.status,
      qr_code: paymentResult.qr_code,
      qr_code_base64: paymentResult.qr_code_base64,
      boleto_url: paymentResult.boleto_url,
      linha_digitavel: paymentResult.linha_digitavel,
      link_pagamento: paymentResult.link_pagamento,
      provider: paymentResult.provider,
      payment_id: paymentResult.payment_id || paymentResult.transaction_id,
      expires_at: paymentResult.expires_at,
      data_vencimento: transacaoSalva.data_vencimento,
      message: 'Pagamento processado com sucesso e transação auditada'
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