import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { action, provider, credentials } = await request.json()
    
    if (action === 'enable_real') {
      // Aqui você poderia salvar as credenciais no banco ou arquivo de configuração
      // Por segurança, vamos apenas mostrar como fazer
      
      console.log('🔧 [PIX Real] Configurando:', {
        provider,
        action,
        hasCredentials: !!credentials
      })
      
      return NextResponse.json({
        success: true,
        message: 'Para ativar PIX real, configure as variáveis de ambiente:',
        instructions: {
          mercado_pago: {
            env_vars: [
              'MERCADO_PAGO_ACCESS_TOKEN=seu_access_token_aqui',
              'MERCADO_PAGO_PUBLIC_KEY=sua_public_key_aqui',
              'PIX_USE_REAL=true'
            ],
            where_to_get: 'https://www.mercadopago.com.br/developers/panel/app',
            steps: [
              '1. Acesse o painel do Mercado Pago',
              '2. Crie uma aplicação',
              '3. Copie as credenciais de produção',
              '4. Configure as variáveis de ambiente',
              '5. Reinicie o servidor'
            ]
          },
          stone: {
            env_vars: [
              'STONE_API_KEY=sua_api_key_aqui',
              'STONE_SECRET_KEY=sua_secret_key_aqui',
              'PIX_USE_REAL=true'
            ],
            where_to_get: 'https://portal.stone.com.br/',
            steps: [
              '1. Acesse o portal Stone',
              '2. Vá em Integrações > API',
              '3. Gere suas credenciais',
              '4. Configure as variáveis de ambiente',
              '5. Reinicie o servidor'
            ]
          }
        },
        current_status: {
          pix_use_real: process.env.PIX_USE_REAL === 'true',
          mercado_pago_configured: !!process.env.MERCADO_PAGO_ACCESS_TOKEN,
          stone_configured: !!process.env.STONE_API_KEY
        }
      })
    }
    
    if (action === 'test_credentials') {
      // Testar as credenciais fornecidas
      const testResult = await testPixCredentials(provider, credentials)
      
      return NextResponse.json({
        success: testResult.success,
        message: testResult.message,
        details: testResult.details
      })
    }
    
    return NextResponse.json({
      success: false,
      error: 'Ação não reconhecida'
    }, { status: 400 })
    
  } catch (error) {
    console.error('❌ [PIX Config] Erro:', error)
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}

async function testPixCredentials(provider: string, credentials: any) {
  try {
    switch (provider) {
      case 'mercado_pago':
        // Testar conexão com Mercado Pago
        const mpResponse = await fetch('https://api.mercadopago.com/v1/account/settings', {
          headers: {
            'Authorization': `Bearer ${credentials.access_token}`
          }
        })
        
        if (mpResponse.ok) {
          const data = await mpResponse.json()
          return {
            success: true,
            message: 'Credenciais Mercado Pago válidas!',
            details: {
              account_id: data.id,
              country: data.country_id,
              site: data.site_id
            }
          }
        } else {
          return {
            success: false,
            message: 'Credenciais Mercado Pago inválidas',
            details: { status: mpResponse.status }
          }
        }
        
      case 'stone':
        // Testar conexão com Stone (implementar conforme API da Stone)
        return {
          success: true,
          message: 'Teste Stone não implementado ainda',
          details: {}
        }
        
      default:
        return {
          success: false,
          message: 'Provedor não suportado',
          details: {}
        }
    }
  } catch (error) {
    return {
      success: false,
      message: 'Erro ao testar credenciais: ' + error.message,
      details: { error: error.message }
    }
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    current_config: {
      pix_use_real: process.env.PIX_USE_REAL === 'true',
      mercado_pago: {
        configured: !!process.env.MERCADO_PAGO_ACCESS_TOKEN,
        token_preview: process.env.MERCADO_PAGO_ACCESS_TOKEN ? 
          `${process.env.MERCADO_PAGO_ACCESS_TOKEN.substring(0, 8)}...` : 'none'
      },
      stone: {
        configured: !!process.env.STONE_API_KEY
      },
      default_provider: process.env.PIX_DEFAULT_PROVIDER || 'mercado_pago'
    }
  })
}