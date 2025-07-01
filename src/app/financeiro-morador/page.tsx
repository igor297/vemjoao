'use client'

import React, { useState, useEffect } from 'react'
import { Container, Row, Col, Card, Button, Modal, Form, Alert, Badge, Table, Dropdown } from 'react-bootstrap'
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
import { safeJsonParse } from '@/lib/api-utils'

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

interface FinanceiroMorador {
  _id: string
  tipo: 'receita' | 'despesa' | 'transferencia'
  categoria: string
  descricao: string
  valor: number
  data_vencimento: string
  data_pagamento?: string
  status: 'pendente' | 'pago' | 'atrasado' | 'cancelado'
  observacoes?: string
  recorrente: boolean
  periodicidade?: string
  criado_por_nome: string
  data_criacao: string
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
  }
  categorias: any[]
  fluxo_mensal: any[]
}

const CATEGORIAS_MORADOR = [
  { value: 'taxa_condominio', label: '🏢 Condomínio', tipo: 'despesa' },
  { value: 'multa_atraso', label: '⚠️ Multa', tipo: 'despesa' }
]

interface Morador {
  _id: string
  nome: string
  cpf?: string
  email?: string
  tipo: 'proprietario' | 'inquilino' | 'dependente'
  unidade: string
  bloco?: string
  condominio_nome?: string
}

interface Condominium {
  _id: string
  nome: string
  valor_taxa_condominio?: number
  dia_vencimento?: number
  aceita_pagamento_automatico?: boolean
  multa_atraso?: number
  juros_mes?: number
  dias_aviso_vencimento?: number
}

// Integração completa com configurações do condomínio
export default function FinanceiroMoradorPage() {
  const [financeiro, setFinanceiro] = useState<FinanceiroMorador[]>([])
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [moradores, setMoradores] = useState<Morador[]>([])
  const [condominiums, setCondominiums] = useState<Condominium[]>([])
  const [selectedMorador, setSelectedMorador] = useState<Morador | null>(null)
  const [selectedCondominium, setSelectedCondominium] = useState<Condominium | null>(null)
  const [moradoresEmDia, setMoradoresEmDia] = useState<MoradorComStatus[]>([])
  const [moradoresAtrasados, setMoradoresAtrasados] = useState<MoradorComStatus[]>([])
  
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [selectedMoradorId, setSelectedMoradorId] = useState<string>('')
  const [selectedCondominiumId, setSelectedCondominiumId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [alert, setAlert] = useState<{type: string, message: string} | null>(null)
  const [showResumoGeral, setShowResumoGeral] = useState(false)
  const [showBuscaModal, setShowBuscaModal] = useState(false)
  const [unidadeSelecionada, setUnidadeSelecionada] = useState<{unidade: string, bloco?: string, moradores: string[]} | null>(null)
  
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<FinanceiroMorador | null>(null)
  
  const [formData, setFormData] = useState({
    tipo: 'despesa' as 'receita' | 'despesa' | 'transferencia',
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
    data_fim: '',
    tipo: ''
  })

  const [buscaMorador, setBuscaMorador] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'proprietario' | 'inquilino' | 'dependente'>('todos');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'em_dia' | 'atrasados'>('todos');

  interface MoradorComStatus extends Morador {
    total_pendente: number;
    count_pendente: number;
    total_pago: number;
    count_pago: number;
    total_atrasado: number;
    count_atrasado: number;
    total_cancelado: number;
    count_cancelado: number;
    total_geral: number;
    count_geral: number;
    tem_atraso: boolean;
    moradores_na_unidade: number;
    detalhes_moradores: { nome: string; tipo: string; cpf?: string }[];
    tipos_na_unidade: string[];
    tem_proprietario: boolean;
    tem_inquilino: boolean;
  }

  

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
            fetchCondominiumCompleto(activeCondominiumId)
            fetchMoradores(user.id, activeCondominiumId)
            // Carregar status dos moradores após um tempo
            setTimeout(() => {
              const currentUserData = JSON.parse(localStorage.getItem('userData') || '{}')
              if (currentUserData?.id) {
                setCurrentUser(currentUserData)
                buscarStatusMoradores()
              }
            }, 2000)
          } else {
            console.log('🏢 Nenhum condomínio ativo, carregando todos os moradores')
            fetchMoradores(user.id)
          }
          
          // Verificar morador ativo
          const activeMoradorId = localStorage.getItem('activeMorador')
          if (activeMoradorId) {
            setSelectedMoradorId(activeMoradorId)
            fetchMoradorCompleto(activeMoradorId)
            loadDashboard(user, activeMoradorId)
            loadFinanceiro(user, activeMoradorId)
          }
        } else {
          // Para não-masters, usar morador do usuário
          if (user.morador_id) {
            setSelectedMoradorId(user.morador_id)
            fetchMoradorCompleto(user.morador_id)
            loadDashboard(user, user.morador_id)
            loadFinanceiro(user, user.morador_id)
          }
        }
      } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error)
      }
    }

    // Listener para mudanças no morador ativo e condomínio ativo
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
            fetchMoradores(user.id, activeCondominiumId)
            // Limpar morador selecionado quando mudar de condomínio
            setSelectedMoradorId('')
            setSelectedMorador(null)
          }
          
          // Verificar mudança no morador ativo
          const activeMoradorId = localStorage.getItem('activeMorador')
          if (activeMoradorId && activeMoradorId !== selectedMoradorId) {
            setSelectedMoradorId(activeMoradorId)
            fetchMoradorCompleto(activeMoradorId)
            loadDashboard(user, activeMoradorId)
            loadFinanceiro(user, activeMoradorId)
          }
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('moradorChanged', handleStorageChange)
    window.addEventListener('condominioChanged', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('moradorChanged', handleStorageChange)
      window.removeEventListener('condominioChanged', handleStorageChange)
    }
  }, [])

  // UseEffect para verificar morador ativo e condomínio ativo periodicamente
  useEffect(() => {
    if (currentUser?.tipo === 'master') {
      const interval = setInterval(() => {
        // Verificar mudança no condomínio ativo
        const activeCondominio = localStorage.getItem('activeCondominio')
        if (activeCondominio && activeCondominio !== selectedCondominiumId) {
          console.log('🏢 Atualizando condomínio ativo:', activeCondominio)
          setSelectedCondominiumId(activeCondominio)
          fetchMoradores(currentUser.id, activeCondominio)
          // Limpar morador selecionado quando mudar de condomínio
          setSelectedMoradorId('')
          setSelectedMorador(null)
        }
        
        // Verificar mudança no morador ativo
        const activeMorador = localStorage.getItem('activeMorador')
        if (activeMorador && activeMorador !== selectedMoradorId) {
          console.log('👤 Atualizando morador ativo:', activeMorador)
          setSelectedMoradorId(activeMorador)
          fetchMoradorCompleto(activeMorador)
          loadDashboard(currentUser, activeMorador)
          loadFinanceiro(currentUser, activeMorador)
        }
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [currentUser, selectedMoradorId, selectedCondominiumId])

  const showAlert = (type: string, message: string) => {
    setAlert({ type, message })
    setTimeout(() => setAlert(null), 5000)
  }

  const loadCondominiums = async (masterId: string) => {
    try {
      const response = await fetch(`/api/condominios?master_id=${encodeURIComponent(masterId)}`)
      const result = await safeJsonParse(response)
      if (result.success && result.data?.success) {
        setCondominiums(result.data.condominios)
      } else {
        console.error('Erro ao carregar condomínios:', result.error)
      }
    } catch (error) {
      console.error('Erro ao carregar condomínios:', error)
    }
  }

  const fetchMoradores = async (masterId: string, condominioId?: string) => {
    try {
      let url = `/api/moradores?master_id=${masterId}`
      
      if (condominioId) {
        url += `&condominio_id=${condominioId}`
      }
      
      console.log('🔍 Carregando moradores com URL:', url)
      const response = await fetch(url)
      const result = await safeJsonParse(response)
      
      if (result.success && result.data?.success) {
        console.log('✅ Moradores carregados:', result.data.moradores.length)
        setMoradores(result.data.moradores)
      } else {
        console.error('Erro ao carregar moradores:', result.error)
      }
    } catch (error) {
      console.error('Erro ao carregar moradores:', error)
    }
  }

  const fetchMoradorCompleto = async (moradorId: string) => {
    try {
      console.log('🔍 Buscando dados completos do morador:', moradorId)
      const response = await fetch(`/api/moradores?id=${moradorId}`)
      const result = await safeJsonParse(response)
      
      console.log('📋 Resposta da API:', result)
      
      if (result.success && result.data?.success && result.data.morador) {
        console.log('✅ Morador encontrado:', result.data.morador.nome)
        setSelectedMorador(result.data.morador)
        return result.data.morador
      } else {
        console.log('❌ Erro na resposta da API:', result.error)
      }
    } catch (error) {
      console.error('❌ Erro ao carregar dados completos do morador:', error)
    }
    return null
  }

  const fetchCondominiumCompleto = async (condominiumId: string) => {
    try {
      console.log('🏢 Buscando configurações do condomínio:', condominiumId)
      const response = await fetch(`/api/condominios?id=${condominiumId}`)
      const result = await safeJsonParse(response)
      
      if (result.success && result.data?.success && result.data.condominio) {
        console.log('✅ Configurações do condomínio carregadas:', result.data.condominio.nome)
        setSelectedCondominium(result.data.condominio)
        return result.data.condominio
      } else {
        console.log('❌ Erro ao carregar configurações do condomínio:', result.error)
      }
    } catch (error) {
      console.error('❌ Erro ao carregar configurações do condomínio:', error)
    }
    return null
  }

  const buscarStatusMoradores = async () => {
    if (!currentUser || !selectedCondominiumId) return

    try {
      const response = await fetch(
        `/api/financeiro-morador/status-moradores?master_id=${currentUser.master_id || currentUser.id}&condominio_id=${selectedCondominiumId}&tipo_usuario=${currentUser.tipo}`
      )
      const data = await response.json()
      
      if (data.success) {
        setMoradoresEmDia(data.moradores_em_dia || [])
        setMoradoresAtrasados(data.moradores_atrasados || [])
      } else {
        console.error('Erro na resposta da API de status dos moradores:', data.error)
      }
    } catch (error) {
      console.error('Erro ao buscar status dos moradores:', error)
    }
  }

  const buscarMorador = (termo: string) => {
    if (!termo.trim()) return moradores

    const termoBusca = termo.toLowerCase().trim()
    return moradores.filter(morador => 
      morador.nome.toLowerCase().includes(termoBusca) ||
      (morador.cpf && morador.cpf.includes(termoBusca)) ||
      (morador.bloco && morador.bloco.toLowerCase().includes(termoBusca)) ||
      morador.unidade.toLowerCase().includes(termoBusca)
    )
  }

  const loadDashboard = async (user: any, moradorId: string) => {
    try {
      const condominioId = selectedCondominiumId || localStorage.getItem('activeCondominio') || ''
      if (!condominioId) {
        console.warn('⚠️ Condominio ID não encontrado para carregar dashboard')
        return
      }

      const response = await fetch(
        `/api/financeiro-morador?master_id=${user.master_id || user.id}&condominio_id=${condominioId}&morador_id=${moradorId}&tipo_usuario=${user.tipo}&relatorio=resumo`
      )
      const data = await response.json()
      
      if (data.success) {
        const [categoriasResponse, fluxoResponse] = await Promise.all([
          fetch(`/api/financeiro-morador?master_id=${user.master_id || user.id}&condominio_id=${condominioId}&morador_id=${moradorId}&tipo_usuario=${user.tipo}&relatorio=por_categoria`),
          fetch(`/api/financeiro-morador?master_id=${user.master_id || user.id}&condominio_id=${condominioId}&morador_id=${moradorId}&tipo_usuario=${user.tipo}&relatorio=fluxo_mensal`)
        ])

        const categoriasData = await categoriasResponse.json()
        const fluxoData = await fluxoResponse.json()

        setDashboardData({
          resumo: data.resumo,
          categorias: categoriasData.success ? categoriasData.categorias : [],
          fluxo_mensal: fluxoData.success ? fluxoData.fluxo_mensal : []
        })
      }
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error)
    }
  }

  const loadFinanceiro = async (user: any, moradorId: string) => {
    try {
      setLoading(true)
      
      const condominioId = selectedCondominiumId || localStorage.getItem('activeCondominio') || ''
      if (!condominioId) {
        console.warn('⚠️ Condominio ID não encontrado para carregar financeiro')
        setLoading(false)
        return
      }
      
      const params = new URLSearchParams({
        master_id: user.master_id || user.id,
        condominio_id: condominioId,
        morador_id: moradorId,
        tipo_usuario: user.tipo,
        ...(filtros.categoria && { categoria: filtros.categoria }),
        ...(filtros.status && { status: filtros.status }),
        ...(filtros.tipo && { tipo: filtros.tipo }),
        ...(filtros.data_inicio && { data_inicio: filtros.data_inicio }),
        ...(filtros.data_fim && { data_fim: filtros.data_fim })
      })

      const response = await fetch(`/api/financeiro-morador?${params}`)
      const data = await response.json()
      
      if (data.success) {
        setFinanceiro(data.lancamentos)
      } else {
        showAlert('error', data.error || 'Erro ao carregar lançamentos')
      }
    } catch (error) {
      console.error('Erro ao carregar financeiro:', error)
      showAlert('error', 'Erro ao carregar dados financeiros')
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

  const handleCondominiumChange = async (condominioId: string) => {
    setSelectedCondominiumId(condominioId)
    // Limpar morador selecionado quando mudar de condomínio
    setSelectedMoradorId('')
    setSelectedMorador(null)
    
    if (condominioId && currentUser) {
      // Buscar configurações do condomínio
      await fetchCondominiumCompleto(condominioId)
      fetchMoradores(currentUser.master_id || currentUser.id, condominioId)
      // Buscar status dos moradores
      setTimeout(() => buscarStatusMoradores(), 1000)
    } else if (currentUser) {
      setSelectedCondominium(null)
      setMoradoresEmDia([])
      setMoradoresAtrasados([])
      fetchMoradores(currentUser.master_id || currentUser.id)
    }
  }

  const handleMoradorChange = async (moradorId: string) => {
    setSelectedMoradorId(moradorId)
    if (moradorId && currentUser) {
      await fetchMoradorCompleto(moradorId)
      loadDashboard(currentUser, moradorId)
      loadFinanceiro(currentUser, moradorId)
    }
  }

  // Nova função para ver detalhes da unidade completa (todos os moradores)
  const handleVerDetalhesUnidade = async (morador: MoradorComStatus) => {
    setSelectedMoradorId('')
    setSelectedMorador(null)
    setShowResumoGeral(false)
    
    // Definir unidade selecionada
    setUnidadeSelecionada({
      unidade: morador.unidade,
      bloco: morador.bloco,
      moradores: morador.detalhes_moradores.map(m => m.nome)
    })
    
    if (currentUser) {
      // Carregar dados financeiros de todos os moradores da unidade
      await loadDashboardUnidade(currentUser, morador.unidade, morador.bloco)
      await loadFinanceiroUnidade(currentUser, morador.unidade, morador.bloco)
    }
  }

  // Função para carregar dashboard de toda a unidade
  const loadDashboardUnidade = async (user: any, unidade: string, bloco?: string) => {
    try {
      const condominioId = selectedCondominiumId || localStorage.getItem('activeCondominio') || ''
      if (!condominioId) {
        console.warn('⚠️ Condominio ID não encontrado para carregar dashboard')
        return
      }

      // Buscar todos os moradores da unidade
      const moradoresDaUnidade = moradores.filter(m => 
        m.unidade === unidade && 
        (!bloco || m.bloco === bloco)
      )

      // Carregar dados de todos os moradores da unidade
      const dashboardPromises = moradoresDaUnidade.map(async (morador) => {
        const response = await fetch(
          `/api/financeiro-morador?master_id=${user.master_id || user.id}&condominio_id=${condominioId}&morador_id=${morador._id}&tipo_usuario=${user.tipo}&relatorio=resumo`
        )
        return response.json()
      })

      const dashboardResults = await Promise.all(dashboardPromises)
      
      // Consolidar dados de todos os moradores
      const resumoConsolidado = {
        total_receitas: dashboardResults.reduce((sum, data) => sum + (data.success ? data.resumo.total_receitas : 0), 0),
        total_despesas: dashboardResults.reduce((sum, data) => sum + (data.success ? data.resumo.total_despesas : 0), 0),
        resultado_liquido: 0,
        total_pendentes: dashboardResults.reduce((sum, data) => sum + (data.success ? data.resumo.total_pendentes : 0), 0),
        total_atrasados: dashboardResults.reduce((sum, data) => sum + (data.success ? data.resumo.total_atrasados : 0), 0),
        count_pendentes: dashboardResults.reduce((sum, data) => sum + (data.success ? data.resumo.count_pendentes : 0), 0),
        count_atrasados: dashboardResults.reduce((sum, data) => sum + (data.success ? data.resumo.count_atrasados : 0), 0)
      }
      
      resumoConsolidado.resultado_liquido = resumoConsolidado.total_receitas - resumoConsolidado.total_despesas

      setDashboardData({
        resumo: resumoConsolidado,
        categorias: [],
        fluxo_mensal: []
      })
    } catch (error) {
      console.error('Erro ao carregar dashboard da unidade:', error)
    }
  }

  // Função para carregar financeiro de toda a unidade
  const loadFinanceiroUnidade = async (user: any, unidade: string, bloco?: string) => {
    try {
      setLoading(true)
      
      const condominioId = selectedCondominiumId || localStorage.getItem('activeCondominio') || ''
      if (!condominioId) {
        console.warn('⚠️ Condominio ID não encontrado para carregar financeiro')
        setLoading(false)
        return
      }
      
      // Buscar todos os moradores da unidade
      const moradoresDaUnidade = moradores.filter(m => 
        m.unidade === unidade && 
        (!bloco || m.bloco === bloco)
      )

      // Carregar dados financeiros de todos os moradores
      const financeiroPromises = moradoresDaUnidade.map(async (morador) => {
        const params = new URLSearchParams({
          master_id: user.master_id || user.id,
          condominio_id: condominioId,
          morador_id: morador._id,
          tipo_usuario: user.tipo,
          ...(filtros.categoria && { categoria: filtros.categoria }),
          ...(filtros.status && { status: filtros.status }),
          ...(filtros.tipo && { tipo: filtros.tipo }),
          ...(filtros.data_inicio && { data_inicio: filtros.data_inicio }),
          ...(filtros.data_fim && { data_fim: filtros.data_fim })
        })

        const response = await fetch(`/api/financeiro-morador?${params}`)
        return response.json()
      })

      const financeiroResults = await Promise.all(financeiroPromises)
      
      // Consolidar todos os lançamentos
      const todosLancamentos = financeiroResults
        .filter(data => data.success)
        .flatMap(data => data.lancamentos || [])
        .sort((a, b) => new Date(b.data_vencimento).getTime() - new Date(a.data_vencimento).getTime())

      setFinanceiro(todosLancamentos)
    } catch (error) {
      console.error('Erro ao carregar financeiro da unidade:', error)
    } finally {
      setLoading(false)
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
    const cat = CATEGORIAS_MORADOR.find(c => c.value === categoria)
    return cat ? cat.label : categoria
  }

  const clearFilters = () => {
    setFiltros({
      categoria: '',
      status: '',
      data_inicio: '',
      data_fim: '',
      tipo: ''
    })
  }

  useEffect(() => {
    if (currentUser && selectedMoradorId) {
      loadFinanceiro(currentUser, selectedMoradorId)
    }
  }, [filtros])

  useEffect(() => {
    if (currentUser?.tipo === 'master') {
      if (!selectedMoradorId) {
        setShowResumoGeral(true);
      } else {
        setShowResumoGeral(false);
      }
    } else {
      setShowResumoGeral(false);
    }
  }, [currentUser, selectedMoradorId]);

  // UseEffect para carregar status dos moradores quando tudo estiver pronto
  useEffect(() => {
    if (currentUser && selectedCondominiumId && currentUser.tipo !== 'morador') {
      buscarStatusMoradores()
    }
  }, [currentUser, selectedCondominiumId])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    
    // Auto-preenchimento baseado na categoria selecionada
    if (name === 'categoria' && selectedCondominium) {
      const newFormData = {
        ...formData,
        [name]: value
      }

      if (value === 'taxa_condominio') {
        // Preencher automaticamente para taxa de condomínio
        const hoje = new Date()
        const diaVencimento = selectedCondominium.dia_vencimento || 10
        const dataVencimento = new Date(hoje.getFullYear(), hoje.getMonth(), diaVencimento)
        
        // Se já passou do dia de vencimento deste mês, usar próximo mês
        if (dataVencimento < hoje) {
          dataVencimento.setMonth(dataVencimento.getMonth() + 1)
        }

        newFormData.valor = selectedCondominium.valor_taxa_condominio ? 
          selectedCondominium.valor_taxa_condominio.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          }) : ''
        newFormData.data_vencimento = dataVencimento.toISOString().split('T')[0]
        newFormData.descricao = `Taxa de condomínio - ${dataVencimento.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`
        newFormData.recorrente = true
        newFormData.periodicidade = 'mensal'
      }

      setFormData(newFormData)
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!currentUser || !selectedMoradorId) {
      showAlert('error', 'Dados do usuário ou morador não encontrados')
      return
    }

    setLoading(true)

    try {
      const condominioId = selectedCondominiumId || localStorage.getItem('activeCondominio') || ''
      if (!condominioId) {
        showAlert('error', 'Condomínio não selecionado')
        setLoading(false)
        return
      }

      // Converter valor para número
      const valorNumerico = parseFloat(formData.valor.replace(/\./g, '').replace(',', '.'))
      
      const dataToSend = {
        ...formData,
        tipo: 'despesa', // Sempre despesa para moradores
        valor: valorNumerico,
        morador_id: selectedMoradorId,
        condominio_id: condominioId,
        master_id: currentUser.master_id || currentUser.id,
        tipo_usuario: currentUser.tipo,
        usuario_id: currentUser.id,
        criado_por_nome: currentUser.nome || currentUser.email
      }

      const url = editingItem ? `/api/financeiro-morador/${editingItem._id}` : '/api/financeiro-morador'
      const method = editingItem ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend)
      })

      const data = await response.json()

      if (data.success) {
        showAlert('success', editingItem ? 'Lançamento atualizado com sucesso!' : 'Lançamento criado com sucesso!')
        handleCloseModal()
        if (currentUser && selectedMoradorId) {
          loadFinanceiro(currentUser, selectedMoradorId)
          loadDashboard(currentUser, selectedMoradorId)
        }
      } else {
        showAlert('error', data.error || 'Erro ao salvar lançamento')
      }
    } catch (error) {
      console.error('Erro ao salvar lançamento:', error)
      showAlert('error', 'Erro interno do servidor')
    } finally {
      setLoading(false)
    }
  }

  const handleGeracaoAutomatica = async () => {
    if (!selectedCondominium || !currentUser) {
      showAlert('error', 'Dados do condomínio ou usuário não encontrados')
      return
    }

    const confirmacao = window.confirm(
      `Confirma a geração automática de taxas condominiais para ${moradores.length} moradores?\n\n` +
      `Valor: ${formatCurrencyDisplay(selectedCondominium.valor_taxa_condominio || 0)}\n` +
      `Vencimento: Dia ${selectedCondominium.dia_vencimento || 10}\n\n` +
      `O sistema evitará duplicações verificando lançamentos existentes.`
    )

    if (!confirmacao) return

    setLoading(true)

    try {
      const response = await fetch('/api/financeiro-morador/gerar-automatico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          condominio_id: selectedCondominiumId,
          master_id: currentUser.master_id || currentUser.id,
          tipo_usuario: currentUser.tipo,
          usuario_id: currentUser.id,
          criado_por_nome: currentUser.nome || currentUser.email
        })
      })

      const data = await response.json()

      if (data.success) {
        showAlert('success', `✅ Geração automática concluída! ${data.created} lançamentos criados, ${data.skipped} já existiam.`)
        if (selectedMoradorId) {
          loadFinanceiro(currentUser, selectedMoradorId)
          loadDashboard(currentUser, selectedMoradorId)
        }
      } else {
        showAlert('error', data.error || 'Erro na geração automática')
      }
    } catch (error) {
      console.error('Erro na geração automática:', error)
      showAlert('error', 'Erro interno do servidor')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (item: FinanceiroMorador) => {
    setEditingItem(item)
    setFormData({
      tipo: item.tipo,
      categoria: item.categoria,
      descricao: item.descricao,
      valor: item.valor.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }),
      data_vencimento: new Date(item.data_vencimento).toISOString().split('T')[0],
      data_pagamento: item.data_pagamento ? new Date(item.data_pagamento).toISOString().split('T')[0] : '',
      status: item.status,
      observacoes: item.observacoes || '',
      recorrente: item.recorrente,
      periodicidade: item.periodicidade || ''
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Confirma a exclusão deste lançamento?')) return

    try {
      const response = await fetch(`/api/financeiro-morador?id=${id}&tipo_usuario=${currentUser?.tipo}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        showAlert('success', 'Lançamento excluído com sucesso!')
        if (currentUser && selectedMoradorId) {
          loadFinanceiro(currentUser, selectedMoradorId)
          loadDashboard(currentUser, selectedMoradorId)
        }
      } else {
        showAlert('error', data.error || 'Erro ao excluir lançamento')
      }
    } catch (error) {
      console.error('Erro ao excluir:', error)
      showAlert('error', 'Erro interno do servidor')
    }
  }

  const handleMarcarPago = async (id: string) => {
    try {
      const response = await fetch('/api/financeiro-morador', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _id: id,
          status: 'pago',
          data_pagamento: new Date().toISOString(),
          tipo_usuario: currentUser?.tipo
        })
      })

      const data = await response.json()

      if (data.success) {
        showAlert('success', 'Lançamento marcado como pago!')
        if (currentUser && selectedMoradorId) {
          loadFinanceiro(currentUser, selectedMoradorId)
          loadDashboard(currentUser, selectedMoradorId)
        }
      } else {
        showAlert('error', data.error || 'Erro ao marcar como pago')
      }
    } catch (error) {
      console.error('Erro ao marcar como pago:', error)
      showAlert('error', 'Erro interno do servidor')
    }
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingItem(null)
    setFormData({
      tipo: 'despesa',
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
                <h2 className="mb-1">🏠 Gestão Financeira de Moradores</h2>
                <p className="text-muted mb-0">Controle financeiro de taxas condominiais, multas e pagamentos de moradores</p>
              </div>
              <div className="d-flex gap-2">
                <Button 
                  variant={showResumoGeral ? "secondary" : "outline-primary"}
                  onClick={() => setShowResumoGeral(!showResumoGeral)}
                  disabled={!selectedCondominiumId}
                >
                  <i className={`fas ${showResumoGeral ? 'fa-user' : 'fa-users'} me-2`}></i>
                  {showResumoGeral ? 'Visão Individual' : 'Resumo Geral'}
                </Button>
                <Button 
                  variant="primary" 
                  size="lg"
                  onClick={() => setShowModal(true)}
                  disabled={!selectedMoradorId || showResumoGeral}
                >
                  <i className="fas fa-plus me-2"></i>
                  Novo Lançamento
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
                              "Selecione o condomínio para visualizar seus moradores"
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
                    <h5 className="mb-0">👤 Seleção de Morador</h5>
                    <Button 
                      variant="outline-primary" 
                      size="sm"
                      onClick={() => setShowBuscaModal(true)}
                      disabled={!selectedCondominiumId}
                    >
                      <i className="fas fa-search me-2"></i>
                      Buscar Morador
                    </Button>
                  </Card.Header>
                  <Card.Body>
                    <Row>
                      <Col md={6}>
                        <Form.Group>
                          <Form.Label>Selecionar Morador *</Form.Label>
                          <Form.Select
                            value={selectedMoradorId}
                            onChange={(e) => handleMoradorChange(e.target.value)}
                          >
                            <option value="">Selecione um morador</option>
                            {moradores.map((mor) => (
                              <option key={mor._id} value={mor._id}>
                                {mor.nome} - {mor.tipo} - {mor.bloco && `${mor.bloco} `}{mor.unidade}
                              </option>
                            ))}
                          </Form.Select>
                          <Form.Text className="text-muted">
                            {selectedCondominiumId && (
                              <div className="mb-1">
                                <span className="text-primary">
                                  🏢 Filtrando por condomínio ativo - {moradores.length} morador(es) encontrado(s)
                                </span>
                              </div>
                            )}
                            {selectedMoradorId ? (
                              localStorage.getItem('activeMorador') === selectedMoradorId ? (
                                <span className="text-success">
                                  ✅ Morador ativo selecionado automaticamente
                                </span>
                              ) : (
                                <span className="text-info">
                                  📋 Morador selecionado manualmente
                                </span>
                              )
                            ) : (
                              <span className="text-warning">
                                ⚠️ Selecione um morador para ver os dados financeiros
                              </span>
                            )}
                          </Form.Text>
                          {/* Mostra o CPF do morador selecionado */}
                          {selectedMoradorId && (
                            <div className="mt-2">
                              <small className="text-muted">
                                <strong>CPF:</strong>{" "}
                                {moradores.find(mor => mor._id === selectedMoradorId)?.cpf ?? 'Não informado'}
                              </small>
                            </div>
                          )}
                        </Form.Group>
                      </Col>
                      <Col md={6} className="d-flex align-items-end">
                        <div className="w-100">
                          <small className="text-muted">
                            <strong>Total de lançamentos:</strong> {financeiro.length}
                          </small>
                          {localStorage.getItem('activeMorador') && (
                            <div className="mt-1">
                              <small className="text-success">
                                👤 <strong>Morador Ativo:</strong> {localStorage.getItem('activeMoradorName') || 'Carregando...'}
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
            <p className="mb-0">Escolha o condomínio para visualizar os dados financeiros dos moradores</p>
          </Alert>
        ) : null}

        {(selectedMoradorId || unidadeSelecionada) && dashboardData && !showResumoGeral && (
          <>
            {/* Indicação visual do tipo de visualização */}
            {unidadeSelecionada && (
              <Alert variant="info" className="mb-3">
                <div className="d-flex align-items-center">
                  <i className="fas fa-building me-2"></i>
                  <div>
                    <strong>🏠 Visualização de Unidade Completa</strong>
                    <br />
                    <small>
                      Exibindo dados consolidados de todos os moradores da unidade {unidadeSelecionada.bloco ? `${unidadeSelecionada.bloco} - ` : ''}{unidadeSelecionada.unidade}
                      <br />
                      Moradores incluídos: {unidadeSelecionada.moradores.join(', ')}
                    </small>
                  </div>
                  <Button 
                    variant="outline-secondary" 
                    size="sm" 
                    className="ms-auto"
                    onClick={() => {
                      setUnidadeSelecionada(null)
                      setShowResumoGeral(true)
                    }}
                  >
                    Voltar ao Resumo
                  </Button>
                </div>
              </Alert>
            )}

            {selectedMorador && !unidadeSelecionada && (
              <Alert variant="primary" className="mb-3">
                <div className="d-flex align-items-center">
                  <i className="fas fa-user me-2"></i>
                  <div>
                    <strong>👤 Visualização Individual</strong>
                    <br />
                    <small>Exibindo dados específicos do morador: {selectedMorador.nome}</small>
                  </div>
                  <Button 
                    variant="outline-secondary" 
                    size="sm" 
                    className="ms-auto"
                    onClick={() => {
                      setSelectedMoradorId('')
                      setSelectedMorador(null)
                      setShowResumoGeral(true)
                    }}
                  >
                    Voltar ao Resumo
                  </Button>
                </div>
              </Alert>
            )}

            {/* Dashboard Cards */}
            <Row className="mb-4">
              <Col md={2}>
                <Card className="border-primary">
                  <Card.Body className="text-center">
                    <div className="text-primary display-6 mb-2">💰</div>
                    <h6 className="text-muted">Total Receitas</h6>
                    <h4 className="text-success">{formatCurrencyDisplay(dashboardData.resumo.total_receitas)}</h4>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={2}>
                <Card className="border-danger">
                  <Card.Body className="text-center">
                    <div className="text-danger display-6 mb-2">💸</div>
                    <h6 className="text-muted">Total Despesas</h6>
                    <h4 className="text-danger">{formatCurrencyDisplay(dashboardData.resumo.total_despesas)}</h4>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={2}>
                <Card className="border-warning">
                  <Card.Body className="text-center">
                    <div className="text-warning display-6 mb-2">⏳</div>
                    <h6 className="text-muted">Pendentes</h6>
                    <h4 className="text-warning">{formatCurrencyDisplay(dashboardData.resumo.total_pendentes)}</h4>
                    <small className="text-muted">{dashboardData.resumo.count_pendentes} lançamento(s)</small>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={2}>
                <Card className="border-danger">
                  <Card.Body className="text-center">
                    <div className="text-danger display-6 mb-2">⚠️</div>
                    <h6 className="text-muted">Atrasados</h6>
                    <h4 className="text-danger">{formatCurrencyDisplay(dashboardData.resumo.total_atrasados)}</h4>
                    <small className="text-muted">{dashboardData.resumo.count_atrasados} lançamento(s)</small>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {/* Gráficos */}
            <Row className="mb-4 justify-content-center">
              <Col md={3}>
                <Card>
                  <Card.Header>
                    <h6 className="mb-0">📊 Lançamentos por Categoria</h6>
                  </Card.Header>
                  <Card.Body>
                    {dashboardData.categorias.length > 0 ? (
                      <Doughnut
                        data={{
                          labels: dashboardData.categorias.map(cat => getCategoriaLabel(cat._id)),
                          datasets: [{
                            data: dashboardData.categorias.map(cat => cat.total_valor),
                            backgroundColor: [
                              '#FF6384',
                              '#36A2EB',
                              '#FFCE56',
                              '#4BC0C0',
                              '#9966FF',
                              '#FF9F40'
                            ]
                          }]
                        }}
                        options={{
                          responsive: true,
                          plugins: {
                            legend: {
                              position: 'bottom'
                            }
                          }
                        }}
                      />
                    ) : (
                      <div className="text-center text-muted py-4">
                        <p>Nenhum lançamento encontrado</p>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card>
                  <Card.Header>
                    <h6 className="mb-0">📈 Fluxo Mensal</h6>
                  </Card.Header>
                  <Card.Body>
                    {dashboardData.fluxo_mensal.length > 0 ? (
                      <Line
                        data={{
                          labels: dashboardData.fluxo_mensal.map(item => `${item._id.mes}/${item._id.ano}`),
                          datasets: [
                            {
                              label: 'Receitas',
                              data: dashboardData.fluxo_mensal.map(item => item.receitas),
                              borderColor: '#28a745',
                              backgroundColor: 'rgba(40, 167, 69, 0.1)',
                              tension: 0.1
                            },
                            {
                              label: 'Despesas',
                              data: dashboardData.fluxo_mensal.map(item => item.despesas),
                              borderColor: '#dc3545',
                              backgroundColor: 'rgba(220, 53, 69, 0.1)',
                              tension: 0.1
                            }
                          ]
                        }}
                        options={{
                          responsive: true,
                          plugins: {
                            legend: {
                              position: 'bottom'
                            }
                          },
                          scales: {
                            y: {
                              beginAtZero: true
                            }
                          }
                        }}
                      />
                    ) : (
                      <div className="text-center text-muted py-4">
                        <p>Nenhum dado de fluxo encontrado</p>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {/* Controles de Geração Automática */}
            {currentUser?.tipo !== 'morador' && selectedCondominium && (
              <Row className="mb-4">
                <Col>
                  <Card className="border-info">
                    <Card.Header className="bg-info text-white">
                      <h6 className="mb-0">🤖 Geração Automática de Taxas Condominiais</h6>
                    </Card.Header>
                    <Card.Body>
                      <Row>
                        <Col md={8}>
                          <p className="mb-2">
                            <strong>Taxa Mensal:</strong> {formatCurrencyDisplay(selectedCondominium.valor_taxa_condominio || 0)}<br/>
                            <strong>Vencimento:</strong> Dia {selectedCondominium.dia_vencimento || 10} de cada mês<br/>
                            <strong>Total de Moradores:</strong> {moradores.length}
                          </p>
                          <Alert variant="warning" className="mb-0">
                            <small>
                              <strong>⚠️ Atenção:</strong> A geração automática criará lançamentos para todos os moradores do condomínio.
                              O sistema evita duplicações verificando se já existe lançamento para o mês/ano.
                            </small>
                          </Alert>
                        </Col>
                        <Col md={4} className="text-end">
                          <Button
                            variant="info"
                            size="lg"
                            onClick={handleGeracaoAutomatica}
                            disabled={loading || !selectedCondominium.valor_taxa_condominio}
                          >
                            {loading ? (
                              <>
                                <span className="spinner-border spinner-border-sm me-2"></span>
                                Processando...
                              </>
                            ) : (
                              <>
                                <i className="fas fa-magic me-2"></i>
                                Gerar Taxas do Mês
                              </>
                            )}
                          </Button>
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            )}

            {/* Tabela de Lançamentos */}
            <Row>
              <Col>
                <Card>
                  <Card.Header className="d-flex justify-content-between align-items-center">
                    <h6 className="mb-0">📋 Lançamentos Financeiros</h6>
                    <div>
                      <Button variant="outline-secondary" size="sm" className="me-2" onClick={clearFilters}>
                        Limpar Filtros
                      </Button>
                      <Button 
                        variant="success" 
                        size="sm"
                        onClick={() => setShowModal(true)}
                        disabled={!selectedMoradorId}
                      >
                        <i className="fas fa-plus me-1"></i>
                        Lançamento Manual
                      </Button>
                    </div>
                  </Card.Header>
                  <Card.Body>
                    {/* Filtros */}
                    <Row className="mb-3">
                      <Col md={2}>
                        <Form.Select
                          value={filtros.categoria}
                          onChange={(e) => setFiltros({...filtros, categoria: e.target.value})}
                          size="sm"
                        >
                          <option value="">Todas as categorias</option>
                          {CATEGORIAS_MORADOR.map(cat => (
                            <option key={cat.value} value={cat.value}>{cat.label}</option>
                          ))}
                        </Form.Select>
                      </Col>
                      <Col md={2}>
                        <Form.Select
                          value={filtros.status}
                          onChange={(e) => setFiltros({...filtros, status: e.target.value})}
                          size="sm"
                        >
                          <option value="">Todos os status</option>
                          <option value="pendente">Pendente</option>
                          <option value="pago">Pago</option>
                          <option value="atrasado">Atrasado</option>
                          <option value="cancelado">Cancelado</option>
                        </Form.Select>
                      </Col>
                      <Col md={3}>
                        <Form.Group controlId="filtroDataInicio">
                          <Form.Label>Data Início</Form.Label>
                          <Form.Control
                            type="date"
                            value={filtros.data_inicio}
                            onChange={(e) => setFiltros({...filtros, data_inicio: e.target.value})}
                            size="sm"
                          />
                        </Form.Group>
                      </Col>
                      <Col md={3}>
                        <Form.Group controlId="filtroDataFim">
                          <Form.Label>Data Fim</Form.Label>
                          <Form.Control
                            type="date"
                            value={filtros.data_fim}
                            onChange={(e) => setFiltros({...filtros, data_fim: e.target.value})}
                            size="sm"
                          />
                        </Form.Group>
                      </Col>
                      <Col md={2}>
                        <small className="text-muted">
                          {financeiro.length} lançamento(s)
                        </small>
                      </Col>
                    </Row>

                    {/* Tabela */}
                    <div className="table-responsive">
                      <Table striped hover>
                        <thead>
                          <tr>
                            <th>Data Venc.</th>
                            <th>Categoria</th>
                            <th>Descrição</th>
                            <th>Valor</th>
                            <th>Status</th>
                            <th>Data Pgto.</th>
                            <th>Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loading ? (
                            <tr>
                              <td colSpan={7} className="text-center py-4">
                                <span className="spinner-border spinner-border-sm me-2"></span>
                                Carregando lançamentos...
                              </td>
                            </tr>
                          ) : financeiro.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="text-center text-muted py-4">
                                Nenhum lançamento encontrado
                              </td>
                            </tr>
                          ) : (
                            financeiro.map((item) => (
                              <tr key={item._id}>
                                <td>
                                  <small>{new Date(item.data_vencimento).toLocaleDateString('pt-BR')}</small>
                                </td>
                                <td>
                                  <small>{getCategoriaLabel(item.categoria)}</small>
                                </td>
                                <td>
                                  <small className="text-truncate" style={{maxWidth: '200px', display: 'block'}}>
                                    {item.descricao}
                                  </small>
                                </td>
                                <td>
                                  <strong>{formatCurrencyDisplay(item.valor)}</strong>
                                </td>
                                <td>{getStatusBadge(item.status)}</td>
                                <td>
                                  <small>
                                    {item.data_pagamento ? 
                                      new Date(item.data_pagamento).toLocaleDateString('pt-BR') : 
                                      '-'
                                    }
                                  </small>
                                </td>
                                <td>
                                  <Button variant="outline-primary" size="sm" onClick={() => handleEdit(item)} className="me-2">
                                    <i className="fas fa-edit me-2"></i>Editar
                                  </Button>
                                  <Button variant="outline-danger" size="sm" onClick={() => handleDelete(item._id)}>
                                    <i className="fas fa-trash me-2"></i>Excluir
                                  </Button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </Table>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </>
        )}

        {/* Resumo Geral dos Moradores */}
        {showResumoGeral && selectedCondominiumId && (
          <>
            <Row className="mb-4">
              <Col>
                <Card>
                  <Card.Header className="d-flex justify-content-between align-items-center">
                    <h5 className="mb-0">📊 Resumo Geral dos Moradores</h5>
                    <div className="d-flex gap-2">
                      <Button 
                        variant={filtroStatus === 'todos' ? 'primary' : 'outline-primary'}
                        size="sm"
                        onClick={() => setFiltroStatus('todos')}
                      >
                        Todos ({moradoresEmDia.length + moradoresAtrasados.length})
                      </Button>
                      <Button 
                        variant={filtroStatus === 'em_dia' ? 'success' : 'outline-success'}
                        size="sm"
                        onClick={() => setFiltroStatus('em_dia')}
                      >
                        Em Dia ({moradoresEmDia.length})
                      </Button>
                      <Button 
                        variant={filtroStatus === 'atrasados' ? 'danger' : 'outline-danger'}
                        size="sm"
                        onClick={() => setFiltroStatus('atrasados')}
                      >
                        Atrasados ({moradoresAtrasados.length})
                      </Button>
                    </div>
                  </Card.Header>
                  <Card.Body>
                    <Row className="mb-3">
                      <Col md={4}>
                        <Form.Group>
                          <Form.Label>Filtrar por Tipo</Form.Label>
                          <Form.Select
                            value={filtroTipo}
                            onChange={(e) => setFiltroTipo(e.target.value as 'todos' | 'proprietario' | 'inquilino' | 'dependente')}
                            size="sm"
                          >
                            <option value="todos">Todos os Tipos</option>
                            <option value="proprietario">Proprietário</option>
                            <option value="inquilino">Inquilino</option>
                            <option value="dependente">Dependente</option>
                          </Form.Select>
                        </Form.Group>
                      </Col>
                    </Row>
                    <Row>
                      <Col md={4}>
                        <Card className="border-success text-center">
                          <Card.Body>
                            <h3 className="text-success">{moradoresEmDia.length}</h3>
                            <p className="mb-0">Moradores em Dia</p>
                          </Card.Body>
                        </Card>
                      </Col>
                      <Col md={4}>
                        <Card className="border-danger text-center">
                          <Card.Body>
                            <h3 className="text-danger">{moradoresAtrasados.length}</h3>
                            <p className="mb-0">Moradores Atrasados</p>
                          </Card.Body>
                        </Card>
                      </Col>
                      <Col md={4}>
                        <Card className="border-warning text-center">
                          <Card.Body>
                            <h3 className="text-warning">
                              {formatCurrencyDisplay(
                                moradoresAtrasados.reduce((sum, m) => sum + (m.total_atrasado || 0), 0)
                              )}
                            </h3>
                            <p className="mb-0">Total em Atraso</p>
                          </Card.Body>
                        </Card>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {/* Lista de Moradores Filtrada */}
            <Row>
              <Col>
                <Card>
                  <Card.Header>
                    <h6 className="mb-0">👥 Lista de Moradores - {selectedCondominium?.nome}</h6>
                  </Card.Header>
                  <Card.Body>
                    <div className="table-responsive">
                      <Table striped hover>
                        <thead>
                          <tr>
                            <th>Nome</th>
                            <th>Unidade</th>
                            <th>Tipo</th>
                            <th>Pendente</th>
                            <th>Atrasado</th>
                            <th>Pago</th>
                            <th>Cancelado</th>
                            <th>Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(filtroStatus === 'todos' || filtroStatus === 'em_dia' ? moradoresEmDia : []).filter(m => 
                            filtroTipo === 'todos' || 
                            m.tipo === filtroTipo ||
                            (m.tipos_na_unidade && m.tipos_na_unidade.includes(filtroTipo))
                          ).map((morador) => (
                            <tr key={morador._id}>
                              <td><strong>{morador.nome}</strong></td>
                              <td>{morador.bloco && `${morador.bloco} - `}{morador.unidade}</td>
                              <td>
                                <Badge bg={morador.tipo === 'proprietario' ? 'primary' : morador.tipo === 'inquilino' ? 'info' : 'secondary'}>
                                  {morador.tipo}
                                </Badge>
                              </td>
                              <td>
                                {morador.count_pendente > 0 ? (
                                  <span className="text-warning">
                                    {formatCurrencyDisplay(morador.total_pendente)} ({morador.count_pendente})
                                  </span>
                                ) : '-'}
                              </td>
                              <td>
                                {morador.count_atrasado > 0 ? (
                                  <span className="text-danger">
                                    {formatCurrencyDisplay(morador.total_atrasado)} ({morador.count_atrasado})
                                  </span>
                                ) : '-'}
                              </td>
                              <td>
                                {morador.count_pago > 0 ? (
                                  <span className="text-success">
                                    {formatCurrencyDisplay(morador.total_pago)} ({morador.count_pago})
                                  </span>
                                ) : '-'}
                              </td>
                              <td>
                                {morador.count_cancelado > 0 ? (
                                  <span className="text-secondary">
                                    {formatCurrencyDisplay(morador.total_cancelado)} ({morador.count_cancelado})
                                  </span>
                                ) : '-'}
                              </td>
                              <td>
                                <Button
                                  variant="outline-primary"
                                  size="sm"
                                  onClick={() => handleVerDetalhesUnidade(morador)}
                                >
                                  Ver Detalhes
                                </Button>
                              </td>
                            </tr>
                          ))}
                          {(filtroStatus === 'todos' || filtroStatus === 'atrasados' ? moradoresAtrasados : []).filter(m => 
                            filtroTipo === 'todos' || 
                            m.tipo === filtroTipo ||
                            (m.tipos_na_unidade && m.tipos_na_unidade.includes(filtroTipo))
                          ).map((morador) => (
                            <tr key={morador._id}>
                              <td><strong>{morador.nome}</strong></td>
                              <td>{morador.bloco && `${morador.bloco} - `}{morador.unidade}</td>
                              <td>
                                <Badge bg={morador.tipo === 'proprietario' ? 'primary' : morador.tipo === 'inquilino' ? 'info' : 'secondary'}>
                                  {morador.tipo}
                                </Badge>
                              </td>
                              <td>
                                {morador.count_pendente > 0 ? (
                                  <span className="text-warning">
                                    {formatCurrencyDisplay(morador.total_pendente)} ({morador.count_pendente})
                                  </span>
                                ) : '-'}
                              </td>
                              <td>
                                {morador.count_atrasado > 0 ? (
                                  <span className="text-danger">
                                    {formatCurrencyDisplay(morador.total_atrasado)} ({morador.count_atrasado})
                                  </span>
                                ) : '-'}
                              </td>
                              <td>
                                {morador.count_pago > 0 ? (
                                  <span className="text-success">
                                    {formatCurrencyDisplay(morador.total_pago)} ({morador.count_pago})
                                  </span>
                                ) : '-'}
                              </td>
                              <td>
                                {morador.count_cancelado > 0 ? (
                                  <span className="text-secondary">
                                    {formatCurrencyDisplay(morador.total_cancelado)} ({morador.count_cancelado})
                                  </span>
                                ) : '-'}
                              </td>
                              <td>
                                <div className="d-flex gap-1">
                                  <Button
                                    variant="outline-primary"
                                    size="sm"
                                    onClick={() => handleVerDetalhesUnidade(morador)}
                                  >
                                    Ver Detalhes
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </>
        )}

        

        {/* Modal para Novo/Editar Lançamento */}
        <Modal show={showModal} onHide={handleCloseModal} size="lg">
          <Modal.Header closeButton>
            <Modal.Title>
              {editingItem ? 'Editar Lançamento' : 'Novo Lançamento'}
            </Modal.Title>
          </Modal.Header>
          <Form onSubmit={handleSubmit}>
            <Modal.Body>
              {selectedMorador && (
                <Alert variant="info" className="mb-3">
                  <strong>👤 Morador:</strong> {selectedMorador.nome}<br/>
                  <strong>🏠 Unidade:</strong> {selectedMorador.bloco ? `${selectedMorador.bloco} - ` : ''}{selectedMorador.unidade}<br/>
                  <strong>📧 Email:</strong> {selectedMorador.email || 'Não informado'}
                </Alert>
              )}

              {selectedCondominium && (
                <Alert variant="success" className="mb-3">
                  <h6 className="mb-2">💰 Configurações de Pagamento - {selectedCondominium.nome}</h6>
                  <Row>
                    <Col md={4}>
                      <small>
                        <strong>Taxa Mensal:</strong><br/>
                        R$ {selectedCondominium.valor_taxa_condominio?.toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        }) || '0,00'}
                      </small>
                    </Col>
                    <Col md={4}>
                      <small>
                        <strong>Vencimento:</strong><br/>
                        Dia {selectedCondominium.dia_vencimento || 10}
                      </small>
                    </Col>
                    <Col md={4}>
                      <small>
                        <strong>Multa:</strong> {selectedCondominium.multa_atraso || 2}%<br/>
                        <strong>Juros:</strong> {selectedCondominium.juros_mes || 1}% a.m.
                      </small>
                    </Col>
                  </Row>
                </Alert>
              )}

              <Row>
                <Col md={12}>
                  <Form.Group className="mb-3">
                    <Form.Label>Categoria *</Form.Label>
                    <Form.Select
                      name="categoria"
                      value={formData.categoria}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="">Selecione a categoria</option>
                      {CATEGORIAS_MORADOR.map((cat) => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
                      ))}
                    </Form.Select>
                    {formData.categoria === 'taxa_condominio' && selectedCondominium?.valor_taxa_condominio && (
                      <Form.Text className="text-success">
                        ✅ Dados preenchidos automaticamente com as configurações do condomínio
                      </Form.Text>
                    )}
                    {formData.categoria === 'multa_atraso' && (
                      <Form.Text className="text-warning">
                        ⚠️ Para multas, preencha manualmente o valor e motivo
                      </Form.Text>
                    )}
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={12}>
                  <Form.Group className="mb-3">
                    <Form.Label>Descrição *</Form.Label>
                    <Form.Control
                      type="text"
                      name="descricao"
                      value={formData.descricao}
                      onChange={handleInputChange}
                      placeholder="Ex: Taxa de condomínio referente ao mês 01/2024"
                      required
                      maxLength={200}
                    />
                    <Form.Text className="text-muted">
                      Máximo 200 caracteres
                    </Form.Text>
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Valor *</Form.Label>
                    <Form.Control
                      type="text"
                      name="valor"
                      value={formData.valor}
                      onChange={handleValueChange}
                      placeholder="0,00"
                      required
                      className={formData.categoria === 'taxa_condominio' && selectedCondominium?.valor_taxa_condominio ? 'border-success' : ''}
                    />
                    {formData.categoria === 'taxa_condominio' && selectedCondominium?.valor_taxa_condominio && (
                      <Form.Text className="text-success">
                        ✅ Valor preenchido automaticamente
                      </Form.Text>
                    )}
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Data de Vencimento *</Form.Label>
                    <Form.Control
                      type="date"
                      name="data_vencimento"
                      value={formData.data_vencimento}
                      onChange={handleInputChange}
                      required
                      className={formData.categoria === 'taxa_condominio' && selectedCondominium?.dia_vencimento ? 'border-success' : ''}
                    />
                    {formData.categoria === 'taxa_condominio' && selectedCondominium?.dia_vencimento && (
                      <Form.Text className="text-success">
                        ✅ Data baseada no dia de vencimento configurado (dia {selectedCondominium.dia_vencimento})
                      </Form.Text>
                    )}
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Status *</Form.Label>
                    <Form.Select
                      name="status"
                      value={formData.status}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="pendente">⏳ Pendente</option>
                      <option value="pago">✅ Pago</option>
                      <option value="atrasado">⚠️ Atrasado</option>
                      <option value="cancelado">❌ Cancelado</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>

              {formData.status === 'pago' && (
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Data de Pagamento</Form.Label>
                      <Form.Control
                        type="date"
                        name="data_pagamento"
                        value={formData.data_pagamento}
                        onChange={handleInputChange}
                      />
                      <Form.Text className="text-muted">
                        Deixe em branco para usar a data atual
                      </Form.Text>
                    </Form.Group>
                  </Col>
                </Row>
              )}

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Check
                      type="checkbox"
                      id="recorrente"
                      label="🔄 Lançamento Recorrente"
                      checked={formData.recorrente}
                      onChange={(e) => setFormData({...formData, recorrente: e.target.checked})}
                    />
                  </Form.Group>
                </Col>
                {formData.recorrente && (
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Periodicidade</Form.Label>
                      <Form.Select
                        name="periodicidade"
                        value={formData.periodicidade}
                        onChange={handleInputChange}
                        required={formData.recorrente}
                      >
                        <option value="">Selecione</option>
                        <option value="mensal">Mensal</option>
                        <option value="bimestral">Bimestral</option>
                        <option value="trimestral">Trimestral</option>
                        <option value="semestral">Semestral</option>
                        <option value="anual">Anual</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                )}
              </Row>

              <Row>
                <Col md={12}>
                  <Form.Group className="mb-3">
                    <Form.Label>Observações</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      name="observacoes"
                      value={formData.observacoes}
                      onChange={handleInputChange}
                      placeholder="Observações adicionais sobre este lançamento..."
                      maxLength={500}
                    />
                    <Form.Text className="text-muted">
                      Máximo 500 caracteres
                    </Form.Text>
                  </Form.Group>
                </Col>
              </Row>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={handleCloseModal}>
                Cancelar
              </Button>
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? 'Salvando...' : (editingItem ? 'Atualizar' : 'Salvar')}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>

        {/* Modal de Busca de Moradores */}
        <Modal show={showBuscaModal} onHide={() => setShowBuscaModal(false)} size="xl">
          <Modal.Header closeButton>
            <Modal.Title>🔍 Buscar Morador</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {/* Campo de Busca */}
            <Row className="mb-4">
              <Col md={8}>
                <Form.Group>
                  <Form.Label>Buscar por Nome, CPF, Bloco ou Apartamento</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Digite o nome, CPF, bloco ou apartamento..."
                    value={buscaMorador}
                    onChange={(e) => setBuscaMorador(e.target.value)}
                    autoFocus
                  />
                </Form.Group>
              </Col>
              <Col md={4} className="d-flex align-items-end">
                <Button
                  variant="primary"
                  onClick={() => setBuscaMorador('')}
                  disabled={!buscaMorador}
                >
                  <i className="fas fa-times me-2"></i>
                  Limpar
                </Button>
              </Col>
            </Row>

            {/* Status dos Moradores */}
            <Row className="mb-4">
              <Col md={6}>
                <Card className="border-success">
                  <Card.Header className="bg-success text-white">
                    <h6 className="mb-0">✅ Moradores em Dia ({moradoresEmDia.length})</h6>
                  </Card.Header>
                  <Card.Body style={{maxHeight: '300px', overflowY: 'auto'}}>
                    {moradoresEmDia.length === 0 ? (
                      <p className="text-muted text-center">Carregando...</p>
                    ) : (
                      moradoresEmDia.map((morador) => (
                        <div 
                          key={morador._id} 
                          className="d-flex justify-content-between align-items-center border-bottom py-2 cursor-pointer"
                          style={{cursor: 'pointer'}}
                          onClick={() => {
                            handleMoradorChange(morador._id)
                            setShowBuscaModal(false)
                          }}
                        >
                          <div>
                            <strong>{morador.nome}</strong><br/>
                            <small className="text-muted">
                              {morador.bloco && `${morador.bloco} - `}{morador.unidade}
                              {morador.cpf && ` | CPF: ${morador.cpf}`}
                            </small>
                          </div>
                          <div className="text-end">
                            <small className="text-success">
                              Sem pendências
                            </small>
                          </div>
                        </div>
                      ))
                    )}
                  </Card.Body>
                </Card>
              </Col>
              <Col md={6}>
                <Card className="border-danger">
                  <Card.Header className="bg-danger text-white">
                    <h6 className="mb-0">⚠️ Moradores Atrasados ({moradoresAtrasados.length})</h6>
                  </Card.Header>
                  <Card.Body style={{maxHeight: '300px', overflowY: 'auto'}}>
                    {moradoresAtrasados.length === 0 ? (
                      <p className="text-muted text-center">Carregando...</p>
                    ) : (
                      moradoresAtrasados.map((morador) => (
                        <div 
                          key={morador._id} 
                          className="d-flex justify-content-between align-items-center border-bottom py-2 cursor-pointer"
                          style={{cursor: 'pointer'}}
                          onClick={() => {
                            handleMoradorChange(morador._id)
                            setShowBuscaModal(false)
                          }}
                        >
                          <div>
                            <strong>{morador.nome}</strong><br/>
                            <small className="text-muted">
                              {morador.bloco && `${morador.bloco} - `}{morador.unidade}
                              {morador.cpf && ` | CPF: ${morador.cpf}`}
                            </small>
                          </div>
                          <div className="text-end">
                            <small className="text-danger">
                              {formatCurrencyDisplay(morador.total_atrasado)}<br/>
                              {morador.count_atrasados} lançamento(s)
                            </small>
                          </div>
                        </div>
                      ))
                    )}
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {/* Resultados da Busca */}
            {buscaMorador && (
              <Row>
                <Col>
                  <Card>
                    <Card.Header>
                      <h6 className="mb-0">📋 Resultados da Busca</h6>
                    </Card.Header>
                    <Card.Body>
                      {buscarMorador(buscaMorador).length === 0 ? (
                        <p className="text-muted text-center">Nenhum morador encontrado com os critérios de busca</p>
                      ) : (
                        <div className="table-responsive">
                          <Table hover>
                            <thead>
                              <tr>
                                <th>Nome</th>
                                <th>Unidade</th>
                                <th>CPF</th>
                                <th>Tipo</th>
                                <th>Ação</th>
                              </tr>
                            </thead>
                            <tbody>
                              {buscarMorador(buscaMorador).map((morador) => (
                                <tr key={morador._id}>
                                  <td><strong>{morador.nome}</strong></td>
                                  <td>{morador.bloco && `${morador.bloco} - `}{morador.unidade}</td>
                                  <td><small>{morador.cpf || 'N/A'}</small></td>
                                  <td>
                                    <Badge bg={morador.tipo === 'proprietario' ? 'primary' : 'secondary'}>
                                      {morador.tipo}
                                    </Badge>
                                  </td>
                                  <td>
                                    <Button
                                      variant="outline-primary"
                                      size="sm"
                                      onClick={() => {
                                        handleMoradorChange(morador._id)
                                        setShowBuscaModal(false)
                                      }}
                                    >
                                      Selecionar
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        </div>
                      )}
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowBuscaModal(false)}>
              Fechar
            </Button>
          </Modal.Footer>
        </Modal>
      </Container>
    </>
  )
}