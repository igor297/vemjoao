import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import FinanceiroCondominio from '@/models/FinanceiroCondominio'
import Morador from '@/models/Morador'
import mongoose from 'mongoose'

export async function POST(request: NextRequest) {
  try {
    await connectDB()
    
    const data = await request.json()
    const { master_id, condominio_id, tipo_usuario } = data

    if (!master_id || !condominio_id || !tipo_usuario) {
      return NextResponse.json({
        success: false,
        error: 'master_id, condominio_id e tipo_usuario são obrigatórios'
      }, { status: 400 })
    }

    // Verificar permissão
    if (!['master', 'sindico', 'subsindico'].includes(tipo_usuario)) {
      return NextResponse.json({
        success: false,
        error: 'Você não tem permissão para atualizar dados financeiros'
      }, { status: 403 })
    }

    console.log('🔄 Atualizando informações de unidade no financeiro-condominio...')

    // Buscar lançamentos do financeiro-condominio que são de moradores mas não têm bloco/apartamento
    const lancamentosSemUnidade = await FinanceiroCondominio.find({
      master_id: new mongoose.Types.ObjectId(master_id),
      condominio_id: new mongoose.Types.ObjectId(condominio_id),
      origem_sistema: 'morador',
      $or: [
        { bloco: { $exists: false } },
        { bloco: null },
        { bloco: '' },
        { apartamento: { $exists: false } },
        { apartamento: null },
        { apartamento: '' }
      ],
      ativo: true
    }).lean()

    console.log(`📋 Encontrados ${lancamentosSemUnidade.length} lançamentos para atualizar`)

    let atualizados = 0
    let erros = 0

    for (const lancamento of lancamentosSemUnidade) {
      try {
        // Buscar dados do morador pelo nome (origem_nome)
        const morador = await Morador.findOne({
          nome: lancamento.origem_nome,
          condominio_id: new mongoose.Types.ObjectId(condominio_id),
          ativo: true
        }).lean()

        if (morador) {
          // Atualizar o lançamento com os dados da unidade
          await FinanceiroCondominio.findByIdAndUpdate(lancamento._id, {
            bloco: morador.bloco || '',
            apartamento: morador.unidade || '',
            data_atualizacao: new Date()
          })

          console.log(`✅ Atualizado: ${lancamento.origem_nome} - ${morador.bloco || ''} ${morador.unidade || ''}`)
          atualizados++
        } else {
          console.log(`⚠️ Morador não encontrado: ${lancamento.origem_nome}`)
          erros++
        }
      } catch (error) {
        console.error(`❌ Erro ao atualizar lançamento ${lancamento._id}:`, error)
        erros++
      }
    }

    console.log(`✅ Atualização concluída: ${atualizados} sucessos, ${erros} erros`)

    return NextResponse.json({
      success: true,
      message: 'Atualização de unidades concluída',
      resumo: {
        total_processados: lancamentosSemUnidade.length,
        total_atualizados: atualizados,
        total_erros: erros
      }
    })

  } catch (error) {
    console.error('Erro na atualização de unidades:', error)
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}