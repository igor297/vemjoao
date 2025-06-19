import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Condominium from '@/models/condominios'
import mongoose from 'mongoose'
import { getAuthUser, ensureMasterIdBinding, validateUserPermission } from '@/utils/auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Obter dados do usuário autenticado
    const { masterId, isValid } = await getAuthUser(request)
    
    if (!isValid) {
      return NextResponse.json(
        { error: 'Usuário não autenticado. Faça login novamente.' },
        { status: 401 }
      )
    }
    
    const condominiumData = (request as any)._parsedBody || await request.json()
    const { id } = params
    
    if (!condominiumData.nome || !condominiumData.numero) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: Nome e Número' },
        { status: 400 }
      )
    }

    await connectDB()
    
    // Verificar se o condomínio existe e pertence ao master
    const existingCond = await Condominium.findById(new mongoose.Types.ObjectId(id))
    if (!existingCond) {
      return NextResponse.json(
        { error: 'Condomínio não encontrado' },
        { status: 404 }
      )
    }
    
    if (!validateUserPermission(masterId, existingCond.master_id)) {
      return NextResponse.json(
        { error: 'Você não tem permissão para editar este condomínio' },
        { status: 403 }
      )
    }
    
    // Garantir que o master_id seja sempre preservado na atualização
    const updateData = ensureMasterIdBinding({
      ...condominiumData,
      estado: condominiumData.estado ? condominiumData.estado.toUpperCase() : '',
      // Garantir valores padrão para campos numéricos
      valor_taxa_condominio: condominiumData.valor_taxa_condominio || 0,
      dia_vencimento: condominiumData.dia_vencimento || 10,
      aceita_pagamento_automatico: condominiumData.aceita_pagamento_automatico || false,
      multa_atraso: condominiumData.multa_atraso || 2.0,
      juros_mes: condominiumData.juros_mes || 1.0,
      dias_aviso_vencimento: condominiumData.dias_aviso_vencimento || 5,
      // Garantir valores padrão para campos de texto
      cep: condominiumData.cep || '',
      cidade: condominiumData.cidade || '',
      bairro: condominiumData.bairro || '',
      rua: condominiumData.rua || '',
      complemento: condominiumData.complemento || '',
      razao_social: condominiumData.razao_social || '',
      cnpj: condominiumData.cnpj || '',
      banco: condominiumData.banco || '',
      agencia: condominiumData.agencia || '',
      conta: condominiumData.conta || '',
      chave_pix: condominiumData.chave_pix || '',
      observacoes_cobranca: condominiumData.observacoes_cobranca || ''
    }, masterId)

    // Atualizar o condomínio
    const result = await Condominium.findByIdAndUpdate(new mongoose.Types.ObjectId(id), updateData, { new: true })
    
    if (!result) {
      return NextResponse.json(
        { error: 'Condomínio não encontrado ou você não tem permissão' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: 'Condomínio atualizado com sucesso'
    })
    
  } catch (error) {
    console.error('Error updating condominio:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar condomínio' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    
    // Obter dados do usuário autenticado
    const { masterId, isValid } = await getAuthUser(request)
    
    if (!isValid) {
      return NextResponse.json(
        { error: 'Usuário não autenticado. Faça login novamente.' },
        { status: 401 }
      )
    }

    await connectDB()
    // Verificar se o condomínio pertence ao master antes de excluir
    const result = await Condominium.findOneAndDelete({ 
      _id: new mongoose.Types.ObjectId(id), 
      master_id: masterId 
    })
    
    if (!result) {
      return NextResponse.json(
        { error: 'Condomínio não encontrado ou você não tem permissão' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: 'Condomínio excluído com sucesso'
    })
    
  } catch (error) {
    console.error('Error deleting condominio:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir condomínio' },
      { status: 500 }
    )
  }
}