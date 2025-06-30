'use client'

import React, { useState, useEffect } from 'react'
import { Container, Row, Col, Card, Button, Modal, Form, Alert, Badge, Table } from 'react-bootstrap'
import { Line, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
)

interface FinanceiroColaborador {
  _id: string
  tipo: 'salario' | 'bonus' | 'desconto' | 'vale' | 'comissao' | 'hora_extra' | 'ferias' | 'decimo_terceiro'
  categoria?: string // Campo opcional para compatibilidade
  descricao: string
  valor: number
  data_vencimento: string
  data_pagamento?: string
  status: 'pendente' | 'pago' | 'atrasado' | 'cancelado'
  observacoes?: string
  recorrente?: boolean
  periodicidade?: string
  criado_por_nome: string
  data_criacao: string
  colaborador_id: string
  colaborador_nome: string
  condominio_id: string
  master_id: string
  mes_referencia?: string
  horas_trabalhadas?: number
}

interface DashboardData {
  resumo: {
    total_receitas: number
    total_despesas: number
    resultado_liquido: number
    total_pendentes: number
    total_atrasados: number
    count_pendentes: number
    count_atrasados: number
    // Campos específicos para colaboradores
    total_salarios?: number
    total_bonus?: number
    total_descontos?: number
    total_vales?: number
    total_horas_extras?: number
    total_pagos?: number
    total_liquido?: number
    count_total?: number
  }
  categorias: any[]
  fluxo_mensal: any[]
}

const CATEGORIAS_COLABORADOR = [
  { value: 'salario', label: '💼 Salário', tipo: 'despesa' },
  { value: 'bonus', label: '💵 Bônus', tipo: 'despesa' },
  { value: 'vale', label: '🍽️ Vale Refeição/Transporte', tipo: 'despesa' },
  { value: 'comissao', label: '💰 Comissão', tipo: 'despesa' },
  { value: 'hora_extra', label: '⏰ Hora Extra', tipo: 'despesa' },
  { value: 'ferias', label: '🏖️ Férias', tipo: 'despesa' },
  { value: 'decimo_terceiro', label: '🎁 13º Salário', tipo: 'despesa' },
  { value: 'desconto', label: '📉 Desconto', tipo: 'despesa' },
  { value: 'adicional', label: '💲 Adicional', tipo: 'despesa' },
  { value: 'vale_transporte', label: '🚌 Vale Transporte', tipo: 'despesa' },
  { value: 'vale_refeicao', label: '🍽️ Vale Refeição', tipo: 'despesa' },
  { value: 'beneficios', label: '🎁 Benefícios', tipo: 'despesa' },
  { value: 'premiacao', label: '🏆 Premiação', tipo: 'despesa' },
  { value: 'ajuda_custo', label: '🚗 Ajuda de Custo', tipo: 'despesa' },
  { value: 'reembolso', label: '🔄 Reembolso', tipo: 'despesa' },
  { value: 'adiantamento', label: '💳 Adiantamento', tipo: 'despesa' },
  { value: 'pro_labor', label: '👔 Pró-labore', tipo: 'despesa' },
  { value: 'outros', label: '📦 Outros', tipo: 'ambos' }
]

interface Colaborador {
  _id: string
  nome: string
  cpf?: string
  salario?: number
  cargo?: string
}

interface Condominium {
  _id: string
  nome: string
}

export default function FinanceiroColaboradorPage() {
  const [financeiro, setFinanceiro] = useState<FinanceiroColaborador[]>([])
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [condominiums, setCondominiums] = useState<Condominium[]>([])
  const [selectedColaborador, setSelectedColaborador] = useState<Colaborador | null>(null)
  
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [selectedColaboradorId, setSelectedColaboradorId] = useState<string>('')
  const [selectedCondominiumId, setSelectedCondominiumId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [alert, setAlert] = useState<{type: string, message: string} | null>(null)
  
  // Estados para paginação
  const [paginaAtual, setPaginaAtual] = useState(1)
  const [totalRegistros, setTotalRegistros] = useState(0)
  const [totalPaginas, setTotalPaginas] = useState(0)
  const registrosPorPagina = 20
  
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<FinanceiroColaborador | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<FinanceiroColaborador | null>(null)
  
  const [formData, setFormData] = useState({
    categoria: '',
    descricao: '',
    valor: '',
    data_vencimento: '',
    observacoes: '',
    recorrente: false,
    periodicidade: '',
    status: 'pendente' as 'pendente' | 'pago' | 'atrasado' | 'cancelado',
    data_pagamento: ''
  })


  const [filtros, setFiltros] = useState({
    categoria: '',
    status: '',
    data_inicio: '',
    data_fim: ''
  })

  useEffect(() => {
    const userData = localStorage.getItem('userData')
    
    if (userData) {
      try {
        const user = JSON.parse(userData)
        setCurrentUser(user)
        
        if (user.tipo === 'master') {
          // Carregar lista de condomínios
          loadCondominiums(user.id)
          
          // Verificar condomínio ativo
          const activeCondominiumId = localStorage.getItem('activeCondominio')
          if (activeCondominiumId) {
            console.log('🏢 Condomínio ativo encontrado:', activeCondominiumId)
            setSelectedCondominiumId(activeCondominiumId)
            fetchColaboradores(user.id, activeCondominiumId)
          } else {
            console.log('🏢 Nenhum condomínio ativo, carregando todos os colaboradores')
            fetchColaboradores(user.id)
          }
          
          // Verificar colaborador ativo
          const activeColaboradorId = localStorage.getItem('activeColaborador')
          if (activeColaboradorId) {
            setSelectedColaboradorId(activeColaboradorId)
            fetchColaboradorCompleto(activeColaboradorId)
            loadDashboard(user, activeColaboradorId)
            loadFinanceiro(user, activeColaboradorId, 1)
          }
        } else {
          // Para não-masters, usar colaborador do usuário
          if (user.colaborador_id) {
            setSelectedColaboradorId(user.colaborador_id)
            fetchColaboradorCompleto(user.colaborador_id)
            loadDashboard(user, user.colaborador_id)
            loadFinanceiro(user, user.colaborador_id, 1)
          }
        }
      } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error)
      }
    }

    // Listener para mudanças no colaborador ativo e condomínio ativo
    const handleStorageChange = () => {
      const userData = localStorage.getItem('userData')
      if (userData) {
        const user = JSON.parse(userData)
        if (user.tipo === 'master') {
          // Verificar mudança no condomínio ativo
          const activeCondominiumId = localStorage.getItem('activeCondominio')
          if (activeCondominiumId && activeCondominiumId !== selectedCondominiumId) {
            console.log('🏢 Condomínio ativo mudou para:', activeCondominiumId)
            setSelectedCondominiumId(activeCondominiumId)
            fetchColaboradores(user.id, activeCondominiumId)
            // Limpar colaborador selecionado quando mudar de condomínio
            setSelectedColaboradorId('')
            setSelectedColaborador(null)
          }
          
          // Verificar mudança no colaborador ativo
          const activeColaboradorId = localStorage.getItem('activeColaborador')
          if (activeColaboradorId && activeColaboradorId !== selectedColaboradorId) {
            setSelectedColaboradorId(activeColaboradorId)
            fetchColaboradorCompleto(activeColaboradorId)
            loadDashboard(user, activeColaboradorId)
            loadFinanceiro(user, activeColaboradorId, 1)
          }
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('colaboradorChanged', handleStorageChange)
    window.addEventListener('condominioChanged', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('colaboradorChanged', handleStorageChange)
      window.removeEventListener('condominioChanged', handleStorageChange)
    }
  }, [])

  // UseEffect para verificar colaborador ativo e condomínio ativo periodicamente
  useEffect(() => {
    if (currentUser?.tipo === 'master') {
      const interval = setInterval(() => {
        // Verificar mudança no condomínio ativo
        const activeCondominio = localStorage.getItem('activeCondominio')
        if (activeCondominio && activeCondominio !== selectedCondominiumId) {
          console.log('🏢 Atualizando condomínio ativo:', activeCondominio)
          setSelectedCondominiumId(activeCondominio)
          fetchColaboradores(currentUser.id, activeCondominio)
          // Limpar colaborador selecionado quando mudar de condomínio
          setSelectedColaboradorId('')
          setSelectedColaborador(null)
        }
        
        // Verificar mudança no colaborador ativo
        const activeColaborador = localStorage.getItem('activeColaborador')
        if (activeColaborador && activeColaborador !== selectedColaboradorId) {
          console.log('👤 Atualizando colaborador ativo:', activeColaborador)
          setSelectedColaboradorId(activeColaborador)
          fetchColaboradorCompleto(activeColaborador)
          loadDashboard(currentUser, activeColaborador)
          loadFinanceiro(currentUser, activeColaborador, 1)
        }
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [currentUser, selectedColaboradorId, selectedCondominiumId])

  const showAlert = (type: string, message: string) => {
    setAlert({ type, message })
    setTimeout(() => setAlert(null), 5000)
  }

  const loadCondominiums = async (masterId: string) => {
    try {
      const response = await fetch(`/api/condominios?master_id=${encodeURIComponent(masterId)}`)
      const data = await response.json()
      if (data.success) {
        setCondominiums(data.condominios)
      }
    } catch (error) {
      console.error('Erro ao carregar condomínios:', error)
    }
  }

  const fetchColaboradores = async (masterId: string, condominioId?: string) => {
    try {
      let url = `/api/colaboradores?master_id=${masterId}`
      
      if (condominioId) {
        url += `&condominio_id=${condominioId}`
      }
      
      console.log('🔍 Carregando colaboradores com URL:', url)
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.success) {
        console.log('✅ Colaboradores carregados:', data.colaboradores.length)
        setColaboradores(data.colaboradores)
      }
    } catch (error) {
      console.error('Erro ao carregar colaboradores:', error)
    }
  }

  const fetchColaboradorCompleto = async (colaboradorId: string) => {
    try {
      console.log('🔍 Buscando dados completos do colaborador:', colaboradorId)
      const response = await fetch(`/api/colaboradores?id=${colaboradorId}`)
      const data = await response.json()
      
      console.log('📋 Resposta da API:', data)
      
      if (data.success && data.colaborador) {
        console.log('✅ Colaborador encontrado:', data.colaborador.nome, 'Salário:', data.colaborador.salario)
        setSelectedColaborador(data.colaborador)
        return data.colaborador
      } else {
        console.log('❌ Erro na resposta da API:', data.error)
      }
    } catch (error) {
      console.error('❌ Erro ao carregar dados completos do colaborador:', error)
    }
    return null
  }

  const loadDashboard = async (user: any, colaboradorId: string) => {
    try {
      const response = await fetch(
        `/api/financeiro-colaborador?master_id=${user.master_id || user.id}&colaborador_id=${colaboradorId}&tipo_usuario=${user.tipo}&condominio_id=${selectedCondominiumId}&relatorio=resumo`
      )
      const data = await response.json()
      
      if (data.success) {
        const [categoriasResponse, fluxoResponse] = await Promise.all([
          fetch(`/api/financeiro-colaborador?master_id=${user.master_id || user.id}&colaborador_id=${colaboradorId}&tipo_usuario=${user.tipo}&condominio_id=${selectedCondominiumId}&relatorio=por_categoria`),
          fetch(`/api/financeiro-colaborador?master_id=${user.master_id || user.id}&colaborador_id=${colaboradorId}&tipo_usuario=${user.tipo}&condominio_id=${selectedCondominiumId}&relatorio=fluxo_mensal`)
        ])

        const categoriasData = await categoriasResponse.json()
        const fluxoData = await fluxoResponse.json()

        // Converter os dados específicos de colaborador para o formato esperado
        const resumoConvertido = {
          total_receitas: (data.resumo?.total_salarios || 0) + (data.resumo?.total_bonus || 0) + (data.resumo?.total_horas_extras || 0),
          total_despesas: (data.resumo?.total_descontos || 0) + (data.resumo?.total_vales || 0),
          resultado_liquido: data.resumo?.total_liquido || 0,
          total_pendentes: data.resumo?.total_pendentes || 0,
          total_atrasados: 0, // Colaboradores não têm campo atrasados na API atual
          count_pendentes: data.resumo?.count_pendentes || 0,
          count_atrasados: 0,
          // Manter campos originais para referência
          ...data.resumo
        }

        setDashboardData({
          resumo: resumoConvertido,
          categorias: categoriasData.success ? categoriasData.categorias : [],
          fluxo_mensal: fluxoData.success ? fluxoData.fluxo_mensal : []
        })
      }
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error)
    }
  }

  const loadFinanceiro = async (user: any, colaboradorId: string, pagina: number = 1) => {
    if (!colaboradorId || !selectedCondominiumId) {
      console.warn('Colaborador ou condomínio não selecionado, não carregando dados financeiros')
      setFinanceiro([])
      setTotalRegistros(0)
      setTotalPaginas(0)
      setPaginaAtual(1)
      return
    }
    
    try {
      setLoading(true)
      
      const params = new URLSearchParams({
        master_id: user.master_id || user.id,
        colaborador_id: colaboradorId,
        condominio_id: selectedCondominiumId || '',
        tipo_usuario: user.tipo,
        page: pagina.toString(),
        limit: registrosPorPagina.toString(),
        ...(filtros.categoria && { categoria: filtros.categoria }),
        ...(filtros.status && { status: filtros.status }),
        ...(filtros.data_inicio && { data_inicio: filtros.data_inicio }),
        ...(filtros.data_fim && { data_fim: filtros.data_fim })
      })

      const response = await fetch(`/api/financeiro-colaborador?${params}`)
      const data = await response.json()
      
      if (data.success) {
        setFinanceiro(data.lancamentos || [])
        // A API retorna os dados de paginação no objeto pagination
        if (data.pagination) {
          setTotalRegistros(data.pagination.total_items || 0)
          setTotalPaginas(data.pagination.total_pages || 0)
          setPaginaAtual(data.pagination.current_page || pagina)
        } else {
          // Fallback se não houver dados de paginação
          setTotalRegistros(data.lancamentos?.length || 0)
          setTotalPaginas(1)
          setPaginaAtual(1)
        }
      } else {
        showAlert('error', data.error || 'Erro ao carregar lançamentos')
        setFinanceiro([])
        setTotalRegistros(0)
        setTotalPaginas(0)
        setPaginaAtual(1)
      }
    } catch (error) {
      console.error('Erro ao carregar financeiro:', error)
      showAlert('error', 'Erro ao carregar dados financeiros')
      setFinanceiro([])
      setTotalRegistros(0)
      setTotalPaginas(0)
      setPaginaAtual(1)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: string) => {
    let cleanValue = value.replace(/\D/g, '')
    if (cleanValue.length > 10) {
      cleanValue = cleanValue.substring(0, 10)
    }
    if (cleanValue === '') return ''
    const numericValue = parseInt(cleanValue) / 100
    return numericValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const formattedValue = formatCurrency(value)
    setFormData({...formData, valor: formattedValue})
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedColaboradorId) {
      showAlert('error', 'Selecione um colaborador primeiro')
      return
    }
    if (!formData.categoria || !formData.descricao || !formData.valor || !formData.data_vencimento) {
      showAlert('error', 'Preencha todos os campos obrigatórios')
      return
    }
    if (formData.recorrente && !formData.periodicidade) {
      showAlert('error', 'Selecione a periodicidade para lançamentos recorrentes')
      return
    }

    try {
      const valorNumerico = parseFloat(formData.valor.replace(/\./g, '').replace(',', '.'))
      
      if (isNaN(valorNumerico) || valorNumerico <= 0) {
        showAlert('error', 'Valor deve ser um número maior que zero')
        return
      }
      // Mapear categoria para tipo esperado pela API
      const mapCategoriaToTipo = (categoria: string) => {
        const mapping: { [key: string]: string } = {
          'salario': 'salario',
          'adicional': 'bonus',
          'vale_transporte': 'vale',
          'vale_refeicao': 'vale', 
          'beneficios': 'bonus',
          'premiacao': 'bonus',
          'bonus': 'bonus',
          'ajuda_custo': 'comissao',
          'reembolso': 'comissao',
          'adiantamento': 'vale',
          'pro_labor': 'salario',
          'outros': 'bonus'
        }
        return mapping[categoria] || 'bonus'
      }

      const dataToSend: any = {
        ...formData,
        tipo: mapCategoriaToTipo(formData.categoria),
        categoria: formData.categoria,
        valor: valorNumerico,
        master_id: currentUser?.master_id || currentUser?.id,
        condominio_id: selectedCondominiumId,
        colaborador_id: selectedColaboradorId,
        condominio_id: selectedCondominiumId,
        tipo_usuario: currentUser?.tipo,
        usuario_id: currentUser?.id,
        criado_por_nome: currentUser?.nome || currentUser?.email,
        periodicidade: formData.recorrente && formData.periodicidade ? formData.periodicidade : undefined,
        status: formData.status,
        data_pagamento: formData.status === 'pago' && formData.data_pagamento ? formData.data_pagamento : undefined,
        recorrente: formData.recorrente
      }

      const url = '/api/financeiro-colaborador'
      const method = editingItem ? 'PUT' : 'POST'
      
      if (editingItem) {
        if (!editingItem._id) {
          showAlert('error', 'ID do item não encontrado para edição')
          return
        }
        dataToSend._id = editingItem._id
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend)
      })

      const data = await response.json()
      
      if (data.success) {
        showAlert('success', editingItem ? 'Lançamento atualizado com sucesso!' : 'Lançamento criado com sucesso!')
        handleCloseModal()
        // Recarregar dados
        if (currentUser && selectedColaboradorId) {
          loadDashboard(currentUser, selectedColaboradorId)
          loadFinanceiro(currentUser, selectedColaboradorId, paginaAtual)
        }
      } else {
        console.error('Erro na resposta da API:', data)
        showAlert('error', data.error || `Erro ao ${editingItem ? 'atualizar' : 'criar'} lançamento`)
      }
    } catch (error) {
      console.error('Erro ao submeter:', error)
      showAlert('error', 'Erro interno do servidor')
    }
  }

  const handleEdit = (item: FinanceiroColaborador) => {
    console.log('🔧 Editando item:', item)
    setEditingItem(item)
    
    // Validações antes de formatação
    if (!item._id) {
      showAlert('error', 'ID do item não encontrado')
      return
    }
    
    // Mapear tipo do banco para categoria do frontend
    const mapTipoToCategoria = (tipo: string) => {
      const mapping: { [key: string]: string } = {
        'salario': 'salario',
        'bonus': 'bonus',
        'desconto': 'desconto',
        'vale': 'vale_transporte', // Mapeamos para a primeira opção de vale
        'comissao': 'ajuda_custo',
        'hora_extra': 'adicional', // Mapeamos para adicional
        'ferias': 'beneficios',
        'decimo_terceiro': 'beneficios'
      }
      return mapping[tipo] || 'outros'
    }
    
    const valorFormatado = typeof item.valor === 'number' 
      ? item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '0,00'
    
    const dataVencimento = item.data_vencimento 
      ? item.data_vencimento.split('T')[0] 
      : ''
    
    const dataPagamento = item.data_pagamento 
      ? item.data_pagamento.split('T')[0] 
      : ''
    
    // Se o item tem campo categoria, usar ele, senão mapear do tipo
    const categoria = item.categoria || mapTipoToCategoria(item.tipo)
    
    const newFormData = {
      categoria: categoria,
      descricao: item.descricao || '',
      valor: valorFormatado,
      data_vencimento: dataVencimento,
      observacoes: item.observacoes || '',
      recorrente: item.recorrente || false,
      periodicidade: item.periodicidade || '',
      status: item.status || 'pendente',
      data_pagamento: dataPagamento
    }
    console.log('📝 Form data sendo definido:', newFormData)
    console.log('🔄 Mapeamento tipo->categoria:', item.tipo, '->', categoria)
    setFormData(newFormData)
    setShowModal(true)
  }

  const handleDelete = (item: FinanceiroColaborador) => {
    setItemToDelete(item)
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    if (!itemToDelete) return

    try {
      const response = await fetch(
        `/api/financeiro-colaborador?id=${itemToDelete._id}&tipo_usuario=${currentUser?.tipo}`,
        { method: 'DELETE' }
      )
      
      const data = await response.json()
      
      if (data.success) {
        showAlert('success', 'Lançamento excluído!')
        loadDashboard(currentUser, selectedColaboradorId)
        // Se estamos na última página e ela ficou vazia, voltar para a página anterior
        const novaPagina = (financeiro && financeiro.length === 1 && paginaAtual > 1) ? paginaAtual - 1 : paginaAtual
        loadFinanceiro(currentUser, selectedColaboradorId, novaPagina)
      } else {
        showAlert('error', data.error || 'Erro ao excluir')
      }
    } catch (error) {
      showAlert('error', 'Erro interno do servidor')
    } finally {
      setShowDeleteModal(false)
      setItemToDelete(null)
    }
  }

  const handleCloseModal = () => {
    console.log('❌ Fechando modal')
    setShowModal(false)
    setEditingItem(null)
    setFormData({
      categoria: '',
      descricao: '',
      valor: '',
      data_vencimento: '',
      observacoes: '',
      recorrente: false,
      periodicidade: '',
      status: 'pendente',
      data_pagamento: ''
    })
  }

  const clearFilters = () => {
    setFiltros({
      categoria: '',
      status: '',
      data_inicio: '',
      data_fim: ''
    })
  }

  useEffect(() => {
    if (currentUser && selectedColaboradorId) {
      setPaginaAtual(1) // Reset para primeira página quando filtros mudarem
      loadFinanceiro(currentUser, selectedColaboradorId, 1)
    }
  }, [filtros])

  // UseEffect para preencher valor automaticamente quando categoria "salario" for selecionada
  useEffect(() => {
    console.log('🎯 UseEffect categoria salário - Categoria:', formData.categoria, 'Colaborador:', selectedColaborador?.nome, 'Salário:', selectedColaborador?.salario, 'Editando:', editingItem ? 'SIM' : 'NÃO')
    
    // Não executar se estivermos editando um item
    if (editingItem) {
      console.log('⏭️ Pulando preenchimento automático porque estamos editando')
      return
    }
    
    if (formData.categoria === 'salario' && selectedColaborador) {
      if (selectedColaborador.salario && selectedColaborador.salario > 0) {
        console.log('💰 Preenchendo valor automaticamente com salário:', selectedColaborador.salario)
        const salarioFormatado = selectedColaborador.salario.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })
        setFormData(prev => ({
          ...prev,
          valor: salarioFormatado,
          descricao: prev.descricao || `Salário - ${selectedColaborador.nome}${selectedColaborador.cargo ? ` (${selectedColaborador.cargo})` : ''}`
        }))
      } else {
        console.log('⚠️ Salário não cadastrado ou zero, apenas atualizando descrição')
        // Se não há salário cadastrado, apenas atualiza a descrição
        setFormData(prev => ({
          ...prev,
          descricao: prev.descricao || `Salário - ${selectedColaborador.nome}${selectedColaborador.cargo ? ` (${selectedColaborador.cargo})` : ''}`
        }))
      }
    }
  }, [formData.categoria, selectedColaborador, editingItem])

  const handleCondominiumChange = (condominioId: string) => {
    setSelectedCondominiumId(condominioId)
    // Limpar colaborador selecionado quando mudar de condomínio
    setSelectedColaboradorId('')
    setSelectedColaborador(null)
    
    if (condominioId && currentUser) {
      fetchColaboradores(currentUser.master_id || currentUser.id, condominioId)
    } else if (currentUser) {
      fetchColaboradores(currentUser.master_id || currentUser.id)
    }
  }

  const handleColaboradorChange = async (colaboradorId: string) => {
    setSelectedColaboradorId(colaboradorId)
    setPaginaAtual(1) // Reset para primeira página
    if (colaboradorId && currentUser) {
      await fetchColaboradorCompleto(colaboradorId)
      loadDashboard(currentUser, colaboradorId)
      loadFinanceiro(currentUser, colaboradorId, 1)
    }
  }

  // Função para navegar entre páginas
  const handlePaginaChange = (novaPagina: number) => {
    if (novaPagina >= 1 && novaPagina <= totalPaginas && currentUser && selectedColaboradorId) {
      loadFinanceiro(currentUser, selectedColaboradorId, novaPagina)
    }
  }

  const formatCurrencyDisplay = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      pendente: { bg: 'warning', text: 'Pendente' },
      pago: { bg: 'success', text: 'Pago' },
      atrasado: { bg: 'danger', text: 'Atrasado' },
      cancelado: { bg: 'secondary', text: 'Cancelado' }
    }
    const config = variants[status as keyof typeof variants] || variants.pendente
    return <Badge bg={config.bg}>{config.text}</Badge>
  }

  const getCategoriaLabel = (categoria: string) => {
    const cat = CATEGORIAS_COLABORADOR.find(c => c.value === categoria)
    return cat ? cat.label : categoria
  }

  const categoriasDisponiveis = CATEGORIAS_COLABORADOR

  const fluxoCaixaData = {
    labels: dashboardData?.fluxo_mensal?.map(item => `${item._id.mes}/${item._id.ano}`) || [],
    datasets: [
      {
        label: 'Receitas',
        data: dashboardData?.fluxo_mensal?.map(item => item.receitas) || [],
        borderColor: '#28a745',
        backgroundColor: 'rgba(40, 167, 69, 0.1)',
        tension: 0.4,
        fill: true
      },
      {
        label: 'Despesas',
        data: dashboardData?.fluxo_mensal?.map(item => item.despesas) || [],
        borderColor: '#dc3545',
        backgroundColor: 'rgba(220, 53, 69, 0.1)',
        tension: 0.4,
        fill: true
      }
    ]
  }

  const categoriasData = {
    labels: dashboardData?.categorias?.slice(0, 6).map(cat => getCategoriaLabel(cat._id)) || [],
    datasets: [{
      data: dashboardData?.categorias?.slice(0, 6).map(cat => cat.total_valor) || [],
      backgroundColor: [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
        '#9966FF', '#FF9F40'
      ],
      borderWidth: 2,
      borderColor: '#fff'
    }]
  }

  return (
    <>
      <Container fluid className="mt-4">
        {alert && (
          <Alert variant={alert.type} dismissible onClose={() => setAlert(null)}>
            {alert.message}
          </Alert>
        )}

        <Row className="mb-4">
          <Col>
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <h2 className="mb-1">👥 Gestão Financeira de Colaboradores</h2>
                <p className="text-muted mb-0">Controle financeiro de pagamentos e benefícios para colaboradores</p>
              </div>
              <div className="d-flex gap-2">
                <Button 
                  variant="primary" 
                  size="lg"
                  onClick={() => setShowModal(true)}
                  disabled={!selectedColaboradorId}
                >
                  ➕ Novo Lançamento
                </Button>
                <Button 
                  variant="outline-info" 
                  size="lg"
                  onClick={() => window.open('/financeiro-condominio', '_blank')}
                  title="Ver dados sincronizados no financeiro do condomínio"
                >
                  🔗 Ver no Condomínio
                </Button>
              </div>
            </div>
          </Col>
        </Row>

        {currentUser?.tipo === 'master' && (
  <>
    <Row className="mb-4">
      <Col>
        <Card>
          <Card.Header className="d-flex justify-content-between align-items-center">
            <h5 className="mb-0">🏢 Seleção de Condomínio</h5>
          </Card.Header>
          <Card.Body>
            <Row>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Selecione o Condomínio *</Form.Label>
                  <Form.Select
                    value={selectedCondominiumId}
                    onChange={(e) => handleCondominiumChange(e.target.value)}
                    required
                  >
                    <option value="">Selecione um condomínio</option>
                    {condominiums.map((cond) => (
                      <option key={cond._id} value={cond._id}>
                        {cond.nome}
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Text className="text-muted">
                    {localStorage.getItem('activeCondominio') && localStorage.getItem('activeCondominio') === selectedCondominiumId ? (
                      <span className="text-success">
                        ✅ Condomínio ativo selecionado automaticamente
                      </span>
                    ) : (
                      "Selecione o condomínio para visualizar seus colaboradores"
                    )}
                  </Form.Text>
                </Form.Group>
              </Col>
              <Col md={6} className="d-flex align-items-end">
                <div className="w-100">
                  <small className="text-muted">
                    <strong>Condomínios disponíveis:</strong> {condominiums.length}
                  </small>
                  {localStorage.getItem('activeCondominio') && (
                    <div className="mt-1">
                      <small className="text-success">
                        🏢 <strong>Condomínio Ativo:</strong> {localStorage.getItem('activeCondominiumName') || 'Carregando...'}
                      </small>
                    </div>
                  )}
                </div>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      </Col>
    </Row>

    <Row className="mb-4">
      <Col>
        <Card>
          <Card.Header className="d-flex justify-content-between align-items-center">
            <h5 className="mb-0">👤 Seleção de Colaborador</h5>
          </Card.Header>
          <Card.Body>
            <Row>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Selecionar Colaborador *</Form.Label>
                <Form.Select
                  value={selectedColaboradorId}
                  onChange={(e) => handleColaboradorChange(e.target.value)}
                >
                  <option value="">Selecione um colaborador</option>
                  {colaboradores.map((col) => (
                    <option key={col._id} value={col._id}>
                      {col.nome}
                    </option>
                  ))}
                </Form.Select>
                <Form.Text className="text-muted">
                  {selectedCondominiumId && (
                    <div className="mb-1">
                      <span className="text-primary">
                        🏢 Filtrando por condomínio ativo - {colaboradores.length} colaborador(es) encontrado(s)
                      </span>
                    </div>
                  )}
                  {selectedColaboradorId ? (
                    localStorage.getItem('activeColaborador') === selectedColaboradorId ? (
                      <span className="text-success">
                        ✅ Colaborador ativo selecionado automaticamente
                      </span>
                    ) : (
                      <span className="text-info">
                        📋 Colaborador selecionado manualmente
                      </span>
                    )
                  ) : (
                    <span className="text-warning">
                      ⚠️ Selecione um colaborador para ver os dados financeiros
                    </span>
                  )}
                </Form.Text>
                {/* Mostra o CPF do colaborador selecionado */}
                {selectedColaboradorId && (
                  <div className="mt-2">
                    <small className="text-muted">
                      <strong>CPF:</strong>{" "}
                      {colaboradores.find(col => col._id === selectedColaboradorId)?.cpf ?? 'Não informado'}
                    </small>
                  </div>
                )}
              </Form.Group>
            </Col>
            <Col md={6} className="d-flex align-items-end">
              <div className="w-100">
                <small className="text-muted">
                  <strong>Total de lançamentos:</strong> {totalRegistros > 0 ? totalRegistros : (financeiro ? financeiro.length : 0)}
                  {totalPaginas > 1 && (
                    <span className="ms-2">
                      (Página {paginaAtual} de {totalPaginas})
                    </span>
                  )}
                </small>
                {localStorage.getItem('activeColaborador') && (
                  <div className="mt-1">
                    <small className="text-success">
                      👤 <strong>Colaborador Ativo:</strong> {localStorage.getItem('activeColaboradorName') || 'Carregando...'}
                    </small>
                  </div>
                )}
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </Col>
  </Row>
  </>
)}

        {currentUser?.tipo === 'master' && !selectedCondominiumId ? (
          <Alert variant="info" className="text-center">
            <h5>👆 Selecione um condomínio acima</h5>
            <p className="mb-0">Escolha o condomínio para visualizar os dados financeiros dos colaboradores</p>
          </Alert>
        ) : null}

        {selectedCondominiumId && (
          <Row className="mb-4">
            <Col>
              <Alert variant="info" className="border-primary">
                <div className="d-flex align-items-start">
                  <div className="me-3">
                    <span style={{ fontSize: '24px' }}>🔗</span>
                  </div>
                  <div className="flex-grow-1">
                    <h6 className="alert-heading mb-2">
                      <strong>Sincronização Automática com Financeiro do Condomínio</strong>
                    </h6>
                    <p className="mb-1">
                      <strong>✅ Como funciona:</strong> Todos os lançamentos de colaboradores são automaticamente sincronizados 
                      como <strong>despesas</strong> no financeiro do condomínio.
                    </p>
                    <p className="mb-1">
                      <strong>💰 Salários, bônus e benefícios</strong> → Aparecem como despesas do condomínio
                    </p>
                    <p className="mb-0">
                      <strong>🔍 Para ver a visão consolidada:</strong> Clique no botão 
                      <span className="badge bg-info ms-1 me-1">🔗 Ver no Condomínio</span> 
                      acima para abrir o financeiro unificado em nova aba.
                    </p>
                  </div>
                </div>
              </Alert>
            </Col>
          </Row>
        )}

        {dashboardData && (currentUser?.tipo !== 'master' || selectedCondominiumId) && (
          <>
            <Row className="mb-4">
              <Col md={3}>
                <Card className="border-success">
                  <Card.Body className="text-center">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <h6 className="text-success mb-0">Receitas</h6>
                      <i className="fas fa-arrow-up text-success"></i>
                    </div>
                    <h3 className="text-success mb-0">{formatCurrencyDisplay(dashboardData?.resumo?.total_receitas || 0)}</h3>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card className="border-danger">
                  <Card.Body className="text-center">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <h6 className="text-danger mb-0">Despesas</h6>
                      <i className="fas fa-arrow-down text-danger"></i>
                    </div>
                    <h3 className="text-danger mb-0">{formatCurrencyDisplay(dashboardData?.resumo?.total_despesas || 0)}</h3>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card className={(dashboardData?.resumo?.resultado_liquido || 0) >= 0 ? 'border-primary' : 'border-warning'}>
                  <Card.Body className="text-center">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <h6 className="mb-0">Saldo</h6>
                      <i className={`fas ${(dashboardData?.resumo?.resultado_liquido || 0) >= 0 ? 'fa-check-circle text-primary' : 'fa-exclamation-triangle text-warning'}`}></i>
                    </div>
                    <h3 className={(dashboardData?.resumo?.resultado_liquido || 0) >= 0 ? 'text-primary' : 'text-warning'}>
                      {formatCurrencyDisplay(dashboardData?.resumo?.resultado_liquido || 0)}
                    </h3>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card className="border-warning">
                  <Card.Body className="text-center">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <h6 className="text-warning mb-0">Pendentes</h6>
                      <Badge bg="warning">{dashboardData?.resumo?.count_pendentes || 0}</Badge>
                    </div>
                    <h3 className="text-warning mb-0">{formatCurrencyDisplay(dashboardData?.resumo?.total_pendentes || 0)}</h3>
                    {(dashboardData?.resumo?.total_atrasados || 0) > 0 && (
                      <small className="text-danger">
                        <i className="fas fa-exclamation-triangle me-1"></i>
                        {formatCurrencyDisplay(dashboardData?.resumo?.total_atrasados || 0)} em atraso
                      </small>
                    )}
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            <Row className="mb-4">
              <Col md={8}>
                <Card className="h-100">
                  <Card.Header className="bg-light">
                    <h5 className="mb-0">📈 Fluxo de Caixa Mensal</h5>
                  </Card.Header>
                  <Card.Body>
                    {dashboardData && dashboardData.fluxo_mensal && dashboardData.fluxo_mensal.length > 0 ? (
                      <Line 
                        data={fluxoCaixaData} 
                        options={{
                          responsive: true,
                          interaction: {
                            mode: 'index' as const,
                            intersect: false,
                          },
                          plugins: {
                            legend: {
                              position: 'top' as const,
                            },
                            tooltip: {
                              callbacks: {
                                label: function(context) {
                                  return `${context.dataset.label}: ${formatCurrencyDisplay(context.parsed.y)}`
                                }
                              }
                            }
                          },
                          scales: {
                            y: {
                              beginAtZero: true,
                              ticks: {
                                callback: function(value) {
                                  return formatCurrencyDisplay(Number(value))
                                }
                              }
                            }
                          }
                        }} 
                      />
                    ) : (
                      <div className="text-center text-muted py-5">
                        <i className="fas fa-chart-line fa-3x mb-3"></i>
                        <p>Nenhum dado disponível para o gráfico</p>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </Col>
              <Col md={4}>
                <Card className="h-100">
                  <Card.Header className="bg-light">
                    <h5 className="mb-0">🎯 Principais Categorias</h5>
                  </Card.Header>
                  <Card.Body>
                    {dashboardData && dashboardData.categorias && dashboardData.categorias.length > 0 ? (
                      <Doughnut 
                        data={categoriasData} 
                        options={{
                          responsive: true,
                          plugins: {
                            legend: {
                              position: 'bottom' as const,
                            },
                            tooltip: {
                              callbacks: {
                                label: function(context) {
                                  return `${context.label}: ${formatCurrencyDisplay(context.parsed)}`
                                }
                              }
                            }
                          }
                        }} 
                      />
                    ) : (
                      <div className="text-center text-muted py-5">
                        <i className="fas fa-chart-pie fa-3x mb-3"></i>
                        <p>Nenhum dado disponível</p>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </>
        )}

        {(currentUser?.tipo !== 'master' || selectedCondominiumId) && (
          <Row>
            <Col>
              <Card>
              <Card.Header>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h5 className="mb-0">📋 Lançamentos Financeiros</h5>
                  <div className="d-flex gap-2">
                    <Button 
                      variant="outline-secondary" 
                      size="sm"
                      onClick={clearFilters}
                    >
                      <i className="fas fa-times me-1"></i>
                      Limpar Filtros
                    </Button>
                  </div>
                </div>
                <div className="bg-light p-3 rounded">
                  <Row className="g-2">
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label className="small mb-1">Status</Form.Label>
                        <Form.Select 
                          size="sm"
                          value={filtros.status}
                          onChange={(e) => setFiltros({...filtros, status: e.target.value})}
                        >
                          <option value="">Todos os status</option>
                          <option value="pendente">Pendente</option>
                          <option value="pago">Pago</option>
                          <option value="atrasado">Atrasado</option>
                          <option value="cancelado">Cancelado</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label className="small mb-1">Categoria</Form.Label>
                        <Form.Select 
                          size="sm"
                          value={filtros.categoria}
                          onChange={(e) => setFiltros({...filtros, categoria: e.target.value})}
                        >
                          <option value="">Todas as categorias</option>
                          {CATEGORIAS_COLABORADOR.map(cat => (
                            <option key={cat.value} value={cat.value}>{cat.label}</option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label className="small mb-1">Período</Form.Label>
                        <div className="d-flex flex-column gap-2">
                          <div className="position-relative">
                            <Form.Control
                              type="date"
                              size="sm"
                              value={filtros.data_inicio}
                              onChange={(e) => setFiltros({...filtros, data_inicio: e.target.value})}
                              placeholder="Data início"
                              style={{ paddingRight: filtros.data_inicio ? '35px' : '12px' }}
                            />
                            {filtros.data_inicio && (
                              <button
                                type="button"
                                className="btn btn-sm p-0"
                                onClick={() => setFiltros({...filtros, data_inicio: ''})}
                                title="Limpar data início"
                                style={{
                                  position: 'absolute',
                                  right: '6px',
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  border: 'none',
                                  background: 'transparent',
                                  color: '#6c757d',
                                  width: '20px',
                                  height: '20px',
                                  borderRadius: '3px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = '#f8f9fa'
                                  e.currentTarget.style.color = '#dc3545'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'transparent'
                                  e.currentTarget.style.color = '#6c757d'
                                }}
                              >
                                <i className="fas fa-times" style={{ fontSize: '10px' }}></i>
                              </button>
                            )}
                          </div>
                          <div className="position-relative">
                            <Form.Control
                              type="date"
                              size="sm"
                              value={filtros.data_fim}
                              onChange={(e) => setFiltros({...filtros, data_fim: e.target.value})}
                              placeholder="Data fim"
                              style={{ paddingRight: filtros.data_fim ? '35px' : '12px' }}
                            />
                            {filtros.data_fim && (
                              <button
                                type="button"
                                className="btn btn-sm p-0"
                                onClick={() => setFiltros({...filtros, data_fim: ''})}
                                title="Limpar data fim"
                                style={{
                                  position: 'absolute',
                                  right: '6px',
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  border: 'none',
                                  background: 'transparent',
                                  color: '#6c757d',
                                  width: '20px',
                                  height: '20px',
                                  borderRadius: '3px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = '#f8f9fa'
                                  e.currentTarget.style.color = '#dc3545'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'transparent'
                                  e.currentTarget.style.color = '#6c757d'
                                }}
                              >
                                <i className="fas fa-times" style={{ fontSize: '10px' }}></i>
                              </button>
                            )}
                          </div>
                          <div className="d-flex gap-1 justify-content-center">
                            <Button
                              variant="outline-info"
                              size="sm"
                              type="button"
                              onClick={() => {
                                const hoje = new Date()
                                const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
                                const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
                                setFiltros({
                                  ...filtros, 
                                  data_inicio: inicioMes.toISOString().split('T')[0],
                                  data_fim: fimMes.toISOString().split('T')[0]
                                })
                              }}
                              title="Filtrar por este mês"
                              style={{ 
                                fontSize: '11px',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '6px'
                              }}
                            >
                              <i className="fas fa-calendar-check me-1"></i>
                              Este mês
                            </Button>
                          </div>
                        </div>
                      </Form.Group>
                    </Col>
                  </Row>
                  
                  {(filtros.status || filtros.categoria || filtros.data_inicio || filtros.data_fim) && (
                    <div className="mt-2">
                      <small className="text-muted">Filtros ativos: </small>
                      {filtros.status && <span className="badge bg-warning me-1">Status: {filtros.status}</span>}
                      {filtros.categoria && (
                        <span className="badge bg-info me-1">
                          Categoria: {getCategoriaLabel(filtros.categoria)}
                        </span>
                      )}
                      {filtros.data_inicio && <span className="badge bg-secondary me-1">De: {filtros.data_inicio}</span>}
                      {filtros.data_fim && <span className="badge bg-secondary me-1">Até: {filtros.data_fim}</span>}
                    </div>
                  )}
                </div>
              </Card.Header>
              <Card.Body>
                <Table responsive hover>
                  <thead>
                    <tr>
                      <th>Colaborador</th>
                      <th>Categoria</th>
                      <th>Descrição</th>
                      <th>Valor</th>
                      <th>Vencimento</th>
                      <th>Status</th>
                      <th>Recorrente</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!financeiro || financeiro.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center text-muted py-4">
                          <i className="fas fa-inbox fa-2x mb-2"></i>
                          <p>Nenhum lançamento encontrado</p>
                        </td>
                      </tr>
                    ) : (
                      (financeiro || []).map((item) => (
                        <tr key={item._id}>
                          <td>
                            <div>
                              <strong>{selectedColaborador?.nome || 'Colaborador'}</strong>
                              {selectedColaborador?.cpf && (
                                <>
                                  <br />
                                  <small className="text-muted">
                                    CPF: {selectedColaborador.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}
                                  </small>
                                </>
                              )}
                              {selectedColaborador?.cargo && (
                                <>
                                  <br />
                                  <span className="badge bg-info">{selectedColaborador.cargo}</span>
                                </>
                              )}
                            </div>
                          </td>
                          <td>{getCategoriaLabel(item.tipo)}</td>
                          <td>
                            <strong>{item.descricao}</strong>
                            {item.observacoes && (
                              <>
                                <br />
                                <small className="text-muted">{item.observacoes}</small>
                              </>
                            )}
                          </td>
                          <td className="text-danger">
                            <strong>{formatCurrencyDisplay(item.valor)}</strong>
                          </td>
                          <td>{item.data_vencimento.split('T')[0].split('-').reverse().join('/')}</td>
                          <td>{getStatusBadge(item.status)}</td>
                          <td>
                            {item.recorrente ? (
                              <Badge bg="info">
                                <i className="fas fa-sync-alt me-1"></i>
                                {item.periodicidade}
                              </Badge>
                            ) : (
                              <Badge bg="light" text="dark">Única</Badge>
                            )}
                          </td>
                          <td>
                            <div className="d-flex gap-2">
                              <Button 
                                variant="outline-primary" 
                                size="sm"
                                onClick={() => handleEdit(item)}
                                title="Editar"
                              >
                                ✏️
                              </Button>
                              <Button 
                                variant="outline-danger" 
                                size="sm"
                                onClick={() => handleDelete(item)}
                                title="Excluir"
                              >
                                🗑️
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
                
                {/* Paginação */}
                {totalPaginas > 1 && (
                  <div className="d-flex justify-content-between align-items-center mt-3 px-3 pb-3">
                    <div className="text-muted">
                      <small>
                        Mostrando {((paginaAtual - 1) * registrosPorPagina) + 1} a {Math.min(paginaAtual * registrosPorPagina, totalRegistros)} de {totalRegistros} registros
                      </small>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        disabled={paginaAtual === 1 || loading}
                        onClick={() => handlePaginaChange(1)}
                        title="Primeira página"
                      >
                        <i className="fas fa-angle-double-left"></i>
                      </Button>
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        disabled={paginaAtual === 1 || loading}
                        onClick={() => handlePaginaChange(paginaAtual - 1)}
                        title="Página anterior"
                      >
                        <i className="fas fa-angle-left"></i>
                      </Button>
                      
                      {/* Números das páginas */}
                      {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
                        let pageNum
                        if (totalPaginas <= 5) {
                          pageNum = i + 1
                        } else if (paginaAtual <= 3) {
                          pageNum = i + 1
                        } else if (paginaAtual >= totalPaginas - 2) {
                          pageNum = totalPaginas - 4 + i
                        } else {
                          pageNum = paginaAtual - 2 + i
                        }
                        
                        return (
                          <Button
                            key={pageNum}
                            variant={pageNum === paginaAtual ? "primary" : "outline-secondary"}
                            size="sm"
                            disabled={loading}
                            onClick={() => handlePaginaChange(pageNum)}
                            style={{ minWidth: '32px' }}
                          >
                            {pageNum}
                          </Button>
                        )
                      })}
                      
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        disabled={paginaAtual === totalPaginas || loading}
                        onClick={() => handlePaginaChange(paginaAtual + 1)}
                        title="Próxima página"
                      >
                        <i className="fas fa-angle-right"></i>
                      </Button>
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        disabled={paginaAtual === totalPaginas || loading}
                        onClick={() => handlePaginaChange(totalPaginas)}
                        title="Última página"
                      >
                        <i className="fas fa-angle-double-right"></i>
                      </Button>
                    </div>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
        )}

        {/* Modal de lançamento */}
        <Modal show={showModal} onHide={handleCloseModal} size="lg">
          <Modal.Header closeButton>
            <Modal.Title>
              {editingItem ? 'Editar Lançamento' : 'Novo Lançamento'}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form onSubmit={handleSubmit}>
              {/* Informação do colaborador herdado */}
              {selectedColaboradorId && (
                <Alert variant="info" className="mb-3">
                  <div className="d-flex align-items-center">
                    <i className="fas fa-user me-2"></i>
                    <div>
                      <strong>Colaborador:</strong> {colaboradores.find(c => c._id === selectedColaboradorId)?.nome || 'Carregando...'}
                      <br />
                      <small className="text-muted">Este lançamento será automaticamente vinculado ao colaborador selecionado</small>
                    </div>
                  </div>
                </Alert>
              )}
              
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Categoria *</Form.Label>
                    <Form.Select
                      value={formData.categoria}
                      onChange={(e) => setFormData({...formData, categoria: e.target.value})}
                      required
                    >
                      <option value="">Selecione uma categoria</option>
                      {categoriasDisponiveis.map(cat => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>

              <Form.Group className="mb-3">
                <Form.Label>Descrição *</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Descrição detalhada do lançamento..."
                  value={formData.descricao}
                  onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                  required
                />
              </Form.Group>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Valor *</Form.Label>
                    <div className="input-group">
                      <span className="input-group-text">R$</span>
                      <Form.Control
                        type="text"
                        placeholder="0,00"
                        value={formData.valor}
                        onChange={handleValueChange}
                        required
                        className={formData.categoria === 'salario' && selectedColaborador?.salario && selectedColaborador.salario > 0 ? 'border-success' : ''}
                      />
                      {formData.categoria === 'salario' && selectedColaborador?.salario && selectedColaborador.salario > 0 && (
                        <span className="input-group-text text-success">
                          <i className="fas fa-check-circle"></i>
                        </span>
                      )}
                    </div>
                    <Form.Text className="text-muted">
                      {formData.categoria === 'salario' && selectedColaborador ? (
                        selectedColaborador.salario && selectedColaborador.salario > 0 ? (
                          <span className="text-success">
                            <i className="fas fa-info-circle me-1"></i>
                            Valor preenchido automaticamente com o salário cadastrado: R$ {selectedColaborador.salario.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-warning">
                            <i className="fas fa-exclamation-triangle me-1"></i>
                            Salário não cadastrado para este colaborador. Digite o valor manualmente.
                          </span>
                        )
                      ) : (
                        <>
                          Digite apenas números (ex: 12345 = R$ 123,45)
                          <br />
                          <small>Máximo: R$ 99.999.999,99</small>
                        </>
                      )}
                    </Form.Text>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Data de Vencimento *</Form.Label>
                    <div className="position-relative">
                      <Form.Control
                        type="date"
                        value={formData.data_vencimento}
                        onChange={(e) => setFormData({...formData, data_vencimento: e.target.value})}
                        required
                        style={{ paddingRight: '80px' }}
                      />
                      <div className="position-absolute" style={{ right: '8px', top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '4px' }}>
                        {formData.data_vencimento && (
                          <button
                            type="button"
                            className="btn btn-sm p-1"
                            onClick={() => setFormData({...formData, data_vencimento: ''})}
                            title="Limpar data"
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: '#6c757d',
                              width: '24px',
                              height: '24px',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#f8f9fa'
                              e.currentTarget.style.color = '#dc3545'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent'
                              e.currentTarget.style.color = '#6c757d'
                            }}
                          >
                            <i className="fas fa-times" style={{ fontSize: '12px' }}></i>
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-sm p-1"
                          onClick={() => {
                            const hoje = new Date()
                            const proximoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 10)
                            setFormData({...formData, data_vencimento: proximoMes.toISOString().split('T')[0]})
                          }}
                          title="Próximo mês (dia 10)"
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#0d6efd',
                            width: '24px',
                            height: '24px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#e7f1ff'
                            e.currentTarget.style.color = '#0a58ca'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent'
                            e.currentTarget.style.color = '#0d6efd'
                          }}
                        >
                          <i className="fas fa-calendar-plus" style={{ fontSize: '12px' }}></i>
                        </button>
                      </div>
                    </div>
                    <Form.Text className="text-muted">
                      <small>
                        <i className="fas fa-info-circle me-1"></i>
                        Clique em <i className="fas fa-calendar-plus text-primary"></i> para definir próximo mês ou <i className="fas fa-times text-danger"></i> para limpar
                      </small>
                    </Form.Text>
                  </Form.Group>
                </Col>
              </Row>

              <Form.Group className="mb-3">
                <Form.Label>Observações</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  placeholder="Observações adicionais..."
                  value={formData.observacoes || ''}
                  onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
                />
              </Form.Group>

              <Row>
                <Col md={6}>
                  <Form.Check
                    type="checkbox"
                    label="Lançamento recorrente"
                    checked={!!formData.recorrente}
                    onChange={(e) => setFormData({...formData, recorrente: e.target.checked})}
                  />
                </Col>
                {formData.recorrente && (
                  <Col md={6}>
                    <Form.Select
                      value={formData.periodicidade || ''}
                      onChange={(e) => setFormData({...formData, periodicidade: e.target.value})}
                      required={formData.recorrente}
                    >
                      <option value="">Selecione a periodicidade</option>
                      <option value="mensal">Mensal</option>
                      <option value="bimestral">Bimestral</option>
                      <option value="trimestral">Trimestral</option>
                      <option value="semestral">Semestral</option>
                      <option value="anual">Anual</option>
                    </Form.Select>
                  </Col>
                )}
              </Row>

              <Row className="mt-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Status do Lançamento *</Form.Label>
                    <Form.Select
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value as 'pendente' | 'pago' | 'atrasado' | 'cancelado'})}
                      required
                    >
                      <option value="pendente">⏳ Pendente</option>
                      <option value="pago">✅ Pago</option>
                      <option value="atrasado">⚠️ Atrasado</option>
                      <option value="cancelado">❌ Cancelado</option>
                    </Form.Select>
                    <Form.Text className="text-muted">
                      <small>
                        <i className="fas fa-info-circle me-1"></i>
                        {editingItem ? 'Atualize o status conforme necessário' : 'Novos lançamentos geralmente começam como "Pendente"'}
                      </small>
                    </Form.Text>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  {formData.status === 'pago' && (
                    <Form.Group>
                      <Form.Label>Data de Pagamento</Form.Label>
                      <div className="position-relative">
                        <Form.Control
                          type="date"
                          value={formData.data_pagamento}
                          onChange={(e) => setFormData({...formData, data_pagamento: e.target.value})}
                        />
                        <button
                          type="button"
                          className="btn btn-sm p-1"
                          onClick={() => {
                            const hoje = new Date().toISOString().split('T')[0]
                            setFormData({...formData, data_pagamento: hoje})
                          }}
                          title="Hoje"
                          style={{
                            position: 'absolute',
                            right: '8px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            border: 'none',
                            background: 'transparent',
                            color: '#28a745',
                            width: '24px',
                            height: '24px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#e8f5e8'
                            e.currentTarget.style.color = '#155724'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent'
                            e.currentTarget.style.color = '#28a745'
                          }}
                        >
                          <i className="fas fa-calendar-day" style={{ fontSize: '12px' }}></i>
                        </button>
                      </div>
                      <Form.Text className="text-muted">
                        <small>Data em que o pagamento foi realizado</small>
                      </Form.Text>
                    </Form.Group>
                  )}
                </Col>
              </Row>
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseModal}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSubmit}>
              {editingItem ? 'Atualizar' : 'Criar'} Lançamento
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Modal de confirmação de exclusão */}
        <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
          <Modal.Header closeButton>
            <Modal.Title className="text-danger">
              🗑️ Confirmar Exclusão
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="text-center py-3">
              <div className="mb-3">
                <i className="text-danger" style={{ fontSize: '48px' }}>⚠️</i>
              </div>
              <h5 className="mb-3">Tem certeza que deseja excluir este lançamento?</h5>
              {itemToDelete && (
                <div className="bg-light p-3 rounded mb-3">
                  <p className="mb-1"><strong>Descrição:</strong> {itemToDelete.descricao}</p>
                  <p className="mb-1"><strong>Valor:</strong> {formatCurrencyDisplay(itemToDelete.valor)}</p>
                  <p className="mb-0"><strong>Categoria:</strong> {getCategoriaLabel(itemToDelete.tipo)}</p>
                </div>
              )}
              <p className="text-muted mb-0">
                Esta ação não pode ser desfeita.
              </p>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button 
              variant="secondary" 
              onClick={() => setShowDeleteModal(false)}
            >
              Cancelar
            </Button>
            <Button 
              variant="danger" 
              onClick={confirmDelete}
            >
              🗑️ Confirmar Exclusão
            </Button>
          </Modal.Footer>
        </Modal>
      </Container>
    </>
  )
}