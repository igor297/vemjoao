import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Master from '@/models/Master'
import Adm from '@/models/Adm'

export async function GET(request: NextRequest) {
  try {
    await connectDB()
    
    // Verificar se há dados de usuário no header (enviados pelo frontend)
    const userHeader = request.headers.get('x-user-data')
    
    if (!userHeader) {
      // Se não há dados no header, retornar um usuário padrão ou erro
      return NextResponse.json({
        success: false,
        error: 'Dados de usuário não encontrados'
      }, { status: 401 })
    }

    try {
      const userData = JSON.parse(userHeader)
      return NextResponse.json(userData)
    } catch (parseError) {
      // Se não conseguir parsear, tentar buscar um usuário master padrão
      const defaultUser = await Master.findOne().select('-senha').lean()
      
      if (defaultUser) {
        const userResponse = {
          id: defaultUser._id,
          nome: defaultUser.nome,
          email: defaultUser.email,
          tipo: 'master',
          master_id: defaultUser._id,
          ativo: true
        }
        return NextResponse.json(userResponse)
      }
      
      return NextResponse.json({
        success: false,
        error: 'Usuário não encontrado'
      }, { status: 404 })
    }

  } catch (error) {
    console.error('Erro ao buscar dados do usuário:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}