import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Imobiliaria from '@/models/Imobiliaria'
import Colaborador from '@/models/Colaborador'
import Adm from '@/models/Adm'
import Master from '@/models/Master'
import Morador from '@/models/Morador'
import mongoose from 'mongoose'

export async function POST(request: NextRequest) {
  try {
    const inquilinoData = await request.json()
    
    console.log('Dados recebidos para inquilino:', inquilinoData)
    
    // Validação básica
    const requiredFields = ['nome', 'cpf', 'data_nasc', 'celular1', 'email', 'senha', 'data_inicio', 'proprietario_id']
    for (const field of requiredFields) {
      if (!inquilinoData[field]) {
        return NextResponse.json(
          { error: `Campo ${field} é obrigatório` },
          { status: 400 }
        )
      }
    }

    // Validação de datas
    const dataInicio = new Date(inquilinoData.data_inicio)
    const dataFim = inquilinoData.data_fim ? new Date(inquilinoData.data_fim) : null

    if (isNaN(dataInicio.getTime())) {
      return NextResponse.json(
        { error: 'Data de início inválida' },
        { status: 400 }
      )
    }

    if (dataFim && isNaN(dataFim.getTime())) {
      return NextResponse.json(
        { error: 'Data de fim inválida' },
        { status: 400 }
      )
    }

    if (dataFim && dataFim <= dataInicio) {
      return NextResponse.json(
        { error: 'Data fim deve ser posterior à data início' },
        { status: 400 }
      )
    }

    await connectDB()
    
    console.log('Buscando proprietário com ID:', inquilinoData.proprietario_id)
    
    // Buscar dados do proprietário usando _id (ObjectId MongoDB)
    const proprietario = await Morador.findById(inquilinoData.proprietario_id)
    
    if (!proprietario) {
      return NextResponse.json(
        { error: 'Proprietário não encontrado' },
        { status: 400 }
      )
    }

    // Verificar se o proprietário é realmente proprietário
    if (proprietario.tipo !== 'proprietario') {
      return NextResponse.json(
        { error: 'O morador selecionado deve ser um proprietário' },
        { status: 400 }
      )
    }

    // Verificar se já existe um inquilino ativo nesta unidade
    const existingInquilino = await Morador.findOne({
      condominio_id: proprietario.condominio_id,
      unidade: proprietario.unidade,
      bloco: proprietario.bloco || '',
      tipo: 'inquilino',
      ativo: true,
      $or: [
        { data_fim: { $exists: false } },
        { data_fim: null },
        { data_fim: { $gt: new Date() } }
      ]
    })
    
    if (existingInquilino) {
      return NextResponse.json(
        { error: 'Já existe um inquilino ativo nesta unidade' },
        { status: 400 }
      )
    }
    
    // Verificar se CPF já existe
    const existingCpf = await Morador.findOne({
      cpf: inquilinoData.cpf.replace(/[^\d]/g, '')
    })
    
    if (existingCpf) {
      return NextResponse.json(
        { error: 'CPF já cadastrado' },
        { status: 400 }
      )
    }

    // Verificar se email já existe em moradores
    const existingMoradorEmail = await Morador.findOne({ 
      email: inquilinoData.email.toLowerCase() 
    })
    if (existingMoradorEmail) {
      return NextResponse.json(
        { error: 'Email já cadastrado em Moradores' },
        { status: 400 }
      )
    }

    // Verificar se email já existe em masters
    const existingMaster = await Master.findOne({ 
      email: inquilinoData.email.toLowerCase() 
    })
    if (existingMaster) {
      return NextResponse.json(
        { error: 'Email já cadastrado em Masters' },
        { status: 400 }
      )
    }

    // Verificar se email já existe em adms
    const existingAdm = await Adm.findOne({ 
      email: inquilinoData.email.toLowerCase() 
    })
    if (existingAdm) {
      return NextResponse.json(
        { error: 'Email já cadastrado em Administradores' },
        { status: 400 }
      )
    }

    // Verificar se email já existe em colaboradores
    const existingColaborador = await Colaborador.findOne({ 
      email: inquilinoData.email.toLowerCase() 
    })
    if (existingColaborador) {
      return NextResponse.json(
        { error: 'Email já cadastrado em Colaboradores' },
        { status: 400 }
      )
    }
    
    // Criar inquilino herdando dados do proprietário automaticamente
    const newInquilino = {
      ...inquilinoData,
      cpf: inquilinoData.cpf.replace(/[^\d]/g, ''),
      email: inquilinoData.email.toLowerCase(),
      tipo: 'inquilino', // Forçar tipo como inquilino
      // Herdar dados do proprietário
      condominio_id: proprietario.condominio_id,
      unidade: proprietario.unidade,
      bloco: proprietario.bloco || '',
      master_id: proprietario.master_id,
      // Datas
      data_nasc: new Date(inquilinoData.data_nasc),
      data_inicio: dataInicio,
      ...(dataFim && { data_fim: dataFim }),
      data_criacao: new Date(),
      ativo: true
    }

    const result = await Morador.create(newInquilino)
    
    return NextResponse.json({
      success: true,
      inquilino: { _id: result._id, ...newInquilino },
      message: 'Inquilino cadastrado com sucesso! Dados herdados automaticamente do proprietário.'
    })
    
  } catch (error) {
    console.error('Error creating inquilino:', error)
    return NextResponse.json(
      { error: 'Erro ao cadastrar inquilino' },
      { status: 500 }
    )
  }

// Endpoint para proprietários listarem apenas seus inquilinos
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const proprietarioId = url.searchParams.get('proprietario_id')
    
    if (!proprietarioId) {
      return NextResponse.json(
        { error: 'ID do proprietário é obrigatório' },
        { status: 400 }
      )
    }

    await connectDB()
    // Buscar inquilinos vinculados a este proprietário
    const inquilinos = await Morador.find({
      proprietario_id: proprietarioId,
      tipo: 'inquilino',
      ativo: true
    }).lean()
    
    // Buscar dados das imobiliárias se houver
    const inquilinosComImobiliaria = await Promise.all(
      inquilinos.map(async (inquilino) => {
        let imobiliaria = null
        if (inquilino.imobiliaria_id) {
          try {
            imobiliaria = await Imobiliaria.findOne({ _id: new mongoose.Types.ObjectId(inquilino.imobiliaria_id) })
          } catch (error) {
            console.error('Error finding imobiliaria:', error)
          }
        }
        
        return {
          ...inquilino,
          imobiliaria_nome: imobiliaria?.nome || null
        }
      })
    )
    
    return NextResponse.json({
      success: true,
      inquilinos: inquilinosComImobiliaria
    })
    
  } catch (error) {
    console.error('Error fetching inquilinos:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar inquilinos' },
      { status: 500 }
    )
  }
}