import dbConnect from '@/lib/mongodb';
import LancamentoContabil from '@/models/LancamentoContabil';
import PlanoContas from '@/models/PlanoContas';
import { ObjectId } from 'mongodb';

export interface RelatorioConfig {
  condominio_id: ObjectId;
  data_inicio: Date;
  data_fim: Date;
  formato?: 'json' | 'excel' | 'pdf';
  detalhado?: boolean;
}

export interface ItemDRE {
  grupo: string;
  conta_codigo: string;
  conta_nome: string;
  valor: number;
  percentual?: number;
}

export interface DRE {
  periodo: {
    inicio: string;
    fim: string;
  };
  condominio_id: string;
  receita_bruta: ItemDRE[];
  deducoes_receita: ItemDRE[];
  receita_liquida: number;
  custos: ItemDRE[];
  lucro_bruto: number;
  despesas_operacionais: ItemDRE[];
  resultado_operacional: number;
  resultado_nao_operacional: ItemDRE[];
  resultado_antes_ir: number;
  provisoes_ir: ItemDRE[];
  lucro_liquido: number;
  total_receitas: number;
  total_custos: number;
  total_despesas: number;
  margem_liquida: number;
}

export interface ItemBalancete {
  conta_codigo: string;
  conta_nome: string;
  saldo_anterior: number;
  debitos: number;
  creditos: number;
  saldo_atual: number;
  tipo_conta: string;
  natureza: string;
}

export interface Balancete {
  periodo: {
    inicio: string;
    fim: string;
  };
  condominio_id: string;
  contas: ItemBalancete[];
  totais: {
    total_debitos: number;
    total_creditos: number;
    total_ativo: number;
    total_passivo: number;
    total_patrimonio_liquido: number;
    diferenca: number;
  };
}

export interface FluxoCaixa {
  periodo: {
    inicio: string;
    fim: string;
  };
  condominio_id: string;
  atividades_operacionais: {
    entradas: ItemDRE[];
    saidas: ItemDRE[];
    liquido_operacional: number;
  };
  atividades_investimento: {
    entradas: ItemDRE[];
    saidas: ItemDRE[];
    liquido_investimento: number;
  };
  atividades_financiamento: {
    entradas: ItemDRE[];
    saidas: ItemDRE[];
    liquido_financiamento: number;
  };
  variacao_liquida: number;
  saldo_inicial: number;
  saldo_final: number;
}

export class RelatoriosContabeisService {
  
  /**
   * Gera Demonstração do Resultado do Exercício (DRE)
   */
  static async gerarDRE(config: RelatorioConfig): Promise<DRE> {
    await dbConnect();
    
    const lancamentos = await LancamentoContabil.buscarParaDRE(
      config.condominio_id,
      config.data_inicio,
      config.data_fim
    );
    
    // Agrupar por categoria DRE
    const grupos: { [key: string]: ItemDRE[] } = {
      receita_bruta: [],
      deducoes_receita: [],
      custo_produtos_vendidos: [],
      despesas_operacionais: [],
      resultado_nao_operacional: [],
      provisao_ir_csll: []
    };
    
    let totalReceitas = 0;
    let totalCustos = 0;
    let totalDespesas = 0;
    
    lancamentos.forEach((item: any) => {
      const grupo = item._id.grupo_dre;
      const itemDRE: ItemDRE = {
        grupo,
        conta_codigo: item._id.conta_id.toString(),
        conta_nome: item._id.conta_nome,
        valor: item.saldo
      };
      
      if (grupos[grupo]) {
        grupos[grupo].push(itemDRE);
        
        // Somar totais
        if (['receita_bruta'].includes(grupo)) {
          totalReceitas += item.saldo;
        } else if (['custo_produtos_vendidos'].includes(grupo)) {
          totalCustos += Math.abs(item.saldo);
        } else if (['despesas_operacionais'].includes(grupo)) {
          totalDespesas += Math.abs(item.saldo);
        }
      }
    });
    
    // Calcular indicadores
    const receitaBruta = grupos.receita_bruta.reduce((sum, item) => sum + item.valor, 0);
    const deducoesReceita = grupos.deducoes_receita.reduce((sum, item) => sum + Math.abs(item.valor), 0);
    const receitaLiquida = receitaBruta - deducoesReceita;
    
    const custos = grupos.custo_produtos_vendidos.reduce((sum, item) => sum + Math.abs(item.valor), 0);
    const lucroBruto = receitaLiquida - custos;
    
    const despesasOperacionais = grupos.despesas_operacionais.reduce((sum, item) => sum + Math.abs(item.valor), 0);
    const resultadoOperacional = lucroBruto - despesasOperacionais;
    
    const resultadoNaoOperacional = grupos.resultado_nao_operacional.reduce((sum, item) => sum + item.valor, 0);
    const resultadoAntesIR = resultadoOperacional + resultadoNaoOperacional;
    
    const provisoesIR = grupos.provisao_ir_csll.reduce((sum, item) => sum + Math.abs(item.valor), 0);
    const lucroLiquido = resultadoAntesIR - provisoesIR;
    
    // Calcular percentuais
    const calcularPercentual = (items: ItemDRE[], base: number) => {
      items.forEach(item => {
        item.percentual = base > 0 ? (item.valor / base) * 100 : 0;
      });
    };
    
    calcularPercentual(grupos.receita_bruta, receitaBruta);
    calcularPercentual(grupos.deducoes_receita, receitaBruta);
    calcularPercentual(grupos.custo_produtos_vendidos, receitaBruta);
    calcularPercentual(grupos.despesas_operacionais, receitaBruta);
    
    return {
      periodo: {
        inicio: config.data_inicio.toISOString().split('T')[0],
        fim: config.data_fim.toISOString().split('T')[0]
      },
      condominio_id: config.condominio_id.toString(),
      receita_bruta: grupos.receita_bruta,
      deducoes_receita: grupos.deducoes_receita,
      receita_liquida: receitaLiquida,
      custos: grupos.custo_produtos_vendidos,
      lucro_bruto: lucroBruto,
      despesas_operacionais: grupos.despesas_operacionais,
      resultado_operacional: resultadoOperacional,
      resultado_nao_operacional: grupos.resultado_nao_operacional,
      resultado_antes_ir: resultadoAntesIR,
      provisoes_ir: grupos.provisao_ir_csll,
      lucro_liquido: lucroLiquido,
      total_receitas: totalReceitas,
      total_custos: totalCustos,
      total_despesas: totalDespesas,
      margem_liquida: receitaBruta > 0 ? (lucroLiquido / receitaBruta) * 100 : 0
    };
  }
  
  /**
   * Gera Balancete de Verificação
   */
  static async gerarBalancete(config: RelatorioConfig): Promise<Balancete> {
    await dbConnect();
    
    const lancamentos = await LancamentoContabil.buscarParaBalancete(
      config.condominio_id,
      config.data_inicio,
      config.data_fim
    );
    
    // Buscar saldos anteriores (período anterior ao início)
    const dataAnterior = new Date(config.data_inicio);
    dataAnterior.setDate(dataAnterior.getDate() - 1);
    
    const saldosAnteriores = await LancamentoContabil.buscarParaBalancete(
      config.condominio_id,
      new Date('2000-01-01'), // Desde o início
      dataAnterior
    );
    
    // Criar mapa de saldos anteriores
    const mapaSaldosAnteriores: { [key: string]: number } = {};
    saldosAnteriores.forEach((item: any) => {
      mapaSaldosAnteriores[item._id.conta_id.toString()] = item.saldo;
    });
    
    // Processar contas do período
    const contas: ItemBalancete[] = lancamentos.map((item: any) => {
      const contaId = item._id.conta_id.toString();
      const saldoAnterior = mapaSaldosAnteriores[contaId] || 0;
      
      return {
        conta_codigo: item._id.conta_codigo,
        conta_nome: item._id.conta_nome,
        saldo_anterior: saldoAnterior,
        debitos: item.total_debito,
        creditos: item.total_credito,
        saldo_atual: saldoAnterior + item.saldo,
        tipo_conta: item._id.tipo_conta,
        natureza: item._id.natureza
      };
    });
    
    // Calcular totais
    const totais = contas.reduce((acc, conta) => {
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
    
    // Calcular diferença (deve ser zero se estiver quadrado)
    totais.diferenca = totais.total_ativo - (totais.total_passivo + totais.total_patrimonio_liquido);
    
    return {
      periodo: {
        inicio: config.data_inicio.toISOString().split('T')[0],
        fim: config.data_fim.toISOString().split('T')[0]
      },
      condominio_id: config.condominio_id.toString(),
      contas: contas.sort((a, b) => a.conta_codigo.localeCompare(b.conta_codigo)),
      totais
    };
  }
  
  /**
   * Gera Demonstração de Fluxo de Caixa
   */
  static async gerarFluxoCaixa(config: RelatorioConfig): Promise<FluxoCaixa> {
    await dbConnect();
    
    // Buscar lançamentos com classificação de fluxo de caixa
    const pipeline = [
      {
        $match: {
          condominio_id: config.condominio_id,
          data_lancamento: { $gte: config.data_inicio, $lte: config.data_fim },
          status: 'confirmado'
        }
      },
      {
        $unwind: '$partidas'
      },
      {
        $lookup: {
          from: 'planocontas',
          localField: 'partidas.conta_id',
          foreignField: '_id',
          as: 'conta'
        }
      },
      {
        $unwind: '$conta'
      },
      {
        $match: {
          'conta.grupo_fluxo_caixa': { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: {
            grupo_fluxo: '$conta.grupo_fluxo_caixa',
            conta_id: '$conta._id',
            conta_nome: '$conta.nome',
            natureza: '$conta.natureza'
          },
          total_debito: { $sum: '$partidas.valor_debito' },
          total_credito: { $sum: '$partidas.valor_credito' },
          saldo: {
            $sum: {
              $cond: [
                { $eq: ['$conta.natureza', 'debito'] },
                { $subtract: ['$partidas.valor_debito', '$partidas.valor_credito'] },
                { $subtract: ['$partidas.valor_credito', '$partidas.valor_debito'] }
              ]
            }
          }
        }
      }
    ];
    
    const resultados = await LancamentoContabil.aggregate(pipeline);
    
    // Agrupar por atividade
    const atividades = {
      operacionais: { entradas: [] as ItemDRE[], saidas: [] as ItemDRE[] },
      investimento: { entradas: [] as ItemDRE[], saidas: [] as ItemDRE[] },
      financiamento: { entradas: [] as ItemDRE[], saidas: [] as ItemDRE[] }
    };
    
    resultados.forEach((item: any) => {
      const itemFluxo: ItemDRE = {
        grupo: item._id.grupo_fluxo,
        conta_codigo: item._id.conta_id.toString(),
        conta_nome: item._id.conta_nome,
        valor: Math.abs(item.saldo)
      };
      
      const isEntrada = item.saldo > 0;
      
      switch (item._id.grupo_fluxo) {
        case 'atividades_operacionais':
          if (isEntrada) {
            atividades.operacionais.entradas.push(itemFluxo);
          } else {
            atividades.operacionais.saidas.push(itemFluxo);
          }
          break;
        case 'atividades_investimento':
          if (isEntrada) {
            atividades.investimento.entradas.push(itemFluxo);
          } else {
            atividades.investimento.saidas.push(itemFluxo);
          }
          break;
        case 'atividades_financiamento':
          if (isEntrada) {
            atividades.financiamento.entradas.push(itemFluxo);
          } else {
            atividades.financiamento.saidas.push(itemFluxo);
          }
          break;
      }
    });
    
    // Calcular líquidos
    const liquidoOperacional = 
      atividades.operacionais.entradas.reduce((sum, item) => sum + item.valor, 0) -
      atividades.operacionais.saidas.reduce((sum, item) => sum + item.valor, 0);
    
    const liquidoInvestimento = 
      atividades.investimento.entradas.reduce((sum, item) => sum + item.valor, 0) -
      atividades.investimento.saidas.reduce((sum, item) => sum + item.valor, 0);
    
    const liquidoFinanciamento = 
      atividades.financiamento.entradas.reduce((sum, item) => sum + item.valor, 0) -
      atividades.financiamento.saidas.reduce((sum, item) => sum + item.valor, 0);
    
    const variacaoLiquida = liquidoOperacional + liquidoInvestimento + liquidoFinanciamento;
    
    // Buscar saldos de caixa
    const saldoInicial = await this.buscarSaldoCaixa(config.condominio_id, config.data_inicio);
    const saldoFinal = saldoInicial + variacaoLiquida;
    
    return {
      periodo: {
        inicio: config.data_inicio.toISOString().split('T')[0],
        fim: config.data_fim.toISOString().split('T')[0]
      },
      condominio_id: config.condominio_id.toString(),
      atividades_operacionais: {
        entradas: atividades.operacionais.entradas,
        saidas: atividades.operacionais.saidas,
        liquido_operacional: liquidoOperacional
      },
      atividades_investimento: {
        entradas: atividades.investimento.entradas,
        saidas: atividades.investimento.saidas,
        liquido_investimento: liquidoInvestimento
      },
      atividades_financiamento: {
        entradas: atividades.financiamento.entradas,
        saidas: atividades.financiamento.saidas,
        liquido_financiamento: liquidoFinanciamento
      },
      variacao_liquida: variacaoLiquida,
      saldo_inicial: saldoInicial,
      saldo_final: saldoFinal
    };
  }
  
  /**
   * Busca saldo de caixa em uma data específica
   */
  private static async buscarSaldoCaixa(condominioId: ObjectId, data: Date): Promise<number> {
    // Buscar contas de caixa e bancos
    const contasCaixa = await PlanoContas.find({
      condominio_id: condominioId,
      subtipo: { $in: ['caixa', 'banco'] },
      ativo: true
    });
    
    let saldoTotal = 0;
    
    for (const conta of contasCaixa) {
      const saldoConta = await conta.getSaldo(new Date('2000-01-01'), data);
      saldoTotal += saldoConta.saldo;
    }
    
    return saldoTotal;
  }
  
  /**
   * Exporta relatório para Excel
   */
  static async exportarParaExcel(relatorio: any, tipoRelatorio: string): Promise<Buffer> {
    // TODO: Implementar exportação para Excel usando biblioteca como exceljs
    console.log(`Exportando ${tipoRelatorio} para Excel`);
    return Buffer.from('Excel export not implemented yet');
  }
  
  /**
   * Exporta relatório para PDF
   */
  static async exportarParaPDF(relatorio: any, tipoRelatorio: string): Promise<Buffer> {
    // TODO: Implementar exportação para PDF usando biblioteca como puppeteer
    console.log(`Exportando ${tipoRelatorio} para PDF`);
    return Buffer.from('PDF export not implemented yet');
  }
  
  /**
   * Valida integridade contábil do período
   */
  static async validarIntegridade(config: RelatorioConfig): Promise<{
    valido: boolean;
    erros: string[];
    alertas: string[];
  }> {
    const balancete = await this.gerarBalancete(config);
    const erros: string[] = [];
    const alertas: string[] = [];
    
    // Verificar se balancete está quadrado
    if (Math.abs(balancete.totais.diferenca) > 0.01) {
      erros.push(`Balancete não está quadrado. Diferença: R$ ${balancete.totais.diferenca.toFixed(2)}`);
    }
    
    // Verificar se débitos = créditos
    if (Math.abs(balancete.totais.total_debitos - balancete.totais.total_creditos) > 0.01) {
      erros.push('Total de débitos diferente do total de créditos');
    }
    
    // Verificar contas com saldos negativos inadequados
    balancete.contas.forEach(conta => {
      if (conta.tipo_conta === 'ativo' && conta.saldo_atual < 0) {
        alertas.push(`Conta de ativo com saldo negativo: ${conta.conta_nome}`);
      }
      if (conta.tipo_conta === 'receita' && conta.saldo_atual < 0) {
        alertas.push(`Conta de receita com saldo negativo: ${conta.conta_nome}`);
      }
    });
    
    return {
      valido: erros.length === 0,
      erros,
      alertas
    };
  }
}

export default RelatoriosContabeisService;