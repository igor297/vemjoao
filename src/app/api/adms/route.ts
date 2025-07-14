import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Master from '@/models/Master'
import Adm from '@/models/Adm'
import { PersonalDataEncryption } from '@/lib/personalDataEncryption'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const masterId = url.searchParams.get('master_id')
    const condominioId = url.searchParams.get('condominio_id')
    
    if (!masterId) {
      return NextResponse.json(
        { error: 'Master ID é obrigatório' },
        { status: 400 }
      )
    }

    await connectDB()
    
    // Filtrar ADMs por master e condomínio (se especificado)
    const filter: any = { master_id: masterId }
    if (condominioId) {
      filter.condominio_id = condominioId
    }
    
    const result = await Adm.find(filter).lean()
    
    // Descriptografar dados sensíveis antes de retornar
    const admsForDisplay = result.map(adm => PersonalDataEncryption.prepareForDisplay(adm))
    
    return NextResponse.json({
      success: true,
      adms: admsForDisplay
    })
    
  } catch (error) {
    console.error('Error fetching ADMs:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar administradores' },
      { status: 500 }
    )
  }}

export async function POST(request: NextRequest) {
  try {
    const admData = await request.json()
    
    // Validação básica
    const requiredFields = ['nome', 'cpf', 'data_nasc', 'tipo', 'email', 'senha', 'data_inicio', 'condominio_id', 'master_id']
    for (const field of requiredFields) {
      if (!admData[field]) {
        return NextResponse.json(
          { error: `Campo ${field} é obrigatório` },
          { status: 400 }
        )
      }
    }

    // Validar tipo
    if (!['sindico', 'subsindico', 'conselheiro'].includes(admData.tipo)) {
      return NextResponse.json(
        { error: 'Tipo deve ser: sindico, subsindico ou conselheiro' },
        { status: 400 }
      )
    }

    await connectDB()

    // Verificar se email já existe em masters
    const existingMaster = await Master.findOne({ email: admData.email.toLowerCase() })
    if (existingMaster) {
      return NextResponse.json(
        { error: 'Email já cadastrado em Masters' },
        { status: 400 }
      )
    }

    // Verificar se email já existe em adms
    const existingAdm = await Adm.findOne({ email: admData.email.toLowerCase() })
    if (existingAdm) {
      return NextResponse.json(
        { error: 'Email já cadastrado em Administradores' },
        { status: 400 }
      )
    }

    // Se for síndico, verificar se já existe um síndico ativo no condomínio
    if (admData.tipo === 'sindico') {
      const activeSindico = await Adm.findOne({
        condominio_id: admData.condominio_id,
        tipo: 'sindico',
        data_fim: { $exists: false }
      })
      
      if (activeSindico) {
        return NextResponse.json(
          { error: 'Já existe um síndico ativo neste condomínio' },
          { status: 400 }
        )
      }
    }
    
    // Criptografar dados sensíveis antes de salvar
    const encryptedData = await PersonalDataEncryption.prepareForSave(admData);
    
    const newAdm = {
      ...encryptedData,
      tipo: admData.tipo.toLowerCase(),
      email: admData.email.toLowerCase(),
      data_nasc: new Date(admData.data_nasc),
      data_inicio: new Date(admData.data_inicio),
      data_fim: admData.data_fim ? new Date(admData.data_fim) : undefined,
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
      morador_origem_id: admData.morador_origem_id && admData.morador_origem_id.trim() !== '' ? admData.morador_origem_id : undefined,
      data_criacao: new Date()
    }

    const result = await Adm.create(newAdm)
    
    return NextResponse.json({
      success: true,
      adm: { _id: result.insertedId, ...newAdm }
    })
    
  } catch (error) {
    console.error('Error creating ADM:', error)
    return NextResponse.json(
      { error: 'Erro ao criar administrador' },
      { status: 500 }
    )
  }}

export async function PUT(request: NextRequest) {
  try {
    const admData = await request.json()
    
    if (!admData._id) {
      return NextResponse.json(
        { error: 'ID do administrador é obrigatório' },
        { status: 400 }
      )
    }

    // Validação básica (senha não é obrigatória na edição)
    const requiredFields = ['nome', 'cpf', 'data_nasc', 'tipo', 'email', 'data_inicio', 'condominio_id', 'master_id']
    for (const field of requiredFields) {
      if (!admData[field]) {
        return NextResponse.json(
          { error: `Campo ${field} é obrigatório` },
          { status: 400 }
        )
      }
    }

    // Validar tipo
    if (!['sindico', 'subsindico', 'conselheiro'].includes(admData.tipo)) {
      return NextResponse.json(
        { error: 'Tipo deve ser: sindico, subsindico ou conselheiro' },
        { status: 400 }
      )
    }

    await connectDB()
    // Verificar se o administrador existe
    const existingAdm = await Adm.findOne({ _id: admData._id })
    if (!existingAdm) {
      return NextResponse.json(
        { error: 'Administrador não encontrado' },
        { status: 404 }
      )
    }


    // Verificar se email já existe em outro administrador
    const duplicateEmail = await Adm.findOne({
      email: admData.email.toLowerCase(),
      _id: { $ne: admData._id }
    })
    
    if (duplicateEmail) {
      return NextResponse.json(
        { error: 'Email já cadastrado para outro administrador' },
        { status: 400 }
      )
    }

    // Se for síndico, verificar se já existe outro síndico ativo no condomínio
    if (admData.tipo === 'sindico') {
      const activeSindico = await Adm.findOne({
        condominio_id: admData.condominio_id,
        tipo: 'sindico',
        data_fim: { $exists: false },
        _id: { $ne: admData._id }
      })
      
      if (activeSindico) {
        return NextResponse.json(
          { error: 'Já existe outro síndico ativo neste condomínio' },
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
      data_fim: admData.data_fim ? new Date(admData.data_fim) : undefined,
      condominio_id: admData.condominio_id,
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

    // Só atualizar senha se foi fornecida - com hash
    if (admData.senha && admData.senha.trim() !== '') {
      updateData.senha = await PersonalDataEncryption.hashPassword(admData.senha)
    }

    const result = await Adm.findByIdAndUpdate(
      { _id: admData._id },
      { $set: updateData }
    )
    
    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Administrador não encontrado' },
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
  }}