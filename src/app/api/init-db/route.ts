import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Master from '@/models/Master'
import Condominium from '@/models/condominios'
import Colaborador from '@/models/Colaborador'
import Morador from '@/models/Morador'

let dbInitialized = false

export async function POST(request: NextRequest) {
  console.log('🔄 [INIT-DB] Início da inicialização do banco')
  
  try {
    if (dbInitialized) {
      console.log('ℹ️ [INIT-DB] Banco já foi inicializado anteriormente')
      return NextResponse.json({
        success: true,
        message: 'Banco já foi inicializado',
        alreadyInitialized: true
      })
    }

    console.log('🚀 [INIT-DB] Iniciando inicialização completa do banco de dados...')
    console.log('🔄 [INIT-DB] Conectando ao banco de dados...')
    await connectDB()
    console.log('✅ [INIT-DB] Conexão com banco estabelecida')

    // Verificar se já existem dados
    console.log('🔄 [INIT-DB] Verificando se já existem dados no banco...')
    const existingMaster = await Master.findOne({})
    console.log('🔄 [INIT-DB] Master existente encontrado?', !!existingMaster)
    
    if (existingMaster) {
      console.log('ℹ️ [INIT-DB] Dados já existem no banco, retornando credenciais')
      dbInitialized = true
      return NextResponse.json({
        success: true,
        message: 'Dados já existem no banco',
        credentials: {
          email: 'master@teste.com',
          senha: '>T8Nn7n_S8-T'
        }
      })
    }

    // Limpar banco (apenas se necessário)
    console.log('🧹 Limpando banco de dados...')
    await Master.deleteMany({})
    await Condominium.deleteMany({})
    await Colaborador.deleteMany({})
    await Morador.deleteMany({})

    // Criar Master
    console.log('👤 Criando usuário master...')
    const masterData = {
      nome: 'Master Sistema Teste',
      email: 'master@teste.com',
      senha: '>T8Nn7n_S8-T',
      celular1: '(11) 99999-0001',
      celular2: '(11) 99999-0002'
    }
    const master = await Master.create(masterData)
    console.log('✅ Master criado:', master.email)

    // Criar Condomínio
    console.log('🏢 Criando condomínio de teste...')
    const condominioData = {
      nome: 'Residencial Teste Sistema',
      cep: '01234-567',
      estado: 'SP',
      cidade: 'São Paulo',
      bairro: 'Centro',
      rua: 'Rua de Teste Sistema',
      numero: '123',
      complemento: 'Teste Sistema Deploy',
      master_id: master._id,
      valor_taxa_condominio: 450.00,
      dia_vencimento: 10,
      aceita_pagamento_automatico: true,
      razao_social: 'Condomínio Teste Sistema Ltda',
      cnpj: '12.345.678/0001-90',
      banco: 'Banco do Brasil',
      agencia: '1234-5',
      conta: '12345-6',
      chave_pix: 'teste@sistema.com',
      multa_atraso: 2.0,
      juros_mes: 1.0,
      dias_aviso_vencimento: 5
    }
    const condominio = await Condominium.create(condominioData)
    console.log('✅ Condomínio criado:', condominio.nome)

    // Criar Colaborador
    console.log('👷 Criando colaborador de teste...')
    const colaboradorData = {
      nome: 'Alex Sousa Teste',
      cpf: '12345678901',
      data_nasc: new Date('1985-06-15'),
      celular1: '(11) 98765-4321',
      celular2: '(11) 1234-5678',
      email: 'alex.sousa@teste.com',
      senha: '123456',
      data_inicio: new Date('2024-01-01'),
      condominio_id: condominio._id,
      cargo: 'Porteiro',
      salario: 2800.00,
      tipo_contrato: 'CLT',
      master_id: master._id,
      ativo: true
    }
    const colaborador = await Colaborador.create(colaboradorData)
    console.log('✅ Colaborador criado:', colaborador.nome)

    // Criar Morador
    console.log('👥 Criando morador de teste...')
    const moradorData = {
      nome: 'João Silva Santos Teste',
      cpf: '98765432100',
      data_nasc: new Date('1980-03-20'),
      celular1: '(11) 99111-2233',
      celular2: '(11) 3333-4444',
      email: 'joao.silva@teste.com',
      senha: '123456',
      tipo: 'proprietario',
      unidade: '101',
      bloco: 'A',
      data_inicio: new Date('2023-01-01'),
      condominio_id: condominio._id,
      master_id: master._id,
      ativo: true,
      observacoes: 'Morador de teste criado via sistema'
    }
    const morador = await Morador.create(moradorData)
    console.log('✅ Morador criado:', morador.nome)

    dbInitialized = true

    console.log('\n🎉 INICIALIZAÇÃO COMPLETA COM SUCESSO!')
    console.log('🔑 CREDENCIAIS DE ACESSO:')
    console.log('📧 Email: master@teste.com')
    console.log('🔒 Senha: >T8Nn7n_S8-T')

    return NextResponse.json({
      success: true,
      message: 'Banco de dados inicializado com sucesso!',
      credentials: {
        email: 'master@teste.com',
        senha: '>T8Nn7n_S8-T'
      },
      data: {
        master: master.nome,
        condominio: condominio.nome,
        colaborador: colaborador.nome,
        morador: morador.nome
      }
    })

  } catch (error) {
    console.error('❌ [INIT-DB] ERRO CRÍTICO na inicialização:', error)
    console.error('❌ [INIT-DB] Stack trace:', error instanceof Error ? error.stack : 'N/A')
    console.error('❌ [INIT-DB] Objeto completo do erro:', JSON.stringify(error, null, 2))
    return NextResponse.json({
      success: false,
      error: 'Erro ao inicializar banco de dados',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    await connectDB()
    const masterCount = await Master.countDocuments()
    const condominioCount = await Condominium.countDocuments()
    
    return NextResponse.json({
      initialized: dbInitialized,
      hasData: masterCount > 0,
      counts: {
        masters: masterCount,
        condominios: condominioCount
      },
      instructions: {
        message: 'Para inicializar o banco, faça um POST para esta URL',
        credentials: 'Após inicializar: master@teste.com / >T8Nn7n_S8-T'
      }
    })
  } catch (error) {
    return NextResponse.json({
      error: 'Erro ao verificar status do banco',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 })
  }
}