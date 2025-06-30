import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Master from '@/models/Master'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    
    await connectDB()
    
    // Buscar o usuário master
    const masterUser = await Master.findOne({ email: email?.toLowerCase() })
    
    if (!masterUser) {
      return NextResponse.json({
        success: false,
        error: 'Usuário não encontrado',
        totalMasters: await Master.countDocuments()
      })
    }

    return NextResponse.json({
      success: true,
      user: {
        id: masterUser._id.toString(),
        nome: masterUser.nome,
        email: masterUser.email,
        senhaArmazenada: masterUser.senha,
        totalMasters: await Master.countDocuments()
      }
    })

  } catch (error) {
    console.error('Erro no debug:', error)
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 })
  }
}