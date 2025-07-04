import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import FinanceiroMorador from '@/models/FinanceiroMorador'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await connectDB()
    
    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;
    const data = await request.json()
    const {
      tipo_usuario,
      data_pagamento,
      status,
      observacoes,
      ...updateData
    } = data

    if (!id || !tipo_usuario) {
      return NextResponse.json({
        success: false,
        error: 'ID e tipo_usuario são obrigatórios'
      }, { status: 400 })
    }

    // Verificar permissão
    if (!['master', 'sindico', 'subsindico'].includes(tipo_usuario)) {
      return NextResponse.json({
        success: false,
        error: 'Você não tem permissão para editar lançamentos'
      }, { status: 403 })
    }

    // Buscar lançamento
    const lancamento = await FinanceiroMorador.findById(id)
    if (!lancamento) {
      return NextResponse.json({
        success: false,
        error: 'Lançamento não encontrado'
      }, { status: 404 })
    }

    // Função para criar data local (reutilizada do POST principal)
    const criarDataLocal = (dataString: string) => {
      const [ano, mes, dia] = dataString.split('-').map(Number)
      return new Date(ano, mes - 1, dia) // mes - 1 porque Date() usa índice 0-11 para meses
    }

    // Preparar dados de atualização, removendo campos vazios/inválidos
    const dadosAtualizacao: any = {
      data_atualizacao: new Date()
    }

    // Copiar campos válidos do updateData, excluindo campos vazios
    Object.keys(updateData).forEach(key => {
      const value = updateData[key]
      // Pular campos vazios ou null/undefined
      if (value === '' || value === null || value === undefined) {
        return
      }
      // Tratamento especial para periodicidade
      if (key === 'periodicidade' && value === '') {
        dadosAtualizacao[key] = null
      } else if (key === 'data_vencimento' && value) {
        // Tratar data de vencimento corretamente
        dadosAtualizacao[key] = criarDataLocal(value)
      } else {
        dadosAtualizacao[key] = value
      }
    })

    // Lógica específica para mudança de status
    console.log('🔄 Verificando mudança de status:', {
      statusRecebido: status,
      statusAtual: lancamento.status,
      diferente: status !== undefined && status !== lancamento.status
    })
    
    if (status !== undefined && status !== lancamento.status) {
      console.log('✅ Atualizando status de', lancamento.status, 'para', status)
      dadosAtualizacao.status = status
      
      if (status === 'pago' && data_pagamento) {
        dadosAtualizacao.data_pagamento = criarDataLocal(data_pagamento)
      } else if (status === 'pago' && !data_pagamento) {
        dadosAtualizacao.data_pagamento = new Date()
      }
    } else {
      console.log('⚠️ Status não será alterado')
    }

    if (observacoes !== undefined) {
      dadosAtualizacao.observacoes = observacoes
    }

    console.log('📝 Dados que serão atualizados:', JSON.stringify(dadosAtualizacao, null, 2))

    // Atualizar
    const lancamentoAtualizado = await FinanceiroMorador.findByIdAndUpdate(
      id,
      dadosAtualizacao,
      { new: true, runValidators: true }
    )

    return NextResponse.json({
      success: true,
      message: 'Lançamento atualizado com sucesso',
      lancamento: lancamentoAtualizado
    })

  } catch (error) {
    console.error('Erro ao atualizar lançamento:', error)
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await connectDB()
    
    const { id } = params
    const url = new URL(request.url)
    const tipoUsuario = url.searchParams.get('tipo_usuario')

    if (!id || !tipoUsuario) {
      return NextResponse.json({
        success: false,
        error: 'ID e tipo_usuario são obrigatórios'
      }, { status: 400 })
    }

    // Verificar permissão
    if (!['master', 'sindico', 'subsindico'].includes(tipoUsuario)) {
      return NextResponse.json({
        success: false,
        error: 'Você não tem permissão para excluir lançamentos'
      }, { status: 403 })
    }

    // Soft delete
    const lancamento = await FinanceiroMorador.findByIdAndUpdate(
      id,
      { 
        ativo: false,
        data_atualizacao: new Date()
      },
      { new: true }
    )

    if (!lancamento) {
      return NextResponse.json({
        success: false,
        error: 'Lançamento não encontrado'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'Lançamento excluído com sucesso'
    })

  } catch (error) {
    console.error('Erro ao excluir lançamento:', error)
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}