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
    const tipo = searchParams.get('tipo') || 'verificacao'; // verificacao, analitico, sintetico
    
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
    
    await dbConnect();
    
    // Configurar relatório
    const config = {
      condominio_id: new ObjectId(condominio_id),
      data_inicio: dataInicio,
      data_fim: dataFim,
      formato: formato as 'json' | 'excel' | 'pdf',
      detalhado: tipo === 'analitico'
    };
    
    // Gerar Balancete
    const balancete = await RelatoriosContabeisService.gerarBalancete(config);
    
    // Filtrar contas baseado no tipo solicitado
    let contasFiltradas = balancete.contas;
    
    if (tipo === 'sintetico') {
      // Apenas contas sintéticas (que têm filhas)
      contasFiltradas = balancete.contas.filter(conta => 
        conta.conta_codigo.split('.').length <= 2
      );
    } else if (tipo === 'analitico') {
      // Apenas contas analíticas (que não têm filhas)
      contasFiltradas = balancete.contas.filter(conta => 
        conta.conta_codigo.split('.').length >= 3
      );
    }
    
    // Validar integridade
    const validacao = await RelatoriosContabeisService.validarIntegridade(config);
    
    // Retornar em diferentes formatos
    switch (formato) {
      case 'excel':
        const bufferExcel = await RelatoriosContabeisService.exportarParaExcel(
          { ...balancete, contas: contasFiltradas }, 
          'Balancete'
        );
        return new NextResponse(bufferExcel, {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="Balancete_${data_inicio}_${data_fim}.xlsx"`
          }
        });
        
      case 'pdf':
        const bufferPDF = await RelatoriosContabeisService.exportarParaPDF(
          { ...balancete, contas: contasFiltradas }, 
          'Balancete'
        );
        return new NextResponse(bufferPDF, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="Balancete_${data_inicio}_${data_fim}.pdf"`
          }
        });
        
      default:
        return NextResponse.json({
          success: true,
          data: {
            ...balancete,
            contas: contasFiltradas
          },
          validacao,
          metadata: {
            gerado_em: new Date().toISOString(),
            periodo: `${data_inicio} a ${data_fim}`,
            tipo_balancete: tipo,
            total_contas: contasFiltradas.length,
            integridade_ok: validacao.valido
          }
        });
    }
    
  } catch (error) {
    console.error('Erro ao gerar Balancete:', error);
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
      tipo = 'verificacao',
      incluir_zeradas = false,
      agrupar_por = null, // 'tipo_conta', 'nivel', null
      filtros = {}
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
      detalhado: tipo === 'analitico'
    };
    
    // Gerar Balancete
    let balancete = await RelatoriosContabeisService.gerarBalancete(config);
    
    // Aplicar filtros
    let contasFiltradas = balancete.contas;
    
    // Filtro por tipo
    if (tipo === 'sintetico') {
      contasFiltradas = contasFiltradas.filter(conta => 
        conta.conta_codigo.split('.').length <= 2
      );
    } else if (tipo === 'analitico') {
      contasFiltradas = contasFiltradas.filter(conta => 
        conta.conta_codigo.split('.').length >= 3
      );
    }
    
    // Filtro para excluir contas zeradas
    if (!incluir_zeradas) {
      contasFiltradas = contasFiltradas.filter(conta => 
        Math.abs(conta.saldo_atual) > 0.01 || 
        Math.abs(conta.debitos) > 0.01 || 
        Math.abs(conta.creditos) > 0.01
      );
    }
    
    // Filtros específicos
    if (filtros.tipo_conta) {
      contasFiltradas = contasFiltradas.filter(conta => 
        filtros.tipo_conta.includes(conta.tipo_conta)
      );
    }
    
    if (filtros.conta_codigo_inicio) {
      contasFiltradas = contasFiltradas.filter(conta => 
        conta.conta_codigo >= filtros.conta_codigo_inicio
      );
    }
    
    if (filtros.conta_codigo_fim) {
      contasFiltradas = contasFiltradas.filter(conta => 
        conta.conta_codigo <= filtros.conta_codigo_fim
      );
    }
    
    // Agrupamentos
    let dadosAgrupados = null;
    if (agrupar_por) {
      dadosAgrupados = agruparContas(contasFiltradas, agrupar_por);
    }
    
    // Recalcular totais baseado nas contas filtradas
    const totaisRecalculados = calcularTotais(contasFiltradas);
    
    // Validação
    const validacao = await RelatoriosContabeisService.validarIntegridade(config);
    
    return NextResponse.json({
      success: true,
      data: {
        ...balancete,
        contas: contasFiltradas,
        totais: totaisRecalculados,
        agrupamentos: dadosAgrupados
      },
      validacao,
      filtros_aplicados: {
        tipo,
        incluir_zeradas,
        agrupar_por,
        filtros_customizados: filtros
      },
      metadata: {
        gerado_em: new Date().toISOString(),
        periodo: `${data_inicio} a ${data_fim}`,
        total_contas_filtradas: contasFiltradas.length,
        total_contas_original: balancete.contas.length
      }
    });
    
  } catch (error) {
    console.error('Erro ao gerar Balancete (POST):', error);
    return NextResponse.json({
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

function agruparContas(contas: any[], criterio: string): any {
  const grupos: { [key: string]: any } = {};
  
  contas.forEach(conta => {
    let chaveGrupo: string;
    
    switch (criterio) {
      case 'tipo_conta':
        chaveGrupo = conta.tipo_conta;
        break;
      case 'nivel':
        chaveGrupo = `Nível ${conta.conta_codigo.split('.').length}`;
        break;
      default:
        chaveGrupo = 'Todas';
    }
    
    if (!grupos[chaveGrupo]) {
      grupos[chaveGrupo] = {
        contas: [],
        totais: {
          saldo_anterior: 0,
          debitos: 0,
          creditos: 0,
          saldo_atual: 0
        }
      };
    }
    
    grupos[chaveGrupo].contas.push(conta);
    grupos[chaveGrupo].totais.saldo_anterior += conta.saldo_anterior;
    grupos[chaveGrupo].totais.debitos += conta.debitos;
    grupos[chaveGrupo].totais.creditos += conta.creditos;
    grupos[chaveGrupo].totais.saldo_atual += conta.saldo_atual;
  });
  
  return grupos;
}

function calcularTotais(contas: any[]): any {
  return contas.reduce((acc, conta) => {
    acc.total_debitos += conta.debitos;
    acc.total_creditos += conta.creditos;
    
    switch (conta.tipo_conta) {
      case 'ativo':
        acc.total_ativo += conta.saldo_atual;
        break;
      case 'passivo':
        acc.total_passivo += conta.saldo_atual;
        break;
      case 'patrimonio_liquido':
        acc.total_patrimonio_liquido += conta.saldo_atual;
        break;
    }
    
    return acc;
  }, {
    total_debitos: 0,
    total_creditos: 0,
    total_ativo: 0,
    total_passivo: 0,
    total_patrimonio_liquido: 0,
    diferenca: 0
  });
}