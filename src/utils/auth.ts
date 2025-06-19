import { NextRequest } from 'next/server'

export interface AuthUser {
  id: string
  nome: string
  email: string
  tipo: 'master' | 'adm' | 'colaborador' | 'morador'
  isMaster: boolean
  isAdm: boolean
  condominio_id?: string
  master_id?: string
}

/**
 * Extrai dados do usuário autenticado da requisição
 * Busca por master_id nos query params ou no body da requisição
 */
export async function getAuthUser(request: NextRequest): Promise<{ masterId: string; isValid: boolean }> {
  try {
    const url = new URL(request.url)
    let masterId = url.searchParams.get('master_id')
    
    // Se não encontrou nos query params, tenta no body (para POST/PUT)
    if (!masterId && (request.method === 'POST' || request.method === 'PUT')) {
      try {
        const body = await request.json()
        masterId = body.master_id
        
        // Recriar o request com o body já lido (hack para Next.js)
        const newRequest = new NextRequest(request.url, {
          method: request.method,
          headers: request.headers,
          body: JSON.stringify(body)
        })
        
        // Adicionar o body no request para uso posterior
        ;(request as any)._parsedBody = body
      } catch (error) {
        // Se não conseguir ler o body, continue sem ele
      }
    }
    
    if (!masterId) {
      return { masterId: '', isValid: false }
    }
    
    return { masterId, isValid: true }
    
  } catch (error) {
    console.error('Error extracting auth user:', error)
    return { masterId: '', isValid: false }
  }
}

/**
 * Valida se o usuário tem permissão para acessar o recurso
 */
export function validateUserPermission(userMasterId: string, resourceMasterId: string): boolean {
  return userMasterId === resourceMasterId
}

/**
 * Garante que o master_id seja sempre vinculado aos dados
 */
export function ensureMasterIdBinding(data: any, masterId: string | any): any {
  return {
    ...data,
    master_id: masterId,
    updated_at: new Date()
  }
}