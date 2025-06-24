import { NextRequest, NextResponse } from 'next/server'
import { autoSeed, getSeedStatus } from '@/lib/auto-seed'

export async function POST(request: NextRequest) {
  try {
    console.log('🌱 Executando auto-seed via API...')
    await autoSeed()
    
    return NextResponse.json({
      success: true,
      message: 'Auto-seed executado com sucesso!',
      credentials: {
        email: 'master@teste.com',
        senha: '>T8Nn7n_S8-T'
      },
      status: getSeedStatus()
    })
  } catch (error) {
    console.error('Erro no auto-seed:', error)
    return NextResponse.json({
      success: false,
      error: 'Erro ao executar auto-seed',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: getSeedStatus(),
    instructions: {
      message: 'Para executar o seed, faça um POST para esta URL',
      credentials: 'master@teste.com / >T8Nn7n_S8-T'
    }
  })
}