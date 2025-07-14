import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Morador from '@/models/Morador'
import Condominium from '@/models/condominios'
import Imobiliaria from '@/models/Imobiliaria'
import { PersonalDataEncryption } from '@/lib/personalDataEncryption'
import mongoose from 'mongoose'

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
    // Filtrar imobiliárias por master e opcionalmente por condomínio
    const filter: any = { master_id: masterId }
    if (condominioId) {
      filter.condominio_id = condominioId
    }
    
    const result = await Imobiliaria.find(filter).lean()
    
    // Buscar dados dos condomínios para exibir nomes
    const imobiliariasComCondominio = await Promise.all(
      result.map(async (imobiliaria) => {
        let condominium = null
        try {
          if (imobiliaria.condominio_id?.length === 24) {
            condominium = await Condominium.findOne({ _id: new mongoose.Types.ObjectId(imobiliaria.condominio_id) })
          } else {
            condominium = await Condominium.findOne({ _id: imobiliaria.condominio_id })
          }
        } catch (error) {
          condominium = await Condominium.findOne({ _id: imobiliaria.condominio_id })
        }
        
        return {
          ...PersonalDataEncryption.prepareForDisplay(imobiliaria),
          condominio_nome: condominium?.nome || 'N/A'
        }
      })
    )
    
    return NextResponse.json({
      success: true,
      imobiliarias: imobiliariasComCondominio
    })
    
  } catch (error) {
    console.error('Error fetching imobiliarias:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar imobiliárias' },
      { status: 500 }
    )
  }

}

export async function POST(request: NextRequest) {
  try {
    const imobiliariaData = await request.json()
    
    // Validação básica - apenas campos essenciais são obrigatórios
    const requiredFields = ['nome', 'email', 'telefone1', 'endereco', 'responsavel_nome', 'responsavel_celular', 'responsavel_email', 'condominio_id', 'master_id']
    for (const field of requiredFields) {
      if (!imobiliariaData[field]) {
        return NextResponse.json(
          { error: `Campo ${field} é obrigatório` },
          { status: 400 }
        )
      }
    }

    await connectDB()
    // Verificar se CNPJ já existe (apenas se fornecido)
    if (imobiliariaData.cnpj) {
      const existingCnpj = await Imobiliaria.findOne({
        cnpj: imobiliariaData.cnpj.replace(/[^\d]/g, '')
      })
      
      if (existingCnpj) {
        return NextResponse.json(
          { error: 'CNPJ já cadastrado' },
          { status: 400 }
        )
      }
    }

    // Verificar se email já existe
    const existingEmail = await Imobiliaria.findOne({ 
      email: imobiliariaData.email.toLowerCase() 
    })
    if (existingEmail) {
      return NextResponse.json(
        { error: 'Email já cadastrado' },
        { status: 400 }
      )
    }
    
    
    // Transformar endereco string em objeto estruturado se necessário
    let enderecoObj = {}
    if (typeof imobiliariaData.endereco === 'string') {
      // Se endereco for uma string, criar um objeto com o campo 'rua'
      enderecoObj = {
        rua: imobiliariaData.endereco,
        cep: '',
        estado: '',
        cidade: '',
        bairro: '',
        numero: '',
        complemento: ''
      }
    } else if (imobiliariaData.endereco && typeof imobiliariaData.endereco === 'object') {
      enderecoObj = imobiliariaData.endereco
    }

    // Criptografar dados sensíveis antes de salvar
    const encryptedData = await PersonalDataEncryption.prepareForSave(imobiliariaData);
    
    const newImobiliaria = {
      ...encryptedData,
      cnpj: encryptedData.cnpj, // Já criptografado pelo prepareForSave
      email: imobiliariaData.email.toLowerCase(),
      responsavel_email: imobiliariaData.responsavel_email.toLowerCase(),
      endereco: enderecoObj,
      data_criacao: new Date(),
      ativo: true
    }

    const result = await Imobiliaria.create(newImobiliaria)
    
    return NextResponse.json({
      success: true,
      imobiliaria: { _id: result._id, ...newImobiliaria }
    })
    
  } catch (error) {
    console.error('Error creating imobiliaria:', error)
    return NextResponse.json(
      { error: 'Erro ao criar imobiliária' },
      { status: 500 }
    )
  }

}

export async function PUT(request: NextRequest) {
  try {
    const { _id, ...imobiliariaData } = await request.json()
    
    if (!_id) {
      return NextResponse.json(
        { error: 'ID da imobiliária é obrigatório' },
        { status: 400 }
      )
    }

    await connectDB()
    // Verificar se existe outra imobiliária com o mesmo CNPJ
    if (imobiliariaData.cnpj) {
      const existingCnpj = await Imobiliaria.findOne({
        cnpj: imobiliariaData.cnpj.replace(/[^\d]/g, ''),
        _id: { $ne: new mongoose.Types.ObjectId(_id) }
      })
      
      if (existingCnpj) {
        return NextResponse.json(
          { error: 'CNPJ já cadastrado para outra imobiliária' },
          { status: 400 }
        )
      }
    }

    // Verificar se existe outra imobiliária com o mesmo email
    if (imobiliariaData.email) {
      const existingEmail = await Imobiliaria.findOne({
        email: imobiliariaData.email.toLowerCase(),
        _id: { $ne: new mongoose.Types.ObjectId(_id) }
      })
      
      if (existingEmail) {
        return NextResponse.json(
          { error: 'Email já cadastrado para outra imobiliária' },
          { status: 400 }
        )
      }
    }
    
    // Transformar endereco string em objeto estruturado se necessário
    let enderecoObj = imobiliariaData.endereco
    if (typeof imobiliariaData.endereco === 'string') {
      enderecoObj = {
        rua: imobiliariaData.endereco,
        cep: '',
        estado: '',
        cidade: '',
        bairro: '',
        numero: '',
        complemento: ''
      }
    }

    // Criptografar dados sensíveis se fornecidos
    let processedData = imobiliariaData;
    if (imobiliariaData.cnpj) {
      processedData = await PersonalDataEncryption.prepareForSave(imobiliariaData);
    }

    const updateData = {
      ...processedData,
      ...(processedData.cnpj && { cnpj: processedData.cnpj }), // Já processado pelo prepareForSave se necessário
      ...(imobiliariaData.email && { email: imobiliariaData.email.toLowerCase() }),
      ...(imobiliariaData.responsavel_email && { responsavel_email: imobiliariaData.responsavel_email.toLowerCase() }),
      ...(enderecoObj && { endereco: enderecoObj })
    }

    const result = await Imobiliaria.findByIdAndUpdate(new mongoose.Types.ObjectId(_id) , updateData , { new: true })
    
    if (!result) {
      return NextResponse.json(
        { error: 'Imobiliária não encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Imobiliária atualizada com sucesso'
    })
    
  } catch (error) {
    console.error('Error updating imobiliaria:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar imobiliária' },
      { status: 500 }
    )
  }

}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const id = url.searchParams.get('id')
    
    if (!id) {
      return NextResponse.json(
        { error: 'ID da imobiliária é obrigatório' },
        { status: 400 }
      )
    }

    await connectDB()
    // Verificar se existem inquilinos vinculados a esta imobiliária
    const inquilinosVinculados = await Morador.find(filter).lean()
    
    if (inquilinosVinculados.length > 0) {
      return NextResponse.json(
        { error: 'Não é possível excluir imobiliária que possui inquilinos vinculados' },
        { status: 400 }
      )
    }

    const result = await Imobiliaria.findByIdAndDelete(new mongoose.Types.ObjectId(id) )
    
    if (!result) {
      return NextResponse.json(
        { error: 'Imobiliária não encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Imobiliária excluída com sucesso'
    })
    
  } catch (error) {
    console.error('Error deleting imobiliaria:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir imobiliária' },
      { status: 500 }
    )
  }
}