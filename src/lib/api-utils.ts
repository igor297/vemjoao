interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  success: boolean;
}

export async function safeJsonParse<T = any>(response: Response): Promise<ApiResponse<T>> {
  try {
    if (!response.ok) {
      // Tentar obter mensagem personalizada do servidor
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          return {
            success: false,
            data: errorData,
            error: errorData.message || errorData.error || 'Algo deu errado'
          };
        }
      } catch (jsonError) {
        // Se não conseguir fazer parse do JSON, usar mensagem genérica
      }
      
      return {
        success: false,
        error: 'Algo não funcionou como esperado'
      };
    }

    const contentType = response.headers.get('content-type');
    
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      
      if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
        return {
          success: false,
          error: 'Algo não funcionou como esperado. Tente novamente.'
        };
      }
      
      return {
        success: false,
        error: 'Algo não funcionou como esperado. Tente novamente.'
      };
    }

    const data = await response.json();
    return {
      success: true,
      data
    };
  } catch (error) {
    return {
      success: false,
      error: 'Algo não funcionou como esperado. Tente novamente.'
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
      error: 'Não conseguimos conectar ao servidor. Verifique sua internet.'
    };
  }
}