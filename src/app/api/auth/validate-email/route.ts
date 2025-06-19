import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Master from '@/models/Master'
import Adm from '@/models/Adm'
import mongoose from 'mongoose'

export async function POST(request: NextRequest) {
  try {
    const { email, excludeId, collection } = await request.json()
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email é obrigatório' },
        { status: 400 }
      )
    }

    await connectDB()
    const emailLower = email.toLowerCase().trim()
    
    // Verificar em masters
    const masterQuery: any = { email: emailLower }
    if (excludeId && collection === 'masters') {
      masterQuery._id = { $ne: new mongoose.Types.ObjectId(excludeId) }
    }
    
    const existingMaster = await Master.findOne(masterQuery)
    if (existingMaster) {
      return NextResponse.json({
        exists: true,
        collection: 'masters',
        message: 'Email já cadastrado em Masters'
      })
    }
    
    // Verificar em adms
    const admQuery: any = { email: emailLower }
    if (excludeId && collection === 'adms') {
      admQuery._id = { $ne: new mongoose.Types.ObjectId(excludeId) }
    }
    
    const existingAdm = await Adm.findOne(admQuery)
    if (existingAdm) {
      return NextResponse.json({
        exists: true,
        collection: 'adms',
        message: 'Email já cadastrado em Administradores'
      })
    }
    
    return NextResponse.json({
      exists: false,
      message: 'Email disponível'
    })
    
  } catch (error) {
    console.error('Email validation error:', error)
    return NextResponse.json(
      { error: 'Erro ao validar email' },
      { status: 500 }
    )
  }
}