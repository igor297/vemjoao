import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Condominium from '@/models/condominios'
import Conjuge from '@/models/Conjuge'
import Morador from '@/models/Morador'
import Master from '@/models/Master'
import Adm from '@/models/Adm'
import Colaborador from '@/models/Colaborador'
import { getAuthUser } from '@/utils/auth'
import mongoose from 'mongoose'
const { ObjectId } = mongoose.Types


export async function GET(request: NextRequest) {
  try {
    // Obter dados do usuário autenticado
    const { masterId, isValid } = await getAuthUser(request)
    
    if (!isValid) {
      return NextResponse.json(
        { error: 'Usuário não autenticado. Master ID é obrigatório.' },
        { status: 401 }
      )
    }

    const url = new URL(request.url)
    const condominioId = url.searchParams.get('condominio_id')
    const moradorId = url.searchParams.get('morador_id')
    const inquilinoId = url.searchParams.get('inquilino_id')

    await connectDB()
    
    // Converter masterId string para ObjectId
    const masterObjectId = new mongoose.Types.ObjectId(masterId)
    
    const filter: any = { master_id: masterObjectId }
    if (condominioId) filter.condominio_id = new mongoose.Types.ObjectId(condominioId)
    if (moradorId) filter.morador_id = new mongoose.Types.ObjectId(moradorId)
    if (inquilinoId) filter.inquilino_id = new mongoose.Types.ObjectId(inquilinoId)
    
    const result = await Conjuge.find(filter)
    
    // Sem filtro adicional - usa apenas o masterId para isolamento
    const filteredConjuges = result
    
    // Buscar dados dos condomínios para exibir nomes
    const conjugesComCondominio = await Promise.all(
      filteredConjuges.map(async (conjuge) => {
        let condominium = null
        try {
          if (conjuge.condominio_id?.length === 24) {
            condominium = await Condominium.findOne({ _id: new ObjectId(conjuge.condominio_id) })
          } else {
            condominium = await Condominium.findOne({ _id: conjuge.condominio_id })
          }
        } catch (error) {
          condominium = await Condominium.findOne({ _id: conjuge.condominio_id })
        }
        
        return {
          ...conjuge.toObject(),
          condominio_nome: condominium?.nome || 'N/A'
        }
      })
    )
    
    return NextResponse.json({
      success: true,
      conjuges: conjugesComCondominio
    })
    
  } catch (error) {
    console.error('Error fetching conjuges:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar cônjuges' },
      { status: 500 }
    )
  }}

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
    
    const conjugeData = (request as any)._parsedBody || await request.json()
    
    // Validação básica
    const requiredFields = ['nome', 'condominio_id', 'unidade']
    for (const field of requiredFields) {
      if (!conjugeData[field]) {
        return NextResponse.json(
          { error: `Campo ${field} é obrigatório` },
          { status: 400 }
        )
      }
    }

    // Deve ter morador_id OU inquilino_id
    if (!conjugeData.morador_id && !conjugeData.inquilino_id) {
      return NextResponse.json(
        { error: 'É necessário informar morador_id ou inquilino_id' },
        { status: 400 }
      )
    }

    await connectDB()
    // Verificar se já existe cônjuge para este morador/inquilino
    const existingConjuge = await Conjuge.findOne({
      $or: [
        { morador_id: conjugeData.morador_id },
        { inquilino_id: conjugeData.inquilino_id }
      ]
    })
    
    if (existingConjuge) {
      return NextResponse.json(
        { error: 'Já existe um cônjuge cadastrado para este morador/inquilino' },
        { status: 400 }
      )
    }

    // Verificar se email já existe (se fornecido)
    if (conjugeData.email) {
      const emailLower = conjugeData.email.toLowerCase()
      
      const existingMorador = await Morador.findOne({ email: emailLower })
      if (existingMorador) {
        return NextResponse.json({ error: 'Email já cadastrado em moradores' }, { status: 400 })
      }
      
      const existingMaster = await Master.findOne({ email: emailLower })
      if (existingMaster) {
        return NextResponse.json({ error: 'Email já cadastrado em masters' }, { status: 400 })
      }
      
      const existingAdm = await Adm.findOne({ email: emailLower })
      if (existingAdm) {
        return NextResponse.json({ error: 'Email já cadastrado em adms' }, { status: 400 })
      }
      
      const existingColaborador = await Colaborador.findOne({ email: emailLower })
      if (existingColaborador) {
        return NextResponse.json({ error: 'Email já cadastrado em colaboradores' }, { status: 400 })
      }
      
      const existingConjuge = await Conjuge.findOne({ email: emailLower })
      if (existingConjuge) {
        return NextResponse.json({ error: 'Email já cadastrado em conjuges' }, { status: 400 })
      }
    }
    
    // Converter masterId string para ObjectId
    const masterObjectId = new mongoose.Types.ObjectId(masterId)
    
    const newConjuge = {
      ...conjugeData,
      master_id: masterObjectId,
      condominio_id: new mongoose.Types.ObjectId(conjugeData.condominio_id),
      morador_id: conjugeData.morador_id ? new mongoose.Types.ObjectId(conjugeData.morador_id) : undefined,
      inquilino_id: conjugeData.inquilino_id ? new mongoose.Types.ObjectId(conjugeData.inquilino_id) : undefined,
      email: conjugeData.email ? conjugeData.email.toLowerCase() : undefined,
      data_criacao: new Date(),
      ativo: true
    }

    const result = await Conjuge.create(newConjuge)
    
    return NextResponse.json({
      success: true,
      conjuge: result
    })
    
  } catch (error) {
    console.error('Error creating conjuge:', error)
    return NextResponse.json(
      { error: 'Erro ao criar cônjuge' },
      { status: 500 }
    )
  }}

export async function PUT(request: NextRequest) {
  try {
    // Obter dados do usuário autenticado
    const { masterId, isValid } = await getAuthUser(request)
    
    if (!isValid) {
      return NextResponse.json(
        { error: 'Usuário não autenticado. Faça login novamente.' },
        { status: 401 }
      )
    }
    
    const { _id, ...conjugeData } = (request as any)._parsedBody || await request.json()
    
    if (!_id) {
      return NextResponse.json(
        { error: 'ID do cônjuge é obrigatório' },
        { status: 400 }
      )
    }

    await connectDB()
    
    // Converter masterId string para ObjectId
    const masterObjectId = new mongoose.Types.ObjectId(masterId)
    
    // Verificar se o cônjuge existe e pertence ao master
    const existingConjuge = await Conjuge.findOne({
      _id: new ObjectId(_id),
      master_id: masterObjectId
    })
    
    if (!existingConjuge) {
      return NextResponse.json(
        { error: 'Cônjuge não encontrado' },
        { status: 404 }
      )
    }
    // Verificar se email já existe em outro cônjuge
    if (conjugeData.email) {
      const existingConjuge = await Conjuge.findOne({
        email: conjugeData.email.toLowerCase(),
        _id: { $ne: new ObjectId(_id) }
      })
      
      if (existingConjuge) {
        return NextResponse.json(
          { error: 'Email já cadastrado para outro cônjuge' },
          { status: 400 }
        )
      }
    }
    
    const updateData = {
      ...conjugeData,
      ...(conjugeData.email && { email: conjugeData.email.toLowerCase() })
    }

    const result = await Conjuge.findByIdAndUpdate(
      { _id: new ObjectId(_id) },
      { $set: updateData }
    )
    
    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Cônjuge não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Cônjuge atualizado com sucesso'
    })
    
  } catch (error) {
    console.error('Error updating conjuge:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar cônjuge' },
      { status: 500 }
    )
  }}

export async function DELETE(request: NextRequest) {
  try {
    // Obter dados do usuário autenticado
    const { masterId, isValid } = await getAuthUser(request)
    
    if (!isValid) {
      return NextResponse.json(
        { error: 'Usuário não autenticado. Faça login novamente.' },
        { status: 401 }
      )
    }
    
    const url = new URL(request.url)
    const id = url.searchParams.get('id')
    
    if (!id) {
      return NextResponse.json(
        { error: 'ID do cônjuge é obrigatório' },
        { status: 400 }
      )
    }

    await connectDB()
    
    // Converter masterId string para ObjectId
    const masterObjectId = new mongoose.Types.ObjectId(masterId)
    
    // Verificar se o cônjuge existe e pertence ao master
    const existingConjuge = await Conjuge.findOne({
      _id: new ObjectId(id),
      master_id: masterObjectId
    })
    
    if (!existingConjuge) {
      return NextResponse.json(
        { error: 'Cônjuge não encontrado' },
        { status: 404 }
      )
    }
    const result = await Conjuge.findByIdAndDelete({ _id: new ObjectId(id) })
    
    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'Cônjuge não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Cônjuge excluído com sucesso'
    })
    
  } catch (error) {
    console.error('Error deleting conjuge:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir cônjuge' },
      { status: 500 }
    )
  }}