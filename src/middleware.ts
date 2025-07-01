import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const userDataHeader = request.headers.get('x-user-data')
  let user

  if (userDataHeader) {
    try {
      user = JSON.parse(decodeURIComponent(userDataHeader))
    } catch (error) {
      console.error('Error parsing user data from header:', error)
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  const restrictedPaths = [
    '/financeiro',
    '/financeiro-condominio',
    '/financeiro-colaboradores',
    '/financeiro-morador',
    '/financeiro-dashboard',
    '/financeiro-unificado',
    '/financeiro-colaboradores-gerenciar'
  ]

  // Bloquear TODOS os moradores (proprietarios, inquilinos e dependentes) das rotas financeiras administrativas
  if (user && user.tipo === 'morador') {
    if (restrictedPaths.some(path => request.nextUrl.pathname.startsWith(path))) {
      return NextResponse.redirect(new URL('/morador-dashboard', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}