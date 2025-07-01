import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import FinanceiroColaborador from '@/models/FinanceiroColaborador'
import FinanceiroUnificado from '@/models/FinanceiroUnificado'
import Colaborador from '@/models/Colaborador'

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    const { colaborador_id, condominio_id, tipo, descricao, valor, data_vencimento, status, mes_referencia, observacoes } = data

    // Validação básica
    if (!colaborador_id || !condominio_id || !tipo || !descricao || !valor || !data_vencimento) {
      return NextResponse.json(
        { error: 'Campos obrigatórios faltando.' },
        { status: 400 }
      )
    }

    await connectDB()

    // Buscar dados do colaborador para incluir no FinanceiroUnificado
    const colaborador = await Colaborador.findById(colaborador_id)
    if (!colaborador) {
      return NextResponse.json(
        { error: 'Colaborador não encontrado.' },
        { status: 404 }
      )
    }

    // Criar lançamento para o colaborador
    const newLancamentoColaborador = await FinanceiroColaborador.create({
      colaborador_id,
      condominio_id,
      tipo,
      descricao,
      valor,
      data_vencimento: new Date(data_vencimento),
      status: status || 'pendente',
      mes_referencia,
      observacoes,
    })

    // Criar lançamento correspondente em FinanceiroUnificado
    // Assumimos que o tipo de lançamento para o condomínio será 'despesa'
    // e a descrição pode ser adaptada para indicar a origem.
    const newLancamentoUnificado = await FinanceiroUnificado.create({
      condominio_id,
      tipo_operacao: 'despesa', // Ou outro tipo apropriado para despesas de RH
      categoria_origem: 'colaborador', // Categoria específica para RH
      subcategoria: tipo, // O tipo do lançamento do colaborador como sub-categoria
      descricao: `Despesa Colaborador (${colaborador.nome} - ${colaborador.cargo || 'N/A'}): ${newLancamentoColaborador.descricao}`,
      valor,
      data_vencimento: new Date(data_vencimento),
      data_competencia: new Date(data_vencimento), // Pode ser a mesma data de vencimento ou outra lógica
      status: status || 'pendente',
      vinculo_id: colaborador_id, // ID do colaborador
      vinculo_nome: colaborador.nome, // Nome do colaborador
      vinculo_tipo: 'colaborador', // Tipo de vínculo
      cargo: colaborador.cargo, // Cargo do colaborador
      departamento: colaborador.departamento, // Departamento do colaborador
      observacoes: `Lançamento original do colaborador: ${newLancamentoColaborador._id}`,
      criado_por_tipo: 'sistema', // Ou o tipo de usuário que fez o lançamento
      criado_por_id: colaborador_id, // Ou o ID do usuário que fez o lançamento
      criado_por_nome: 'Sistema - Financeiro Colaborador', // Ou o nome do usuário que fez o lançamento
      recorrente: false, // Assumindo que lançamentos de colaborador não são recorrentes por padrão
      mes_referencia: mes_referencia,
    })

    return NextResponse.json({
      success: true,
      lancamentoColaborador: newLancamentoColaborador,
      lancamentoUnificado: newLancamentoUnificado,
    })

    return NextResponse.json({
      success: true,
      lancamentoColaborador: newLancamentoColaborador,
      lancamentoUnificado: newLancamentoUnificado,
    })
  } catch (error: any) {
    console.error('Erro na API POST /api/financeiro-colaborador/create:', error)
    return NextResponse.json(
      { error: 'Erro ao criar lançamento financeiro para colaborador.' },
      { status: 500 }
    )
  }
}
