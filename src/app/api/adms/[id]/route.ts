import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Master from '@/models/Master'
import Adm from '@/models/Adm'
import mongoose from 'mongoose'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admData = await request.json()
    const { id } = await params
    
    // Validação básica
    const requiredFields = ['nome', 'cpf', 'data_nasc', 'tipo', 'email', 'data_inicio', 'master_id']
    for (const field of requiredFields) {
      if (!admData[field]) {
        return NextResponse.json(
          { error: `Campo ${field} é obrigatório` },
          { status: 400 }
        )
      }
    }

    await connectDB()
    // Verificar se ADM existe e pertence ao master
    const existingAdm = await Adm.findOne({
      _id: new mongoose.Types.ObjectId(id),
      master_id: admData.master_id
    })
    
    if (!existingAdm) {
      return NextResponse.json(
        { error: 'Administrador não encontrado ou você não tem permissão' },
        { status: 404 }
      )
    }


    // Verificar se email já existe em masters
    const existingMaster = await Master.findOne({ email: admData.email.toLowerCase() })
    if (existingMaster) {
      return NextResponse.json(
        { error: 'Email já cadastrado em Masters' },
        { status: 400 }
      )
    }

    // Verificar se email já existe em outro ADM
    const existingEmail = await Adm.findOne({
      email: admData.email.toLowerCase(),
      _id: { $ne: new mongoose.Types.ObjectId(id) }
    })
    
    if (existingEmail) {
      return NextResponse.json(
        { error: 'Email já cadastrado para outro administrador' },
        { status: 400 }
      )
    }

    // Se mudou para síndico, verificar se já existe um síndico ativo
    if (admData.tipo === 'sindico' && existingAdm.tipo !== 'sindico') {
      const activeSindico = await Adm.findOne({
        condominio_id: existingAdm.condominio_id,
        tipo: 'sindico',
        data_fim: { $exists: false },
        _id: { $ne: new mongoose.Types.ObjectId(id) }
      })
      
      if (activeSindico) {
        return NextResponse.json(
          { error: 'Já existe um síndico ativo neste condomínio' },
          { status: 400 }
        )
      }
    }
    
    const updateData: any = {
      nome: admData.nome,
      cpf: admData.cpf,
      data_nasc: new Date(admData.data_nasc),
      tipo: admData.tipo.toLowerCase(),
      email: admData.email.toLowerCase(),
      data_inicio: new Date(admData.data_inicio),
      data_fim: admData.data_fim && admData.data_fim.trim() !== '' ? new Date(admData.data_fim) : undefined,
      bloco: admData.bloco || '',
      unidade: admData.unidade || '',
      celular1: admData.celular1 || '',
      celular2: admData.celular2 || '',
      // Campos de endereço
      cep: admData.cep || '',
      logradouro: admData.logradouro || '',
      estado: admData.estado ? admData.estado.toUpperCase() : '',
      cidade: admData.cidade || '',
      numero: admData.numero || '',
      complemento: admData.complemento || '',
      observacoes: admData.observacoes || '',
      adm_interno: admData.adm_interno || false,
      morador_origem_id: admData.morador_origem_id && admData.morador_origem_id.trim() !== '' ? admData.morador_origem_id : undefined
    }

    // Só atualizar senha se foi fornecida
    if (admData.senha && admData.senha.trim() !== '') {
      updateData.senha = admData.senha
    }

    const result = await Adm.findByIdAndUpdate(new mongoose.Types.ObjectId(id), { master_id: admData.master_id, ...updateData }, { new: true })
    
    if (!result) {
      return NextResponse.json(
        { error: 'Administrador não encontrado ou você não tem permissão' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: 'Administrador atualizado com sucesso'
    })
    
  } catch (error) {
    console.error('Error updating ADM:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar administrador' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const url = new URL(request.url)
    const masterId = url.searchParams.get('master_id')

    if (!masterId) {
      return NextResponse.json(
        { error: 'Master ID é obrigatório' },
        { status: 400 }
      )
    }

    await connectDB()
    // Verificar se ADM pertence ao master antes de excluir
    const result = await Adm.findOneAndDelete({ 
      _id: new mongoose.Types.ObjectId(id), 
      master_id: masterId 
    })
    
    if (!result) {
      return NextResponse.json(
        { error: 'Administrador não encontrado ou você não tem permissão' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: 'Administrador excluído com sucesso'
    })
    
  } catch (error) {
    console.error('Error deleting ADM:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir administrador' },
      { status: 500 }
    )
  }
}