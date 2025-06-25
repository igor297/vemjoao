import connectDB from '@/lib/mongodb'
import Master from '@/models/Master'
import Condominium from '@/models/condominios'
import Colaborador from '@/models/Colaborador'
import Morador from '@/models/Morador'

let seedExecuted = false

export async function autoSeed() {
  // Só executa uma vez e apenas no Railway
  const isRailway = process.env.PORT === '8080' || process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production'
  if (seedExecuted || !isRailway) {
    return
  }

  try {
    console.log('🌱 Iniciando auto-seed para Railway...')
    await connectDB()

    // Verificar se já existem dados
    const existingMaster = await Master.findOne({})
    if (existingMaster) {
      console.log('✅ Dados já existem, pulando seed')
      seedExecuted = true
      return
    }

    // Criar Master inicial
    console.log('👤 Criando usuário master...')
    const masterData = {
      nome: 'Master Sistema',
      email: 'master@teste.com',
      senha: '>T8Nn7n_S8-T',
      celular1: '(11) 99999-0001',
      celular2: '(11) 99999-0002'
    }
    const master = await Master.create(masterData)
    console.log('✅ Master criado:', master.email)

    // Criar Condomínio de teste
    console.log('🏢 Criando condomínio de teste...')
    const condominioData = {
      nome: 'Residencial Teste Railway',
      cep: '01234-567',
      estado: 'SP',
      cidade: 'São Paulo',
      bairro: 'Centro',
      rua: 'Rua de Teste',
      numero: '123',
      complemento: 'Teste Railway',
      master_id: master._id,
      valor_taxa_condominio: 450.00,
      dia_vencimento: 10,
      aceita_pagamento_automatico: true,
      razao_social: 'Condomínio Teste Railway Ltda',
      cnpj: '12.345.678/0001-90',
      banco: 'Banco do Brasil',
      agencia: '1234-5',
      conta: '12345-6',
      chave_pix: 'teste@railway.com',
      multa_atraso: 2.0,
      juros_mes: 1.0,
      dias_aviso_vencimento: 5
    }
    const condominio = await Condominium.create(condominioData)
    console.log('✅ Condomínio criado:', condominio.nome)

    // Criar Colaborador de teste
    console.log('👷 Criando colaborador de teste...')
    const colaboradorData = {
      nome: 'Alex Sousa',
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

    // Criar Morador de teste
    console.log('👥 Criando morador de teste...')
    const moradorData = {
      nome: 'João Silva Santos',
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
      observacoes: 'Morador de teste criado automaticamente'
    }
    const morador = await Morador.create(moradorData)
    console.log('✅ Morador criado:', morador.nome)

    console.log('\n🎉 AUTO-SEED CONCLUÍDO COM SUCESSO!')
    console.log('🔑 CREDENCIAIS DE ACESSO:')
    console.log('📧 Email: master@teste.com')
    console.log('🔒 Senha: >T8Nn7n_S8-T')
    console.log('\n✨ Dados de teste criados:')
    console.log(`👤 Master: ${master.nome}`)
    console.log(`🏢 Condomínio: ${condominio.nome}`)
    console.log(`👷 Colaborador: ${colaborador.nome}`)
    console.log(`👥 Morador: ${morador.nome}`)

    seedExecuted = true

  } catch (error) {
    console.error('❌ Erro no auto-seed:', error)
    // Não impede a aplicação de rodar se o seed falhar
  }
}

export function getSeedStatus() {
  return {
    executed: seedExecuted,
    environment: process.env.NODE_ENV
  }
}