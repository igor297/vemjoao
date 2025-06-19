import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import ExtratoBancario from '@/models/ExtratoBancario'
import ContaBancaria from '@/models/ContaBancaria'
import Transacao from '@/models/Transacao'
import FinanceiroUnificado from '@/models/FinanceiroUnificado'
import multer from 'multer'
import csv from 'csv-parse'
import { Readable } from 'stream'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const masterId = url.searchParams.get('master_id')
    const condominioId = url.searchParams.get('condominio_id')
    const contaBancariaId = url.searchParams.get('conta_bancaria_id')
    const reconciliado = url.searchParams.get('reconciliado')
    const dataInicio = url.searchParams.get('data_inicio')
    const dataFim = url.searchParams.get('data_fim')
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '50')

    if (!masterId || !condominioId) {
      return NextResponse.json(
        { error: 'Master ID e Condomínio ID são obrigatórios' },
        { status: 400 }
      )
    }

    await connectDB()

    // Filtros base
    const filter: any = {
      condominio_id: condominioId
    }

    if (contaBancariaId) {
      filter.conta_bancaria_id = contaBancariaId
    }

    if (reconciliado !== null) {
      filter.reconciliado = reconciliado === 'true'
    }

    if (dataInicio && dataFim) {
      filter.data_movimento = {
        $gte: new Date(dataInicio),
        $lte: new Date(dataFim)
      }
    }

    // Consulta paginada
    const skip = (page - 1) * limit
    const total = await ExtratoBancario.countDocuments(filter)
    
    const extratos = await ExtratoBancario
      .find(filter)
      .sort({ data_movimento: -1 })
      .skip(skip)
      .limit(limit)
      .populate('conta_bancaria_id', 'banco agencia conta nome')
      .populate('transacao_id', 'id_transacao valor_final status')
      .lean()

    return NextResponse.json({
      success: true,
      extratos,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('Error fetching extratos bancários:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar extratos bancários' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const arquivo = formData.get('arquivo') as File
    const masterId = formData.get('master_id') as string
    const condominioId = formData.get('condominio_id') as string
    const contaBancariaId = formData.get('conta_bancaria_id') as string
    const tipoArquivo = formData.get('tipo_arquivo') as string

    if (!arquivo || !masterId || !condominioId || !contaBancariaId) {
      return NextResponse.json(
        { error: 'Arquivo, Master ID, Condomínio ID e Conta Bancária ID são obrigatórios' },
        { status: 400 }
      )
    }

    await connectDB()

    // Verificar se a conta bancária existe
    const contaBancaria = await ContaBancaria.findById(contaBancariaId)
    if (!contaBancaria) {
      return NextResponse.json(
        { error: 'Conta bancária não encontrada' },
        { status: 404 }
      )
    }

    // Processar arquivo baseado no tipo
    let movimentos: any[] = []
    
    if (tipoArquivo === 'csv') {
      movimentos = await processarCSV(arquivo)
    } else if (tipoArquivo === 'ofx') {
      movimentos = await processarOFX(arquivo)
    } else {
      return NextResponse.json(
        { error: 'Tipo de arquivo não suportado' },
        { status: 400 }
      )
    }

    // Salvar movimentos no banco
    const resultados = {
      total: movimentos.length,
      salvos: 0,
      duplicados: 0,
      erros: 0,
      detalhes: [] as any[]
    }

    for (const movimento of movimentos) {
      try {
        // Verificar se já existe
        const existente = await ExtratoBancario.findOne({
          documento: movimento.documento,
          conta_bancaria_id: contaBancariaId
        })

        if (existente) {
          resultados.duplicados++
          resultados.detalhes.push({
            documento: movimento.documento,
            status: 'duplicado'
          })
          continue
        }

        // Criar novo extrato
        const novoExtrato = new ExtratoBancario({
          ...movimento,
          condominio_id: condominioId,
          conta_bancaria_id: contaBancariaId,
          origem_importacao: tipoArquivo,
          arquivo_origem: arquivo.name,
          processado: true
        })

        // Categorização automática
        novoExtrato.categorizarAutomaticamente()

        await novoExtrato.save()
        resultados.salvos++
        resultados.detalhes.push({
          documento: movimento.documento,
          status: 'salvo',
          categoria: novoExtrato.categoria_automatica
        })

      } catch (error: any) {
        resultados.erros++
        resultados.detalhes.push({
          documento: movimento.documento,
          status: 'erro',
          erro: error.message
        })
      }
    }

    // Executar reconciliação automática para os novos extratos
    if (resultados.salvos > 0) {
      await executarReconciliacaoAutomatica(condominioId, contaBancariaId)
    }

    return NextResponse.json({
      success: true,
      message: `Processamento concluído: ${resultados.salvos} salvos, ${resultados.duplicados} duplicados, ${resultados.erros} erros`,
      resultados
    })

  } catch (error: any) {
    console.error('Error processing extrato bancário:', error)
    return NextResponse.json(
      { error: 'Erro ao processar extrato bancário' },
      { status: 500 }
    )
  }
}

// Funções auxiliares para processamento de arquivos
async function processarCSV(arquivo: File): Promise<any[]> {
  const conteudo = await arquivo.text()
  const movimentos: any[] = []

  return new Promise((resolve, reject) => {
    const parser = csv.parse({
      columns: true,
      skip_empty_lines: true,
      delimiter: ';'
    })

    parser.on('readable', function() {
      let record
      while (record = parser.read()) {
        // Mapear campos do CSV para nosso modelo
        const movimento = {
          data_movimento: new Date(record.data || record.Data),
          tipo_movimento: parseFloat(record.valor || record.Valor) > 0 ? 'credito' : 'debito',
          valor: Math.abs(parseFloat(record.valor || record.Valor)),
          historico: record.historico || record.Descricao || record.Histórico,
          documento: record.documento || record.Documento || `${record.data}-${record.valor}`,
          saldo_anterior: parseFloat(record.saldo_anterior || 0),
          saldo_atual: parseFloat(record.saldo_atual || record.saldo || 0)
        }

        // Detectar tipo específico de movimento
        const historico = movimento.historico.toLowerCase()
        if (historico.includes('pix')) {
          movimento.dados_pix = {
            identificador_transacao: record.identificador_pix || record.id_transacao || '',
            chave_pix: record.chave_pix
          }
        } else if (historico.includes('boleto')) {
          movimento.dados_boleto = {
            nosso_numero: record.nosso_numero,
            codigo_barras: record.codigo_barras
          }
        }

        movimentos.push(movimento)
      }
    })

    parser.on('error', reject)
    parser.on('end', () => resolve(movimentos))
    
    parser.write(conteudo)
    parser.end()
  })
}

async function processarOFX(arquivo: File): Promise<any[]> {
  // Implementação básica para OFX - seria necessário usar biblioteca específica
  const conteudo = await arquivo.text()
  const movimentos: any[] = []
  
  // Parser OFX simples (em produção usar biblioteca como 'ofx-js')
  const linhas = conteudo.split('\n')
  let movimentoAtual: any = {}
  
  for (const linha of linhas) {
    if (linha.includes('<STMTTRN>')) {
      movimentoAtual = {}
    } else if (linha.includes('</STMTTRN>')) {
      if (movimentoAtual.DTPOSTED && movimentoAtual.TRNAMT) {
        movimentos.push({
          data_movimento: new Date(
            movimentoAtual.DTPOSTED.substring(0, 4) + '-' +
            movimentoAtual.DTPOSTED.substring(4, 6) + '-' +
            movimentoAtual.DTPOSTED.substring(6, 8)
          ),
          tipo_movimento: parseFloat(movimentoAtual.TRNAMT) > 0 ? 'credito' : 'debito',
          valor: Math.abs(parseFloat(movimentoAtual.TRNAMT)),
          historico: movimentoAtual.MEMO || '',
          documento: movimentoAtual.FITID || '',
          saldo_anterior: 0,
          saldo_atual: 0
        })
      }
    } else {
      const match = linha.match(/<(\w+)>([^<]+)/)
      if (match) {
        movimentoAtual[match[1]] = match[2]
      }
    }
  }
  
  return movimentos
}

// Função de reconciliação automática
async function executarReconciliacaoAutomatica(condominioId: string, contaBancariaId?: string) {
  try {
    // Buscar extratos não reconciliados
    const filtroExtrato: any = {
      condominio_id: condominioId,
      reconciliado: false,
      processado: true
    }
    
    if (contaBancariaId) {
      filtroExtrato.conta_bancaria_id = contaBancariaId
    }

    const extratosNaoReconciliados = await ExtratoBancario.find(filtroExtrato)
    
    // Buscar transações não reconciliadas
    const transacoesNaoReconciliadas = await Transacao.find({
      condominio_id: condominioId,
      status: { $in: ['aprovado', 'pendente'] },
      reconciliado: false
    })

    let reconciliacoesAutomaticas = 0

    for (const extrato of extratosNaoReconciliados) {
      let melhorMatch: any = null
      let melhorScore = 0

      for (const transacao of transacoesNaoReconciliadas) {
        const score = extrato.calcularConfidenceScore(transacao)
        
        if (score > melhorScore && score >= 80) { // Threshold para reconciliação automática
          melhorScore = score
          melhorMatch = transacao
        }
      }

      if (melhorMatch) {
        // Reconciliar automaticamente
        extrato.reconciliado = true
        extrato.transacao_id = melhorMatch._id
        extrato.data_reconciliacao = new Date()
        extrato.confidence_score = melhorScore
        
        extrato.adicionarLog('reconciliacao_automatica', {
          transacao_id: melhorMatch._id,
          confidence_score: melhorScore,
          metodo: 'automatico'
        })

        await extrato.save()

        // Atualizar transação
        melhorMatch.reconciliado = true
        melhorMatch.extrato_bancario_id = extrato._id
        melhorMatch.data_reconciliacao = new Date()
        await melhorMatch.save()

        reconciliacoesAutomaticas++

        // Remover da lista para não reconciliar novamente
        const index = transacoesNaoReconciliadas.indexOf(melhorMatch)
        if (index > -1) {
          transacoesNaoReconciliadas.splice(index, 1)
        }
      }
    }

    console.log(`Reconciliação automática executada: ${reconciliacoesAutomaticas} matches encontrados`)
    return reconciliacoesAutomaticas

  } catch (error) {
    console.error('Erro na reconciliação automática:', error)
    return 0
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { 
      extrato_id, 
      transacao_id, 
      acao, 
      usuario_id,
      observacoes 
    } = await request.json()

    if (!extrato_id || !acao || !usuario_id) {
      return NextResponse.json(
        { error: 'Extrato ID, ação e usuário ID são obrigatórios' },
        { status: 400 }
      )
    }

    await connectDB()

    const extrato = await ExtratoBancario.findById(extrato_id)
    if (!extrato) {
      return NextResponse.json(
        { error: 'Extrato não encontrado' },
        { status: 404 }
      )
    }

    if (acao === 'reconciliar_manual') {
      if (!transacao_id) {
        return NextResponse.json(
          { error: 'Transação ID é obrigatório para reconciliação manual' },
          { status: 400 }
        )
      }

      const transacao = await Transacao.findById(transacao_id)
      if (!transacao) {
        return NextResponse.json(
          { error: 'Transação não encontrada' },
          { status: 404 }
        )
      }

      // Reconciliar manualmente
      extrato.reconciliado = true
      extrato.transacao_id = transacao_id
      extrato.data_reconciliacao = new Date()
      extrato.reconciliado_por = usuario_id
      extrato.confidence_score = 100 // Manual sempre tem score máximo

      extrato.adicionarLog('reconciliacao_manual', {
        transacao_id,
        observacoes,
        metodo: 'manual'
      }, usuario_id)

      await extrato.save()

      // Atualizar transação
      transacao.reconciliado = true
      transacao.extrato_bancario_id = extrato._id
      transacao.data_reconciliacao = new Date()
      await transacao.save()

      return NextResponse.json({
        success: true,
        message: 'Reconciliação manual realizada com sucesso'
      })

    } else if (acao === 'desreconciliar') {
      // Desfazer reconciliação
      if (extrato.transacao_id) {
        const transacao = await Transacao.findById(extrato.transacao_id)
        if (transacao) {
          transacao.reconciliado = false
          transacao.extrato_bancario_id = undefined
          transacao.data_reconciliacao = undefined
          await transacao.save()
        }
      }

      extrato.reconciliado = false
      extrato.transacao_id = undefined
      extrato.data_reconciliacao = undefined
      extrato.reconciliado_por = undefined
      extrato.confidence_score = 0

      extrato.adicionarLog('desreconciliacao', {
        observacoes,
        metodo: 'manual'
      }, usuario_id)

      await extrato.save()

      return NextResponse.json({
        success: true,
        message: 'Reconciliação desfeita com sucesso'
      })

    } else if (acao === 'categorizar') {
      const { categoria_manual } = await request.json()
      
      extrato.categoria_manual = categoria_manual
      extrato.adicionarLog('categorizacao_manual', {
        categoria_anterior: extrato.categoria_manual,
        categoria_nova: categoria_manual,
        observacoes
      }, usuario_id)

      await extrato.save()

      return NextResponse.json({
        success: true,
        message: 'Categorização atualizada com sucesso'
      })
    }

    return NextResponse.json(
      { error: 'Ação não reconhecida' },
      { status: 400 }
    )

  } catch (error: any) {
    console.error('Error updating extrato bancário:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar extrato bancário' },
      { status: 500 }
    )
  }
}