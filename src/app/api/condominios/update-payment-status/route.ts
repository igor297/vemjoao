import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import StatusPagamentoMorador from '@/models/StatusPagamentoMorador'
import FinanceiroMorador from '@/models/FinanceiroMorador'
import Morador from '@/models/Morador'
import Condominium from '@/models/condominios'
import mongoose from 'mongoose'
import { calcularStatusPagamento } from '@/models/StatusPagamentoMorador'

export async function POST(request: NextRequest) {
  try {
    const { condominio_id, master_id, gerar_financeiro_automatico } = await request.json()
    
    if (!condominio_id || !master_id) {
      return NextResponse.json(
        { error: 'Condomínio ID e Master ID são obrigatórios' },
        { status: 400 }
      )
    }

    await connectDB()
    // Buscar dados do condomínio
    const condominio = await Condominium.findOne({
      _id: new mongoose.Types.ObjectId(condominio_id),
      master_id: new mongoose.Types.ObjectId(master_id)
    })
    
    if (!condominio) {
      return NextResponse.json(
        { error: 'Condomínio não encontrado' },
        { status: 404 }
      )
    }

    // Se o condomínio aceita pagamento automático, gerar registros financeiros
    if (condominio.aceita_pagamento_automatico && gerar_financeiro_automatico) {
      await gerarRegistrosFinanceirosAutomaticos(condominio, master_id)
    }

    // Atualizar status de pagamento de todos os moradores
    const resultado = await atualizarStatusPagamentoMoradores(condominio_id, master_id)
    
    return NextResponse.json({
      success: true,
      message: 'Status de pagamento atualizado com sucesso',
      ...resultado
    })
    
  } catch (error) {
    console.error('Error updating payment status:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar status de pagamento' },
      { status: 500 }
    )
  }
}

async function gerarRegistrosFinanceirosAutomaticos(condominio: any, masterId: string) {
  // Buscar moradores ativos do condomínio
  const moradores = await Morador.find({
    condominio_id: condominio._id,
    master_id: new mongoose.Types.ObjectId(masterId),
    ativo: true
  }).lean()

  const hoje = new Date()
  const mesAtual = hoje.getMonth()
  const anoAtual = hoje.getFullYear()
  
  // Calcular data de vencimento baseada no dia configurado
  const dataVencimento = new Date(anoAtual, mesAtual, condominio.dia_vencimento || 10)
  
  // Se o vencimento já passou este mês, usar o próximo mês
  if (dataVencimento < hoje) {
    dataVencimento.setMonth(dataVencimento.getMonth() + 1)
  }

  let gerados = 0

  for (const morador of moradores) {
    // Verificar se já existe registro financeiro para este mês
    const registroExistente = await FinanceiroMorador.findOne({
      morador_id: morador._id,
      condominio_id: condominio._id,
      tipo: 'taxa_condominio',
      data_vencimento: {
        $gte: new Date(dataVencimento.getFullYear(), dataVencimento.getMonth(), 1),
        $lt: new Date(dataVencimento.getFullYear(), dataVencimento.getMonth() + 1, 1)
      },
      ativo: true
    })

    if (!registroExistente && condominio.valor_taxa_condominio > 0) {
      // Gerar ID único
      const lastFinanceiro = await FinanceiroMorador.findOne(
        {},
        null,
        { sort: { data_criacao: -1 } }
      )
      
      let nextId = 1
      if (lastFinanceiro && lastFinanceiro.id_financeiro) {
        const lastIdNumber = parseInt(lastFinanceiro.id_financeiro.replace('FM', ''))
        if (!isNaN(lastIdNumber)) {
          nextId = lastIdNumber + 1
        }
      }

      const novoRegistro = {
        id_financeiro: `FM${nextId.toString().padStart(6, '0')}`,
        tipo: 'taxa_condominio',
        descricao: `Taxa Condominial - ${dataVencimento.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`,
        valor: condominio.valor_taxa_condominio,
        data_vencimento: dataVencimento,
        status: 'pendente',
        morador_id: morador._id,
        morador_nome: morador.nome,
        apartamento: morador.unidade,
        bloco: morador.bloco || '',
        condominio_id: condominio._id,
        master_id: new mongoose.Types.ObjectId(masterId),
        criado_por_tipo: 'sistema',
        criado_por_id: 'auto',
        criado_por_nome: 'Geração Automática',
        observacoes: 'Gerado automaticamente pelo sistema',
        data_criacao: new Date(),
        data_atualizacao: new Date(),
        ativo: true
      }

      await FinanceiroMorador.create(novoRegistro)
      gerados++
    }
  }

  return { registros_gerados: gerados }
}

async function atualizarStatusPagamentoMoradores(condominioId: string, masterId: string) {
  // Buscar todos os moradores
  const filtroMoradores = {
    condominio_id: new mongoose.Types.ObjectId(condominioId),
    master_id: new mongoose.Types.ObjectId(masterId),
    ativo: true
  }
  const moradores = await Morador.find(filtroMoradores).lean()
  
  let atualizados = 0
  
  for (const morador of moradores) {
    // Buscar dados financeiros pendentes do morador
    const financeirosPendentes = await FinanceiroMorador.find({
      morador_id: morador._id,
      condominio_id: new mongoose.Types.ObjectId(condominioId),
      master_id: new mongoose.Types.ObjectId(masterId),
      status: { $in: ['pendente', 'atrasado'] },
      ativo: true
    }).lean()
    
    const valorPendente = financeirosPendentes.reduce((total: number, item: any) => total + item.valor, 0)
    const proximoVencimento = financeirosPendentes.length > 0 
      ? new Date(Math.min(...financeirosPendentes.map((f: any) => new Date(f.data_vencimento).getTime())))
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 dias no futuro se não há pendências
    
    const { status, diasAtraso, descricao } = calcularStatusPagamento(proximoVencimento, valorPendente)
    
    // Buscar status existente
    const existingStatus = await StatusPagamentoMorador.findOne({
      morador_id: morador._id,
      condominio_id: new mongoose.Types.ObjectId(condominioId)
    })
    
    const statusData = {
      id_status: existingStatus?.id_status || `SPM${Date.now()}${Math.random().toString(36).substr(2, 4)}`,
      condominio_id: new mongoose.Types.ObjectId(condominioId),
      master_id: new mongoose.Types.ObjectId(masterId),
      morador_id: morador._id,
      apartamento: morador.unidade,
      bloco: morador.bloco || '',
      nome_morador: morador.nome,
      tipo_morador: morador.tipo || 'morador',
      email: morador.email || '',
      telefone: morador.celular1 || '',
      status_pagamento: status,
      valor_pendente: valorPendente,
      valor_total_mes: valorPendente,
      data_proximo_vencimento: proximoVencimento,
      dias_atraso: diasAtraso,
      descricao_situacao: descricao,
      pagamento_automatico_ativo: false,
      notificacoes_enviadas: existingStatus?.notificacoes_enviadas || 0,
      data_atualizacao: new Date(),
      atualizado_por_id: new mongoose.Types.ObjectId(masterId),
      atualizado_por_nome: 'Sistema Automático',
      ativo: true
    }
    
    if (existingStatus) {
      await StatusPagamentoMorador.updateOne(
        { _id: existingStatus._id },
        { $set: statusData }
      )
    } else {
      await StatusPagamentoMorador.create(statusData)
    }
    
    atualizados++
  }
  
  return { 
    status_atualizados: atualizados,
    resumo: {
      em_dia: await StatusPagamentoMorador.countDocuments({ 
        condominio_id: new mongoose.Types.ObjectId(condominioId), 
        status_pagamento: 'em_dia', 
        ativo: true 
      }),
      proximo_vencimento: await StatusPagamentoMorador.countDocuments({ 
        condominio_id: new mongoose.Types.ObjectId(condominioId), 
        status_pagamento: 'proximo_vencimento', 
        ativo: true 
      }),
      atrasado: await StatusPagamentoMorador.countDocuments({ 
        condominio_id: new mongoose.Types.ObjectId(condominioId), 
        status_pagamento: 'atrasado', 
        ativo: true 
      }),
      isento: await StatusPagamentoMorador.countDocuments({ 
        condominio_id: new mongoose.Types.ObjectId(condominioId), 
        status_pagamento: 'isento', 
        ativo: true 
      })
    }
  }
}