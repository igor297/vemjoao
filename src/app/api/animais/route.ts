import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Condominium from '@/models/condominios'
import Animal from '@/models/Animal'
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
    
    const result = await Animal.find(filter)
    
    // Sem filtro adicional - usa apenas o masterId para isolamento
    const filteredAnimais = result
    
    // Buscar dados dos condomínios para exibir nomes
    const animaisComCondominio = await Promise.all(
      filteredAnimais.map(async (animal) => {
        let condominium = null
        try {
          if (animal.condominio_id?.length === 24) {
            condominium = await Condominium.findOne({ _id: new mongoose.Types.ObjectId(animal.condominio_id) })
          } else {
            condominium = await Condominium.findOne({ _id: animal.condominio_id })
          }
        } catch (error) {
          condominium = await Condominium.findOne({ _id: animal.condominio_id })
        }
        
        return {
          ...animal.toObject(),
          condominio_nome: condominium?.nome || 'N/A'
        }
      })
    )
    
    return NextResponse.json({
      success: true,
      animais: animaisComCondominio
    })
    
  } catch (error) {
    console.error('Error fetching animais:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar animais' },
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
    
    const animalData = (request as any)._parsedBody || await request.json()
    
    // Validação básica
    const requiredFields = ['tipo', 'nome', 'condominio_id', 'unidade']
    for (const field of requiredFields) {
      if (!animalData[field]) {
        return NextResponse.json(
          { error: `Campo ${field} é obrigatório` },
          { status: 400 }
        )
      }
    }

    // Deve ter morador_id OU inquilino_id
    if (!animalData.morador_id && !animalData.inquilino_id) {
      return NextResponse.json(
        { error: 'É necessário informar morador_id ou inquilino_id' },
        { status: 400 }
      )
    }

    // Validar tipo
    if (!['cao', 'gato', 'passaro', 'peixe', 'outro'].includes(animalData.tipo)) {
      return NextResponse.json(
        { error: 'Tipo deve ser: cao, gato, passaro, peixe ou outro' },
        { status: 400 }
      )
    }

    await connectDB()
    // Converter masterId string para ObjectId
    const masterObjectId = new mongoose.Types.ObjectId(masterId)
    
    const newAnimal = {
      ...animalData,
      master_id: masterObjectId,
      condominio_id: new mongoose.Types.ObjectId(animalData.condominio_id),
      morador_id: animalData.morador_id ? new mongoose.Types.ObjectId(animalData.morador_id) : undefined,
      inquilino_id: animalData.inquilino_id ? new mongoose.Types.ObjectId(animalData.inquilino_id) : undefined,
      data_criacao: new Date(),
      ativo: true
    }

    const result = await Animal.create(newAnimal)
    
    return NextResponse.json({
      success: true,
      animal: result
    })
    
  } catch (error) {
    console.error('Error creating animal:', error)
    return NextResponse.json(
      { error: 'Erro ao criar animal' },
      { status: 500 }
    )
  }
}

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
    
    const { _id, ...animalData } = (request as any)._parsedBody || await request.json()
    
    if (!_id) {
      return NextResponse.json(
        { error: 'ID do animal é obrigatório' },
        { status: 400 }
      )
    }

    await connectDB()
    
    // Converter masterId string para ObjectId
    const masterObjectId = new mongoose.Types.ObjectId(masterId)
    
    // Verificar se o animal existe e pertence ao master
    const existingAnimal = await Animal.findOne({
      _id: new ObjectId(_id),
      master_id: masterObjectId
    })
    
    if (!existingAnimal) {
      return NextResponse.json(
        { error: 'Animal não encontrado' },
        { status: 404 }
      )
    }
    
    if (!canUserEditEntity(existingAnimal, user)) {
      return NextResponse.json(
        { error: 'Você não tem permissão para editar este animal' },
        { status: 403 }
      )
    }
    const result = await Animal.findByIdAndUpdate(new mongoose.Types.ObjectId(_id) , animalData , { new: true })
    
    if (!result) {
      return NextResponse.json(
        { error: 'Animal não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Animal atualizado com sucesso'
    })
    
  } catch (error) {
    console.error('Error updating animal:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar animal' },
      { status: 500 }
    )
  }
}

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
        { error: 'ID do animal é obrigatório' },
        { status: 400 }
      )
    }

    await connectDB()
    
    // Converter masterId string para ObjectId
    const masterObjectId = new mongoose.Types.ObjectId(masterId)
    
    // Verificar se o animal existe e pertence ao master
    const existingAnimal = await Animal.findOne({
      _id: new ObjectId(id),
      master_id: masterObjectId
    })
    
    if (!existingAnimal) {
      return NextResponse.json(
        { error: 'Animal não encontrado' },
        { status: 404 }
      )
    }
    const result = await Animal.findByIdAndDelete(new mongoose.Types.ObjectId(id) )
    
    if (!result) {
      return NextResponse.json(
        { error: 'Animal não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Animal excluído com sucesso'
    })
    
  } catch (error) {
    console.error('Error deleting animal:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir animal' },
      { status: 500 }
    )
  }
}