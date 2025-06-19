import FinanceiroCondominio, { gerarHashSincronizacao } from '@/models/FinanceiroCondominio'
import mongoose from 'mongoose'

interface DadosLancamento {
  _id: string
  tipo: 'receita' | 'despesa'
  categoria: string
  descricao: string
  valor: number
  data_vencimento: Date
  data_pagamento?: Date
  status: 'pendente' | 'pago' | 'atrasado' | 'cancelado'
  condominio_id: string
  master_id: string
  criado_por_tipo: string
  criado_por_id: string
  criado_por_nome: string
  observacoes?: string
  recorrente: boolean
  periodicidade?: string
  mes_referencia?: string
  origem_nome: string
  origem_identificacao?: string
  bloco?: string
  apartamento?: string
  unidade?: string
}

export class SincronizacaoFinanceira {
  
  /**
   * Sincroniza lançamento de colaborador como despesa no condomínio
   */
  static async sincronizarColaborador(dadosColaborador: DadosLancamento): Promise<boolean> {
    try {
      console.log('🔄 Sincronizando colaborador -> despesa condomínio:', dadosColaborador.origem_nome)

      const hash = gerarHashSincronizacao(dadosColaborador)
      
      // Verificar se já existe sincronização
      const existente = await FinanceiroCondominio.findOne({
        origem_sistema: 'colaborador',
        origem_id: new mongoose.Types.ObjectId(dadosColaborador._id),
        ativo: true
      })

      const dadosCondominio = {
        tipo: 'despesa' as const,
        categoria: `colaborador_${dadosColaborador.categoria}`,
        descricao: `💼 Colaborador: ${dadosColaborador.descricao}`,
        valor: dadosColaborador.valor,
        data_vencimento: dadosColaborador.data_vencimento,
        data_pagamento: dadosColaborador.data_pagamento,
        status: dadosColaborador.status,
        condominio_id: new mongoose.Types.ObjectId(dadosColaborador.condominio_id),
        master_id: new mongoose.Types.ObjectId(dadosColaborador.master_id),
        origem_sistema: 'colaborador' as const,
        origem_id: new mongoose.Types.ObjectId(dadosColaborador._id),
        origem_nome: dadosColaborador.origem_nome,
        origem_identificacao: dadosColaborador.origem_identificacao,
        bloco: dadosColaborador.bloco,
        apartamento: dadosColaborador.apartamento,
        criado_por_tipo: dadosColaborador.criado_por_tipo,
        criado_por_id: new mongoose.Types.ObjectId(dadosColaborador.criado_por_id),
        criado_por_nome: dadosColaborador.criado_por_nome,
        observacoes: `Sincronizado automaticamente de lançamento de colaborador. ${dadosColaborador.observacoes || ''}`.trim(),
        recorrente: dadosColaborador.recorrente,
        periodicidade: dadosColaborador.periodicidade,
        mes_referencia: dadosColaborador.mes_referencia,
        sincronizado: true,
        data_sincronizacao: new Date(),
        hash_origem: hash
      }

      if (existente) {
        // Verificar se precisa atualizar
        if (existente.hash_origem !== hash) {
          console.log('🔄 Atualizando sincronização existente')
          await FinanceiroCondominio.findByIdAndUpdate(existente._id, {
            ...dadosCondominio,
            data_atualizacao: new Date()
          })
        } else {
          console.log('✅ Sincronização já está atualizada')
        }
      } else {
        // Criar nova sincronização
        console.log('✅ Criando nova sincronização')
        await FinanceiroCondominio.create(dadosCondominio)
      }

      return true
    } catch (error) {
      console.error('❌ Erro na sincronização de colaborador:', error)
      return false
    }
  }

  /**
   * Sincroniza lançamento de morador como receita no condomínio
   */
  static async sincronizarMorador(dadosMorador: DadosLancamento): Promise<boolean> {
    try {
      console.log('🔄 Sincronizando morador -> receita condomínio:', dadosMorador.origem_nome)

      const hash = gerarHashSincronizacao(dadosMorador)
      
      // Verificar se já existe sincronização
      const existente = await FinanceiroCondominio.findOne({
        origem_sistema: 'morador',
        origem_id: new mongoose.Types.ObjectId(dadosMorador._id),
        ativo: true
      })

      const dadosCondominio = {
        tipo: 'receita' as const,
        categoria: `morador_${dadosMorador.categoria}`,
        descricao: `🏠 Morador: ${dadosMorador.descricao}`,
        valor: dadosMorador.valor,
        data_vencimento: dadosMorador.data_vencimento,
        data_pagamento: dadosMorador.data_pagamento,
        status: dadosMorador.status,
        condominio_id: new mongoose.Types.ObjectId(dadosMorador.condominio_id),
        master_id: new mongoose.Types.ObjectId(dadosMorador.master_id),
        origem_sistema: 'morador' as const,
        origem_id: new mongoose.Types.ObjectId(dadosMorador._id),
        origem_nome: dadosMorador.origem_nome,
        origem_identificacao: dadosMorador.origem_identificacao,
        bloco: dadosMorador.bloco,
        apartamento: dadosMorador.unidade,
        criado_por_tipo: dadosMorador.criado_por_tipo,
        criado_por_id: new mongoose.Types.ObjectId(dadosMorador.criado_por_id),
        criado_por_nome: dadosMorador.criado_por_nome,
        observacoes: `Sincronizado automaticamente de lançamento de morador. ${dadosMorador.observacoes || ''}`.trim(),
        recorrente: dadosMorador.recorrente,
        periodicidade: dadosMorador.periodicidade,
        mes_referencia: dadosMorador.mes_referencia,
        sincronizado: true,
        data_sincronizacao: new Date(),
        hash_origem: hash
      }

      if (existente) {
        // Verificar se precisa atualizar
        if (existente.hash_origem !== hash) {
          console.log('🔄 Atualizando sincronização existente')
          await FinanceiroCondominio.findByIdAndUpdate(existente._id, {
            ...dadosCondominio,
            data_atualizacao: new Date()
          })
        } else {
          console.log('✅ Sincronização já está atualizada')
        }
      } else {
        // Criar nova sincronização
        console.log('✅ Criando nova sincronização')
        await FinanceiroCondominio.create(dadosCondominio)
      }

      return true
    } catch (error) {
      console.error('❌ Erro na sincronização de morador:', error)
      return false
    }
  }

  /**
   * Remove sincronização quando lançamento é excluído
   */
  static async removerSincronizacao(origemSistema: 'colaborador' | 'morador', origemId: string): Promise<boolean> {
    try {
      console.log(`🗑️ Removendo sincronização ${origemSistema}:`, origemId)
      
      await FinanceiroCondominio.findOneAndUpdate(
        {
          origem_sistema: origemSistema,
          origem_id: new mongoose.Types.ObjectId(origemId),
          ativo: true
        },
        {
          ativo: false,
          data_atualizacao: new Date()
        }
      )

      return true
    } catch (error) {
      console.error('❌ Erro ao remover sincronização:', error)
      return false
    }
  }

  /**
   * Sincronização em lote para lançamentos existentes
   */
  static async sincronizarLote(lancamentos: DadosLancamento[], origemSistema: 'colaborador' | 'morador'): Promise<{
    sucesso: number,
    erros: number,
    detalhes: string[]
  }> {
    let sucesso = 0
    let erros = 0
    const detalhes: string[] = []

    console.log(`🔄 Iniciando sincronização em lote: ${lancamentos.length} lançamentos de ${origemSistema}`)

    for (const lancamento of lancamentos) {
      try {
        const resultado = origemSistema === 'colaborador' 
          ? await this.sincronizarColaborador(lancamento)
          : await this.sincronizarMorador(lancamento)

        if (resultado) {
          sucesso++
          detalhes.push(`✅ ${lancamento.origem_nome}: ${lancamento.descricao}`)
        } else {
          erros++
          detalhes.push(`❌ ${lancamento.origem_nome}: Erro na sincronização`)
        }
      } catch (error) {
        erros++
        detalhes.push(`❌ ${lancamento.origem_nome}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
      }
    }

    console.log(`📊 Sincronização em lote concluída: ${sucesso} sucessos, ${erros} erros`)

    return { sucesso, erros, detalhes }
  }
}