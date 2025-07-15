import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Condominium from '@/models/condominios'
import Dependente from '@/models/Dependente'
import Morador from '@/models/Morador'
import Master from '@/models/Master'
import Adm from '@/models/Adm'
import Colaborador from '@/models/Colaborador'
import Conjuge from '@/models/Conjuge'
import { PersonalDataEncryption } from '@/lib/personalDataEncryption'
import { getAuthUser } from '@/utils/auth'
import mongoose from 'mongoose'
const { ObjectId } = mongoose.Types

export async function GET(request: NextRequest) {
  try {
    // Obter dados do usuário autenticado
    const { masterId, isValid } = await getAuthUser(request)
    
    if (!isValid) {
      return NextResponse.json(
        { error: 'Usuário não autenticado. Master ID é obrigatório.' },
        { status: 401 }
      )
    }

    const url = new URL(request.url)
    const condominioId = url.searchParams.get('condominio_id')
    const moradorId = url.searchParams.get('morador_id')
    const inquilinoId = url.searchParams.get('inquilino_id')

    await connectDB()
    
    // Converter masterId string para ObjectId
    const masterObjectId = new mongoose.Types.ObjectId(masterId)
    
    const filter: any = { master_id: masterObjectId }
    if (condominioId) filter.condominio_id = new mongoose.Types.ObjectId(condominioId)
    if (moradorId) filter.morador_id = new mongoose.Types.ObjectId(moradorId)
    if (inquilinoId) filter.inquilino_id = new mongoose.Types.ObjectId(inquilinoId)
    
    const result = await Dependente.find(filter)
    
    // Sem filtro adicional - usa apenas o masterId para isolamento
    const filteredDependentes = result
    
    // Buscar dados dos condomínios para exibir nomes
    const dependentesComCondominio = await Promise.all(
      filteredDependentes.map(async (dependente) => {
        let condominium = null
        try {
          if (dependente.condominio_id?.length === 24) {
            condominium = await Condominium.findOne({ _id: new mongoose.Types.ObjectId(dependente.condominio_id) })
          } else {
            condominium = await Condominium.findOne({ _id: dependente.condominio_id })
          }
        } catch (error) {
          condominium = await Condominium.findOne({ _id: dependente.condominio_id })
        }
        
        // Calcular idade
        const hoje = new Date()
        const nascimento = new Date(dependente.data_nasc)
        let idade = hoje.getFullYear() - nascimento.getFullYear()
        const mes = hoje.getMonth() - nascimento.getMonth()
        if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
          idade--
        }
        
        return {
          ...PersonalDataEncryption.prepareForDisplay(dependente.toObject()),
          condominio_nome: condominium?.nome || 'N/A',
          idade
        }
      })
    )
    
    return NextResponse.json({
      success: true,
      dependentes: dependentesComCondominio
    })
    
  } catch (error) {
    console.error('Error fetching dependentes:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar dependentes' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Obter dados do usuário autenticado
    const { masterId, isValid } = await getAuthUser(request)
    
    if (!isValid) {
      return NextResponse.json(
        { error: 'Usuário não autenticado. Faça login novamente.' },
        { status: 401 }
      )
    }
    
    const dependenteData = (request as any)._parsedBody || await request.json()
    
    // Validação básica
    const requiredFields = ['nome', 'data_nasc', 'condominio_id', 'unidade']
    for (const field of requiredFields) {
      if (!dependenteData[field]) {
        return NextResponse.json(
          { error: `Campo ${field} é obrigatório` },
          { status: 400 }
        )
      }
    }

    // Deve ter morador_id OU inquilino_id
    if (!dependenteData.morador_id && !dependenteData.inquilino_id) {
      return NextResponse.json(
        { error: 'É necessário informar morador_id ou inquilino_id' },
        { status: 400 }
      )
    }

    // Calcular idade para validar email/senha
    const hoje = new Date()
    const nascimento = new Date(dependenteData.data_nasc)
    let idade = hoje.getFullYear() - nascimento.getFullYear()
    const mes = hoje.getMonth() - nascimento.getMonth()
    if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
      idade--
    }

    // Se menor de 18, não pode ter email/senha
    if (idade < 18) {
      dependenteData.email = undefined
      dependenteData.senha = undefined
    } else {
      // Se 18+, email e senha são obrigatórios se fornecidos
      const senha = dependenteData.senha || dependenteData.password
      if (dependenteData.email && !senha) {
        return NextResponse.json(
          { error: 'Senha é obrigatória para dependentes maiores de 18 anos com email' },
          { status: 400 }
        )
      }
      // Normalizar para 'senha' para o processamento
      if (dependenteData.password && !dependenteData.senha) {
        dependenteData.senha = dependenteData.password
        delete dependenteData.password
      }
    }

    await connectDB()
    // Verificar se email já existe (se fornecido)
    if (dependenteData.email) {
      const emailLower = dependenteData.email.toLowerCase()
      
      const existingMorador = await Morador.findOne({ email: emailLower })
      if (existingMorador) {
        return NextResponse.json({ error: 'Email já cadastrado em moradores' }, { status: 400 })
      }
      
      const existingMaster = await Master.findOne({ email: emailLower })
      if (existingMaster) {
        return NextResponse.json({ error: 'Email já cadastrado em masters' }, { status: 400 })
      }
      
      const existingAdm = await Adm.findOne({ email: emailLower })
      if (existingAdm) {
        return NextResponse.json({ error: 'Email já cadastrado em adms' }, { status: 400 })
      }
      
      const existingColaborador = await Colaborador.findOne({ email: emailLower })
      if (existingColaborador) {
        return NextResponse.json({ error: 'Email já cadastrado em colaboradores' }, { status: 400 })
      }
      
      const existingConjuge = await Conjuge.findOne({ email: emailLower })
      if (existingConjuge) {
        return NextResponse.json({ error: 'Email já cadastrado em conjuges' }, { status: 400 })
      }
      
      const existingDependente = await Dependente.findOne({ email: emailLower })
      if (existingDependente) {
        return NextResponse.json({ error: 'Email já cadastrado em dependentes' }, { status: 400 })
      }
    }
    
    // Criptografar dados sensíveis antes de salvar (apenas se tiver senha)
    let encryptedData = dependenteData;
    if (dependenteData.senha) {
      encryptedData = await PersonalDataEncryption.prepareForSave(dependenteData);
    }
    
    // Converter masterId string para ObjectId
    const masterObjectId = new mongoose.Types.ObjectId(masterId)
    
    const newDependente = {
      ...encryptedData,
      master_id: masterObjectId,
      condominio_id: new mongoose.Types.ObjectId(dependenteData.condominio_id),
      morador_id: dependenteData.morador_id ? new mongoose.Types.ObjectId(dependenteData.morador_id) : undefined,
      inquilino_id: dependenteData.inquilino_id ? new mongoose.Types.ObjectId(dependenteData.inquilino_id) : undefined,
      email: dependenteData.email ? dependenteData.email.toLowerCase() : undefined,
      data_nasc: new Date(dependenteData.data_nasc),
      data_criacao: new Date(),
      ativo: true
    }

    const result = await Dependente.create(newDependente)
    
    return NextResponse.json({
      success: true,
      dependente: result
    })
    
  } catch (error) {
    console.error('Error creating dependente:', error)
    return NextResponse.json(
      { error: 'Erro ao criar dependente' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Obter dados do usuário autenticado
    const { masterId, isValid } = await getAuthUser(request)
    
    if (!isValid) {
      return NextResponse.json(
        { error: 'Usuário não autenticado. Faça login novamente.' },
        { status: 401 }
      )
    }
    
    const { _id, ...dependenteData } = (request as any)._parsedBody || await request.json()
    
    if (!_id) {
      return NextResponse.json(
        { error: 'ID do dependente é obrigatório' },
        { status: 400 }
      )
    }

    await connectDB()
    
    // Converter masterId string para ObjectId
    const masterObjectId = new mongoose.Types.ObjectId(masterId)
    
    // Verificar se o dependente existe e pertence ao master
    const existingDependente = await Dependente.findOne({
      _id: new ObjectId(_id),
      master_id: masterObjectId
    })
    
    if (!existingDependente) {
      return NextResponse.json(
        { error: 'Dependente não encontrado' },
        { status: 404 }
      )
    }
    // Use the existing dependente found in authorization check
    const dependenteAtual = existingDependente

    // Calcular idade se data_nasc foi fornecida
    let idade = 0
    const dataNasc = dependenteData.data_nasc ? new Date(dependenteData.data_nasc) : new Date(dependenteAtual.data_nasc)
    const hoje = new Date()
    idade = hoje.getFullYear() - dataNasc.getFullYear()
    const mes = hoje.getMonth() - dataNasc.getMonth()
    if (mes < 0 || (mes === 0 && hoje.getDate() < dataNasc.getDate())) {
      idade--
    }

    // Se menor de 18, não pode ter email/senha
    if (idade < 18) {
      dependenteData.email = undefined
      dependenteData.senha = undefined
      dependenteData.password = undefined
    } else {
      // Normalizar para 'senha' para o processamento
      if (dependenteData.password && !dependenteData.senha) {
        dependenteData.senha = dependenteData.password
        delete dependenteData.password
      }
    }

    // Verificar se email já existe em outro dependente
    if (dependenteData.email) {
      const existingDependente = await Dependente.findOne({
        email: dependenteData.email.toLowerCase(),
        _id: { $ne: new mongoose.Types.ObjectId(_id) }
      })
      
      if (existingDependente) {
        return NextResponse.json(
          { error: 'Email já cadastrado para outro dependente' },
          { status: 400 }
        )
      }
    }
    
    // Criptografar dados sensíveis se fornecidos
    let processedData = dependenteData;
    if (dependenteData.senha) {
      processedData = await PersonalDataEncryption.prepareForSave(dependenteData);
    }
    
    const updateData = {
      ...processedData,
      ...(dependenteData.email && { email: dependenteData.email.toLowerCase() }),
      ...(dependenteData.data_nasc && { data_nasc: new Date(dependenteData.data_nasc) })
    }

    const result = await Dependente.findByIdAndUpdate(new mongoose.Types.ObjectId(_id) , updateData , { new: true })
    
    if (!result) {
      return NextResponse.json(
        { error: 'Dependente não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Dependente atualizado com sucesso'
    })
    
  } catch (error) {
    console.error('Error updating dependente:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar dependente' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Obter dados do usuário autenticado
    const { masterId, isValid } = await getAuthUser(request)
    
    if (!isValid) {
      return NextResponse.json(
        { error: 'Usuário não autenticado. Faça login novamente.' },
        { status: 401 }
      )
    }
    
    const url = new URL(request.url)
    const id = url.searchParams.get('id')
    
    if (!id) {
      return NextResponse.json(
        { error: 'ID do dependente é obrigatório' },
        { status: 400 }
      )
    }

    await connectDB()
    
    // Converter masterId string para ObjectId
    const masterObjectId = new mongoose.Types.ObjectId(masterId)
    
    // Verificar se o dependente existe e pertence ao master
    const existingDependente = await Dependente.findOne({
      _id: new ObjectId(id),
      master_id: masterObjectId
    })
    
    if (!existingDependente) {
      return NextResponse.json(
        { error: 'Dependente não encontrado' },
        { status: 404 }
      )
    }
    const result = await Dependente.findByIdAndDelete(new mongoose.Types.ObjectId(id) )
    
    if (!result) {
      return NextResponse.json(
        { error: 'Dependente não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Dependente excluído com sucesso'
    })
    
  } catch (error) {
    console.error('Error deleting dependente:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir dependente' },
      { status: 500 }
    )
  }
}