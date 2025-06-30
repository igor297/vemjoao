import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Condominium from '@/models/condominios'
import Veiculo from '@/models/Veiculo'
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
    
    const result = await Veiculo.find(filter)
    
    // Sem filtro adicional - usa apenas o masterId para isolamento
    const filteredVeiculos = result
    
    // Buscar dados dos condomínios para exibir nomes
    const veiculosComCondominio = await Promise.all(
      filteredVeiculos.map(async (veiculo) => {
        let condominium = null
        try {
          if (veiculo.condominio_id?.length === 24) {
            condominium = await Condominium.findOne({ _id: new mongoose.Types.ObjectId(veiculo.condominio_id) })
          } else {
            condominium = await Condominium.findOne({ _id: veiculo.condominio_id })
          }
        } catch (error) {
          condominium = await Condominium.findOne({ _id: veiculo.condominio_id })
        }
        
        return {
          ...veiculo.toObject(),
          condominio_nome: condominium?.nome || 'N/A'
        }
      })
    )
    
    return NextResponse.json({
      success: true,
      veiculos: veiculosComCondominio
    })
    
  } catch (error) {
    console.error('Error fetching veiculos:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar veículos' },
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
    
    const veiculoData = (request as any)._parsedBody || await request.json()
    
    // Validação básica
    const requiredFields = ['tipo', 'placa', 'condominio_id', 'unidade']
    for (const field of requiredFields) {
      if (!veiculoData[field]) {
        return NextResponse.json(
          { error: `Campo ${field} é obrigatório` },
          { status: 400 }
        )
      }
    }

    // Deve ter morador_id OU inquilino_id
    if (!veiculoData.morador_id && !veiculoData.inquilino_id) {
      return NextResponse.json(
        { error: 'É necessário informar morador_id ou inquilino_id' },
        { status: 400 }
      )
    }

    // Validar tipo
    if (!['carro', 'moto', 'bicicleta', 'outro'].includes(veiculoData.tipo)) {
      return NextResponse.json(
        { error: 'Tipo deve ser: carro, moto, bicicleta ou outro' },
        { status: 400 }
      )
    }

    await connectDB()
    // Verificar se placa já existe
    const existingVeiculo = await Veiculo.findOne({
      placa: veiculoData.placa.toUpperCase().trim()
    })
    
    if (existingVeiculo) {
      return NextResponse.json(
        { error: 'Placa já cadastrada' },
        { status: 400 }
      )
    }
    
    // Converter masterId string para ObjectId
    const masterObjectId = new mongoose.Types.ObjectId(masterId)
    
    const newVeiculo = {
      ...veiculoData,
      master_id: masterObjectId,
      condominio_id: new mongoose.Types.ObjectId(veiculoData.condominio_id),
      morador_id: veiculoData.morador_id ? new mongoose.Types.ObjectId(veiculoData.morador_id) : undefined,
      inquilino_id: veiculoData.inquilino_id ? new mongoose.Types.ObjectId(veiculoData.inquilino_id) : undefined,
      placa: veiculoData.placa.toUpperCase().trim(),
      data_criacao: new Date(),
      ativo: true
    }

    const result = await Veiculo.create(newVeiculo)
    
    return NextResponse.json({
      success: true,
      veiculo: result
    })
    
  } catch (error) {
    console.error('Error creating veiculo:', error)
    console.error('Placa value being saved:', veiculoData?.placa)
    return NextResponse.json(
      { error: 'Erro ao criar veículo' },
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
    
    const { _id, ...veiculoData } = (request as any)._parsedBody || await request.json()
    
    if (!_id) {
      return NextResponse.json(
        { error: 'ID do veículo é obrigatório' },
        { status: 400 }
      )
    }

    await connectDB()
    
    // Converter masterId string para ObjectId
    const masterObjectId = new mongoose.Types.ObjectId(masterId)
    
    // Verificar se o veículo existe e pertence ao master
    const existingVeiculo = await Veiculo.findOne({
      _id: new ObjectId(_id),
      master_id: masterObjectId
    })
    
    if (!existingVeiculo) {
      return NextResponse.json(
        { error: 'Veículo não encontrado' },
        { status: 404 }
      )
    }
    // Verificar se placa já existe em outro veículo
    if (veiculoData.placa) {
      const existingVeiculo = await Veiculo.findOne({
        placa: veiculoData.placa.toUpperCase().trim(),
        _id: { $ne: new mongoose.Types.ObjectId(_id) }
      })
      
      if (existingVeiculo) {
        return NextResponse.json(
          { error: 'Placa já cadastrada para outro veículo' },
          { status: 400 }
        )
      }
    }
    
    const updateData = {
      ...veiculoData,
      ...(veiculoData.placa && { placa: veiculoData.placa.toUpperCase().trim() })
    }

    const result = await Veiculo.findByIdAndUpdate(new mongoose.Types.ObjectId(_id) , updateData , { new: true })
    
    if (!result) {
      return NextResponse.json(
        { error: 'Veículo não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Veículo atualizado com sucesso'
    })
    
  } catch (error) {
    console.error('Error updating veiculo:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar veículo' },
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
        { error: 'ID do veículo é obrigatório' },
        { status: 400 }
      )
    }

    await connectDB()
    
    // Converter masterId string para ObjectId
    const masterObjectId = new mongoose.Types.ObjectId(masterId)
    
    // Verificar se o veículo existe e pertence ao master
    const existingVeiculo = await Veiculo.findOne({
      _id: new ObjectId(id),
      master_id: masterObjectId
    })
    
    if (!existingVeiculo) {
      return NextResponse.json(
        { error: 'Veículo não encontrado' },
        { status: 404 }
      )
    }
    const result = await Veiculo.findByIdAndDelete(new mongoose.Types.ObjectId(id) )
    
    if (!result) {
      return NextResponse.json(
        { error: 'Veículo não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Veículo excluído com sucesso'
    })
    
  } catch (error) {
    console.error('Error deleting veiculo:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir veículo' },
      { status: 500 }
    )
  }
}