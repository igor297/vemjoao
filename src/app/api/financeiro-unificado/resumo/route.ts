import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import FinanceiroMorador from '@/models/FinanceiroMorador'
import FinanceiroCondominio from '@/models/FinanceiroCondominio'
import FinanceiroColaborador from '@/models/FinanceiroColaborador'
import Morador from '@/models/Morador'
import mongoose from 'mongoose'

export async function GET(request: NextRequest) {
  try {
    await connectDB()
    
    const url = new URL(request.url)
    const masterId = url.searchParams.get('master_id')
    const condominioId = url.searchParams.get('condominio_id')
    const tipoUsuario = url.searchParams.get('tipo_usuario')

    if (!masterId || !condominioId || !tipoUsuario) {
      return NextResponse.json({
        success: false,
        error: 'Master ID, condomínio ID e tipo de usuário são obrigatórios'
      }, { status: 400 })
    }

    const hoje = new Date()
    const filterBase = {
      master_id: new mongoose.Types.ObjectId(masterId),
      condominio_id: new mongoose.Types.ObjectId(condominioId),
      ativo: true
    }

    // 1. DADOS DOS MORADORES POR UNIDADE
    const moradores = await Morador.find({
      master_id: new mongoose.Types.ObjectId(masterId),
      condominio_id: new mongoose.Types.ObjectId(condominioId),
      ativo: true
    }).lean()

    // Agrupar moradores por unidade
    const unidadesMap = new Map()
    moradores.forEach(morador => {
      const chaveUnidade = `${morador.bloco || 'sem_bloco'}_${morador.unidade}`
      if (!unidadesMap.has(chaveUnidade)) {
        unidadesMap.set(chaveUnidade, {
          unidade: morador.unidade,
          bloco: morador.bloco,
          moradores: []
        })
      }
      unidadesMap.get(chaveUnidade).moradores.push(morador)
    })

    // Atualizar automaticamente status de lançamentos vencidos
    const updateResult = await FinanceiroMorador.updateMany(
      {
        condominio_id: new mongoose.Types.ObjectId(condominioId),
        status: 'pendente',
        data_vencimento: { $lt: hoje },
        ativo: true
      },
      {
        $set: {
          status: 'atrasado',
          data_atualizacao: new Date()
        }
      }
    )
    
    if (updateResult.modifiedCount > 0) {
      console.log(`🔄 Atualizados ${updateResult.modifiedCount} lançamentos de pendente para atrasado`)
    }

    // Buscar status financeiro de cada unidade
    const unidadesComStatus = await Promise.all(
      Array.from(unidadesMap.values()).map(async (unidadeData) => {
        const moradoresDaUnidade = unidadeData.moradores
        const idsmoradores = moradoresDaUnidade.map(m => m._id)
        
        // Lançamentos atrasados dos moradores (incluindo recém-atualizados)
        const lancamentosMoradorAtrasados = await FinanceiroMorador.aggregate([
          {
            $match: {
              morador_id: { $in: idsmoradores },
              condominio_id: new mongoose.Types.ObjectId(condominioId),
              $or: [
                { status: 'atrasado' },
                { 
                  status: 'pendente', 
                  data_vencimento: { $lt: hoje }
                }
              ],
              ativo: true
            }
          },
          {
            $group: {
              _id: null,
              total_atrasado: { $sum: '$valor' },
              count_atrasados: { $sum: 1 }
            }
          }
        ])

        const statusMorador = lancamentosMoradorAtrasados[0] || {
          total_atrasado: 0,
          count_atrasados: 0
        }

        const proprietario = moradoresDaUnidade.find(m => m.tipo === 'proprietario')
        const moradorPrincipal = proprietario || moradoresDaUnidade[0]
        const nomesMoradores = moradoresDaUnidade.map(m => `${m.nome} (${m.tipo})`).join(', ')

        return {
          _id: moradorPrincipal._id,
          nome: nomesMoradores,
          cpf: moradorPrincipal.cpf,
          unidade: unidadeData.unidade,
          bloco: unidadeData.bloco,
          tipo: proprietario ? 'unidade_com_proprietario' : moradoresDaUnidade[0].tipo,
          total_atrasado: statusMorador.total_atrasado,
          count_atrasados: statusMorador.count_atrasados,
          tem_atraso: statusMorador.count_atrasados > 0,
          moradores_na_unidade: moradoresDaUnidade.length,
          fonte: 'financeiro_morador'
        }
      })
    )

    // 2. DADOS DO CONDOMÍNIO (RECEITAS/DESPESAS)
    const resumoCondominio = await FinanceiroCondominio.aggregate([
      { $match: filterBase },
      {
        $group: {
          _id: null,
          total_receitas: {
            $sum: { $cond: [{ $eq: ['$tipo', 'receita'] }, '$valor', 0] }
          },
          total_despesas: {
            $sum: { $cond: [{ $eq: ['$tipo', 'despesa'] }, '$valor', 0] }
          },
          receitas_pendentes: {
            $sum: { 
              $cond: [
                { $and: [
                  { $eq: ['$tipo', 'receita'] },
                  { $eq: ['$status', 'pendente'] }
                ]}, 
                '$valor', 0
              ] 
            }
          },
          despesas_pendentes: {
            $sum: { 
              $cond: [
                { $and: [
                  { $eq: ['$tipo', 'despesa'] },
                  { $eq: ['$status', 'pendente'] }
                ]}, 
                '$valor', 0
              ] 
            }
          },
          receitas_atrasadas: {
            $sum: { 
              $cond: [
                { $and: [
                  { $eq: ['$tipo', 'receita'] },
                  { $eq: ['$status', 'atrasado'] }
                ]}, 
                '$valor', 0
              ] 
            }
          },
          despesas_atrasadas: {
            $sum: { 
              $cond: [
                { $and: [
                  { $eq: ['$tipo', 'despesa'] },
                  { $eq: ['$status', 'atrasado'] }
                ]}, 
                '$valor', 0
              ] 
            }
          },
          count_receitas_pendentes: {
            $sum: { 
              $cond: [
                { $and: [
                  { $eq: ['$tipo', 'receita'] },
                  { $eq: ['$status', 'pendente'] }
                ]}, 
                1, 0
              ] 
            }
          },
          count_despesas_pendentes: {
            $sum: { 
              $cond: [
                { $and: [
                  { $eq: ['$tipo', 'despesa'] },
                  { $eq: ['$status', 'pendente'] }
                ]}, 
                1, 0
              ] 
            }
          }
        }
      }
    ])

    const dadosCondominio = resumoCondominio[0] || {
      total_receitas: 0,
      total_despesas: 0,
      receitas_pendentes: 0,
      despesas_pendentes: 0,
      receitas_atrasadas: 0,
      despesas_atrasadas: 0,
      count_receitas_pendentes: 0,
      count_despesas_pendentes: 0
    }

    // 3. DADOS DOS COLABORADORES
    const resumoColaboradores = await FinanceiroColaborador.aggregate([
      { $match: filterBase },
      {
        $group: {
          _id: '$colaborador_id',
          colaborador_nome: { $first: '$colaborador_nome' },
          colaborador_cargo: { $first: '$colaborador_cargo' },
          colaborador_cpf: { $first: '$colaborador_cpf' },
          total_a_receber: {
            $sum: { $cond: [{ $eq: ['$status', 'pendente'] }, '$valor', 0] }
          },
          total_atrasado: {
            $sum: { $cond: [{ $eq: ['$status', 'atrasado'] }, '$valor', 0] }
          },
          count_pendentes: {
            $sum: { $cond: [{ $eq: ['$status', 'pendente'] }, 1, 0] }
          },
          count_atrasados: {
            $sum: { $cond: [{ $eq: ['$status', 'atrasado'] }, 1, 0] }
          }
        }
      }
    ])

    const colaboradoresComStatus = resumoColaboradores.map(colaborador => ({
      ...colaborador,
      status_pagamento: (colaborador.count_pendentes > 0 || colaborador.count_atrasados > 0) ? 
        (colaborador.count_atrasados > 0 ? 'atrasado' : 'pendente') : 'em_dia',
      nome: colaborador.colaborador_nome,
      cargo: colaborador.colaborador_cargo,
      cpf: colaborador.colaborador_cpf
    }))

    // 4. SEPARAR UNIDADES EM DIA DAS ATRASADAS
    const moradoresEmDia = unidadesComStatus.filter(m => !m.tem_atraso)
    const moradoresAtrasados = unidadesComStatus.filter(m => m.tem_atraso)

    // 5. SEPARAR COLABORADORES POR STATUS
    const colaboradoresEmDia = colaboradoresComStatus.filter(c => c.status_pagamento === 'em_dia')
    const colaboradoresPendentes = colaboradoresComStatus.filter(c => c.status_pagamento === 'pendente')
    const colaboradoresAtrasados = colaboradoresComStatus.filter(c => c.status_pagamento === 'atrasado')

    // 6. CALCULAR TOTAIS
    const totalAtrasadoMoradores = moradoresAtrasados.reduce((sum, m) => sum + (m.total_atrasado || 0), 0)
    const totalPendenteColaboradores = colaboradoresPendentes.reduce((sum, c) => sum + (c.total_a_receber || 0), 0)
    const totalAtrasadoColaboradores = colaboradoresAtrasados.reduce((sum, c) => sum + (c.total_atrasado || 0), 0)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      dados_unificados: {
        // Dados dos moradores
        moradores: {
          em_dia: moradoresEmDia,
          atrasados: moradoresAtrasados,
          total_atrasado: totalAtrasadoMoradores,
          estatisticas: {
            total_unidades: unidadesComStatus.length,
            unidades_em_dia: moradoresEmDia.length,
            unidades_atrasadas: moradoresAtrasados.length,
            percentual_em_dia: unidadesComStatus.length > 0 ? 
              Math.round((moradoresEmDia.length / unidadesComStatus.length) * 100) : 0
          }
        },
        // Dados do condomínio
        condominio: {
          receitas: {
            total: dadosCondominio.total_receitas,
            pendentes: dadosCondominio.receitas_pendentes,
            atrasadas: dadosCondominio.receitas_atrasadas,
            count_pendentes: dadosCondominio.count_receitas_pendentes
          },
          despesas: {
            total: dadosCondominio.total_despesas,
            pendentes: dadosCondominio.despesas_pendentes,
            atrasadas: dadosCondominio.despesas_atrasadas,
            count_pendentes: dadosCondominio.count_despesas_pendentes
          },
          saldo_liquido: dadosCondominio.total_receitas - dadosCondominio.total_despesas
        },
        // Dados dos colaboradores
        colaboradores: {
          em_dia: colaboradoresEmDia,
          pendentes: colaboradoresPendentes,
          atrasados: colaboradoresAtrasados,
          total_a_pagar: totalPendenteColaboradores + totalAtrasadoColaboradores,
          estatisticas: {
            total: colaboradoresComStatus.length,
            em_dia_count: colaboradoresEmDia.length,
            pendentes_count: colaboradoresPendentes.length,
            atrasados_count: colaboradoresAtrasados.length
          }
        }
      },
      resumo_geral: {
        total_a_receber_moradores: totalAtrasadoMoradores,
        total_a_pagar_colaboradores: totalPendenteColaboradores + totalAtrasadoColaboradores,
        receitas_condominio_pendentes: dadosCondominio.receitas_pendentes + dadosCondominio.receitas_atrasadas,
        despesas_condominio_pendentes: dadosCondominio.despesas_pendentes + dadosCondominio.despesas_atrasadas,
        resultado_liquido: totalAtrasadoMoradores - (totalPendenteColaboradores + totalAtrasadoColaboradores),
        situacao_financeira: {
          moradores_ok: moradoresAtrasados.length === 0,
          colaboradores_ok: colaboradoresPendentes.length === 0 && colaboradoresAtrasados.length === 0,
          condominio_ok: (dadosCondominio.receitas_pendentes + dadosCondominio.despesas_pendentes) === 0
        }
      }
    })

  } catch (error) {
    console.error('Erro ao buscar resumo financeiro unificado:', error)
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}