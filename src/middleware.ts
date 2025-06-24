import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { autoSeed } from '@/lib/auto-seed'

export async function middleware(request: NextRequest) {
  // Executar auto-seed apenas no Railway (produção)
  if (process.env.NODE_ENV === 'production') {
    try {
      await autoSeed()
    } catch (error) {
      console.error('Erro no middleware auto-seed:', error)
      // Continua mesmo se o seed falhar
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}