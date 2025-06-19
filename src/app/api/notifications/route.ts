import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import mongoose from 'mongoose'

// Criar notificação
export async function POST(request: NextRequest) {
  try {
    const notificationData = await request.json()
    
    // Validação básica
    const requiredFields = ['titulo', 'mensagem', 'tipo', 'destinatario_id', 'destinatario_tipo', 'condominio_id', 'master_id']
    for (const field of requiredFields) {
      if (!notificationData[field]) {
        return NextResponse.json(
          { error: `Campo ${field} é obrigatório` },
          { status: 400 }
        )
      }
    }

    await connectDB()
    // Gerar ID único para notificação
    const lastNotification = await notifications.findOne(
      {},
      { sort: { data_criacao: -1 } }
    )
    
    let nextId = 1
    if (lastNotification && lastNotification.id_notification) {
      const lastIdNumber = parseInt(lastNotification.id_notification.replace('NOT', ''))
      nextId = lastIdNumber + 1
    }
    
    const newNotification = {
      ...notificationData,
      id_notification: `NOT${nextId.toString().padStart(6, '0')}`,
      data_criacao: new Date(),
      data_leitura: null,
      lida: false,
      ativo: true
    }

    const result = await notifications.insertOne(newNotification)
    
    return NextResponse.json({
      success: true,
      notification: { _id: result._id, ...newNotification },
      message: 'Notificação criada com sucesso!'
    })
    
  } catch (error) {
    console.error('Error creating notification:', error)
    return NextResponse.json(
      { error: 'Erro ao criar notificação' },
      { status: 500 }
    )
  }

// Buscar notificações
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const destinatarioId = url.searchParams.get('destinatario_id')
    const destinatarioTipo = url.searchParams.get('destinatario_tipo')
    const condominioId = url.searchParams.get('condominio_id')
    const apenasNaoLidas = url.searchParams.get('apenas_nao_lidas') === 'true'
    const limite = parseInt(url.searchParams.get('limite') || '50')
    
    if (!destinatarioId || !destinatarioTipo) {
      return NextResponse.json(
        { error: 'destinatario_id e destinatario_tipo são obrigatórios' },
        { status: 400 }
      )
    }

    await connectDB()
    // Filtros para busca
    const filtros: any = {
      destinatario_id: destinatarioId,
      destinatario_tipo: destinatarioTipo,
      ativo: true
    }
    
    if (condominioId) {
      filtros.condominio_id = condominioId
    }
    
    if (apenasNaoLidas) {
      filtros.lida = false
    }
    
    const notificacoes = await notifications
      .find(filtros)
      .sort({ data_criacao: -1 })
      .limit(limite)
      .toArray()
    
    // Contar notificações não lidas
    const naoLidas = await notifications.countDocuments({
      destinatario_id: destinatarioId,
      destinatario_tipo: destinatarioTipo,
      lida: false,
      ativo: true,
      ...(condominioId && { condominio_id: condominioId })
    })
    
    return NextResponse.json({
      success: true,
      notificacoes: notificacoes,
      total_encontradas: notificacoes.length,
      nao_lidas: naoLidas
    })
    
  } catch (error) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar notificações' },
      { status: 500 }
    )
  }

// Marcar como lida
}

export async function PATCH(request: NextRequest) {
  try {
    const { notification_id, marcar_todas = false, destinatario_id, destinatario_tipo } = await request.json()
    
    await connectDB()
    let result
    
    if (marcar_todas && destinatario_id && destinatario_tipo) {
      // Marcar todas como lidas para o usuário
      result = await notifications.updateMany(
        {
          destinatario_id: destinatario_id,
          destinatario_tipo: destinatario_tipo,
          lida: false,
          ativo: true
        },
        {
          $set: {
            lida: true,
            data_leitura: new Date()
          }
        }
      )
    } else if (notification_id) {
      // Marcar uma específica como lida
      result = await notifications.updateOne(
        { id_notification: notification_id },
        {
          $set: {
            lida: true,
            data_leitura: new Date()
          }
        }
      )
    } else {
      return NextResponse.json(
        { error: 'notification_id ou (marcar_todas + destinatario_id + destinatario_tipo) são obrigatórios' },
        { status: 400 }
      )
    }
    
    return NextResponse.json({
      success: true,
      notificacoes_atualizadas: result.modifiedCount,
      message: marcar_todas ? 'Todas as notificações foram marcadas como lidas' : 'Notificação marcada como lida'
    })
    
  } catch (error) {
    console.error('Error updating notification:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar notificação' },
      { status: 500 }
    )
  }
}