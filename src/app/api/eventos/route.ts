import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Evento from '@/models/Evento'
import mongoose from 'mongoose'
import { verificarPermissaoEvento } from '@/models/Evento'

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

    await connectDB()
    // Filtrar eventos por master e condomínio
    const filter: any = { master_id: masterId, ativo: true }
    if (condominioId) {
      filter.condominio_id = condominioId
    }
    
    const result = await Evento.find(filter).sort({ data_inicio: 1 }).lean()
    
    // Filtrar eventos baseado nas permissões do usuário
    const eventosPermitidos = result.filter(evento => {
      const isProprioEvento = evento.criado_por_id === usuarioId
      return verificarPermissaoEvento(evento.tipo, tipoUsuario, 'ver', isProprioEvento)
    })
    
    return NextResponse.json({
      success: true,
      eventos: eventosPermitidos
    })
    
  } catch (error) {
    console.error('Error fetching eventos:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar eventos' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const eventoData = await request.json()
    
    // Validação básica
    const requiredFields = [
      'nome', 'descricao', 'tipo', 'data_inicio', 'hora_inicio', 
      'data_fim', 'hora_fim', 'criado_por_tipo', 'criado_por_id', 
      'criado_por_nome', 'condominio_id', 'master_id'
    ]
    
    for (const field of requiredFields) {
      if (!eventoData[field]) {
        return NextResponse.json(
          { error: `Campo ${field} é obrigatório` },
          { status: 400 }
        )
      }
    }

    // Verificar permissão para criar
    if (!verificarPermissaoEvento(eventoData.tipo, eventoData.criado_por_tipo, 'criar')) {
      return NextResponse.json(
        { error: 'Você não tem permissão para criar este tipo de evento' },
        { status: 403 }
      )
    }

    // Validar formato de hora
    const horaRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
    if (!horaRegex.test(eventoData.hora_inicio) || !horaRegex.test(eventoData.hora_fim)) {
      return NextResponse.json(
        { error: 'Formato de hora inválido. Use HH:MM' },
        { status: 400 }
      )
    }

    // Validar se data/hora fim é posterior ao início
    const dataHoraInicio = new Date(`${eventoData.data_inicio}T${eventoData.hora_inicio}`)
    const dataHoraFim = new Date(`${eventoData.data_fim}T${eventoData.hora_fim}`)
    
    if (dataHoraFim <= dataHoraInicio) {
      return NextResponse.json(
        { error: 'Data/hora de fim deve ser posterior à data/hora de início' },
        { status: 400 }
      )
    }

    await connectDB()
    // Verificar conflitos de horário para reservas
    if (eventoData.tipo === 'reserva') {
      const conflito = await Evento.findOne({
        tipo: 'reserva',
        condominio_id: eventoData.condominio_id,
        ativo: true,
        $or: [
          {
            $and: [
              { data_inicio: { $lte: new Date(eventoData.data_inicio) } },
              { data_fim: { $gte: new Date(eventoData.data_inicio) } }
            ]
          },
          {
            $and: [
              { data_inicio: { $lte: new Date(eventoData.data_fim) } },
              { data_fim: { $gte: new Date(eventoData.data_fim) } }
            ]
          }
        ]
      })
      
      if (conflito) {
        return NextResponse.json(
          { error: 'Já existe uma reserva neste horário' },
          { status: 400 }
        )
      }
    }
    
    
    const newEvento = {
      ...eventoData,
      data_inicio: new Date(eventoData.data_inicio),
      data_fim: new Date(eventoData.data_fim),
      condominio_evento: eventoData.condominio_evento || '',
      observacoes: eventoData.observacoes || '',
      data_criacao: new Date(),
      ativo: true
    }

    const result = await Evento.create(newEvento)
    
    return NextResponse.json({
      success: true,
      evento: { _id: result._id, ...newEvento }
    })
    
  } catch (error: any) {
    console.error('Error creating evento:', error)
    
    // Retornar mensagens de validação mais específicas
    if (error.name === 'ValidationError') {
      const firstError = Object.values(error.errors)[0] as any
      return NextResponse.json(
        { error: firstError.message },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Erro ao criar evento' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { _id, usuario_tipo, usuario_id, ...eventoData } = await request.json()
    
    if (!_id || !usuario_tipo || !usuario_id) {
      return NextResponse.json(
        { error: 'ID do evento, tipo de usuário e ID do usuário são obrigatórios' },
        { status: 400 }
      )
    }

    await connectDB()
    // Buscar evento existente
    const eventoExistente = await Evento.findOne({ _id: new mongoose.Types.ObjectId(_id) })
    if (!eventoExistente) {
      return NextResponse.json(
        { error: 'Evento não encontrado' },
        { status: 404 }
      )
    }

    const isProprioEvento = eventoExistente.criado_por_id === usuario_id
    
    // Verificar permissão para editar
    if (!verificarPermissaoEvento(eventoExistente.tipo, usuario_tipo, 'editar', isProprioEvento)) {
      return NextResponse.json(
        { error: 'Você não tem permissão para editar este evento' },
        { status: 403 }
      )
    }

    let updateData: any = {}

    // Para colaborador em eventos de retirada/entrega ou outros tipos específicos,
    // permitir apenas edição de observações
    if (usuario_tipo === 'colaborador' && eventoExistente.tipo === 'retirada_entrega') {
      updateData = {
        observacoes: eventoData.observacoes || eventoExistente.observacoes
      }
    } else if (['conselheiro', 'colaborador'].includes(usuario_tipo) && eventoExistente.tipo === 'outros') {
      updateData = {
        observacoes: eventoData.observacoes || eventoExistente.observacoes
      }
    } else {
      // Atualização completa para usuários com permissão total
      updateData = {
        nome: eventoData.nome || eventoExistente.nome,
        descricao: eventoData.descricao || eventoExistente.descricao,
        data_inicio: eventoData.data_inicio ? new Date(eventoData.data_inicio) : eventoExistente.data_inicio,
        hora_inicio: eventoData.hora_inicio || eventoExistente.hora_inicio,
        data_fim: eventoData.data_fim ? new Date(eventoData.data_fim) : eventoExistente.data_fim,
        hora_fim: eventoData.hora_fim || eventoExistente.hora_fim,
        condominio_evento: eventoData.condominio_evento || eventoExistente.condominio_evento || '',
        observacoes: eventoData.observacoes || eventoExistente.observacoes || ''
      }
    }

    const result = await Evento.findByIdAndUpdate(new mongoose.Types.ObjectId(_id) , updateData , { new: true })
    
    if (!result) {
      return NextResponse.json(
        { error: 'Evento não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Evento atualizado com sucesso'
    })
    
  } catch (error: any) {
    console.error('Error updating evento:', error)
    
    // Retornar mensagens de validação mais específicas
    if (error.name === 'ValidationError') {
      const firstError = Object.values(error.errors)[0] as any
      return NextResponse.json(
        { error: firstError.message },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Erro ao atualizar evento' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const id = url.searchParams.get('id')
    const usuarioTipo = url.searchParams.get('usuario_tipo')
    const usuarioId = url.searchParams.get('usuario_id')

    if (!id || !usuarioTipo || !usuarioId) {
      return NextResponse.json(
        { error: 'ID do evento, tipo de usuário e ID do usuário são obrigatórios' },
        { status: 400 }
      )
    }

    await connectDB()
    // Buscar evento existente
    const eventoExistente = await Evento.findOne({ _id: new mongoose.Types.ObjectId(id) })
    if (!eventoExistente) {
      return NextResponse.json(
        { error: 'Evento não encontrado' },
        { status: 404 }
      )
    }

    const isProprioEvento = eventoExistente.criado_por_id === usuarioId
    
    // Verificar permissão para excluir
    if (!verificarPermissaoEvento(eventoExistente.tipo, usuarioTipo, 'excluir', isProprioEvento)) {
      return NextResponse.json(
        { error: 'Você não tem permissão para excluir este evento' },
        { status: 403 }
      )
    }

    // Soft delete - marcar como inativo
    const result = await Evento.findByIdAndUpdate(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: { ativo: false } }
    )
    
    if (!result) {
      return NextResponse.json(
        { error: 'Evento não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Evento excluído com sucesso'
    })
    
  } catch (error) {
    console.error('Error deleting evento:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir evento' },
      { status: 500 }
    )
  }
}