import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Ticket from '@/models/Ticket'
import Morador from '@/models/Morador'
import Conjuge from '@/models/Conjuge'
import Dependente from '@/models/Dependente'
import mongoose from 'mongoose'
import { verificarPermissaoTicket } from '@/models/Ticket'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const masterId = url.searchParams.get('master_id')
    const condominioId = url.searchParams.get('condominio_id')
    const tipoUsuario = url.searchParams.get('tipo_usuario')
    const usuarioId = url.searchParams.get('usuario_id')
    
    if (!masterId || !tipoUsuario) {
      return NextResponse.json(
        { error: 'Master ID e tipo de usuário são obrigatórios' },
        { status: 400 }
      )
    }

    // Validar se condominio_id não é undefined ou string vazia
    if (!condominioId || condominioId === 'undefined' || condominioId === 'null') {
      return NextResponse.json(
        { error: 'Condomínio deve ser selecionado' },
        { status: 400 }
      )
    }

    await connectDB()
    const filter: any = { 
      master_id: masterId, 
      condominio_id: condominioId,
      ativo: true 
    }
    
    // Se for colaborador/morador, filtrar apenas seus próprios tickets
    if (['colaborador', 'morador', 'inquilino', 'conjuge', 'dependente'].includes(tipoUsuario)) {
      filter.solicitante_id = usuarioId
    }
    
    // Verificar permissão
    const isProprioTicket = ['colaborador', 'morador', 'inquilino', 'conjuge', 'dependente'].includes(tipoUsuario)
    if (!verificarPermissaoTicket('ver', tipoUsuario, isProprioTicket)) {
      return NextResponse.json(
        { error: 'Você não tem permissão para visualizar tickets' },
        { status: 403 }
      )
    }
    
    const result = await Ticket.find(filter).sort({ data_abertura: -1 })
    
    return NextResponse.json({
      success: true,
      tickets: result
    })
    
  } catch (error) {
    console.error('Error fetching tickets:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar tickets' },
      { status: 500 }
    )
  }

}

export async function POST(request: NextRequest) {
  try {
    const ticketData = await request.json()
    
    // Validação básica
    const requiredFields = [
      'titulo', 'descricao', 'categoria', 'solicitante_tipo', 
      'solicitante_id', 'condominio_id', 'master_id'
    ]
    
    for (const field of requiredFields) {
      if (!ticketData[field]) {
        return NextResponse.json(
          { error: `Campo ${field} é obrigatório` },
          { status: 400 }
        )
      }
    }

    // Validação de tamanho dos campos
    if (ticketData.titulo && ticketData.titulo.length < 5) {
      return NextResponse.json(
        { error: 'Título deve ter pelo menos 5 caracteres' },
        { status: 400 }
      )
    }

    if (ticketData.descricao && ticketData.descricao.length < 10) {
      return NextResponse.json(
        { error: 'Descrição deve ter pelo menos 10 caracteres' },
        { status: 400 }
      )
    }

    // Verificar permissão para criar
    if (!verificarPermissaoTicket('criar', ticketData.solicitante_tipo)) {
      return NextResponse.json(
        { error: 'Você não tem permissão para criar tickets' },
        { status: 403 }
      )
    }

    await connectDB()

    // Buscar dados completos do solicitante baseado no tipo
    let solicitanteData = null
    let solicitante_nome = ''
    let solicitante_cpf = ''
    let solicitante_apartamento = ''
    let solicitante_bloco = ''

    if (ticketData.solicitante_tipo === 'morador' || ticketData.solicitante_tipo === 'inquilino') {
      // Buscar no modelo Morador
      solicitanteData = await Morador.findById(ticketData.solicitante_id)
      if (solicitanteData) {
        solicitante_nome = solicitanteData.nome
        solicitante_cpf = solicitanteData.cpf
        solicitante_apartamento = solicitanteData.unidade
        solicitante_bloco = solicitanteData.bloco || ''
      }
    } else if (ticketData.solicitante_tipo === 'conjuge') {
      // Buscar no modelo Conjuge
      solicitanteData = await Conjuge.findById(ticketData.solicitante_id)
      if (solicitanteData) {
        solicitante_nome = solicitanteData.nome
        solicitante_cpf = solicitanteData.cpf || ''
        solicitante_apartamento = solicitanteData.unidade
        solicitante_bloco = solicitanteData.bloco || ''
      }
    } else if (ticketData.solicitante_tipo === 'dependente') {
      // Buscar no modelo Dependente
      solicitanteData = await Dependente.findById(ticketData.solicitante_id)
      if (solicitanteData) {
        solicitante_nome = solicitanteData.nome
        solicitante_cpf = solicitanteData.cpf || ''
        solicitante_apartamento = solicitanteData.unidade
        solicitante_bloco = solicitanteData.bloco || ''
      }
    }

    // Se não encontrou dados do solicitante, retornar erro
    if (!solicitanteData) {
      return NextResponse.json(
        { error: 'Dados do solicitante não encontrados' },
        { status: 404 }
      )
    }
    // Gerar ID único
    const lastTicket = await Ticket.findOne(
      {},
      { sort: { data_abertura: -1 } }
    )
    
    let nextId = 1
    if (lastTicket && lastTicket.id_ticket) {
      const lastIdNumber = parseInt(lastTicket.id_ticket.replace('TK', ''))
      nextId = lastIdNumber + 1
    }
    
    // Criar mensagem inicial
    const mensagemInicial = {
      id: new mongoose.Types.ObjectId().toString(),
      remetente_tipo: ticketData.solicitante_tipo,
      remetente_id: ticketData.solicitante_id,
      remetente_nome: solicitante_nome,
      mensagem: ticketData.descricao,
      data: new Date()
    }
    
    const newTicket: any = {
      titulo: ticketData.titulo,
      descricao: ticketData.descricao,
      categoria: ticketData.categoria,
      solicitante_tipo: ticketData.solicitante_tipo,
      solicitante_id: ticketData.solicitante_id,
      solicitante_nome: solicitante_nome,
      solicitante_cpf: solicitante_cpf,
      solicitante_apartamento: solicitante_apartamento,
      solicitante_bloco: solicitante_bloco,
      condominio_id: ticketData.condominio_id,
      master_id: ticketData.master_id,
      id_ticket: `TK${nextId.toString().padStart(6, '0')}`,
      status: 'aberto',
      prioridade: ticketData.prioridade || 'media',
      data_abertura: new Date(),
      data_atualizacao: new Date(),
      mensagens: [mensagemInicial],
      ativo: true
    }

    const result = await Ticket.create(newTicket)
    
    return NextResponse.json({
      success: true,
      ticket: { _id: result._id, ...newTicket }
    })
    
  } catch (error) {
    console.error('Error creating ticket:', error)
    return NextResponse.json(
      { error: 'Erro ao criar ticket' },
      { status: 500 }
    )
  }

}

export async function PUT(request: NextRequest) {
  try {
    const { _id, acao, usuario_tipo, usuario_id, usuario_nome, ...ticketData } = await request.json()
    
    if (!_id || !acao || !usuario_tipo || !usuario_id) {
      return NextResponse.json(
        { error: 'ID do ticket, ação, tipo e ID do usuário são obrigatórios' },
        { status: 400 }
      )
    }

    await connectDB()
    // Buscar ticket existente
    const ticketExistente = await Ticket.findOne({ _id: new mongoose.Types.ObjectId(_id) })
    if (!ticketExistente) {
      return NextResponse.json(
        { error: 'Ticket não encontrado' },
        { status: 404 }
      )
    }
    
    const isProprioTicket = ticketExistente.solicitante_id === usuario_id
    let updateData: any = {}
    
    if (acao === 'responder') {
      // Verificar permissão para responder
      if (!verificarPermissaoTicket('responder', usuario_tipo, isProprioTicket)) {
        return NextResponse.json(
          { error: 'Você não tem permissão para responder este ticket' },
          { status: 403 }
        )
      }
      
      if (!ticketData.mensagem) {
        return NextResponse.json(
          { error: 'Mensagem é obrigatória' },
          { status: 400 }
        )
      }
      
      // Adicionar nova mensagem
      const novaMensagem = {
        id: new mongoose.Types.ObjectId().toString(),
        remetente_tipo: usuario_tipo,
        remetente_id: usuario_id,
        remetente_nome: usuario_nome,
        mensagem: ticketData.mensagem,
        data: new Date()
      }
      
      updateData = {
        $push: { mensagens: novaMensagem },
        $set: { 
          data_atualizacao: new Date(),
          status: usuario_tipo === 'colaborador' || ['morador', 'inquilino', 'conjuge', 'dependente'].includes(usuario_tipo) 
            ? 'aguardando_resposta' : 'em_andamento'
        }
      }
      
    } else if (acao === 'fechar') {
      // Verificar permissão para fechar
      if (!verificarPermissaoTicket('fechar', usuario_tipo, isProprioTicket)) {
        return NextResponse.json(
          { error: 'Você não tem permissão para fechar este ticket' },
          { status: 403 }
        )
      }
      
      updateData = {
        $set: {
          status: 'fechado',
          data_fechamento: new Date(),
          data_atualizacao: new Date()
        }
      }
      
    } else if (acao === 'atualizar_status') {
      // Apenas admin pode atualizar status
      if (!['master', 'sindico', 'subsindico'].includes(usuario_tipo)) {
        return NextResponse.json(
          { error: 'Você não tem permissão para atualizar o status' },
          { status: 403 }
        )
      }
      
      updateData = {
        $set: {
          status: ticketData.status,
          atendido_por_tipo: usuario_tipo,
          atendido_por_id: usuario_id,
          atendido_por_nome: usuario_nome,
          data_atualizacao: new Date()
        }
      }
    }

    const result = await Ticket.findByIdAndUpdate(
      { _id: new mongoose.Types.ObjectId(_id) },
      updateData
    )
    
    if (!result) {
      return NextResponse.json(
        { error: 'Ticket não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Ticket atualizado com sucesso'
    })
    
  } catch (error) {
    console.error('Error updating ticket:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar ticket' },
      { status: 500 }
    )
  }
}