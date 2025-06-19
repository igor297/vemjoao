import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Condominio from '@/models/condominios'
import { getAuthUser } from '@/utils/auth'
import mongoose from 'mongoose'

export async function GET(request: NextRequest) {
  try {
    await connectDB()
    
    const url = new URL(request.url)
    const condominioId = url.searchParams.get('id')
    const masterId = url.searchParams.get('master_id')
    
    // Se tem ID específico, buscar condomínio individual
    if (condominioId) {
      const condominio = await Condominio.findById(condominioId).lean()
      
      if (!condominio) {
        return NextResponse.json(
          { success: false, error: 'Condomínio não encontrado' },
          { status: 404 }
        )
      }
      
      return NextResponse.json({
        success: true,
        condominio: condominio
      })
    }
    
    // Busca por lista de condomínios (comportamento original)
    const { masterId: authMasterId, isValid } = await getAuthUser(request)
    
    if (!isValid && !masterId) {
      return NextResponse.json(
        { error: 'Usuário não autenticado. Master ID é obrigatório.' },
        { status: 401 }
      )
    }

    // Usar masterId do parâmetro ou do auth
    const finalMasterId = masterId || authMasterId
    
    // Converter masterId string para ObjectId para compatibilidade com o banco
    const masterObjectId = new mongoose.Types.ObjectId(finalMasterId)
    
    // Filtrar condomínios apenas do master logado
    const result = await Condominio.find({ master_id: masterObjectId }).lean()
    
    return NextResponse.json({
      success: true,
      condominios: result
    })
    
  } catch (error) {
    console.error('Error fetching condominios:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar condomínios' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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
    
    // Validação básica - apenas campos essenciais são obrigatórios
    if (!condominiumData.nome || !condominiumData.numero) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: Nome e Número' },
        { status: 400 }
      )
    }

    await connectDB()
    
    // Converter masterId string para ObjectId
    const masterObjectId = new mongoose.Types.ObjectId(masterId)
    
    // Garantir que o condomínio seja sempre vinculado ao master logado
    const newCondominiumData = {
      ...condominiumData,
      master_id: masterObjectId,
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
      observacoes_cobranca: condominiumData.observacoes_cobranca || '',
      data_criacao: new Date(),
      updated_at: new Date()
    }

    const newCondominio = new Condominio(newCondominiumData)
    const result = await newCondominio.save()
    
    return NextResponse.json({
      success: true,
      condominio: result
    })
    
  } catch (error) {
    console.error('Error creating condominio:', error)
    return NextResponse.json(
      { error: 'Erro ao criar condomínio' },
      { status: 500 }
    )
  }
}