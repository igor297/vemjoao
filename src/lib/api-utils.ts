interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  success: boolean;
}

export async function safeJsonParse<T = any>(response: Response): Promise<ApiResponse<T>> {
  try {
    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }

    const contentType = response.headers.get('content-type');
    
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      
      if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
        return {
          success: false,
          error: 'Servidor retornou HTML ao invés de JSON. Verifique a URL da API.'
        };
      }
      
      return {
        success: false,
        error: `Tipo de conteúdo inválido: ${contentType || 'não especificado'}`
      };
    }

    const data = await response.json();
    return {
      success: true,
      data
    };
  } catch (error) {
    if (error instanceof SyntaxError && error.message.includes('Unexpected token')) {
      return {
        success: false,
        error: 'Resposta não é um JSON válido. Verifique se a API está retornando o formato correto.'
      };
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao processar resposta'
    };
  }
}

export async function safeFetch<T = any>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(url, options);
    return await safeJsonParse<T>(response);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro de rede'
    };
  }
}