import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import CobrancaAutomatizada, { validarCobrancaAutomatizada, substituirVariaveisTemplate, VARIAVEIS_TEMPLATE } from '@/models/CobrancaAutomatizada'
import FinanceiroUnificado from '@/models/FinanceiroUnificado'
import mongoose from 'mongoose'

export async function GET(request: NextRequest) {
  try {
    await connectDB()
    
    const url = new URL(request.url)
    const masterId = url.searchParams.get('master_id')
    const condominioId = url.searchParams.get('condominio_id')
    const cobrancaId = url.searchParams.get('cobranca_id')
    const acao = url.searchParams.get('acao')

    if (!masterId) {
      return NextResponse.json({
        success: false,
        error: 'Master ID é obrigatório'
      }, { status: 400 })
    }

    // Buscar cobrança específica
    if (cobrancaId) {
      const cobranca = await CobrancaAutomatizada.findById(cobrancaId)
      
      if (!cobranca) {
        return NextResponse.json({
          success: false,
          error: 'Cobrança não encontrada'
        }, { status: 404 })
      }

      return NextResponse.json({
        success: true,
        cobranca
      })
    }

    // Retornar variáveis disponíveis para templates
    if (acao === 'variaveis_template') {
      return NextResponse.json({
        success: true,
        variaveis: VARIAVEIS_TEMPLATE
      })
    }

    // Status de execução das cobranças
    if (acao === 'status') {
      const cobrancas = await CobrancaAutomatizada.find({
        master_id: new mongoose.Types.ObjectId(masterId),
        ...(condominioId && { condominio_id: new mongoose.Types.ObjectId(condominioId) }),
        ativo: true
      })

      const agora = new Date()
      const status = {
        total_cobrancas: cobrancas.length,
        ativas: cobrancas.filter(c => c.ativa && !c.pausada).length,
        pausadas: cobrancas.filter(c => c.pausada).length,
        proximas_execucoes: cobrancas
          .filter(c => c.ativa && !c.pausada && c.estatisticas.proxima_execucao)
          .sort((a, b) => a.estatisticas.proxima_execucao.getTime() - b.estatisticas.proxima_execucao.getTime())
          .slice(0, 5)
          .map(c => ({
            nome: c.nome,
            proxima_execucao: c.estatisticas.proxima_execucao,
            tipo: c.tipo_cobranca
          })),
        estatisticas_gerais: {
          total_envios_mes: cobrancas.reduce((sum, c) => sum + c.estatisticas.total_envios, 0),
          taxa_sucesso_media: cobrancas.length > 0 
            ? cobrancas.reduce((sum, c) => sum + c.estatisticas.taxa_sucesso, 0) / cobrancas.length 
            : 0,
          valor_total_cobrado: cobrancas.reduce((sum, c) => sum + c.estatisticas.valor_total_cobrado, 0),
          valor_total_recebido: cobrancas.reduce((sum, c) => sum + c.estatisticas.valor_total_recebido, 0)
        }
      }

      return NextResponse.json({
        success: true,
        status
      })
    }

    // Listar todas as cobranças
    const query = {
      master_id: new mongoose.Types.ObjectId(masterId),
      ativo: true
    }

    if (condominioId) {
      query.condominio_id = new mongoose.Types.ObjectId(condominioId)
    }

    const cobrancas = await CobrancaAutomatizada.find(query)
      .sort({ data_criacao: -1 })

    return NextResponse.json({
      success: true,
      cobrancas
    })

  } catch (error) {
    console.error('Erro ao buscar cobranças automatizadas:', error)
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB()
    
    const dados = await request.json()
    const { acao } = dados

    // Ação para executar cobrança manualmente
    if (acao === 'executar') {
      const cobrancaId = dados.cobranca_id
      
      if (!cobrancaId) {
        return NextResponse.json({
          success: false,
          error: 'ID da cobrança é obrigatório para execução'
        }, { status: 400 })
      }

      const cobranca = await CobrancaAutomatizada.findById(cobrancaId)
      
      if (!cobranca) {
        return NextResponse.json({
          success: false,
          error: 'Cobrança não encontrada'
        }, { status: 404 })
      }

      try {
        const resultado = await executarCobranca(cobranca, 'manual')
        
        return NextResponse.json({
          success: true,
          message: 'Cobrança executada com sucesso',
          resultado
        })
      } catch (error) {
        return NextResponse.json({
          success: false,
          error: `Erro na execução: ${error.message}`
        }, { status: 500 })
      }
    }

    // Ação para testar template
    if (acao === 'testar_template') {
      const { template, dados_teste } = dados
      
      const templateProcessado = substituirVariaveisTemplate(template, dados_teste)
      
      return NextResponse.json({
        success: true,
        template_processado: templateProcessado
      })
    }

    // Criar nova cobrança
    const {
      master_id,
      condominio_id,
      nome,
      descricao,
      tipo_cobranca,
      configuracao
    } = dados

    if (!master_id || !condominio_id || !nome || !tipo_cobranca) {
      return NextResponse.json({
        success: false,
        error: 'Master ID, Condomínio ID, nome e tipo de cobrança são obrigatórios'
      }, { status: 400 })
    }

    // Validar configuração
    const configCompleta = {
      nome,
      tipo_cobranca,
      canais: configuracao?.canais || { email: true },
      frequencia: configuracao?.frequencia || 'unica',
      ...configuracao
    }

    const validacao = validarCobrancaAutomatizada(configCompleta)
    if (!validacao.valida) {
      return NextResponse.json({
        success: false,
        error: 'Configuração inválida',
        erros: validacao.erros
      }, { status: 400 })
    }

    // Verificar se já existe cobrança com o mesmo nome para o condomínio
    const cobrancaExistente = await CobrancaAutomatizada.findOne({
      condominio_id: new mongoose.Types.ObjectId(condominio_id),
      nome: nome.trim(),
      ativo: true
    })

    if (cobrancaExistente) {
      return NextResponse.json({
        success: false,
        error: 'Já existe uma cobrança com este nome para o condomínio'
      }, { status: 409 })
    }

    // Calcular próxima execução
    const proximaExecucao = calcularProximaExecucao(
      configuracao?.frequencia || 'unica',
      configuracao?.horario_envio || '09:00',
      configuracao?.dias_semana,
      configuracao?.dia_mes
    )

    const novaCobranca = new CobrancaAutomatizada({
      condominio_id: new mongoose.Types.ObjectId(condominio_id),
      master_id: new mongoose.Types.ObjectId(master_id),
      nome: nome.trim(),
      descricao: descricao?.trim(),
      tipo_cobranca,
      
      regras_disparo: {
        dias_antes_vencimento: configuracao?.dias_antes_vencimento,
        dias_apos_vencimento: configuracao?.dias_apos_vencimento,
        valor_minimo: configuracao?.valor_minimo || 0,
        apenas_inadimplentes: configuracao?.apenas_inadimplentes || false,
        apenas_primeiros_avisos: configuracao?.apenas_primeiros_avisos !== false
      },
      
      canais: {
        email: configuracao?.canais?.email !== false,
        whatsapp: configuracao?.canais?.whatsapp || false,
        sms: configuracao?.canais?.sms || false,
        notificacao_app: configuracao?.canais?.notificacao_app || false
      },
      
      template_email: {
        assunto: configuracao?.template_email?.assunto || 'Cobrança - {{nome_condominio}}',
        corpo: configuracao?.template_email?.corpo || 'Prezado {{nome_morador}}, você possui uma pendência no valor de {{valor}}',
        incluir_boleto: configuracao?.template_email?.incluir_boleto !== false,
        incluir_qr_pix: configuracao?.template_email?.incluir_qr_pix !== false
      },
      
      template_whatsapp: {
        mensagem: configuracao?.template_whatsapp?.mensagem || 'Olá {{nome_morador}}, você possui uma pendência de {{valor}} com vencimento em {{vencimento}}',
        incluir_link_pagamento: configuracao?.template_whatsapp?.incluir_link_pagamento !== false,
        incluir_qr_pix: configuracao?.template_whatsapp?.incluir_qr_pix !== false
      },
      
      template_sms: {
        mensagem: configuracao?.template_sms?.mensagem || '{{nome_condominio}}: Pendência de {{valor}}. Venc: {{vencimento}}',
        incluir_link_curto: configuracao?.template_sms?.incluir_link_curto !== false
      },
      
      frequencia: configuracao?.frequencia || 'unica',
      horario_envio: configuracao?.horario_envio || '09:00',
      dias_semana: configuracao?.dias_semana,
      dia_mes: configuracao?.dia_mes,
      
      max_tentativas_por_cobranca: configuracao?.max_tentativas || 3,
      intervalo_entre_tentativas: configuracao?.intervalo_tentativas || 24,
      parar_apos_pagamento: configuracao?.parar_apos_pagamento !== false,
      
      filtros: {
        categorias_incluir: configuracao?.filtros?.categorias_incluir,
        categorias_excluir: configuracao?.filtros?.categorias_excluir,
        valores: {
          minimo: configuracao?.filtros?.valor_minimo,
          maximo: configuracao?.filtros?.valor_maximo
        },
        unidades: configuracao?.filtros?.unidades,
        blocos: configuracao?.filtros?.blocos,
        tags_morador: configuracao?.filtros?.tags_morador
      },
      
      gerar_boleto_automatico: configuracao?.gerar_boleto !== false,
      gerar_pix_automatico: configuracao?.gerar_pix !== false,
      valor_juros_diario: configuracao?.juros_diario || 0.1,
      valor_multa: configuracao?.multa || 2,
      tipo_multa: configuracao?.tipo_multa || 'percentual',
      desconto_pagamento_antecipado: configuracao?.desconto_antecipado,
      dias_desconto: configuracao?.dias_desconto,
      
      ativa: configuracao?.ativa !== false,
      pausada: false,
      data_inicio: configuracao?.data_inicio || new Date(),
      data_fim: configuracao?.data_fim,
      
      estatisticas: {
        total_envios: 0,
        total_emails: 0,
        total_whatsapp: 0,
        total_sms: 0,
        total_pagamentos_gerados: 0,
        valor_total_cobrado: 0,
        valor_total_recebido: 0,
        taxa_sucesso: 0,
        proxima_execucao: proximaExecucao
      },
      
      historico_execucoes: [],
      
      criado_por_id: new mongoose.Types.ObjectId(dados.usuario_id || master_id),
      criado_por_nome: dados.usuario_nome || 'Sistema'
    })

    await novaCobranca.save()

    return NextResponse.json({
      success: true,
      message: 'Cobrança automatizada criada com sucesso',
      cobranca: novaCobranca
    })

  } catch (error) {
    console.error('Erro ao criar cobrança automatizada:', error)
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    await connectDB()
    
    const dados = await request.json()
    const { cobranca_id, acao, ...dadosAtualizacao } = dados

    if (!cobranca_id) {
      return NextResponse.json({
        success: false,
        error: 'ID da cobrança é obrigatório'
      }, { status: 400 })
    }

    const cobranca = await CobrancaAutomatizada.findById(cobranca_id)
    
    if (!cobranca) {
      return NextResponse.json({
        success: false,
        error: 'Cobrança não encontrada'
      }, { status: 404 })
    }

    // Ações específicas
    if (acao === 'pausar') {
      cobranca.pausada = !cobranca.pausada
      cobranca.data_atualizacao = new Date()
      await cobranca.save()

      return NextResponse.json({
        success: true,
        message: `Cobrança ${cobranca.pausada ? 'pausada' : 'retomada'} com sucesso`,
        pausada: cobranca.pausada
      })
    }

    if (acao === 'ativar') {
      cobranca.ativa = !cobranca.ativa
      cobranca.data_atualizacao = new Date()
      await cobranca.save()

      return NextResponse.json({
        success: true,
        message: `Cobrança ${cobranca.ativa ? 'ativada' : 'desativada'} com sucesso`,
        ativa: cobranca.ativa
      })
    }

    // Atualização geral
    const camposPermitidos = [
      'nome', 'descricao', 'regras_disparo', 'canais', 'template_email',
      'template_whatsapp', 'template_sms', 'frequencia', 'horario_envio',
      'dias_semana', 'dia_mes', 'max_tentativas_por_cobranca',
      'intervalo_entre_tentativas', 'parar_apos_pagamento', 'filtros',
      'gerar_boleto_automatico', 'gerar_pix_automatico', 'valor_juros_diario',
      'valor_multa', 'tipo_multa', 'desconto_pagamento_antecipado', 'dias_desconto'
    ]

    camposPermitidos.forEach(campo => {
      if (dadosAtualizacao[campo] !== undefined) {
        cobranca[campo] = dadosAtualizacao[campo]
      }
    })

    // Recalcular próxima execução se a frequência mudou
    if (dadosAtualizacao.frequencia || dadosAtualizacao.horario_envio || 
        dadosAtualizacao.dias_semana || dadosAtualizacao.dia_mes) {
      cobranca.estatisticas.proxima_execucao = calcularProximaExecucao(
        cobranca.frequencia,
        cobranca.horario_envio,
        cobranca.dias_semana,
        cobranca.dia_mes
      )
    }

    cobranca.data_atualizacao = new Date()
    await cobranca.save()

    return NextResponse.json({
      success: true,
      message: 'Cobrança atualizada com sucesso',
      cobranca
    })

  } catch (error) {
    console.error('Erro ao atualizar cobrança automatizada:', error)
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await connectDB()
    
    const url = new URL(request.url)
    const cobrancaId = url.searchParams.get('cobranca_id')

    if (!cobrancaId) {
      return NextResponse.json({
        success: false,
        error: 'ID da cobrança é obrigatório'
      }, { status: 400 })
    }

    const cobranca = await CobrancaAutomatizada.findById(cobrancaId)
    
    if (!cobranca) {
      return NextResponse.json({
        success: false,
        error: 'Cobrança não encontrada'
      }, { status: 404 })
    }

    // Soft delete
    cobranca.ativo = false
    cobranca.ativa = false
    cobranca.data_atualizacao = new Date()
    await cobranca.save()

    return NextResponse.json({
      success: true,
      message: 'Cobrança removida com sucesso'
    })

  } catch (error) {
    console.error('Erro ao remover cobrança automatizada:', error)
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}

// Função auxiliar para calcular próxima execução
function calcularProximaExecucao(frequencia: string, horario: string, diasSemana?: number[], diaMes?: number): Date {
  const agora = new Date()
  const proxima = new Date()
  const [hora, minuto] = horario.split(':').map(Number)

  switch (frequencia) {
    case 'diaria':
      proxima.setDate(agora.getDate() + 1)
      proxima.setHours(hora, minuto, 0, 0)
      break
    
    case 'semanal':
      if (diasSemana && diasSemana.length > 0) {
        // Encontrar próximo dia da semana
        const diaAtual = agora.getDay()
        const proximoDia = diasSemana.find(dia => dia > diaAtual) || diasSemana[0]
        const diasParaProximo = proximoDia > diaAtual ? proximoDia - diaAtual : 7 - diaAtual + proximoDia
        
        proxima.setDate(agora.getDate() + diasParaProximo)
        proxima.setHours(hora, minuto, 0, 0)
      }
      break
    
    case 'mensal':
      if (diaMes) {
        proxima.setMonth(agora.getMonth() + 1)
        proxima.setDate(diaMes)
        proxima.setHours(hora, minuto, 0, 0)
      }
      break
    
    default: // 'unica'
      proxima.setTime(agora.getTime() + 60000) // 1 minuto a partir de agora
      break
  }

  return proxima
}

// Função auxiliar para executar cobrança
async function executarCobranca(cobranca: any, tipo: 'manual' | 'automatica') {
  const inicioExecucao = Date.now()
  let quantidadeEnvios = 0
  const erros: string[] = []

  try {
    // Buscar pendências que atendem aos critérios da cobrança
    const query = {
      condominio_id: cobranca.condominio_id,
      master_id: cobranca.master_id,
      status: { $in: ['pendente', 'atrasado'] }
    }

    // Aplicar filtros da cobrança
    if (cobranca.regras_disparo.valor_minimo > 0) {
      query.valor = { $gte: cobranca.regras_disparo.valor_minimo }
    }

    if (cobranca.filtros.categorias_incluir?.length > 0) {
      query.subcategoria = { $in: cobranca.filtros.categorias_incluir }
    }

    if (cobranca.filtros.categorias_excluir?.length > 0) {
      query.subcategoria = { $nin: cobranca.filtros.categorias_excluir }
    }

    const pendencias = await FinanceiroUnificado.find(query).limit(100)

    // Simular envio de cobranças (na implementação real, integraria com services de email/WhatsApp/SMS)
    for (const pendencia of pendencias) {
      try {
        // Preparar dados para substituição no template
        const dadosTemplate = {
          nome_morador: pendencia.vinculo_nome || 'Morador',
          nome_condominio: 'Condomínio',
          valor: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pendencia.valor),
          valor_numero: pendencia.valor.toString(),
          vencimento: new Date(pendencia.data_vencimento).toLocaleDateString('pt-BR'),
          apartamento: pendencia.apartamento || '',
          bloco: pendencia.bloco || '',
          codigo_cobranca: pendencia.codigo_lancamento
        }

        // Enviar por cada canal ativo
        if (cobranca.canais.email) {
          // Simular envio de email
          quantidadeEnvios++
          cobranca.estatisticas.total_emails++
        }

        if (cobranca.canais.whatsapp) {
          // Simular envio de WhatsApp
          quantidadeEnvios++
          cobranca.estatisticas.total_whatsapp++
        }

        if (cobranca.canais.sms) {
          // Simular envio de SMS
          quantidadeEnvios++
          cobranca.estatisticas.total_sms++
        }

      } catch (error) {
        erros.push(`Erro ao processar pendência ${pendencia.codigo_lancamento}: ${error.message}`)
      }
    }

    // Atualizar estatísticas
    cobranca.estatisticas.total_envios += quantidadeEnvios
    cobranca.estatisticas.ultima_execucao = new Date()
    cobranca.estatisticas.proxima_execucao = calcularProximaExecucao(
      cobranca.frequencia,
      cobranca.horario_envio,
      cobranca.dias_semana,
      cobranca.dia_mes
    )

    // Adicionar ao histórico
    const tempoExecucao = Date.now() - inicioExecucao
    cobranca.historico_execucoes.push({
      data: new Date(),
      tipo,
      status: erros.length === 0 ? 'sucesso' : (quantidadeEnvios > 0 ? 'parcial' : 'erro'),
      detalhes: `Processadas ${pendencias.length} pendências, ${quantidadeEnvios} envios realizados`,
      quantidade_envios: quantidadeEnvios,
      tempo_execucao: tempoExecucao,
      erros: erros.length > 0 ? erros : undefined
    })

    await cobranca.save()

    return {
      pendencias_processadas: pendencias.length,
      envios_realizados: quantidadeEnvios,
      tempo_execucao: tempoExecucao,
      status: erros.length === 0 ? 'sucesso' : 'parcial',
      erros
    }

  } catch (error) {
    console.error('Erro na execução da cobrança:', error)
    throw error
  }
}