import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Condominium from '@/models/condominios'
import Colaborador from '@/models/Colaborador'
import Adm from '@/models/Adm'
import Master from '@/models/Master'
import Morador from '@/models/Morador'
import mongoose from 'mongoose'

export async function PUT(request: NextRequest) {
  try {
    const { morador_id, celular1, celular2, email, observacoes } = await request.json()
    
    if (!morador_id) {
      return NextResponse.json(
        { error: 'ID do morador é obrigatório' },
        { status: 400 }
      )
    }

    // Validação básica dos campos obrigatórios
    if (!celular1 || !email) {
      return NextResponse.json(
        { error: 'Celular principal e email são obrigatórios' },
        { status: 400 }
      )
    }

    await connectDB()
    // Verificar se o morador existe
    const morador = await Morador.findOne({ _id: new mongoose.Types.ObjectId(morador_id) })
    
    if (!morador) {
      return NextResponse.json(
        { error: 'Morador não encontrado' },
        { status: 404 }
      )
    }

    // Verificar se existe outro morador com o mesmo email (exceto o próprio)
    if (email && email.toLowerCase() !== morador.email) {
      const existingMoradorEmail = await Morador.findOne({
        email: email.toLowerCase(),
        _id: { $ne: new mongoose.Types.ObjectId(morador_id) }
      })
      
      if (existingMoradorEmail) {
        return NextResponse.json(
          { error: 'Email já cadastrado para outro morador' },
          { status: 400 }
        )
      }

      // Verificar se email já existe em outras coleções
      const existingMaster = await Master.findOne({ 
        email: email.toLowerCase() 
      })
      if (existingMaster) {
        return NextResponse.json(
          { error: 'Email já cadastrado em Masters' },
          { status: 400 }
        )
      }

      const existingAdm = await Adm.findOne({ 
        email: email.toLowerCase() 
      })
      if (existingAdm) {
        return NextResponse.json(
          { error: 'Email já cadastrado em Administradores' },
          { status: 400 }
        )
      }

      const existingColaborador = await Colaborador.findOne({ 
        email: email.toLowerCase() 
      })
      if (existingColaborador) {
        return NextResponse.json(
          { error: 'Email já cadastrado em Colaboradores' },
          { status: 400 }
        )
      }
    }
    
    // Dados que o morador pode editar (apenas campos específicos)
    const updateData = {
      celular1,
      celular2: celular2 || undefined,
      email: email.toLowerCase(),
      observacoes: observacoes || undefined
    }

    const result = await Morador.findByIdAndUpdate(new mongoose.Types.ObjectId(morador_id) , updateData , { new: true })
    
    if (!result) {
      return NextResponse.json(
        { error: 'Morador não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Perfil atualizado com sucesso'
    })
    
  } catch (error) {
    console.error('Error updating morador profile:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar perfil' },
      { status: 500 }
    )
  }

}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const moradorId = url.searchParams.get('morador_id')
    
    if (!moradorId) {
      return NextResponse.json(
        { error: 'ID do morador é obrigatório' },
        { status: 400 }
      )
    }

    await connectDB()
    const morador = await Morador.findOne({ _id: new mongoose.Types.ObjectId(moradorId) })
    
    if (!morador) {
      return NextResponse.json(
        { error: 'Morador não encontrado' },
        { status: 404 }
      )
    }

    // Buscar dados do condomínio
    let condominium = null
    
    try {
      if (morador.condominio_id?.length === 24) {
        condominium = await Condominium.findOne({ _id: new mongoose.Types.ObjectId(morador.condominio_id) })
      } else {
        condominium = await Condominium.findOne({ _id: morador.condominio_id })
      }
    } catch (error) {
      condominium = await Condominium.findOne({ _id: morador.condominio_id })
    }

    // Buscar dados do responsável se for dependente
    let responsavel = null
    if (morador.tipo === 'dependente' && morador.responsavel_id) {
      try {
        responsavel = await Morador.findOne({ _id: new mongoose.Types.ObjectId(morador.responsavel_id) })
      } catch (error) {
        console.error('Error finding responsavel:', error)
      }
    }
    
    // Retornar apenas dados pessoais (sem senha)
    const { senha, ...moradorData } = morador
    
    return NextResponse.json({
      success: true,
      morador: {
        ...moradorData,
        condominio_nome: condominium?.nome || 'N/A',
        responsavel_nome: responsavel?.nome || null
      }
    })
    
  } catch (error) {
    console.error('Error fetching morador profile:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar perfil' },
      { status: 500 }
    )
  }
}