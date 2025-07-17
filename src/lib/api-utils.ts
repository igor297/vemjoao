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
          const text = await response.text();
          if (text.trim()) {
            const errorData = JSON.parse(text);
            return {
              success: false,
              data: errorData,
              error: errorData.message || errorData.error || 'Algo deu errado'
            };
          }
        }
      } catch (jsonError) {
        console.error('Error parsing error response JSON:', jsonError);
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

    // Verificar se há conteúdo antes de tentar fazer parse
    const text = await response.text();
    if (!text.trim()) {
      return {
        success: false,
        error: 'Resposta vazia do servidor'
      };
    }

    try {
      const data = JSON.parse(text);
      return {
        success: true,
        data
      };
    } catch (parseError) {
      console.error('Error parsing JSON response:', parseError, 'Response text:', text);
      return {
        success: false,
        error: 'Erro ao processar resposta do servidor'
      };
    }
  } catch (error) {
    console.error('Network or other error:', error);
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