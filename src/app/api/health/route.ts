import { NextRequest, NextResponse } from 'next/server'
import { autoSeed } from '@/lib/auto-seed'

export async function GET(request: NextRequest) {
  try {
    // Executar auto-seed na primeira requisição (apenas em produção)
    if (process.env.NODE_ENV === 'production') {
      await autoSeed()
    }

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      mongodb: 'connected'
    })
  } catch (error) {
    console.error('Health check error:', error)
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}