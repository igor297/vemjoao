'use client'

import { useState, useEffect, useMemo } from 'react'
import { Container, Row, Col, Card, Button, Table, Modal, Form, Alert, Badge } from 'react-bootstrap'
import ConjugeManager from '@/components/moradores/ConjugeManager'
import DependenteManager from '@/components/moradores/DependenteManager'
import VeiculoManager from '@/components/moradores/VeiculoManager'
import AnimalManager from '@/components/moradores/AnimalManager'

interface Morador {
  _id: string
  id_morador: string
  nome: string
  cpf: string
  data_nasc: string
  celular1: string
  celular2?: string
  email: string
  tipo: 'proprietario' | 'inquilino' | 'dependente'
  unidade: string
  bloco?: string
  data_inicio: string
  data_fim?: string
  condominio_id: string
  condominio_nome: string
  master_id: string
  ativo: boolean
  responsavel_nome?: string
  proprietario_nome?: string
  imobiliaria_nome?: string
}

interface Condominium {
  _id: string
  nome: string
}

interface Imobiliaria {
  _id: string
  nome: string
  cnpj?: string
  telefone1?: string
  email?: string
  endereco?: string
  responsavel_nome?: string
  responsavel_celular?: string
  responsavel_email?: string
  observacoes?: string
}

export default function MoradoresPage() {
  const [moradores, setMoradores] = useState<Morador[]>([])
  const [condominiums, setCondominiums] = useState<Condominium[]>([])
  const [imobiliarias, setImobiliarias] = useState<Imobiliaria[]>([])
  const [showModal, setShowModal] = useState(false)
  const [showInquilinoModal, setShowInquilinoModal] = useState(false)
  const [showImobiliariaModal, setShowImobiliariaModal] = useState(false)
  const [selectedProprietario, setSelectedProprietario] = useState<Morador | null>(null)
  const [editingMorador, setEditingMorador] = useState<Morador | null>(null)
  const [editingImobiliaria, setEditingImobiliaria] = useState<Imobiliaria | null>(null)
  const [showImobiliariaForm, setShowImobiliariaForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [userInfo, setUserInfo] = useState<any>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [canEditImobiliaria, setCanEditImobiliaria] = useState(false)
  const [selectedCondominiumId, setSelectedCondominiumId] = useState<string>('')
  const [responsaveis, setResponsaveis] = useState<Morador[]>([])
  const [proprietarios, setProprietarios] = useState<Morador[]>([])
  
  // Estados para modais de ações adicionais
  const [showActionsModal, setShowActionsModal] = useState(false)
  const [selectedMoradorForActions, setSelectedMoradorForActions] = useState<Morador | null>(null)
  
  // Estados para modais específicos
  const [showConjugeModal, setShowConjugeModal] = useState(false)
  const [showDependenteModal, setShowDependenteModal] = useState(false)
  const [showVeiculoModal, setShowVeiculoModal] = useState(false)
  const [showAnimalModal, setShowAnimalModal] = useState(false)
  
  // Estados para controle de visibilidade da senha
  const [showPassword, setShowPassword] = useState(false)
  const [showInquilinoPassword, setShowInquilinoPassword] = useState(false)

  const [formData, setFormData] = useState({
    nome: '',
    cpf: '',
    data_nasc: '',
    celular1: '',
    celular2: '',
    email: '',
    password: '',
    tipo: 'proprietario' as 'proprietario',
    unidade: '',
    bloco: '',
    data_inicio: '',
    data_fim: '',
    condominio_id: '',
    responsavel_id: '',
    proprietario_id: '',
    imobiliaria_id: '',
    observacoes: ''
  })

  const [inquilinoFormData, setInquilinoFormData] = useState({
    nome: '',
    cpf: '',
    data_nasc: '',
    celular1: '',
    celular2: '',
    email: '',
    password: '',
    data_inicio: '',
    data_fim: '',
    imobiliaria_id: '',
    observacoes: ''
  })

  const [imobiliariaFormData, setImobiliariaFormData] = useState({
    nome: '',
    cnpj: '',
    telefone1: '',
    email: '',
    endereco: '',
    responsavel_nome: '',
    responsavel_celular: '',
    responsavel_email: '',
    observacoes: ''
  })

  useEffect(() => {
    const userData = localStorage.getItem('userData')
    if (userData) {
      try {
        const user = JSON.parse(userData)
        setUserInfo(user)
        
        // Determinar permissões baseadas no tipo de usuário
        if (user.tipo === 'master') {
          setCanEdit(true)
          setCanEditImobiliaria(true)
        } else if (user.tipo === 'adm') {
          // Síndico e subsíndico podem tudo, conselheiro só pode ver
          setCanEdit(user.subtipo === 'sindico' || user.subtipo === 'subsindico')
          setCanEditImobiliaria(user.subtipo === 'sindico' || user.subtipo === 'subsindico')
        } else if (user.tipo === 'morador') {
          setCanEdit(user.subtipo === 'proprietario')
          setCanEditImobiliaria(user.subtipo === 'proprietario')
        } else {
          setCanEdit(false)
          setCanEditImobiliaria(false)
        }
        
        fetchImobiliarias(user)
        if (user.tipo === 'master') {
          fetchCondominiums(user.id)
          // Verificar condomínio ativo
          const activeCondominiumId = localStorage.getItem('activeCondominio')
          if (activeCondominiumId) {
            setSelectedCondominiumId(activeCondominiumId)
            fetchMoradoresByCondominium(user, activeCondominiumId)
          } else {
            fetchMoradores(user)
          }
        } else {
          fetchMoradores(user)
        }
      } catch (error) {
        console.error('Error parsing user data:', error)
        setError('Erro ao carregar dados do usuário')
      }
    }

    // Listener para mudanças no condomínio ativo
    const handleStorageChange = () => {
      const userData = localStorage.getItem('userData')
      if (userData) {
        const user = JSON.parse(userData)
        if (user.tipo === 'master') {
          const activeCondominiumId = localStorage.getItem('activeCondominio')
          if (activeCondominiumId && activeCondominiumId !== selectedCondominiumId) {
            setSelectedCondominiumId(activeCondominiumId)
            fetchMoradoresByCondominium(user, activeCondominiumId)
          }
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('condominioChanged', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('condominioChanged', handleStorageChange)
    }
  }, [])

  // UseEffect para verificar condomínio ativo periodicamente
  useEffect(() => {
    if (userInfo?.tipo === 'master') {
      const interval = setInterval(() => {
        const activeCondominium = localStorage.getItem('activeCondominium')
        if (activeCondominium && activeCondominium !== selectedCondominiumId) {
          console.log('Atualizando condomínio ativo:', activeCondominium)
          setSelectedCondominiumId(activeCondominium)
          fetchMoradoresByCondominium(userInfo, activeCondominium)
        }
      }, 1000) // Verifica a cada segundo

      return () => clearInterval(interval)
    }
  }, [userInfo, selectedCondominiumId])

  // UseEffect para abrir modal quando proprietário for selecionado
  useEffect(() => {
    if (selectedProprietario && !showInquilinoModal) {
      console.log('UseEffect - Abrindo modal para:', selectedProprietario.nome)
      setShowInquilinoModal(true)
    }
  }, [selectedProprietario])

  const fetchMoradores = async (user: any) => {
    try {
      setLoading(true)
      let url = `/api/moradores?master_id=${user.master_id || user.id}`
      
      // Se não for master, filtrar pelo condomínio específico
      if (user.tipo !== 'master' && user.condominio_id) {
        url += `&condominio_id=${user.condominio_id}`
      }
      
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.success) {
        const moradoresComImobiliaria = data.moradores.map((morador: Morador) => {
          if (morador.imobiliaria_id) {
            const imobiliaria = imobiliarias.find(imob => imob._id === morador.imobiliaria_id)
            return { ...morador, imobiliaria_nome: imobiliaria ? imobiliaria.nome : morador.imobiliaria_nome }
          }
          return morador
        })
        setMoradores(moradoresComImobiliaria)
        
        // Filtrar responsáveis (proprietários e inquilinos para dependentes)
        const responsaveisValidos = data.moradores.filter((m: Morador) => 
          m.tipo === 'proprietario' || m.tipo === 'inquilino'
        )
        setResponsaveis(responsaveisValidos)

        // Filtrar proprietários (apenas proprietários para inquilinos)
        const proprietariosValidos = data.moradores.filter((m: Morador) => 
          m.tipo === 'proprietario'
        )
        setProprietarios(proprietariosValidos)
      } else {
        setError(data.error)
      }
    } catch (error) {
      setError('Erro ao carregar moradores')
    } finally {
      setLoading(false)
    }
  }

  const fetchMoradoresByCondominium = async (user: any, condominioId: string) => {
    try {
      setLoading(true)
      let url = `/api/moradores?master_id=${user.master_id || user.id}`
      
      if (condominioId) {
        url += `&condominio_id=${condominioId}`
      }
      
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.success) {
        const moradoresComImobiliaria = data.moradores.map((morador: Morador) => {
          if (morador.imobiliaria_id) {
            const imobiliaria = imobiliarias.find(imob => imob._id === morador.imobiliaria_id)
            return { ...morador, imobiliaria_nome: imobiliaria ? imobiliaria.nome : morador.imobiliaria_nome }
          }
          return morador
        })
        setMoradores(moradoresComImobiliaria)
        
        // Filtrar responsáveis (proprietários e inquilinos para dependentes)
        const responsaveisValidos = data.moradores.filter((m: Morador) => 
          m.tipo === 'proprietario' || m.tipo === 'inquilino'
        )
        setResponsaveis(responsaveisValidos)

        // Filtrar proprietários (apenas proprietários para inquilinos)
        const proprietariosValidos = data.moradores.filter((m: Morador) => 
          m.tipo === 'proprietario'
        )
        setProprietarios(proprietariosValidos)
      } else {
        setError(data.error)
      }
    } catch (error) {
      setError('Erro ao carregar moradores')
    } finally {
      setLoading(false)
    }
  }

  const fetchCondominiums = async (masterId: string) => {
    try {
      const response = await fetch(`/api/condominios?master_id=${masterId}`)
      const data = await response.json()
      
      if (data.success) {
        setCondominiums(data.condominios)
      }
    } catch (error) {
      console.error('Error fetching condominiums:', error)
    }
  }

  const fetchImobiliarias = async (user: any) => {
    try {
      let url = `/api/imobiliarias?master_id=${user.master_id || user.id}`
      
      // Se não for master, filtrar pelo condomínio específico
      if (user.tipo !== 'master' && user.condominio_id) {
        url += `&condominio_id=${user.condominio_id}`
      }
      
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.success) {
        setImobiliarias(data.imobiliarias)
      }
    } catch (error) {
      console.error('Error fetching imobiliarias:', error)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    
    if (name === 'data_nasc' || name === 'data_inicio' || name === 'data_fim') {
      let formattedDate = value.replace(/\D/g, '') // Remove tudo que não é dígito

      if (formattedDate.length > 8) {
        formattedDate = formattedDate.substring(0, 8) // Limita a 8 dígitos para DDMMYYYY
      }

      if (formattedDate.length > 4) {
        formattedDate = formattedDate.replace(/^(\d{2})(\d{2})(\d{4})$/, '$1/$2/$3')
      } else if (formattedDate.length > 2) {
        formattedDate = formattedDate.replace(/^(\d{2})(\d{2})$/, '$1/$2')
      } else if (formattedDate.length > 0) {
        formattedDate = formattedDate.replace(/^(\d{2})$/, '$1')
      }
      setFormData(prev => ({ ...prev, [name]: formattedDate }))
      return
    }
  }

  const handleInquilinoInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    
    if (name === 'data_nasc' || name === 'data_inicio' || name === 'data_fim') {
      let formattedDate = value.replace(/\D/g, '') // Remove tudo que não é dígito

      if (formattedDate.length > 8) {
        formattedDate = formattedDate.substring(0, 8) // Limita a 8 dígitos para DDMMYYYY
      }

      if (formattedDate.length > 4) {
        formattedDate = formattedDate.replace(/^(\d{2})(\d{2})(\d{4})$/, '$1/$2/$3')
      } else if (formattedDate.length > 2) {
        formattedDate = formattedDate.replace(/^(\d{2})(\d{2})$/, '$1/$2')
      } else if (formattedDate.length > 0) {
        formattedDate = formattedDate.replace(/^(\d{2})$/, '$1')
      }
      setInquilinoFormData(prev => ({ ...prev, [name]: formattedDate }))
      return
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const url = '/api/moradores'
      const method = editingMorador ? 'PUT' : 'POST'
      
      const payload = {
        ...formData,
        master_id: userInfo?.master_id || userInfo?.id,
        ...(editingMorador && { _id: editingMorador._id })
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(editingMorador ? 'Morador atualizado com sucesso!' : 'Morador cadastrado com sucesso!')
        setShowModal(false)
        resetForm()
        fetchMoradores(userInfo)
      } else {
        setError(data.error)
      }
    } catch (error) {
      setError('Erro ao salvar morador')
    } finally {
      setLoading(false)
    }
  }

  const handleInquilinoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      if (!selectedProprietario?._id) {
        setError('Erro: Proprietário não selecionado')
        setLoading(false)
        return
      }

      // Validar campos obrigatórios antes de enviar (password só é obrigatória na criação)
      const requiredFields: {[key: string]: string} = {
        nome: 'Nome Completo',
        cpf: 'CPF',
        data_nasc: 'Data de Nascimento',
        celular1: 'Celular Principal',
        email: 'Email',
        data_inicio: 'Data de Início'
      }
      
      // Senha só é obrigatória se não estiver editando
      if (!editingMorador) {
        requiredFields.password = 'Senha'
      }
      
      for (const [field, label] of Object.entries(requiredFields)) {
        const value = inquilinoFormData[field as keyof typeof inquilinoFormData]
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          setError(`Campo "${label}" é obrigatório`)
          setLoading(false)
          return
        }
      }

      let url, method
      let payload: any

      if (editingMorador) {
        // Editando inquilino existente
        url = '/api/moradores'
        method = 'PUT'
        payload = {
          _id: editingMorador._id,
          ...inquilinoFormData,
          tipo: 'inquilino',
          // Manter dados herdados do proprietário
          condominio_id: selectedProprietario.condominio_id,
          unidade: selectedProprietario.unidade,
          bloco: selectedProprietario.bloco || '',
          master_id: selectedProprietario.master_id,
          proprietario_id: selectedProprietario._id
        }
      } else {
        // Criando novo inquilino
        url = '/api/moradores/inquilino'
        method = 'POST'
        payload = {
          ...inquilinoFormData,
          proprietario_id: selectedProprietario._id
        }
      }

      console.log('Payload sendo enviado:', payload)

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(editingMorador ? 'Inquilino atualizado com sucesso!' : 'Inquilino cadastrado com sucesso!')
        setShowInquilinoModal(false)
        setSelectedProprietario(null)
        setEditingMorador(null)
        resetInquilinoForm()
        if (userInfo) {
          if (selectedCondominiumId) {
            fetchMoradoresByCondominium(userInfo, selectedCondominiumId)
          } else {
            fetchMoradores(userInfo)
          }
        }
      } else {
        setError(data.error)
      }
    } catch (error) {
      setError(editingMorador ? 'Erro ao atualizar inquilino' : 'Erro ao cadastrar inquilino')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (morador: Morador) => {
    if (!canEdit) return
    
    if (morador.tipo === 'inquilino') {
      // Para inquilinos, usar o modal específico com lógica de imobiliária
      const proprietario = moradores.find(m => 
        m._id === morador.proprietario_id || 
        (m.tipo === 'proprietario' && 
         m.condominio_id === morador.condominio_id &&
         m.unidade === morador.unidade &&
         (m.bloco || '') === (morador.bloco || ''))
      )
      
      if (proprietario) {
        setSelectedProprietario(proprietario)
        setInquilinoFormData({
          nome: morador.nome,
          cpf: morador.cpf,
          data_nasc: morador.data_nasc.split('T')[0],
          celular1: morador.celular1,
          celular2: morador.celular2 || '',
          email: morador.email,
          password: '', // Não preencher senha na edição
          data_inicio: morador.data_inicio.split('T')[0],
          data_fim: morador.data_fim ? morador.data_fim.split('T')[0] : '',
          imobiliaria_id: morador.imobiliaria_id || '',
          observacoes: morador.observacoes || ''
        })
        setEditingMorador(morador) // Marcar que está editando um inquilino
        setShowInquilinoModal(true)
      } else {
        setError('Proprietário do inquilino não encontrado')
      }
    } else {
      // Para proprietários e outros tipos, usar o modal normal
      setEditingMorador(morador)
      setFormData({
        nome: morador.nome,
        cpf: morador.cpf,
        data_nasc: morador.data_nasc.split('T')[0],
        celular1: morador.celular1,
        celular2: morador.celular2 || '',
        email: morador.email,
        password: '', // Não preencher senha na edição
        tipo: morador.tipo,
        unidade: morador.unidade,
        bloco: morador.bloco || '',
        data_inicio: morador.data_inicio.split('T')[0],
        data_fim: morador.data_fim ? morador.data_fim.split('T')[0] : '',
        condominio_id: morador.condominio_id,
        responsavel_id: '',
        proprietario_id: '',
        imobiliaria_id: '',
        observacoes: ''
      })
      setShowModal(true)
    }
  }

  const handleDelete = async (id: string) => {
    if (!canEdit) return
    
    if (!confirm('Tem certeza que deseja excluir este morador?')) return

    try {
      setLoading(true)
      const response = await fetch(`/api/moradores?id=${id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        setSuccess('Morador excluído com sucesso!')
        fetchMoradores(userInfo)
      } else {
        setError(data.error)
      }
    } catch (error) {
      setError('Erro ao excluir morador')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      nome: '',
      cpf: '',
      data_nasc: '',
      celular1: '',
      celular2: '',
      email: '',
      password: '',
      tipo: 'proprietario',
      unidade: '',
      bloco: '',
      data_inicio: '',
      data_fim: '',
      condominio_id: '',
      responsavel_id: '',
      proprietario_id: '',
      imobiliaria_id: '',
      observacoes: ''
    })
    setEditingMorador(null)
  }

  const resetInquilinoForm = () => {
    setInquilinoFormData({
      nome: '',
      cpf: '',
      data_nasc: '',
      celular1: '',
      celular2: '',
      email: '',
      password: '',
      data_inicio: '',
      data_fim: '',
      imobiliaria_id: '',
      observacoes: ''
    })
    setEditingMorador(null)
    // Não limpar selectedProprietario aqui
  }

  const resetImobiliariaForm = () => {
    setImobiliariaFormData({
      nome: '',
      cnpj: '',
      telefone1: '',
      email: '',
      endereco: '',
      responsavel_nome: '',
      responsavel_celular: '',
      responsavel_email: '',
      observacoes: ''
    })
    setEditingImobiliaria(null)
    setShowImobiliariaForm(false)
  }

  const handleImobiliariaInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    
    // Aplicar máscara CNPJ
    if (name === 'cnpj') {
      let cnpj = value.replace(/\D/g, '')
      if (cnpj.length <= 14) {
        cnpj = cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
        setImobiliariaFormData(prev => ({ ...prev, cnpj }))
      }
      return
    }
    
    // Aplicar máscara telefone
    if (name === 'telefone1' || name === 'responsavel_celular') {
      let phone = value.replace(/\D/g, '')
      if (phone.length <= 11) {
        if (phone.length === 11) {
          phone = phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
        } else if (phone.length === 10) {
          phone = phone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
        }
        setImobiliariaFormData(prev => ({ ...prev, [name]: phone }))
      }
      return
    }
    
    setImobiliariaFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleImobiliariaSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const url = '/api/imobiliarias'
      const method = editingImobiliaria ? 'PUT' : 'POST'
      
      const payload = {
        ...imobiliariaFormData,
        master_id: userInfo?.master_id || userInfo?.id,
        condominio_id: selectedCondominiumId || localStorage.getItem('activeCondominio'),
        ...(editingImobiliaria && { _id: editingImobiliaria._id })
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(editingImobiliaria ? 'Imobiliária atualizada com sucesso!' : 'Imobiliária cadastrada com sucesso!')
        resetImobiliariaForm()
        fetchImobiliarias(userInfo)
      } else {
        setError(data.error)
      }
    } catch (error) {
      setError('Erro ao salvar imobiliária')
    } finally {
      setLoading(false)
    }
  }

  const handleEditImobiliaria = (imobiliaria: any) => {
    setEditingImobiliaria(imobiliaria)
    setImobiliariaFormData({
      nome: imobiliaria.nome,
      cnpj: imobiliaria.cnpj || '',
      telefone1: imobiliaria.telefone1 || '',
      email: imobiliaria.email || '',
      endereco: imobiliaria.endereco || '',
      responsavel_nome: imobiliaria.responsavel_nome || '',
      responsavel_celular: imobiliaria.responsavel_celular || '',
      responsavel_email: imobiliaria.responsavel_email || '',
      observacoes: imobiliaria.observacoes || ''
    })
    setShowImobiliariaForm(true)
  }

  const handleDeleteImobiliaria = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta imobiliária?')) return

    try {
      setLoading(true)
      const response = await fetch(`/api/imobiliarias?id=${id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        setSuccess('Imobiliária excluída com sucesso!')
        fetchImobiliarias(userInfo)
      } else {
        setError(data.error)
      }
    } catch (error) {
      setError('Erro ao excluir imobiliária')
    } finally {
      setLoading(false)
    }
  }

  const handleNewImobiliaria = () => {
    resetImobiliariaForm()
    setShowImobiliariaForm(true)
  }

  const handleOpenActionsModal = (morador: Morador) => {
    setSelectedMoradorForActions(morador)
    setShowActionsModal(true)
  }

  const handleCloseActionsModal = () => {
    setShowActionsModal(false)
    // Não limpar selectedMoradorForActions aqui para manter os dados para os modais específicos
  }

  const handleCloseAllModals = () => {
    setShowActionsModal(false)
    setShowConjugeModal(false)
    setShowDependenteModal(false)
    setShowVeiculoModal(false)
    setShowAnimalModal(false)
    setSelectedMoradorForActions(null)
  }

  const handleBackToActionsMenu = () => {
    setShowConjugeModal(false)
    setShowDependenteModal(false)
    setShowVeiculoModal(false)
    setShowAnimalModal(false)
    setShowActionsModal(true)
  }

  const verificarInquilinoExistente = (proprietario: Morador) => {
    return moradores.find(morador => 
      morador.tipo === 'inquilino' && 
      morador.condominio_id === proprietario.condominio_id &&
      morador.unidade === proprietario.unidade &&
      (morador.bloco || '') === (proprietario.bloco || '') &&
      morador.ativo === true
    )
  }

  const handleCadastrarInquilino = (proprietario: Morador) => {
    console.log('Proprietário selecionado:', proprietario)
    
    // Verificar se já existe inquilino ativo para esta unidade
    const inquilinoExistente = verificarInquilinoExistente(proprietario)
    
    if (inquilinoExistente) {
      setError(`Esta unidade já possui um inquilino ativo: ${inquilinoExistente.nome}. Apenas um inquilino por unidade é permitido.`)
      return
    }
    
    resetInquilinoForm()
    setSelectedProprietario(proprietario)
    // O modal será aberto pelo useEffect
  }

  const handleCloseModal = () => {
    setShowModal(false)
    resetForm()
  }

  const handleCondominiumChange = (condominioId: string) => {
    setSelectedCondominiumId(condominioId)
    if (condominioId && userInfo) {
      fetchMoradoresByCondominium(userInfo, condominioId)
    } else if (userInfo) {
      fetchMoradores(userInfo)
    }
  }

  const handleNewMorador = () => {
    // Usar condomínio ativo se disponível, senão usar o selecionado
    const activeCondominiumId = localStorage.getItem('activeCondominium') || selectedCondominiumId
    
    setFormData({
      nome: '',
      cpf: '',
      data_nasc: '',
      celular1: '',
      celular2: '',
      email: '',
      password: '',
      tipo: 'proprietario',
      unidade: '',
      bloco: '',
      data_inicio: '',
      data_fim: '',
      condominio_id: activeCondominiumId,
      responsavel_id: '',
      proprietario_id: '',
      imobiliaria_id: '',
      observacoes: ''
    })
    setShowModal(true)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR')
  }

  // 🚀 Performance: Cache de dados filtrados e computados
  const activeCondominios = useMemo(() => 
    condominiums.filter(c => c.nome && c._id), 
    [condominiums]
  )

  const activeMoradores = useMemo(() => 
    moradores.filter(m => m.ativo), 
    [moradores]
  )

  const moradoresPorTipo = useMemo(() => ({
    proprietarios: moradores.filter(m => m.tipo === 'proprietario'),
    inquilinos: moradores.filter(m => m.tipo === 'inquilino'),
    dependentes: moradores.filter(m => m.tipo === 'dependente')
  }), [moradores])

  const getStatusBadge = (morador: Morador) => {
    if (!morador.ativo) {
      return <Badge bg="secondary">Inativo</Badge>
    }
    
    if (morador.data_fim) {
      const dataFim = new Date(morador.data_fim)
      const now = new Date()
      
      if (dataFim < now) {
        return <Badge bg="danger">Expirado</Badge>
      }
    }
    
    return <Badge bg="success">Ativo</Badge>
  }

  const getTipoBadge = (tipo: string) => {
    const colors = {
      proprietario: 'primary',
      inquilino: 'warning',
      dependente: 'secondary'
    }
    const labels = {
      proprietario: 'Proprietário',
      inquilino: 'Inquilino',
      dependente: 'Dependente'
    }
    return <Badge bg={colors[tipo as keyof typeof colors]}>
      {labels[tipo as keyof typeof labels]}
    </Badge>
  }

  return (
    <>
      <Container fluid className="py-4">
        <Row className="mb-4">
          <Col>
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <h2 className="mb-0">🏠 Gestão de Moradores</h2>
                <p className="text-muted mb-0">
                  {userInfo?.tipo === 'master' 
                    ? 'Gerencie todos os moradores dos seus condomínios' 
                    : `Moradores do ${userInfo?.condominio_nome}`}
                </p>
              </div>
              {canEdit && (
                <Button 
                  variant="primary" 
                  onClick={handleNewMorador}
                  disabled={loading}
                >
                  Novo Proprietário
                </Button>
              )}
            </div>
          </Col>
        </Row>

        {error && (
          <Alert variant="danger" dismissible onClose={() => setError('')} className="bg-dark text-light">
            {error}
          </Alert>
        )}

        {success && (
          <Alert variant="success" dismissible onClose={() => setSuccess('')} className="bg-dark text-light">
            {success}
          </Alert>
        )}

        <Card className="shadow bg-dark text-light">
          <Card.Header className="bg-primary text-white">
            <h5 className="mb-0">
              Lista de Moradores ({moradores.length})
            </h5>
          </Card.Header>
          <Card.Body>
            {userInfo?.tipo === 'master' && (
              <Row className="mb-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Filtrar por Condomínio</Form.Label>
                    <Form.Select
                      value={selectedCondominiumId}
                      onChange={(e) => handleCondominiumChange(e.target.value)}
                    >
                      <option value="">Todos os condomínios</option>
                      {condominiums.map((cond) => (
                        <option key={cond._id} value={cond._id}>
                          {cond.nome}
                        </option>
                      ))}
                    </Form.Select>
                    <Form.Text className="text-muted">
                      {selectedCondominiumId ? (
                        localStorage.getItem('activeCondominium') === selectedCondominiumId ? (
                          <span className="text-success">
                            ✅ Condomínio ativo selecionado automaticamente
                          </span>
                        ) : (
                          <span className="text-info">
                            📋 Condomínio selecionado manualmente
                          </span>
                        )
                      ) : (
                        <span className="text-warning">
                          ⚠️ Nenhum condomínio selecionado - mostrando todos
                        </span>
                      )}
                    </Form.Text>
                  </Form.Group>
                </Col>
                <Col md={6} className="d-flex align-items-end">
                  <div className="w-100">
                    <small className="text-muted">
                      <strong>Total de moradores:</strong> {moradores.length}
                    </small>
                    {localStorage.getItem('activeCondominium') && (
                      <div className="mt-1">
                        <small className="text-success">
                          🏢 <strong>Condomínio Ativo:</strong> {localStorage.getItem('activeCondominiumName') || 'Carregando...'}
                        </small>
                      </div>
                    )}
                  </div>
                </Col>
              </Row>
            )}
            {loading ? (
              <div className="text-center p-4">
                <div className="spinner-border" role="status">
                  <span className="visually-hidden">Carregando...</span>
                </div>
              </div>
            ) : moradores.length === 0 ? (
              <div className="text-center p-4">
                <p className="text-muted">Nenhum morador cadastrado</p>
              </div>
            ) : (
              <div className="table-responsive">
                <Table responsive striped hover variant="dark">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Tipo</th>
                      <th>Unidade</th>
                      <th>Email</th>
                      <th>Celular</th>
                      <th>Vinculação</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {moradores.map((morador) => (
                      <tr key={morador._id}>
                        <td className="fw-semibold">{morador.nome}</td>
                        <td>{getTipoBadge(morador.tipo)}</td>
                        <td>
                          {morador.bloco ? `${morador.bloco} - ` : ''}{morador.unidade}
                        </td>
                        <td className="text-body">{morador.email}</td>
                        <td>{morador.celular1}</td>
                        <td>
                          {morador.tipo === 'proprietario' && (
                            <div>
                              <Badge bg="info" className="d-block mb-1">
                                {morador.condominio_nome}
                              </Badge>
                              {(() => {
                                const inquilino = verificarInquilinoExistente(morador)
                                return inquilino ? (
                                  <Badge bg="success" className="d-block">
                                    Inquilino: {inquilino.nome}
                                  </Badge>
                                ) : (
                                  <Badge bg="secondary" className="d-block">
                                    Sem inquilino
                                  </Badge>
                                )
                              })()}
                            </div>
                          )}
                          {morador.tipo === 'inquilino' && morador.proprietario_nome && (
                            <div>
                              <Badge bg="warning" className="d-block mb-1">
                                Proprietário: {morador.proprietario_nome}
                              </Badge>
                              {morador.imobiliaria_nome && (
                                <Badge bg="success" className="d-block mb-1">
                                  Imobiliária: {morador.imobiliaria_nome}
                                </Badge>
                              )}
                              <Badge bg="info">
                                {morador.condominio_nome}
                              </Badge>
                            </div>
                          )}
                        </td>
                        <td>{getStatusBadge(morador)}</td>
                        <td>
                          <div className="btn-group btn-group-sm" role="group">
                            {/* Botão de gerenciar família sempre visível para proprietários e inquilinos */}
                            {(morador.tipo === 'proprietario' || morador.tipo === 'inquilino') && (
                              <Button
                                variant="outline-info"
                                size="sm"
                                onClick={() => handleOpenActionsModal(morador)}
                                title="Gerenciar Família e Pertences"
                              >
                                👨‍👩‍👧‍👦
                              </Button>
                            )}
                            
                            {/* Botões administrativos só para quem tem permissão */}
                            {canEdit && (
                              <>
                                {morador.tipo === 'proprietario' && (
                                  (() => {
                                    const temInquilino = verificarInquilinoExistente(morador)
                                    return temInquilino ? (
                                      <Button
                                        variant="outline-warning"
                                        size="sm"
                                        onClick={() => setError(`Esta unidade já possui um inquilino ativo: ${temInquilino.nome}`)}
                                        title={`Inquilino: ${temInquilino.nome}`}
                                      >
                                        👤✓
                                      </Button>
                                    ) : (
                                      <Button
                                        variant="outline-success"
                                        size="sm"
                                        onClick={() => handleCadastrarInquilino(morador)}
                                        title="Cadastrar Inquilino"
                                      >
                                        👤+
                                      </Button>
                                    )
                                  })()
                                )}
                                <Button
                                  variant="outline-primary"
                                  size="sm"
                                  onClick={() => handleEdit(morador)}
                                  title="Editar"
                                >
                                  ✏️
                                </Button>
                                <Button
                                  variant="outline-danger"
                                  size="sm"
                                  onClick={() => handleDelete(morador._id)}
                                  title="Excluir"
                                >
                                  🗑️
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Card.Body>
        </Card>

        {/* Modal para cadastro/edição */}
        <Modal show={showModal} onHide={handleCloseModal} size="lg">
          <Modal.Header closeButton closeVariant="white" className="bg-dark text-light">
            <Modal.Title>
              {editingMorador ? 'Editar Proprietário' : 'Novo Proprietário'}
            </Modal.Title>
          </Modal.Header>
          <Form onSubmit={handleSubmit}>
            <Modal.Body className="bg-dark text-light">
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Nome Completo *</Form.Label>
                    <Form.Control
                      type="text"
                      name="nome"
                      value={formData.nome}
                      onChange={handleInputChange}
                      required
                      placeholder="Digite o nome completo"
                      className="bg-dark text-light"
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>CPF *</Form.Label>
                    <Form.Control
                      type="text"
                      name="cpf"
                      value={formData.cpf}
                      onChange={handleInputChange}
                      required
                      placeholder="000.000.000-00"
                      maxLength={14}
                      className="bg-dark text-light"
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Data de Nascimento *</Form.Label>
                    <Form.Control
                      type="text"
                      name="data_nasc"
                      value={formData.data_nasc}
                      onChange={handleInputChange}
                      required
                      placeholder="DD/MM/AAAA"
                      maxLength={10}
                      className="bg-dark text-light"
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Tipo de Morador *</Form.Label>
                    <Form.Control
                      type="text"
                      value="Proprietário"
                      disabled
                      className="bg-secondary text-light"
                    />
                    <Form.Text className="text-muted">
                      💡 Para cadastrar inquilinos, use o botão "👤+" na lista de proprietários
                    </Form.Text>
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Condomínio *</Form.Label>
                    <Form.Select
                      name="condominio_id"
                      value={formData.condominio_id}
                      onChange={handleInputChange}
                      required
                      disabled={userInfo?.tipo !== 'master'}
                      className="bg-dark text-light"
                    >
                      <option value="">Selecione um condomínio</option>
                      {userInfo?.tipo === 'master' ? (
                        condominiums.map((cond) => (
                          <option key={cond._id} value={cond._id}>
                            {cond.nome}
                          </option>
                        ))
                      ) : (
                        <option value={userInfo?.condominio_id}>
                          {userInfo?.condominio_nome}
                        </option>
                      )}
                    </Form.Select>
                    {formData.condominio_id && localStorage.getItem('activeCondominium') === formData.condominio_id ? (
                      <Form.Text className="text-success">
                        ✅ Condomínio ativo preenchido automaticamente
                      </Form.Text>
                    ) : formData.condominio_id ? (
                      <Form.Text className="text-info">
                        📋 Condomínio selecionado
                      </Form.Text>
                    ) : null}
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Bloco</Form.Label>
                    <Form.Control
                      type="text"
                      name="bloco"
                      value={formData.bloco}
                      onChange={handleInputChange}
                      placeholder="Ex: A, B, Torre 1"
                      className="bg-dark text-light"
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Unidade *</Form.Label>
                    <Form.Control
                      type="text"
                      name="unidade"
                      value={formData.unidade}
                      onChange={handleInputChange}
                      required
                      placeholder="Ex: 101, Casa 15"
                      className="bg-dark text-light"
                    />
                  </Form.Group>
                </Col>
              </Row>


              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Celular Principal *</Form.Label>
                    <Form.Control
                      type="text"
                      name="celular1"
                      value={formData.celular1}
                      onChange={handleInputChange}
                      required
                      placeholder="(85) 99999-9999"
                      maxLength={15}
                      className="bg-dark text-light"
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Celular Secundário</Form.Label>
                    <Form.Control
                      type="text"
                      name="celular2"
                      value={formData.celular2}
                      onChange={handleInputChange}
                      placeholder="(85) 99999-9999"
                      maxLength={15}
                      className="bg-dark text-light"
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Email *</Form.Label>
                    <Form.Control
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      placeholder="morador@exemplo.com"
                      className="bg-dark text-light"
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Senha {editingMorador ? '(deixe vazio para manter)' : '*'}</Form.Label>
                    <div className="position-relative">
                      <Form.Control
                        type={showPassword ? "text" : "password"}
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        required={!editingMorador}
                        placeholder={editingMorador ? "Deixe em branco para manter" : "Mínimo 6 caracteres"}
                        minLength={6}
                        className="pe-5 bg-dark text-light"
                      />
                      <Button
                        variant="link"
                        className="position-absolute end-0 top-50 translate-middle-y border-0 bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{ zIndex: 10 }}
                      >
                        {showPassword ? (
                          <i className="bi bi-eye-slash"></i>
                        ) : (
                          <i className="bi bi-eye"></i>
                        )}
                      </Button>
                    </div>
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Data de Início *</Form.Label>
                    <Form.Control
                      type="text"
                      name="data_inicio"
                      value={formData.data_inicio}
                      onChange={handleInputChange}
                      required
                      placeholder="DD/MM/AAAA"
                      maxLength={10}
                      className="bg-dark text-light"
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Data de Término</Form.Label>
                    <Form.Control
                      type="text"
                      name="data_fim"
                      value={formData.data_fim}
                      onChange={handleInputChange}
                      placeholder="DD/MM/AAAA"
                      maxLength={10}
                      className="bg-dark text-light"
                    />
                    <Form.Text className="text-muted">
                      Deixe vazio para morador sem data de término
                    </Form.Text>
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col>
                  <Form.Group className="mb-3">
                    <Form.Label>Observações</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      name="observacoes"
                      value={formData.observacoes}
                      onChange={handleInputChange}
                      placeholder="Informações adicionais sobre o morador..."
                      maxLength={500}
                      className="bg-dark text-light"
                    />
                  </Form.Group>
                </Col>
              </Row>
            </Modal.Body>
            <Modal.Footer className="bg-dark text-light">
              <Button variant="secondary" onClick={handleCloseModal}>
                Cancelar
              </Button>
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? 'Salvando...' : (editingMorador ? 'Atualizar' : 'Cadastrar')}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>

        {/* Modal para cadastro de inquilino */}
        <Modal show={showInquilinoModal} onHide={() => {
          setShowInquilinoModal(false)
          setSelectedProprietario(null)
          setEditingMorador(null)
          resetInquilinoForm()
        }} size="lg">
          <Modal.Header closeButton closeVariant="white" className="bg-dark text-light">
            <Modal.Title>
              {editingMorador ? 'Editar Inquilino' : 'Cadastrar Inquilino'}{selectedProprietario ? ` ${editingMorador ? 'de' : 'para'} ${selectedProprietario.nome}` : ''}
            </Modal.Title>
          </Modal.Header>
          <Form onSubmit={handleInquilinoSubmit}>
            <Modal.Body className="bg-dark text-light">
              
              {selectedProprietario ? (
                <Alert variant="info" className="mb-3 bg-dark text-light border-secondary">
                  <strong>📋 Dados que o Inquilino Herdará Automaticamente:</strong><br/>
                  <strong>🏠 Proprietário:</strong> {selectedProprietario.nome}<br/>
                  <strong>🏢 Condomínio:</strong> {selectedProprietario.condominio_nome}<br/>
                  <strong>🏗️ Bloco:</strong> {selectedProprietario.bloco || 'Não informado'}<br/>
                  <strong>🏠 Unidade:</strong> {selectedProprietario.unidade}<br/>
                  <small className="text-muted">
                    O inquilino será automaticamente vinculado a esta propriedade
                  </small>
                </Alert>
              ) : (
                <Alert variant="warning" className="mb-3">
                  <strong>⚠️ Erro:</strong> Nenhum proprietário selecionado
                </Alert>
              )}

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Nome Completo *</Form.Label>
                    <Form.Control
                        type="text"
                        name="nome"
                        value={inquilinoFormData.nome}
                        onChange={handleInquilinoInputChange}
                        required
                        placeholder="Digite o nome completo"
                        className="bg-dark text-light"
                      />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>CPF *</Form.Label>
                    <Form.Control
                        type="text"
                        name="cpf"
                        value={inquilinoFormData.cpf}
                        onChange={handleInquilinoInputChange}
                        required
                        placeholder="000.000.000-00"
                        maxLength={14}
                        className="bg-dark text-light"
                      />
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Data de Nascimento *</Form.Label>
                    <Form.Control
                        type="text"
                        name="data_nasc"
                        value={inquilinoFormData.data_nasc}
                        onChange={handleInquilinoInputChange}
                        required
                        placeholder="DD/MM/AAAA"
                        maxLength={10}
                        className="bg-dark text-light"
                      />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Imobiliária</Form.Label>
                    <div className="d-flex gap-2">
                      <Form.Select
                        name="imobiliaria_id"
                        value={inquilinoFormData.imobiliaria_id}
                        onChange={handleInquilinoInputChange}
                        disabled={!canEditImobiliaria}
                        className="flex-grow-1 bg-dark text-light"
                      >
                        {imobiliarias.length === 0 ? (
                          <option value="">Sem imobiliária</option>
                        ) : (
                          <>
                            <option value="">Nenhuma imobiliária</option>
                            {imobiliarias.map((imob) => (
                              <option key={imob._id} value={imob._id}>
                                {imob.nome}
                              </option>
                            ))}
                          </>
                        )}
                      </Form.Select>
                      {(userInfo?.tipo === 'master' || (userInfo?.tipo === 'morador' && userInfo?.subtipo === 'proprietario')) && (
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => setShowImobiliariaModal(true)}
                          title="Gerenciar Imobiliárias"
                        >
                          🏢⚙️
                        </Button>
                      )}
                    </div>
                    <Form.Text className="text-muted">
                      {imobiliarias.length === 0 ? (
                        <>🏢 Nenhuma imobiliária cadastrada. {canEditImobiliaria ? 'Clique no botão ao lado para adicionar uma.' : 'Apenas proprietários e masters podem gerenciar imobiliárias.'}</>
                      ) : inquilinoFormData.imobiliaria_id ? (
                        <>✅ <strong>Imobiliária selecionada:</strong> {imobiliarias.find(i => i._id === inquilinoFormData.imobiliaria_id)?.nome}</>
                      ) : (
                        <>🏢 {imobiliarias.length} imobiliária(s) disponível(is). {!canEditImobiliaria ? 'Apenas proprietários e masters podem gerenciar.' : 'Selecione uma ou gerencie através do botão ao lado.'}</>
                      )}
                    </Form.Text>
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Condomínio</Form.Label>
                    <Form.Control
                      type="text"
                      value={selectedProprietario?.condominio_nome || 'Condomínio não informado'}
                      disabled
                      className="bg-secondary text-light"
                    />
                    <Form.Text className="text-success">
                      🏢 Herdado automaticamente do proprietário
                    </Form.Text>
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Bloco</Form.Label>
                    <Form.Control
                      type="text"
                      value={selectedProprietario?.bloco || 'Bloco não informado'}
                      disabled
                      className="bg-secondary text-light"
                    />
                    <Form.Text className="text-success">
                      🏗️ Herdado automaticamente do proprietário
                    </Form.Text>
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Unidade</Form.Label>
                    <Form.Control
                      type="text"
                      value={selectedProprietario?.unidade || 'Unidade não informada'}
                      disabled
                      className="bg-secondary text-light"
                    />
                    <Form.Text className="text-success">
                      🏠 Herdado automaticamente do proprietário
                    </Form.Text>
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Celular Principal *</Form.Label>
                    <Form.Control
                        type="text"
                        name="celular1"
                        value={inquilinoFormData.celular1}
                        onChange={handleInquilinoInputChange}
                        required
                        placeholder="(85) 99999-9999"
                        maxLength={15}
                        className="bg-dark text-light"
                      />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Celular Secundário</Form.Label>
                    <Form.Control
                        type="text"
                        name="celular2"
                        value={inquilinoFormData.celular2}
                        onChange={handleInquilinoInputChange}
                        placeholder="(85) 99999-9999"
                        maxLength={15}
                        className="bg-dark text-light"
                      />
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Email *</Form.Label>
                    <Form.Control
                        type="email"
                        name="email"
                        value={inquilinoFormData.email}
                        onChange={handleInquilinoInputChange}
                        required
                        placeholder="inquilino@exemplo.com"
                        className="bg-dark text-light"
                      />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Senha {editingMorador ? '(deixe vazio para manter)' : '*'}</Form.Label>
                    <div className="position-relative">
                      <Form.Control
                        type={showInquilinoPassword ? "text" : "password"}
                        name="password"
                        value={inquilinoFormData.password}
                        onChange={handleInquilinoInputChange}
                        required={!editingMorador}
                        placeholder={editingMorador ? "Deixe em branco para manter" : "Mínimo 6 caracteres"}
                        minLength={6}
                        className="pe-5 bg-dark text-light"
                      />
                      <Button
                        variant="link"
                        className="position-absolute end-0 top-50 translate-middle-y border-0 bg-transparent"
                        onClick={() => setShowInquilinoPassword(!showInquilinoPassword)}
                        style={{ zIndex: 10 }}
                      >
                        {showInquilinoPassword ? (
                          <i className="bi bi-eye-slash"></i>
                        ) : (
                          <i className="bi bi-eye"></i>
                        )}
                      </Button>
                    </div>
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Data de Início *</Form.Label>
                    <Form.Control
                        type="text"
                        name="data_inicio"
                        value={inquilinoFormData.data_inicio}
                        onChange={handleInquilinoInputChange}
                        required
                        placeholder="DD/MM/AAAA"
                        maxLength={10}
                        className="bg-dark text-light"
                      />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Data de Término</Form.Label>
                    <Form.Control
                        type="text"
                        name="data_fim"
                        value={inquilinoFormData.data_fim}
                        onChange={handleInquilinoInputChange}
                        placeholder="DD/MM/AAAA"
                        maxLength={10}
                        className="bg-dark text-light"
                      />
                    <Form.Text className="text-muted">
                      Deixe vazio para contrato por tempo indeterminado
                    </Form.Text>
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col>
                  <Form.Group className="mb-3">
                    <Form.Label>Observações</Form.Label>
                    <Form.Control
                        as="textarea"
                        rows={3}
                        name="observacoes"
                        value={inquilinoFormData.observacoes}
                        onChange={handleInquilinoInputChange}
                        placeholder="Informações adicionais sobre o inquilino..."
                        maxLength={500}
                        className="bg-dark text-light"
                      />
                  </Form.Group>
                </Col>
              </Row>
            </Modal.Body>
            <Modal.Footer className="bg-dark text-light">
              <Button variant="secondary" onClick={() => {
                setShowInquilinoModal(false)
                setSelectedProprietario(null)
                setEditingMorador(null)
                resetInquilinoForm()
              }}>
                Cancelar
              </Button>
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? (editingMorador ? 'Atualizando...' : 'Cadastrando...') : (editingMorador ? 'Atualizar Inquilino' : 'Cadastrar Inquilino')}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>

        {/* Modal para gerenciar imobiliárias */}
        <Modal show={showImobiliariaModal} onHide={() => {
          setShowImobiliariaModal(false)
          resetImobiliariaForm()
        }} size="lg">
          <Modal.Header closeButton closeVariant="white" className="bg-dark text-light">
            <Modal.Title>
              {showImobiliariaForm ? (editingImobiliaria ? 'Editar Imobiliária' : 'Nova Imobiliária') : 'Gerenciar Imobiliárias'}
            </Modal.Title>
          </Modal.Header>
          
          {!showImobiliariaForm ? (
            <>
              {/* Lista de imobiliárias */}
              <Modal.Body className="bg-dark text-light">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className="mb-0">Lista de Imobiliárias ({imobiliarias.length})</h6>
                  <Button 
                    variant="primary" 
                    size="sm"
                    onClick={handleNewImobiliaria}
                  >
                    Nova Imobiliária
                  </Button>
                </div>
                
                {imobiliarias.length === 0 ? (
                  <Alert variant="info" className="text-center bg-dark text-light border-secondary">
                    <h6>📋 Nenhuma imobiliária cadastrada</h6>
                    <p className="mb-0">Clique em "Nova Imobiliária" para adicionar a primeira</p>
                  </Alert>
                ) : (
                  <div className="table-responsive">
                    <Table hover size="sm" variant="dark">
                      <thead className="table-light">
                        <tr>
                          <th>Nome</th>
                          <th>CNPJ</th>
                          <th>Telefone</th>
                          <th>Email</th>
                          <th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {imobiliarias.map((imobiliaria) => (
                          <tr key={imobiliaria._id}>
                            <td className="fw-semibold">{imobiliaria.nome}</td>
                            <td>{imobiliaria.cnpj || 'N/A'}</td>
                            <td>{imobiliaria.telefone1 || 'N/A'}</td>
                            <td>{imobiliaria.email || 'N/A'}</td>
                            <td>
                              <div className="btn-group btn-group-sm">
                                <Button
                                  variant="outline-primary"
                                  size="sm"
                                  onClick={() => handleEditImobiliaria(imobiliaria)}
                                  title="Editar"
                                >
                                  ✏️
                                </Button>
                                <Button
                                  variant="outline-danger"
                                  size="sm"
                                  onClick={() => handleDeleteImobiliaria(imobiliaria._id)}
                                  title="Excluir"
                                >
                                  🗑️
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                )}
              </Modal.Body>
              <Modal.Footer className="bg-dark text-light">
                <Button variant="secondary" onClick={() => setShowImobiliariaModal(false)}>
                  Fechar
                </Button>
              </Modal.Footer>
            </>
          ) : (
            <>
              {/* Formulário de edição/criação */}
              <Form onSubmit={handleImobiliariaSubmit}>
                <Modal.Body className="bg-dark text-light">
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Nome da Imobiliária *</Form.Label>
                        <Form.Control
                          type="text"
                          name="nome"
                          value={imobiliariaFormData.nome}
                          onChange={handleImobiliariaInputChange}
                          required
                          placeholder="Digite o nome da imobiliária"
                          className="bg-dark text-light"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>CNPJ</Form.Label>
                        <Form.Control
                          type="text"
                          name="cnpj"
                          value={imobiliariaFormData.cnpj}
                          onChange={handleImobiliariaInputChange}
                          placeholder="00.000.000/0000-00"
                          maxLength={18}
                          className="bg-dark text-light"
                        />
                        <Form.Text className="text-muted">
                          Opcional
                        </Form.Text>
                      </Form.Group>
                    </Col>
                  </Row>

                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Telefone Principal *</Form.Label>
                        <Form.Control
                          type="text"
                          name="telefone1"
                          value={imobiliariaFormData.telefone1}
                          onChange={handleImobiliariaInputChange}
                          required
                          placeholder="(85) 99999-9999"
                          maxLength={15}
                          className="bg-dark text-light"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Email *</Form.Label>
                        <Form.Control
                          type="email"
                          name="email"
                          value={imobiliariaFormData.email}
                          onChange={handleImobiliariaInputChange}
                          required
                          placeholder="contato@imobiliaria.com"
                          className="bg-dark text-light"
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  <Row>
                    <Col md={12}>
                      <Form.Group className="mb-3">
                        <Form.Label>Endereço *</Form.Label>
                        <Form.Control
                          type="text"
                          name="endereco"
                          value={imobiliariaFormData.endereco}
                          onChange={handleImobiliariaInputChange}
                          required
                          placeholder="Endereço completo"
                          className="bg-dark text-light"
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  <Row>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>Nome do Responsável *</Form.Label>
                        <Form.Control
                          type="text"
                          name="responsavel_nome"
                          value={imobiliariaFormData.responsavel_nome}
                          onChange={handleImobiliariaInputChange}
                          required
                          placeholder="Nome do responsável"
                          className="bg-dark text-light"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>Celular do Responsável *</Form.Label>
                        <Form.Control
                          type="text"
                          name="responsavel_celular"
                          value={imobiliariaFormData.responsavel_celular}
                          onChange={handleImobiliariaInputChange}
                          required
                          placeholder="(85) 99999-9999"
                          maxLength={15}
                          className="bg-dark text-light"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>Email do Responsável *</Form.Label>
                        <Form.Control
                          type="email"
                          name="responsavel_email"
                          value={imobiliariaFormData.responsavel_email}
                          onChange={handleImobiliariaInputChange}
                          required
                          placeholder="responsavel@imobiliaria.com"
                          className="bg-dark text-light"
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  <Row>
                    <Col>
                      <Form.Group className="mb-3">
                        <Form.Label>Observações</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={3}
                          name="observacoes"
                          value={imobiliariaFormData.observacoes}
                          onChange={handleImobiliariaInputChange}
                          placeholder="Informações adicionais sobre a imobiliária..."
                          maxLength={500}
                          className="bg-dark text-light"
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                </Modal.Body>
                <Modal.Footer className="bg-dark text-light">
                  <Button variant="secondary" onClick={() => {
                    resetImobiliariaForm()
                  }}>
                    ← Voltar
                  </Button>
                  <Button variant="primary" type="submit" disabled={loading}>
                    {loading ? 'Salvando...' : (editingImobiliaria ? 'Atualizar' : 'Cadastrar')}
                  </Button>
                </Modal.Footer>
              </Form>
            </>
          )}
        </Modal>

        {/* Modal para escolher ações adicionais */}
        <Modal show={showActionsModal} onHide={handleCloseActionsModal} centered>
          <Modal.Header closeButton>
            <Modal.Title>
              🏠 Gerenciar Família e Pertences
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {selectedMoradorForActions && (
              <>
                <Alert variant="info" className="mb-4">
                  <strong>📋 Morador Selecionado:</strong><br/>
                  <strong>👤 Nome:</strong> {selectedMoradorForActions.nome}<br/>
                  <strong>🏢 Condomínio:</strong> {selectedMoradorForActions.condominio_nome}<br/>
                  <strong>🏠 Unidade:</strong> {selectedMoradorForActions.bloco ? `${selectedMoradorForActions.bloco} - ` : ''}{selectedMoradorForActions.unidade}<br/>
                  <strong>📊 Tipo:</strong> {selectedMoradorForActions.tipo === 'proprietario' ? 'Proprietário' : selectedMoradorForActions.tipo === 'inquilino' ? 'Inquilino' : 'Dependente'}
                </Alert>

                <div className="d-grid gap-3">
                  <Button 
                    variant="outline-primary" 
                    size="lg"
                    onClick={() => {
                      handleCloseActionsModal()
                      setShowConjugeModal(true)
                    }}
                  >
                    💍 Gerenciar Cônjuge
                    <br/>
                    <small className="text-muted">Cadastrar ou editar cônjuge</small>
                  </Button>

                  <Button 
                    variant="outline-success" 
                    size="lg"
                    onClick={() => {
                      handleCloseActionsModal()
                      setShowDependenteModal(true)
                    }}
                  >
                    👨‍👩‍👧‍👦 Gerenciar Dependentes
                    <br/>
                    <small className="text-muted">Cadastrar, editar ou listar dependentes</small>
                  </Button>

                  <Button 
                    variant="outline-warning" 
                    size="lg"
                    onClick={() => {
                      handleCloseActionsModal()
                      setShowVeiculoModal(true)
                    }}
                  >
                    🚗 Gerenciar Veículos
                    <br/>
                    <small className="text-muted">Cadastrar, editar ou listar veículos</small>
                  </Button>

                  <Button 
                    variant="outline-info" 
                    size="lg"
                    onClick={() => {
                      handleCloseActionsModal()
                      setShowAnimalModal(true)
                    }}
                  >
                    🐕 Gerenciar Animais
                    <br/>
                    <small className="text-muted">Cadastrar, editar ou listar animais</small>
                  </Button>
                </div>
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseActionsModal}>
              Fechar
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Modais específicos para gerenciar cada tipo */}
        {selectedMoradorForActions && (
          <>
            <ConjugeManager
              show={showConjugeModal}
              onHide={() => setShowConjugeModal(false)}
              onBack={handleBackToActionsMenu}
              morador={selectedMoradorForActions}
              onSuccess={setSuccess}
              onError={setError}
            />

            <DependenteManager
              show={showDependenteModal}
              onHide={() => setShowDependenteModal(false)}
              onBack={handleBackToActionsMenu}
              morador={selectedMoradorForActions}
              onSuccess={setSuccess}
              onError={setError}
            />

            <VeiculoManager
              show={showVeiculoModal}
              onHide={() => setShowVeiculoModal(false)}
              onBack={handleBackToActionsMenu}
              morador={selectedMoradorForActions}
              onSuccess={setSuccess}
              onError={setError}
            />

            <AnimalManager
              show={showAnimalModal}
              onHide={() => setShowAnimalModal(false)}
              onBack={handleBackToActionsMenu}
              morador={selectedMoradorForActions}
              onSuccess={setSuccess}
              onError={setError}
            />
          </>
        )}
      </Container>
    </>
  )
}