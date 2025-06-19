import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import FinanceiroMorador from '@/models/FinanceiroMorador'
import Morador from '@/models/Morador'
import Condominio from '@/models/condominios'
import { SincronizacaoFinanceira } from '@/services/sincronizacaoFinanceira'
import mongoose from 'mongoose'

export async function POST(request: NextRequest) {
  try {
    await connectDB()
    
    const data = await request.json()
    const {
      condominio_id,
      master_id,
      tipo_usuario,
      usuario_id,
      criado_por_nome
    } = data

    // Validações básicas
    if (!master_id || !condominio_id || !tipo_usuario || !usuario_id) {
      return NextResponse.json({
        success: false,
        error: 'Dados obrigatórios faltando'
      }, { status: 400 })
    }

    // Verificar permissão (apenas master, sindico, subsindico)
    if (!['master', 'sindico', 'subsindico'].includes(tipo_usuario)) {
      return NextResponse.json({
        success: false,
        error: 'Você não tem permissão para gerar lançamentos automáticos'
      }, { status: 403 })
    }

    // Buscar dados do condomínio
    const condominio = await Condominio.findById(condominio_id)
    if (!condominio) {
      return NextResponse.json({
        success: false,
        error: 'Condomínio não encontrado'
      }, { status: 404 })
    }

    // Verificar se tem configurações necessárias
    if (!condominio.valor_taxa_condominio || condominio.valor_taxa_condominio <= 0) {
      return NextResponse.json({
        success: false,
        error: 'Valor da taxa condominial não configurado'
      }, { status: 400 })
    }

    // Buscar todos os moradores ativos do condomínio
    const moradores = await Morador.find({
      condominio_id: new mongoose.Types.ObjectId(condominio_id),
      master_id: new mongoose.Types.ObjectId(master_id),
      ativo: true
    })

    if (moradores.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Nenhum morador ativo encontrado no condomínio'
      }, { status: 400 })
    }

    // Calcular data de vencimento (próximo mês)
    const hoje = new Date()
    const diaVencimento = condominio.dia_vencimento || 10
    const dataVencimento = new Date(hoje.getFullYear(), hoje.getMonth(), diaVencimento)
    
    // Se já passou do dia de vencimento deste mês, usar próximo mês
    if (dataVencimento < hoje) {
      dataVencimento.setMonth(dataVencimento.getMonth() + 1)
    }

    // Criar referência do mês/ano para evitar duplicações
    const mesReferencia = `${dataVencimento.getMonth() + 1}/${dataVencimento.getFullYear()}`
    const descricaoBase = `Taxa de condomínio - ${dataVencimento.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`

    let created = 0
    let skipped = 0
    const erros: string[] = []

    // Processar cada morador
    for (const morador of moradores) {
      try {
        // Verificar se já existe lançamento para este morador neste mês
        const lancamentoExistente = await FinanceiroMorador.findOne({
          morador_id: morador._id,
          condominio_id: new mongoose.Types.ObjectId(condominio_id),
          categoria: 'taxa_condominio',
          data_vencimento: {
            $gte: new Date(dataVencimento.getFullYear(), dataVencimento.getMonth(), 1),
            $lt: new Date(dataVencimento.getFullYear(), dataVencimento.getMonth() + 1, 1)
          },
          ativo: true
        })

        if (lancamentoExistente) {
          console.log(`⚠️ Lançamento já existe para ${morador.nome} - ${mesReferencia}`)
          skipped++
          continue
        }

        // Criar novo lançamento
        const novoLancamento = new FinanceiroMorador({
          tipo: 'despesa',
          categoria: 'taxa_condominio',
          descricao: descricaoBase,
          valor: condominio.valor_taxa_condominio,
          data_vencimento: dataVencimento,
          morador_id: morador._id,
          morador_nome: morador.nome,
          apartamento: morador.unidade,
          bloco: morador.bloco || '',
          condominio_id: new mongoose.Types.ObjectId(condominio_id),
          master_id: new mongoose.Types.ObjectId(master_id),
          criado_por_tipo: tipo_usuario,
          criado_por_id: new mongoose.Types.ObjectId(usuario_id),
          criado_por_nome,
          status: 'pendente',
          recorrente: true,
          periodicidade: 'mensal',
          mes_referencia: mesReferencia
        })

        // Verificar se está atrasado
        if (dataVencimento < hoje) {
          novoLancamento.status = 'atrasado'
        }

        await novoLancamento.save()
        console.log(`✅ Lançamento criado para ${morador.nome} - ${mesReferencia}`)
        created++

        // Sincronizar com financeiro do condomínio
        try {
          const dadosSincronizacao = {
            _id: novoLancamento._id.toString(),
            tipo: 'receita' as const,
            categoria: 'taxa_condominio',
            descricao: descricaoBase,
            valor: condominio.valor_taxa_condominio,
            data_vencimento: dataVencimento,
            data_pagamento: novoLancamento.data_pagamento,
            status: novoLancamento.status,
            condominio_id: condominio_id,
            master_id: master_id,
            criado_por_tipo: tipo_usuario,
            criado_por_id: usuario_id,
            criado_por_nome,
            observacoes: '',
            recorrente: true,
            periodicidade: 'mensal',
            mes_referencia: mesReferencia,
            origem_nome: morador.nome,
            origem_identificacao: morador.cpf,
            bloco: morador.bloco || '',
            unidade: morador.unidade || ''
          }

          await SincronizacaoFinanceira.sincronizarMorador(dadosSincronizacao)
          console.log(`✅ Sincronização criada para ${morador.nome} - ${mesReferencia}`)
        } catch (syncError) {
          console.error(`⚠️ Erro na sincronização para ${morador.nome}:`, syncError)
        }

      } catch (error) {
        console.error(`❌ Erro ao criar lançamento para ${morador.nome}:`, error)
        erros.push(`${morador.nome}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
      }
    }

    console.log(`📊 Geração automática concluída: ${created} criados, ${skipped} já existiam`)

    return NextResponse.json({
      success: true,
      message: 'Geração automática concluída',
      created,
      skipped,
      total_moradores: moradores.length,
      valor_taxa: condominio.valor_taxa_condominio,
      data_vencimento: dataVencimento.toISOString(),
      mes_referencia: mesReferencia,
      erros: erros.length > 0 ? erros : undefined
    })

  } catch (error) {
    console.error('Erro na geração automática:', error)
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}