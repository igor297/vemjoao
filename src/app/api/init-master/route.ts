import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Master from '@/models/Master'
import { PersonalDataEncryption } from '@/lib/personalDataEncryption'

export async function POST(request: NextRequest) {
  try {
    await connectDB()
    
    // Verificar quantos masters existem
    const totalMasters = await Master.countDocuments()
    const existingMaster = await Master.findOne({ email: 'master@teste.com' })
    
    if (existingMaster) {
      return NextResponse.json({
        success: false,
        error: 'Usuário master@teste.com já existe',
        totalMasters,
        existingUser: {
          nome: existingMaster.nome,
          email: existingMaster.email,
          senha: existingMaster.senha
        }
      }, { status: 400 })
    }

    // Criar master inicial
    const masterData = {
      nome: 'Master Teste',
      email: 'master@teste.com',
      senha: await PersonalDataEncryption.hashPassword('>T8Nn7n_S8-T'),
      celular1: '(11) 99999-0001',
      celular2: '(11) 99999-0002'
    }

    const master = await Master.create(masterData)

    return NextResponse.json({
      success: true,
      message: 'Master criado com sucesso!',
      credentials: {
        email: 'master@teste.com',
        senha: '>T8Nn7n_S8-T'
      }
    })

  } catch (error) {
    console.error('Erro ao criar master:', error)
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}