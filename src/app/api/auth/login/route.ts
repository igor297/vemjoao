import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Master from '@/models/Master'
import Adm from '@/models/Adm'
import Colaborador from '@/models/Colaborador'
import Morador from '@/models/Morador'
import Condominium from '@/models/condominios'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email e senha são obrigatórios' },
        { status: 400 }
      )
    }

    await connectDB()
    
    const emailLower = email.toLowerCase().trim()
    
    // Primeiro, tentar buscar na collection masters
    const masterUser = await Master.findOne({ 
      email: emailLower,
      senha: password 
    })
    
    if (masterUser) {
      return NextResponse.json({
        success: true,
        user: {
          id: masterUser._id.toString(),  // Always use _id for consistency
          nome: masterUser.nome,
          email: masterUser.email,
          tipo: 'master',
          isMaster: true,
          isAdm: false
        }
      })
    }
    
    // Se não encontrou em masters, buscar na collection adms
    const admUser = await Adm.findOne({ 
      email: emailLower,
      senha: password 
    })
    
    if (admUser) {
      // Verificar se o ADM está ativo (data_fim não existe ou é futura)
      if (admUser.data_fim) {
        const now = new Date()
        const dataFim = new Date(admUser.data_fim)
        
        if (dataFim < now) {
          return NextResponse.json(
            { error: 'Acesso expirado. Entre em contato com o administrador.' },
            { status: 401 }
          )
        }
      }
      
      // Buscar dados do condomínio
      let condominium = null
      
      if (admUser.condominio_id) {
        try {
          condominium = await Condominium.findById(admUser.condominio_id)
        } catch (error) {
          console.error('Error finding condominium:', error)
        }
      }
      
      return NextResponse.json({
        success: true,
        user: {
          id: admUser._id.toString(),  // Always use _id for consistency
          nome: admUser.nome,
          email: admUser.email,
          tipo: 'adm',
          subtipo: admUser.tipo, // sindico, subsindico, conselheiro
          condominio_id: admUser.condominio_id,
          condominio_nome: condominium?.nome || 'N/A',
          master_id: admUser.master_id,
          isMaster: false,
          isAdm: true
        }
      })
    }
    
    // Se não encontrou em masters e adms, buscar na collection colaboradores
    const colaboradorUser = await Colaborador.findOne({ 
      email: emailLower,
      senha: password 
    })
    
    if (colaboradorUser) {
      // Verificar se o colaborador está ativo (data_fim não existe ou é futura)
      if (colaboradorUser.data_fim) {
        const now = new Date()
        const dataFim = new Date(colaboradorUser.data_fim)
        
        if (dataFim < now) {
          return NextResponse.json(
            { error: 'Acesso expirado. Entre em contato com o administrador.' },
            { status: 401 }
          )
        }
      }
      
      // Buscar dados do condomínio
      let condominium = null
      
      if (colaboradorUser.condominio_id) {
        try {
          condominium = await Condominium.findById(colaboradorUser.condominio_id)
        } catch (error) {
          console.error('Error finding condominium:', error)
        }
      }
      
      return NextResponse.json({
        success: true,
        user: {
          id: colaboradorUser._id.toString(),  // Always use _id for consistency
          nome: colaboradorUser.nome,
          email: colaboradorUser.email,
          tipo: 'colaborador',
          condominio_id: colaboradorUser.condominio_id,
          condominio_nome: condominium?.nome || 'N/A',
          master_id: colaboradorUser.master_id,
          isMaster: false,
          isAdm: false,
          isColaborador: true
        }
      })
    }
    
    // Se não encontrou em masters, adms e colaboradores, buscar na collection moradores
    const moradorUser = await Morador.findOne({ 
      email: emailLower,
      senha: password 
    })
    
    if (moradorUser) {
      // Verificar se o morador está ativo (data_fim não existe ou é futura)
      if (moradorUser.data_fim) {
        const now = new Date()
        const dataFim = new Date(moradorUser.data_fim)
        
        if (dataFim < now) {
          return NextResponse.json(
            { error: 'Acesso expirado. Entre em contato com o administrador.' },
            { status: 401 }
          )
        }
      }
      
      // Verificar se está ativo
      if (!moradorUser.ativo) {
        return NextResponse.json(
          { error: 'Conta inativa. Entre em contato com o administrador.' },
          { status: 401 }
        )
      }
      
      // Buscar dados do condomínio
      let condominium = null
      
      if (moradorUser.condominio_id) {
        try {
          condominium = await Condominium.findById(moradorUser.condominio_id)
        } catch (error) {
          console.error('Error finding condominium:', error)
        }
      }
      
      // Buscar dados do responsável se for dependente
      let responsavel = null
      if (moradorUser.tipo === 'dependente' && moradorUser.responsavel_id) {
        try {
          responsavel = await Morador.findById(moradorUser.responsavel_id)
        } catch (error) {
          console.error('Error finding responsavel:', error)
        }
      }

      // Buscar dados do proprietário se for inquilino
      let proprietario = null
      if (moradorUser.tipo === 'inquilino' && moradorUser.proprietario_id) {
        try {
          proprietario = await Morador.findById(moradorUser.proprietario_id)
        } catch (error) {
          console.error('Error finding proprietario:', error)
        }
      }
      
      return NextResponse.json({
        success: true,
        user: {
          id: moradorUser._id.toString(),  // Always use _id for consistency
          nome: moradorUser.nome,
          email: moradorUser.email,
          tipo: 'morador',
          subtipo: moradorUser.tipo, // proprietario, inquilino, dependente
          unidade: moradorUser.unidade,
          apartamento: moradorUser.unidade,  // Adicionar apartamento para compatibilidade
          bloco: moradorUser.bloco || '',
          condominio_id: moradorUser.condominio_id,
          condominio_nome: condominium?.nome || 'N/A',
          master_id: moradorUser.master_id,
          responsavel_nome: responsavel?.nome || null,
          proprietario_nome: proprietario?.nome || null,
          isMaster: false,
          isAdm: false,
          isColaborador: false,
          isMorador: true
        }
      })
    }
    
    // Se não encontrou em nenhuma collection
    return NextResponse.json(
      { error: 'Email ou senha incorretos' },
      { status: 401 }
    )
    
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}