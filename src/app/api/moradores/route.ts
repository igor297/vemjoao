import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Morador from '@/models/Morador'
import Condominium from '@/models/condominios'
import Master from '@/models/Master'
import Adm from '@/models/Adm'
import Colaborador from '@/models/Colaborador'
import Imobiliaria from '@/models/Imobiliaria'
import FinanceiroMorador from '@/models/FinanceiroMorador'
import StatusPagamentoMorador from '@/models/StatusPagamentoMorador'
import { PersonalDataEncryption } from '@/lib/personalDataEncryption'
import mongoose from 'mongoose'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const moradorId = url.searchParams.get('id')
    const masterId = url.searchParams.get('master_id')
    const condominioId = url.searchParams.get('condominio_id')
    const unidade = url.searchParams.get('unidade')
    const nome = url.searchParams.get('nome')
    
    await connectDB()
    
    // Se tem ID específico, buscar morador individual
    if (moradorId) {
      const morador = await Morador.findById(moradorId).lean()
      
      if (!morador) {
        return NextResponse.json(
          { success: false, error: 'Morador não encontrado' },
          { status: 404 }
        )
      }
      
      // Buscar dados do condomínio
      let condominium = null
      try {
        if (morador.condominio_id) {
          condominium = await Condominium.findById(morador.condominio_id).lean()
        }
      } catch (error) {
        console.error('Error finding condominium:', error)
      }
      
      return NextResponse.json({
        success: true,
        morador: {
          ...PersonalDataEncryption.prepareForDisplay(morador),
          condominio_nome: condominium?.nome || 'N/A'
        }
      })
    }
    
    // Busca por lista de moradores (comportamento original)
    if (!masterId) {
      return NextResponse.json(
        { error: 'Master ID é obrigatório' },
        { status: 400 }
      )
    }
    
    // Filtrar moradores por master e opcionalmente por condomínio, unidade e nome
    const filter: any = { master_id: masterId }
    if (condominioId) {
      filter.condominio_id = condominioId
    }
    if (unidade) {
      filter.unidade = unidade
    }
    if (nome) {
      filter.nome = { $regex: nome, $options: 'i' } // Busca case-insensitive
    }
    
    const result = await Morador.find(filter).lean()
    
    // Buscar dados dos condomínios para exibir nomes
    const moradoresComCondominio = await Promise.all(
      result.map(async (morador) => {
        let condominium = null
        try {
          if (morador.condominio_id) {
            condominium = await Condominium.findById(morador.condominio_id).lean()
          }
        } catch (error) {
          console.error('Error finding condominium:', error)
        }
        
        // Se for dependente, buscar dados do responsável
        let responsavel = null
        if (morador.responsavel_id) {
          try {
            responsavel = await Morador.findById(morador.responsavel_id).lean()
          } catch (error) {
            console.error('Error finding responsavel:', error)
          }
        }

        // Se for inquilino, buscar dados do proprietário
        let proprietario = null
        if (morador.proprietario_id) {
          try {
            proprietario = await Morador.findById(morador.proprietario_id).lean()
          } catch (error) {
            console.error('Error finding proprietario:', error)
          }
        }

        // Se for inquilino, buscar dados da imobiliária
        let imobiliaria = null
        if (morador.imobiliaria_id) {
          try {
            imobiliaria = await Imobiliaria.findById(morador.imobiliaria_id).lean()
          } catch (error) {
            console.error('Error finding imobiliaria:', error)
          }
        }
        
        return {
          ...PersonalDataEncryption.prepareForDisplay(morador),
          condominio_nome: condominium?.nome || 'N/A',
          responsavel_nome: responsavel?.nome || 'N/A',
          proprietario_nome: proprietario?.nome || 'N/A',
          imobiliaria_nome: imobiliaria?.nome || 'N/A'
        }
      })
    )
    
    return NextResponse.json({
      success: true,
      moradores: moradoresComCondominio
    })
    
  } catch (error) {
    console.error('Error fetching moradores:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar moradores' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const moradorData = await request.json()
    
    // Validação básica
    const requiredFields = [
      'nome', 'cpf', 'data_nasc', 'celular1', 'email', 'tipo', 'unidade', 'data_inicio', 'condominio_id', 'master_id'
    ]
    
    // Validar senha separadamente (aceita tanto 'senha' quanto 'password')
    const senhaInput = moradorData.senha || moradorData.password;
    if (!senhaInput) {
      return NextResponse.json(
        { error: 'Campo senha é obrigatório' },
        { status: 400 }
      )
    }
    
    // Validação de campos obrigatórios
    for (const field of requiredFields) {
      if (!moradorData[field]) {
        return NextResponse.json(
          { error: `Campo ${field} é obrigatório` },
          { status: 400 }
        )
      }
    }

    // Validar tipo
    if (!['proprietario', 'inquilino', 'dependente'].includes(moradorData.tipo)) {
      return NextResponse.json(
        { error: 'Tipo deve ser: proprietario, inquilino ou dependente' },
        { status: 400 }
      )
    }

    await connectDB()
    
    // Verificar se CPF já existe
    const existingCpf = await Morador.findOne({
      cpf: moradorData.cpf.replace(/[^\d]/g, '')
    })
    
    if (existingCpf) {
      return NextResponse.json(
        { error: 'CPF já cadastrado' },
        { status: 400 }
      )
    }

    // Verificar se email já existe em moradores
    const existingMoradorEmail = await Morador.findOne({ 
      email: moradorData.email.toLowerCase() 
    })
    if (existingMoradorEmail) {
      return NextResponse.json(
        { error: 'Email já cadastrado em Moradores' },
        { status: 400 }
      )
    }

    // Verificar se email já existe em masters
    const existingMaster = await Master.findOne({ 
      email: moradorData.email.toLowerCase() 
    })
    if (existingMaster) {
      return NextResponse.json(
        { error: 'Email já cadastrado em Masters' },
        { status: 400 }
      )
    }

    // Verificar se email já existe em adms
    const existingAdm = await Adm.findOne({ 
      email: moradorData.email.toLowerCase() 
    })
    if (existingAdm) {
      return NextResponse.json(
        { error: 'Email já cadastrado em Administradores' },
        { status: 400 }
      )
    }

    // Verificar se email já existe em colaboradores
    const existingColaborador = await Colaborador.findOne({ 
      email: moradorData.email.toLowerCase() 
    })
    if (existingColaborador) {
      return NextResponse.json(
        { error: 'Email já cadastrado em Colaboradores' },
        { status: 400 }
      )
    }

    // Se for dependente, verificar se o responsável existe
    if (moradorData.tipo === 'dependente' && moradorData.responsavel_id) {
      const responsavel = await Morador.findById(moradorData.responsavel_id)
      
      if (!responsavel) {
        return NextResponse.json(
          { error: 'Responsável não encontrado' },
          { status: 400 }
        )
      }
    }

    // Se for inquilino, verificar se o proprietário existe e herdar dados
    let proprietarioData = null
    if (moradorData.tipo === 'inquilino' && moradorData.proprietario_id) {
      proprietarioData = await Morador.findById(moradorData.proprietario_id)
      
      if (!proprietarioData) {
        return NextResponse.json(
          { error: 'Proprietário não encontrado' },
          { status: 400 }
        )
      }

      // Verificar se o proprietário é realmente proprietário
      if (proprietarioData.tipo !== 'proprietario') {
        return NextResponse.json(
          { error: 'O morador selecionado deve ser um proprietário' },
          { status: 400 }
        )
      }

      // Verificar se já existe um inquilino ativo nesta unidade
      const existingInquilino = await Morador.findOne({
        condominio_id: proprietarioData.condominio_id,
        unidade: proprietarioData.unidade,
        bloco: proprietarioData.bloco || '',
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

      // Herdar automaticamente dados do proprietário
      moradorData.condominio_id = proprietarioData.condominio_id
      moradorData.unidade = proprietarioData.unidade
      moradorData.bloco = proprietarioData.bloco || ''
      moradorData.master_id = proprietarioData.master_id
    }

    // Verificar se a unidade já tem um proprietário ativo (se for proprietário)
    if (moradorData.tipo === 'proprietario') {
      const existingProprietario = await Morador.findOne({
        condominio_id: moradorData.condominio_id,
        unidade: moradorData.unidade,
        bloco: moradorData.bloco || '',
        tipo: 'proprietario',
        ativo: true,
        $or: [
          { data_fim: { $exists: false } },
          { data_fim: null },
          { data_fim: { $gt: new Date() } }
        ]
      })
      
      if (existingProprietario) {
        return NextResponse.json(
          { error: 'Já existe um proprietário ativo para esta unidade' },
          { status: 400 }
        )
      }
    }
    
    // Criptografar dados sensíveis antes de salvar
    const encryptedData = await PersonalDataEncryption.prepareForSave(moradorData);
    
    const newMoradorData = {
      ...encryptedData,
      cpf: encryptedData.cpf, // Já criptografado pelo prepareForSave
      email: moradorData.email.toLowerCase(),
      data_nasc: new Date(moradorData.data_nasc),
      data_inicio: new Date(moradorData.data_inicio),
      data_fim: moradorData.data_fim ? new Date(moradorData.data_fim) : undefined,
      // Tratar campos ObjectId vazios
      responsavel_id: moradorData.responsavel_id && moradorData.responsavel_id !== '' ? moradorData.responsavel_id : undefined,
      proprietario_id: moradorData.proprietario_id && moradorData.proprietario_id !== '' ? moradorData.proprietario_id : undefined,
      imobiliaria_id: moradorData.imobiliaria_id && moradorData.imobiliaria_id !== '' ? moradorData.imobiliaria_id : undefined,
      data_criacao: new Date(),
      ativo: true
    }

    const newMorador = new Morador(newMoradorData)
    const result = await newMorador.save()
    
    return NextResponse.json({
      success: true,
      morador: result
    })
    
  } catch (error) {
    console.error('Error creating morador:', error)
    return NextResponse.json(
      { error: 'Erro ao criar morador' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { _id, ...moradorData } = await request.json()
    
    if (!_id) {
      return NextResponse.json(
        { error: 'ID do morador é obrigatório' },
        { status: 400 }
      )
    }

    await connectDB()
    
    // Verificar se existe outro morador com o mesmo CPF
    if (moradorData.cpf) {
      const existingCpf = await Morador.findOne({
        cpf: moradorData.cpf.replace(/[^\d]/g, ''),
        _id: { $ne: new mongoose.Types.ObjectId(_id) }
      })
      
      if (existingCpf) {
        return NextResponse.json(
          { error: 'CPF já cadastrado para outro morador' },
          { status: 400 }
        )
      }
    }
    
    // Limpar campos ObjectId vazios
    const cleanObjectIdField = (field) => {
      if (!field || field === '' || field === 'null' || field === 'undefined') {
        return undefined
      }
      return field
    }

    // Criptografar dados sensíveis se fornecidos
    let processedData = moradorData;
    if (moradorData.cpf || moradorData.senha) {
      processedData = await PersonalDataEncryption.prepareForSave(moradorData);
    }

    const updateData = {
      ...processedData,
      ...(processedData.cpf && { cpf: processedData.cpf }), // Já processado pelo prepareForSave se necessário
      ...(moradorData.email && { email: moradorData.email.toLowerCase() }),
      ...(moradorData.data_nasc && { data_nasc: new Date(moradorData.data_nasc) }),
      ...(moradorData.data_inicio && { data_inicio: new Date(moradorData.data_inicio) }),
      ...(moradorData.data_fim && { data_fim: new Date(moradorData.data_fim) }),
      // Limpar campos ObjectId vazios
      responsavel_id: cleanObjectIdField(moradorData.responsavel_id),
      proprietario_id: cleanObjectIdField(moradorData.proprietario_id),
      imobiliaria_id: cleanObjectIdField(moradorData.imobiliaria_id)
    }

    // Buscar dados atuais do morador para comparação
    const moradorAtual = await Morador.findById(_id)
    
    if (!moradorAtual) {
      return NextResponse.json(
        { error: 'Morador não encontrado' },
        { status: 404 }
      )
    }

    const result = await Morador.findByIdAndUpdate(_id, updateData, { new: true })
    
    if (!result) {
      return NextResponse.json(
        { error: 'Morador não encontrado' },
        { status: 404 }
      )
    }

    // ✅ SINCRONIZAR DADOS FINANCEIROS se nome, apartamento ou bloco mudaram
    const dadosMudaram = (
      updateData.nome && updateData.nome !== moradorAtual.nome ||
      updateData.unidade && updateData.unidade !== moradorAtual.unidade ||
      updateData.bloco !== moradorAtual.bloco
    )

    if (dadosMudaram) {
      try {
        // Atualizar registros financeiros do morador
        await FinanceiroMorador.updateMany(
          { morador_id: moradorAtual._id },
          {
            $set: {
              morador_nome: updateData.nome || moradorAtual.nome,
              apartamento: updateData.unidade || moradorAtual.unidade,
              bloco: updateData.bloco !== undefined ? updateData.bloco : moradorAtual.bloco,
              data_atualizacao: new Date()
            }
          }
        )

        // Atualizar status de pagamento do morador
        await StatusPagamentoMorador.updateMany(
          { morador_id: moradorAtual._id },
          {
            $set: {
              nome_morador: updateData.nome || moradorAtual.nome,
              apartamento: updateData.unidade || moradorAtual.unidade,
              bloco: updateData.bloco !== undefined ? updateData.bloco : moradorAtual.bloco,
              data_atualizacao: new Date()
            }
          }
        )

        console.log(`✅ Dados financeiros sincronizados para morador ${moradorAtual._id}`)
      } catch (syncError) {
        console.error('Erro ao sincronizar dados financeiros:', syncError)
        // Não falhar a operação principal por erro de sincronização
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Morador atualizado com sucesso',
      sincronizado: dadosMudaram
    })
    
  } catch (error) {
    console.error('Error updating morador:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar morador' },
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
        { error: 'ID do morador é obrigatório' },
        { status: 400 }
      )
    }

    await connectDB()

    // Verificar se existem dependentes vinculados a este morador
    const dependentes = await Morador.find({ responsavel_id: id })
    
    if (dependentes.length > 0) {
      return NextResponse.json(
        { error: 'Não é possível excluir morador que possui dependentes vinculados' },
        { status: 400 }
      )
    }

    const result = await Morador.findByIdAndDelete(id)
    
    if (!result) {
      return NextResponse.json(
        { error: 'Morador não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Morador excluído com sucesso'
    })
    
  } catch (error) {
    console.error('Error deleting morador:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir morador' },
      { status: 500 }
    )
  }
}