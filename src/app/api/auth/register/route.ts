import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Master from '@/models/Master'
import { PersonalDataEncryption } from '@/lib/personalDataEncryption'

export async function POST(request: NextRequest) {
  console.log('🔄 [REGISTER] Início da tentativa de registro')
  
  try {
    console.log('🔄 [REGISTER] Extraindo dados do request...')
    const { nome, cpf, cnpj, email, password, celular1, celular2 } = await request.json()
    console.log('🔄 [REGISTER] Dados recebidos:', { nome, cpf, cnpj, email, celular1, celular2 })
    
    if (!nome || !cpf || !email || !password || !celular1) {
      console.log('❌ [REGISTER] Dados obrigatórios não fornecidos')
      return NextResponse.json(
        { success: false, message: 'Nome, CPF, email, senha e celular são obrigatórios' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      console.log('❌ [REGISTER] Senha muito curta')
      return NextResponse.json(
        { success: false, message: 'A senha deve ter pelo menos 6 caracteres' },
        { status: 400 }
      )
    }

    console.log('🔄 [REGISTER] Conectando ao banco de dados...')
    await connectDB()
    console.log('✅ [REGISTER] Conexão com banco estabelecida')
    
    const emailLower = email.toLowerCase().trim()
    console.log('🔄 [REGISTER] Email normalizado:', emailLower)
    
    // Verificar se já existe um usuário com este email
    console.log('🔄 [REGISTER] Verificando se email já existe...')
    const existingUser = await Master.findOne({ 
      email: emailLower
    })
    
    if (existingUser) {
      console.log('❌ [REGISTER] Email já existe')
      return NextResponse.json(
        { success: false, message: 'Este email já está sendo usado por outro usuário' },
        { status: 409 }
      )
    }
    
    // Criptografar senha
    console.log('🔄 [REGISTER] Criptografando senha...')
    const hashedPassword = await PersonalDataEncryption.hashPassword(password)
    
    // Criar novo usuário
    console.log('🔄 [REGISTER] Criando novo usuário...')
    const newUser = new Master({
      nome,
      cpf,
      cnpj: cnpj || '',
      email: emailLower,
      senha: hashedPassword,
      celular1,
      celular2: celular2 || '',
      status: 'teste', // Status teste para cadastros via formulário
      dataCriacao: new Date().toLocaleDateString('pt-BR'),
      horaCriacao: new Date().toLocaleTimeString('pt-BR'),
      dataHoraCriacao: `${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`,
      dataHoraUltimaAtualizacao: `${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`,
      dataUltimaAtualizacao: new Date().toLocaleDateString('pt-BR'),
      horaUltimaAtualizacao: new Date().toLocaleTimeString('pt-BR')
    })
    
    await newUser.save()
    console.log('✅ [REGISTER] Usuário criado com sucesso:', newUser._id)
    
    return NextResponse.json({
      success: true,
      message: 'Cadastro realizado com sucesso! Sua conta foi criada com status de teste.',
      user: {
        id: newUser._id.toString(),
        nome: newUser.nome,
        cpf: newUser.cpf,
        email: newUser.email,
        status: newUser.status
      }
    })
    
  } catch (error) {
    console.error('❌ [REGISTER] ERRO CRÍTICO no registro:', error)
    console.error('❌ [REGISTER] Stack trace:', error instanceof Error ? error.stack : 'N/A')
    
    return NextResponse.json(
      { 
        success: false,
        message: 'Erro interno do servidor. Tente novamente mais tarde.'
      },
      { status: 500 }
    )
  }
}