/**
 * Utilitário para fazer requisições autenticadas do frontend
 */

export interface AuthenticatedUser {
  id: string
  nome: string
  email: string
  tipo: 'master' | 'adm' | 'colaborador' | 'morador'
  subtipo?: string
  condominio_id?: string
  master_id?: string
  senha?: string
}

/**
 * Obtém dados do usuário do localStorage
 */
export function getAuthenticatedUser(): AuthenticatedUser | null {
  try {
    const userData = localStorage.getItem('userData')
    if (!userData) return null
    
    return JSON.parse(userData)
  } catch (error) {
    console.error('Error parsing user data:', error)
    return null
  }
}

/**
 * Faz uma requisição autenticada enviando credenciais nos headers
 */
export async function makeAuthenticatedRequest(
  url: string, 
  options: RequestInit = {}
): Promise<Response> {
  const user = getAuthenticatedUser()
  
  if (!user) {
    throw new Error('Usuário não autenticado')
  }

  // Preparar headers de autenticação
  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-user-email': user.email,
    'x-user-id': user.id,
    'x-user-type': user.tipo
  }

  // Adicionar senha se disponível (para autenticação completa)
  if (user.senha) {
    authHeaders['x-user-password'] = user.senha
  }

  // Mergear com headers existentes
  const mergedOptions: RequestInit = {
    ...options,
    headers: {
      ...authHeaders,
      ...options.headers
    }
  }

  return fetch(url, mergedOptions)
}

/**
 * Helper para requisições GET autenticadas
 */
export async function authenticatedGet(url: string): Promise<Response> {
  return makeAuthenticatedRequest(url, { method: 'GET' })
}

/**
 * Helper para requisições POST autenticadas
 */
export async function authenticatedPost(url: string, data: any): Promise<Response> {
  return makeAuthenticatedRequest(url, {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Helper para requisições PUT autenticadas
 */
export async function authenticatedPut(url: string, data: any): Promise<Response> {
  return makeAuthenticatedRequest(url, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

/**
 * Helper para requisições DELETE autenticadas
 */
export async function authenticatedDelete(url: string): Promise<Response> {
  return makeAuthenticatedRequest(url, { method: 'DELETE' })
}