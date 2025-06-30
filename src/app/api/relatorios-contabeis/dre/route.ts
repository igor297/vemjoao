import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import dbConnect from '@/lib/mongodb';
import RelatoriosContabeisService from '@/lib/contabilidade/relatorios-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Validar parâmetros obrigatórios
    const condominio_id = searchParams.get('condominio_id');
    const data_inicio = searchParams.get('data_inicio');
    const data_fim = searchParams.get('data_fim');
    const formato = searchParams.get('formato') || 'json';
    
    if (!condominio_id || !data_inicio || !data_fim) {
      return NextResponse.json({
        error: 'Parâmetros obrigatórios: condominio_id, data_inicio, data_fim'
      }, { status: 400 });
    }
    
    // Validar formato de data
    const dataInicio = new Date(data_inicio);
    const dataFim = new Date(data_fim);
    
    if (isNaN(dataInicio.getTime()) || isNaN(dataFim.getTime())) {
      return NextResponse.json({
        error: 'Formato de data inválido. Use YYYY-MM-DD'
      }, { status: 400 });
    }
    
    if (dataInicio > dataFim) {
      return NextResponse.json({
        error: 'Data início deve ser anterior à data fim'
      }, { status: 400 });
    }
    
    await dbConnect();
    
    // Configurar relatório
    const config = {
      condominio_id: new ObjectId(condominio_id),
      data_inicio: dataInicio,
      data_fim: dataFim,
      formato: formato as 'json' | 'excel' | 'pdf',
      detalhado: searchParams.get('detalhado') === 'true'
    };
    
    // Gerar DRE
    const dre = await RelatoriosContabeisService.gerarDRE(config);
    
    // Retornar em diferentes formatos
    switch (formato) {
      case 'excel':
        const bufferExcel = await RelatoriosContabeisService.exportarParaExcel(dre, 'DRE');
        return new NextResponse(bufferExcel, {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="DRE_${data_inicio}_${data_fim}.xlsx"`
          }
        });
        
      case 'pdf':
        const bufferPDF = await RelatoriosContabeisService.exportarParaPDF(dre, 'DRE');
        return new NextResponse(bufferPDF, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="DRE_${data_inicio}_${data_fim}.pdf"`
          }
        });
        
      default:
        return NextResponse.json({
          success: true,
          data: dre,
          metadata: {
            gerado_em: new Date().toISOString(),
            periodo: `${data_inicio} a ${data_fim}`,
            total_linhas: (dre.receita_bruta?.length || 0) + 
                          (dre.despesas_operacionais?.length || 0) + 
                          (dre.custos?.length || 0)
          }
        });
    }
    
  } catch (error) {
    console.error('Erro ao gerar DRE:', error);
    return NextResponse.json({
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      condominio_id,
      data_inicio,
      data_fim,
      formato = 'json',
      detalhado = false,
      comparativo = false,
      periodo_comparativo
    } = body;
    
    if (!condominio_id || !data_inicio || !data_fim) {
      return NextResponse.json({
        error: 'Campos obrigatórios: condominio_id, data_inicio, data_fim'
      }, { status: 400 });
    }
    
    await dbConnect();
    
    const config = {
      condominio_id: new ObjectId(condominio_id),
      data_inicio: new Date(data_inicio),
      data_fim: new Date(data_fim),
      formato: formato as 'json' | 'excel' | 'pdf',
      detalhado
    };
    
    // Gerar DRE principal
    const dre = await RelatoriosContabeisService.gerarDRE(config);
    
    let dreComparativo = null;
    
    // Gerar DRE comparativo se solicitado
    if (comparativo && periodo_comparativo) {
      const configComparativo = {
        ...config,
        data_inicio: new Date(periodo_comparativo.data_inicio),
        data_fim: new Date(periodo_comparativo.data_fim)
      };
      
      dreComparativo = await RelatoriosContabeisService.gerarDRE(configComparativo);
    }
    
    // Calcular variações se houver comparativo
    let analiseComparativa = null;
    if (dreComparativo) {
      analiseComparativa = {
        variacao_receita_bruta: dre.total_receitas - dreComparativo.total_receitas,
        variacao_percentual_receita: dreComparativo.total_receitas > 0 
          ? ((dre.total_receitas - dreComparativo.total_receitas) / dreComparativo.total_receitas) * 100 
          : 0,
        variacao_lucro_liquido: dre.lucro_liquido - dreComparativo.lucro_liquido,
        variacao_percentual_lucro: dreComparativo.lucro_liquido > 0 
          ? ((dre.lucro_liquido - dreComparativo.lucro_liquido) / dreComparativo.lucro_liquido) * 100 
          : 0,
        variacao_margem_liquida: dre.margem_liquida - dreComparativo.margem_liquida
      };
    }
    
    return NextResponse.json({
      success: true,
      data: {
        dre_atual: dre,
        dre_comparativo: dreComparativo,
        analise_comparativa: analiseComparativa
      },
      metadata: {
        gerado_em: new Date().toISOString(),
        comparativo: comparativo,
        detalhado: detalhado
      }
    });
    
  } catch (error) {
    console.error('Erro ao gerar DRE (POST):', error);
    return NextResponse.json({
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}