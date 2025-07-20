import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Master from '@/models/Master'
import { PersonalDataEncryption } from '@/lib/personalDataEncryption'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB()
    
    const { id } = await params
    const master = await Master.findById(id).select('-senha')
    
    if (!master) {
      return NextResponse.json({
        success: false,
        error: 'Master não encontrado'
      }, { status: 404 })
    }

    // Preparar dados para exibição (descriptografa campos sensíveis)
    const displayData = PersonalDataEncryption.prepareForDisplay(master.toObject())
    
    return NextResponse.json({
      success: true,
      masters: displayData
    })

  } catch (error) {
    console.error('Erro ao buscar master:', error)
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB()
    
    const body = await request.json()
    const { nome, email, celular1, celular2, senha, password } = body
    const senhaInput = senha || password; // Aceita tanto 'senha' quanto 'password'

    const { id } = await params
    
    // Verificar se o master existe
    const existingMaster = await Master.findById(id)
    if (!existingMaster) {
      return NextResponse.json({
        success: false,
        error: 'Master não encontrado'
      }, { status: 404 })
    }

    // Verificar se o email já existe em outro master
    if (email && email !== existingMaster.email) {
      const emailExists = await Master.findOne({ 
        email: email.toLowerCase(),
        _id: { $ne: id }
      })
      if (emailExists) {
        return NextResponse.json({
          success: false,
          error: 'Este email já está em uso'
        }, { status: 400 })
      }
    }

    // Preparar dados para atualização
    const updateData: any = {}
    if (nome) updateData.nome = nome
    if (email) updateData.email = email.toLowerCase()
    if (celular1) updateData.celular1 = celular1
    if (celular2) updateData.celular2 = celular2
    
    // Se uma nova senha foi fornecida, hash ela
    if (senhaInput) {
      updateData.senha = await PersonalDataEncryption.hashPassword(senhaInput)
    }

    // Atualizar o master
    const updatedMaster = await Master.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-senha')

    return NextResponse.json({
      success: true,
      masters: updatedMaster
    })

  } catch (error) {
    console.error('Erro ao atualizar master:', error)
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}