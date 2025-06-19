import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Adm from '@/models/Adm'
import Master from '@/models/Master'
import Condominium from '@/models/condominios'
import Colaborador from '@/models/Colaborador'
import mongoose from 'mongoose'

export async function GET(request: NextRequest) {
  console.log('🔍 [DEBUG] API Colaboradores GET - Iniciando...')
  try {
    const url = new URL(request.url)
    const masterId = url.searchParams.get('master_id')
    const condominioId = url.searchParams.get('condominio_id')
    const userType = url.searchParams.get('user_type')
    const colaboradorId = url.searchParams.get('id')

    console.log('🔍 [DEBUG] Parâmetros recebidos:', { masterId, condominioId, userType, colaboradorId })

    // Se um ID específico de colaborador foi fornecido, buscar apenas ele
    if (colaboradorId) {
      console.log('🔍 [DEBUG] Buscando colaborador específico por ID:', colaboradorId)
      await connectDB()
      
      const colaborador = await Colaborador.findById(colaboradorId).lean()
      if (!colaborador) {
        console.log('❌ [DEBUG] Colaborador não encontrado')
        return NextResponse.json(
          { error: 'Colaborador não encontrado' },
          { status: 404 }
        )
      }

      // Buscar dados do condomínio
      let condominium = null
      try {
        if (colaborador.condominio_id) {
          const condominiumId = typeof colaborador.condominio_id === 'string'
            ? new mongoose.Types.ObjectId(colaborador.condominio_id)
            : colaborador.condominio_id
          condominium = await Condominium.findById(condominiumId).lean()
        }
      } catch (error) {
        console.error('❌ [DEBUG] Erro ao buscar condomínio:', error)
      }

      const colaboradorCompleto = {
        ...colaborador,
        condominio_nome: condominium?.nome || 'N/A'
      }

      console.log('✅ [DEBUG] Colaborador encontrado:', colaboradorCompleto.nome)
      return NextResponse.json({
        success: true,
        colaborador: colaboradorCompleto
      })
    }

    if (!masterId) {
      console.log('❌ [DEBUG] Master ID não fornecido')
      return NextResponse.json(
        { error: 'Master ID é obrigatório' },
        { status: 400 }
      )
    }

    console.log('🔌 [DEBUG] Conectando ao MongoDB...')
    await connectDB()
    console.log('✅ [DEBUG] MongoDB conectado com sucesso')
    // Filtrar colaboradores por master e condomínio
    const filter: any = { master_id: masterId }
    if (condominioId) {
      filter.condominio_id = condominioId
    }

    console.log('🔍 [DEBUG] Filtro aplicado:', filter)
    console.log('🔍 [DEBUG] Buscando colaboradores...')
    const result = await Colaborador.find(filter).lean()
    console.log('✅ [DEBUG] Colaboradores encontrados:', result.length)

    // Buscar dados dos condomínios para exibir nomes
    console.log('🔍 [DEBUG] Buscando dados dos condomínios...')
    const colaboradoresComCondominio = await Promise.all(
      result.map(async (colaborador, index) => {
        console.log(`🔍 [DEBUG] Processando colaborador ${index + 1}/${result.length}:`, colaborador.nome)
        let condominium = null
        try {
          if (colaborador.condominio_id) {
            const condominiumId = typeof colaborador.condominio_id === 'string'
              ? new mongoose.Types.ObjectId(colaborador.condominio_id)
              : colaborador.condominio_id
            console.log(`🔍 [DEBUG] Buscando condomínio ID:`, condominiumId)
            condominium = await Condominium.findById(condominiumId).lean()
            console.log(`✅ [DEBUG] Condomínio encontrado:`, condominium?.nome || 'N/A')
          }
        } catch (error) {
          console.error('❌ [DEBUG] Error finding condominium:', error, 'ID:', colaborador.condominio_id)
        }

        return {
          ...colaborador,
          condominio_nome: condominium?.nome || 'N/A'
        }
      })
    )
    console.log('✅ [DEBUG] Processamento de condomínios concluído')

    console.log('✅ [DEBUG] Retornando resposta com', colaboradoresComCondominio.length, 'colaboradores')
    return NextResponse.json({
      success: true,
      colaboradores: colaboradoresComCondominio
    })

  } catch (error: any) {
    console.error('❌ [DEBUG] ERRO na API GET colaboradores:', error)
    console.error('❌ [DEBUG] Stack trace:', error.stack)
    return NextResponse.json(
      { error: 'Erro ao buscar colaboradores' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  console.log('🔍 [DEBUG] API Colaboradores POST - Iniciando...')
  try {
    console.log('🔍 [DEBUG] Lendo dados do request...')
    const colaboradorData = await request.json()
    console.log('🔍 [DEBUG] Dados recebidos:', colaboradorData)

    // Validação básica
    const requiredFields = [
      'nome', 'cpf', 'data_nasc', 'celular1', 'email', 'senha', 'data_inicio', 'condominio_id', 'master_id'
    ]
    console.log('🔍 [DEBUG] Validando campos obrigatórios...')
    for (const field of requiredFields) {
      if (!colaboradorData[field]) {
        console.log(`❌ [DEBUG] Campo obrigatório ausente: ${field}`)
        return NextResponse.json(
          { error: `Campo ${field} é obrigatório` },
          { status: 400 }
        )
      }
    }
    console.log('✅ [DEBUG] Todos os campos obrigatórios estão presentes')

    console.log('🔌 [DEBUG] Conectando ao MongoDB...')
    await connectDB()
    console.log('✅ [DEBUG] MongoDB conectado com sucesso')

    // Verificar se email já existe em colaboradores
    const existingColaborador = await Colaborador.findOne({
      email: colaboradorData.email.toLowerCase()
    })
    if (existingColaborador) {
      return NextResponse.json(
        { error: 'Email já cadastrado em Colaboradores' },
        { status: 400 }
      )
    }

    // Verificar se email já existe em masters
    const existingMaster = await Master.findOne({
      email: colaboradorData.email.toLowerCase()
    })
    if (existingMaster) {
      return NextResponse.json(
        { error: 'Email já cadastrado em Masters' },
        { status: 400 }
      )
    }

    // Verificar se email já existe em adms
    const existingAdm = await Adm.findOne({
      email: colaboradorData.email.toLowerCase()
    })
    if (existingAdm) {
      return NextResponse.json(
        { error: 'Email já cadastrado em Administradores' },
        { status: 400 }
      )
    }

    const newColaborador = {
      ...colaboradorData,
      cpf: colaboradorData.cpf.replace(/[^\d]/g, ''),
      email: colaboradorData.email.toLowerCase(),
      data_nasc: new Date(colaboradorData.data_nasc),
      data_inicio: new Date(colaboradorData.data_inicio),
      data_fim: colaboradorData.data_fim ? new Date(colaboradorData.data_fim) : undefined,
      // Campos de endereço
      cep: colaboradorData.cep || '',
      logradouro: colaboradorData.logradouro || '',
      estado: colaboradorData.estado ? colaboradorData.estado.toUpperCase() : '',
      cidade: colaboradorData.cidade || '',
      numero: colaboradorData.numero || '',
      complemento: colaboradorData.complemento || '',
      observacoes: colaboradorData.observacoes || '',
      // Campos profissionais
      cargo: colaboradorData.cargo || '',
      salario: colaboradorData.salario || 0,
      tipo_contrato: colaboradorData.tipo_contrato || '',
      jornada_trabalho: colaboradorData.jornada_trabalho || '',
      departamento: colaboradorData.departamento || '',
      supervisor: colaboradorData.supervisor || '',
      // Dependentes
      dependentes: colaboradorData.dependentes || '',
      // Contato de emergência
      contato_emergencia_nome: colaboradorData.contato_emergencia_nome || '',
      contato_emergencia_telefone: colaboradorData.contato_emergencia_telefone || '',
      contato_emergencia_parentesco: colaboradorData.contato_emergencia_parentesco || '',
      // Documentos e informações
      rg: colaboradorData.rg || '',
      pis: colaboradorData.pis || '',
      ctps: colaboradorData.ctps || '',
      escolaridade: colaboradorData.escolaridade || '',
      estado_civil: colaboradorData.estado_civil || '',
      observacoes_profissionais: colaboradorData.observacoes_profissionais || '',
      // Documentos digitalizados
      foto_perfil: colaboradorData.foto_perfil || '',
      foto_rg_frente: colaboradorData.foto_rg_frente || '',
      foto_rg_verso: colaboradorData.foto_rg_verso || '',
      foto_cpf: colaboradorData.foto_cpf || '',
      foto_ctps: colaboradorData.foto_ctps || '',
      foto_comprovante_residencia: colaboradorData.foto_comprovante_residencia || '',
      outros_documentos: colaboradorData.outros_documentos || [],
      data_criacao: new Date(),
      ativo: true
    }

    console.log('🔍 [DEBUG] Criando colaborador no banco...')
    const result = await Colaborador.create(newColaborador)
    console.log('✅ [DEBUG] Colaborador criado com sucesso. ID:', result._id)

    return NextResponse.json({
      success: true,
      colaborador: { _id: result._id, ...newColaborador }
    })

  } catch (error: any) {
    console.error('❌ [DEBUG] ERRO na API POST colaborador:', error)
    console.error('❌ [DEBUG] Stack trace:', error.stack)
    return NextResponse.json(
      { error: 'Erro ao criar colaborador' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { _id, ...colaboradorData } = await request.json()

    if (!_id) {
      return NextResponse.json(
        { error: 'ID do colaborador é obrigatório' },
        { status: 400 }
      )
    }

    await connectDB()

    // Verificar se existe outro colaborador com o mesmo email
    if (colaboradorData.email) {
      const existingEmail = await Colaborador.findOne({
        email: colaboradorData.email.toLowerCase(),
        _id: { $ne: new mongoose.Types.ObjectId(_id) }
      })

      if (existingEmail) {
        return NextResponse.json(
          { error: 'Email já cadastrado para outro colaborador' },
          { status: 400 }
        )
      }
    }

    const updateData = {
      ...colaboradorData,
      cpf: colaboradorData.cpf ? colaboradorData.cpf.replace(/[^\d]/g, '') : colaboradorData.cpf,
      email: colaboradorData.email ? colaboradorData.email.toLowerCase() : colaboradorData.email,
      data_nasc: colaboradorData.data_nasc ? new Date(colaboradorData.data_nasc) : colaboradorData.data_nasc,
      data_inicio: colaboradorData.data_inicio ? new Date(colaboradorData.data_inicio) : colaboradorData.data_inicio,
      data_fim: colaboradorData.data_fim && colaboradorData.data_fim.trim() !== '' ? new Date(colaboradorData.data_fim) : undefined,
      // Campos de endereço
      cep: colaboradorData.cep || '',
      logradouro: colaboradorData.logradouro || '',
      estado: colaboradorData.estado ? colaboradorData.estado.toUpperCase() : '',
      cidade: colaboradorData.cidade || '',
      numero: colaboradorData.numero || '',
      complemento: colaboradorData.complemento || '',
      observacoes: colaboradorData.observacoes || '',
      // Campos profissionais
      cargo: colaboradorData.cargo || '',
      salario: colaboradorData.salario || 0,
      tipo_contrato: colaboradorData.tipo_contrato || '',
      jornada_trabalho: colaboradorData.jornada_trabalho || '',
      departamento: colaboradorData.departamento || '',
      supervisor: colaboradorData.supervisor || '',
      // Dependentes
      dependentes: colaboradorData.dependentes || '',
      // Contato de emergência
      contato_emergencia_nome: colaboradorData.contato_emergencia_nome || '',
      contato_emergencia_telefone: colaboradorData.contato_emergencia_telefone || '',
      contato_emergencia_parentesco: colaboradorData.contato_emergencia_parentesco || '',
      // Documentos e informações
      rg: colaboradorData.rg || '',
      pis: colaboradorData.pis || '',
      ctps: colaboradorData.ctps || '',
      escolaridade: colaboradorData.escolaridade || '',
      estado_civil: colaboradorData.estado_civil || '',
      observacoes_profissionais: colaboradorData.observacoes_profissionais || '',
      // Documentos digitalizados
      foto_perfil: colaboradorData.foto_perfil || '',
      foto_rg_frente: colaboradorData.foto_rg_frente || '',
      foto_rg_verso: colaboradorData.foto_rg_verso || '',
      foto_cpf: colaboradorData.foto_cpf || '',
      foto_ctps: colaboradorData.foto_ctps || '',
      foto_comprovante_residencia: colaboradorData.foto_comprovante_residencia || '',
      outros_documentos: colaboradorData.outros_documentos || []
    }

    const result = await Colaborador.findByIdAndUpdate(_id, updateData, { new: true })

    if (!result) {
      return NextResponse.json(
        { error: 'Colaborador não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Colaborador atualizado com sucesso'
    })

  } catch (error: any) {
    console.error('Error updating colaborador:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar colaborador' },
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
        { error: 'ID do colaborador é obrigatório' },
        { status: 400 }
      )
    }

    await connectDB()
    const result = await Colaborador.findByIdAndDelete(id)

    if (!result) {
      return NextResponse.json(
        { error: 'Colaborador não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Colaborador excluído com sucesso'
    })

  } catch (error: any) {
    console.error('Error deleting colaborador:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir colaborador' },
      { status: 500 }
    )
  }
}