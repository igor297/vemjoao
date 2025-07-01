import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import FinanceiroMorador from '@/models/FinanceiroMorador'
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

    // Buscar todos os moradores ativos do condomínio
    const moradores = await Morador.find({
      master_id: new mongoose.Types.ObjectId(masterId),
      condominio_id: new mongoose.Types.ObjectId(condominioId),
      ativo: true
    }).lean()

    if (moradores.length === 0) {
      return NextResponse.json({
        success: true,
        moradores_em_dia: [],
        moradores_atrasados: []
      })
    }

    // Agrupar moradores por unidade (bloco + apartamento)
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

    // Buscar lançamentos atrasados para cada unidade
    const hoje = new Date()
    const unidadesComStatus = await Promise.all(
      Array.from(unidadesMap.values()).map(async (unidadeData) => {
        const moradoresDaUnidade = unidadeData.moradores
        const idsmoradores = moradoresDaUnidade.map(m => m._id)
        
        // Buscar lançamentos atrasados/pendentes de TODOS os moradores da unidade
        const lancamentosFinanceiros = await FinanceiroMorador.aggregate([
          {
            $match: {
              morador_id: { $in: idsmoradores },
              condominio_id: new mongoose.Types.ObjectId(condominioId),
              ativo: true
            }
          },
          {
            $group: {
              _id: null,
              total_pendente: { $sum: { $cond: [{ $eq: ['$status', 'pendente'] }, '$valor', 0] } },
              count_pendente: { $sum: { $cond: [{ $eq: ['$status', 'pendente'] }, 1, 0] } },
              total_pago: { $sum: { $cond: [{ $eq: ['$status', 'pago'] }, '$valor', 0] } },
              count_pago: { $sum: { $cond: [{ $eq: ['$status', 'pago'] }, 1, 0] } },
              total_atrasado: { $sum: { $cond: [{ $eq: ['$status', 'atrasado'] }, '$valor', 0] } },
              count_atrasado: { $sum: { $cond: [{ $eq: ['$status', 'atrasado'] }, 1, 0] } },
              total_cancelado: { $sum: { $cond: [{ $eq: ['$status', 'cancelado'] }, '$valor', 0] } },
              count_cancelado: { $sum: { $cond: [{ $eq: ['$status', 'cancelado'] }, 1, 0] } },
              total_geral: { $sum: '$valor' },
              count_geral: { $sum: 1 }
            }
          }
        ])

        const statusFinanceiro = lancamentosFinanceiros[0] || {
          total_pendente: 0,
          count_pendente: 0,
          total_pago: 0,
          count_pago: 0,
          total_atrasado: 0,
          count_atrasado: 0,
          total_cancelado: 0,
          count_cancelado: 0,
          total_geral: 0,
          count_geral: 0
        }

        // Encontrar o morador principal (proprietário se existir, senão o primeiro)
        const proprietario = moradoresDaUnidade.find(m => m.tipo === 'proprietario')
        const moradorPrincipal = proprietario || moradoresDaUnidade[0]
        
        // Criar lista de nomes dos moradores da unidade
        const nomesMoradores = moradoresDaUnidade.map(m => `${m.nome} (${m.tipo})`).join(', ')

        return {
          _id: moradorPrincipal._id,
          nome: nomesMoradores,
          cpf: moradorPrincipal.cpf,
          unidade: unidadeData.unidade,
          bloco: unidadeData.bloco,
          tipo: moradorPrincipal.tipo, // Manter o tipo do morador principal
          total_pendente: statusFinanceiro.total_pendente,
          count_pendente: statusFinanceiro.count_pendente,
          total_pago: statusFinanceiro.total_pago,
          count_pago: statusFinanceiro.count_pago,
          total_atrasado: statusFinanceiro.total_atrasado,
          count_atrasado: statusFinanceiro.count_atrasado,
          total_cancelado: statusFinanceiro.total_cancelado,
          count_cancelado: statusFinanceiro.count_cancelado,
          total_geral: statusFinanceiro.total_geral,
          count_geral: statusFinanceiro.count_geral,
          tem_atraso: statusFinanceiro.count_atrasado > 0 || statusFinanceiro.count_pendente > 0, // Considera atrasado se tiver atrasados ou pendentes
          moradores_na_unidade: moradoresDaUnidade.length,
          detalhes_moradores: moradoresDaUnidade.map(m => ({
            nome: m.nome,
            tipo: m.tipo,
            cpf: m.cpf
          })),
          tipos_na_unidade: [...new Set(moradoresDaUnidade.map(m => m.tipo))], // Array com todos os tipos únicos na unidade
          tem_proprietario: moradoresDaUnidade.some(m => m.tipo === 'proprietario'),
          tem_inquilino: moradoresDaUnidade.some(m => m.tipo === 'inquilino')
        }
      })
    )

    // Separar unidades em dia das atrasadas
    const moradoresEmDia = unidadesComStatus.filter(m => !m.tem_atraso)
    const moradoresAtrasados = unidadesComStatus.filter(m => m.tem_atraso)

    // Ordenar
    moradoresEmDia.sort((a, b) => a.nome.localeCompare(b.nome))
    moradoresAtrasados.sort((a, b) => b.total_atrasado - a.total_atrasado) // Maior dívida primeiro

    return NextResponse.json({
      success: true,
      moradores_em_dia: moradoresEmDia,
      moradores_atrasados: moradoresAtrasados,
      total_moradores: moradores.length,
      total_unidades: unidadesComStatus.length,
      estatisticas: {
        unidades_em_dia: moradoresEmDia.length,
        unidades_atrasadas: moradoresAtrasados.length,
        percentual_unidades_em_dia: unidadesComStatus.length > 0 ? Math.round((moradoresEmDia.length / unidadesComStatus.length) * 100) : 0,
        total_divida: moradoresAtrasados.reduce((sum, m) => sum + m.total_atrasado, 0),
        // Manter estatísticas antigas para compatibilidade
        em_dia: moradoresEmDia.length,
        atrasados: moradoresAtrasados.length,
        percentual_em_dia: unidadesComStatus.length > 0 ? Math.round((moradoresEmDia.length / unidadesComStatus.length) * 100) : 0
      }
    })

  } catch (error) {
    console.error('Erro ao buscar status dos moradores:', error)
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}