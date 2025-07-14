'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Navbar, Nav, Container, Button, Dropdown } from 'react-bootstrap'

interface HeaderProps {
  showLogout?: boolean
}

export default function Header({ showLogout = true }: HeaderProps) {
  const [userType, setUserType] = useState<string>('')
  const [userName, setUserName] = useState<string>('')
  const [userSubtipo, setUserSubtipo] = useState<string>('')
  const [condominioNome, setCondominioNome] = useState<string>('')
  const [activeCondominioName, setActiveCondominioName] = useState<string>('')
  const [activeTab, setActiveTab] = useState<string>('')
  const [useTicketingSystem, setUseTicketingSystem] = useState<boolean>(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const router = useRouter()

  const getLocalStorage = (key: string) => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(key)
    }
    return null
  }

  const loadCondominiumSetting = useCallback(async (condominioId: string, masterId: string) => {
    try {
      const response = await fetch(`/api/condominium-settings?condominio_id=${encodeURIComponent(condominioId)}&master_id=${encodeURIComponent(masterId)}`)
      const data = await response.json()
      if (data.success && data.setting) {
        console.log('Header: Carregando configuração de ticket:', data.setting.use_ticketing_system)
        setUseTicketingSystem(data.setting.use_ticketing_system)
      } else {
        console.log('Header: Nenhuma configuração encontrada, usando padrão false')
        setUseTicketingSystem(false) // Default to false if no setting found
      }
    } catch (error) {
      console.error('Error loading condominium setting:', error)
      setUseTicketingSystem(false)
    }
  }, [])

  useEffect(() => {
    const updateHeaderData = () => {
      const userData = getLocalStorage('userData')
      if (userData) {
        try {
          const user = JSON.parse(userData)
          setUserType(user.tipo || '')
          setUserName(user.nome || '')
          setUserSubtipo(user.subtipo || '')
          setCondominioNome(user.condominio_nome || '')
          setCurrentUserId(user.id || null)

          if (user.tipo === 'master') {
            const activeCondominioId = getLocalStorage('activeCondominio')
            const activeName = getLocalStorage('activeCondominioName')
            setActiveCondominioName(activeName || 'Nenhum condomínio ativo')
            if (activeCondominioId && user.id) {
              loadCondominiumSetting(activeCondominioId, user.id)
            }
          } else {
            // For non-master users, ensure activeCondominioName is reset or set to their specific condominium
            setActiveCondominioName(user.condominio_nome || '')
            
            // Load ticker configuration for non-master users using their condominium ID and master ID
            if (user.condominio_id && user.master_id) {
              loadCondominiumSetting(user.condominio_id, user.master_id)
            }
          }
        } catch (error) {
          console.error('Error parsing user data:', error)
        }
      } else {
        // Clear all user-related states if no user data is found
        setUserType('')
        setUserName('')
        setUserSubtipo('')
        setCondominioNome('')
        setActiveCondominioName('')
        setUseTicketingSystem(false)
        setCurrentUserId(null)
      }
    }

    // Initial load
    updateHeaderData()

    // Detect current page for active menu highlighting
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname
      setActiveTab(currentPath)
    }

    // Event listeners for storage and custom condominium changes
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', updateHeaderData)
      window.addEventListener('condominioChanged', updateHeaderData)

      return () => {
        window.removeEventListener('storage', updateHeaderData)
        window.removeEventListener('condominioChanged', updateHeaderData)
      }
    }
  }, [loadCondominiumSetting])

  const handleLogout = () => {
    // Limpar todos os dados do usuário do localStorage
    localStorage.removeItem('userData')
    localStorage.removeItem('activeCondominio')
    localStorage.removeItem('activeCondominioName')
    
    // Limpar também quaisquer outros dados que possam estar salvos
    const keysToRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.startsWith('user') || key.startsWith('active') || key.startsWith('condominio'))) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key))
    
    // Limpar estados do componente
    setUserType('')
    setUserName('')
    setUserSubtipo('')
    setCondominioNome('')
    setActiveCondominioName('')
    setUseTicketingSystem(false)
    setCurrentUserId(null)
    
    // Redirecionar para login
    router.push('/login')
  }

  const handleCondominiumClick = () => {
    router.push('/condominio')
  }

  const handleDashboardClick = () => {
    router.push('/dashboard')
  }

  const handleNavigation = (path: string) => {
    setActiveTab(path)
    router.push(path)
  }

  const getMobileMenuItems = () => {
    const baseItems = [
      {
        icon: '🏠',
        label: 'Dashboard',
        path: userType === 'master' ? '/dashboard' : 
              userType === 'adm' ? '/adm-dashboard' :
              userType === 'colaborador' ? '/colaborador-dashboard' :
              '/morador-dashboard'
      }
    ]

    let menuItems = []

    switch (userType) {
      case 'master':
        menuItems = [
          ...baseItems,
          { icon: '🏢', label: 'Condomínios', path: '/condominio' },
          { icon: '👥', label: 'Moradores', path: '/moradores' },
          { icon: '💰', label: 'Financeiro', path: '/financeiro' },
          { icon: '📅', label: 'Eventos', path: '/eventos' },
          
        ]
        if (useTicketingSystem) {
          menuItems.push({ icon: '🎫', label: 'Ticket', path: '/tickets' })
        }
        break
      case 'adm':
        menuItems = [
          ...baseItems,
          { icon: '👥', label: 'Moradores', path: '/moradores' },
          { icon: '🤝', label: 'Colaborador', path: '/colaborador' },
          { icon: '💰', label: 'Financeiro', path: '/financeiro' },
          { icon: '📅', label: 'Eventos', path: '/eventos' }
        ]
        if (useTicketingSystem) {
          menuItems.push({ icon: '🎫', label: 'Ticket', path: '/tickets' })
        }
        break
      case 'colaborador':
        menuItems = [
          ...baseItems,
          { icon: '💰', label: 'Financeiro', path: '/financeiro-colaboradores' },
          { icon: '📅', label: 'Eventos', path: '/eventos' }
        ]
        if (useTicketingSystem) {
          menuItems.push({ icon: '🎫', label: 'Ticket', path: '/tickets' })
        }
        break
      case 'morador':
        menuItems = [
          ...baseItems,
          { icon: '📅', label: 'Eventos', path: '/eventos' },
          { icon: '💳', label: 'Pagamentos', path: '/portal-pagamento' }
        ]
        if (useTicketingSystem) {
          menuItems.push({ icon: '🎫', label: 'Ticket', path: '/tickets' })
        }
        break
      default:
        menuItems = baseItems
    }
    return menuItems
  }

  const mobileMenuItems = getMobileMenuItems()

  return (
    <>
    <Navbar bg="primary" variant="dark" expand="lg" className="shadow d-none d-lg-block desktop-header">
      <Container fluid>
        <Navbar.Brand onClick={handleDashboardClick} className="d-flex align-items-center" style={{ cursor: 'pointer' }}>
          <div className="bg-white rounded-circle d-flex align-items-center justify-content-center me-3" 
               style={{ width: '32px', height: '32px' }}>
            <svg className="text-primary" width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div className="d-flex flex-column">
            <span className="fw-bold">Sistema Condominial</span>
            {userType === 'master' && (
              <small className="text-light opacity-75">
                🏢 {activeCondominioName || 'Nenhum condomínio ativo'}
              </small>
            )}
            {userType !== 'master' && condominioNome && (
              <small className="text-light opacity-75">
                🏢 {condominioNome}
              </small>
            )}
            {userType !== 'master' && !condominioNome && (
              <small className="text-light opacity-75">
                🏢 Sem condomínio definido
              </small>
            )}
          </div>
        </Navbar.Brand>
        
        <Nav className="me-auto">
          <Nav.Item>
            <Button 
              variant="outline-light" 
              size="sm"
              onClick={() => {
                if (userType === 'master') {
                  handleDashboardClick()
                } else if (userType === 'adm') {
                  router.push('/adm-dashboard')
                } else if (userType === 'colaborador') {
                  router.push('/colaborador-dashboard')
                } else if (userType === 'morador') {
                  router.push('/morador-dashboard')
                }
              }}
              className="ms-3"
            >
              Dashboard
            </Button>
          </Nav.Item>
          
          {userType === 'master' && (
            <>
              <Nav.Item>
                <Button 
                  variant="outline-light" 
                  size="sm"
                  onClick={handleCondominiumClick}
                  className="ms-2"
                >
                  Condomínios
                </Button>
              </Nav.Item>
              <Nav.Item>
                <Button 
                  variant="outline-light" 
                  size="sm"
                  onClick={() => router.push('/adm')}
                  className="ms-2"
                >
                  ADM
                </Button>
              </Nav.Item>
              <Nav.Item>
                <Button 
                  variant="outline-light" 
                  size="sm"
                  onClick={() => router.push('/colaborador')}
                  className="ms-2"
                >
                  Colaborador
                </Button>
              </Nav.Item>
              <Nav.Item>
                <Button 
                  variant="outline-light" 
                  size="sm"
                  onClick={() => router.push('/moradores')}
                  className="ms-2"
                >
                  Moradores
                </Button>
              </Nav.Item>
              
              <Nav.Item>
                <Button 
                  variant="outline-light" 
                  size="sm"
                  onClick={() => router.push('/eventos')}
                  className="ms-2"
                >
                  📅 Eventos
                </Button>
              </Nav.Item>
              {useTicketingSystem && (
                <Nav.Item>
                  <Button 
                    variant="outline-light" 
                    size="sm"
                    onClick={() => router.push('/tickets')}
                    className="ms-2"
                  >
                    🎫 Ticket
                  </Button>
                </Nav.Item>
              )}
              <Nav.Item>
                {/* Menu suspenso para Financeiro */}
                <Dropdown className="ms-2">
                  <Dropdown.Toggle variant="outline-light" size="sm" id="dropdown-financeiro">
                    💰 Financeiro
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    <Dropdown.Item onClick={() => router.push('/financeiro')}>Dashboard Financeiro</Dropdown.Item>
                    <Dropdown.Item onClick={() => router.push('/financeiro-condominio')}>Financeiro do Condomínio</Dropdown.Item>
                    <Dropdown.Item onClick={() => router.push('/financeiro-colaboradores')}>Financeiro do Colaborador</Dropdown.Item>
                    <Dropdown.Item onClick={() => router.push('/financeiro-morador')}>Financeiro do Morador</Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              </Nav.Item>
            </>
          )}
          
          {userType === 'adm' && (
            <>
              <Nav.Item>
                <Button 
                  variant="outline-light" 
                  size="sm"
                  onClick={() => router.push('/colaborador')}
                  className="ms-2"
                >
                  Colaborador
                </Button>
              </Nav.Item>
              <Nav.Item>
                <Button 
                  variant="outline-light" 
                  size="sm"
                  onClick={() => router.push('/moradores')}
                  className="ms-2"
                >
                  Moradores
                </Button>
              </Nav.Item>
              <Nav.Item>
                <Button 
                  variant="outline-light" 
                  size="sm"
                  onClick={() => router.push('/eventos')}
                  className="ms-2"
                >
                  📅 Eventos
                </Button>
              </Nav.Item>
              {useTicketingSystem && (
                <Nav.Item>
                  <Button 
                    variant="outline-light" 
                    size="sm"
                    onClick={() => router.push('/tickets')}
                    className="ms-2"
                  >
                    🎫 Ticket
                  </Button>
                </Nav.Item>
              )}
              <Nav.Item>
                {/* Menu suspenso para Financeiro */}
                <Dropdown className="ms-2">
                  <Dropdown.Toggle variant="outline-light" size="sm" id="dropdown-financeiro">
                    💰 Financeiro
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    <Dropdown.Item onClick={() => router.push('/financeiro')}>Dashboard Financeiro</Dropdown.Item>
                    <Dropdown.Item onClick={() => router.push('/financeiro-condominio')}>Financeiro do Condomínio</Dropdown.Item>
                    <Dropdown.Item onClick={() => router.push('/financeiro-colaboradores')}>Financeiro do Colaborador</Dropdown.Item>
                    <Dropdown.Item onClick={() => router.push('/financeiro-morador')}>Financeiro do Morador</Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              </Nav.Item>
            </>
          )}
          
          {userType === 'colaborador' && (
            <>
              <Nav.Item>
                <Button 
                  variant="outline-light" 
                  size="sm"
                  onClick={() => router.push('/eventos')}
                  className="ms-2"
                >
                  📅 Eventos
                </Button>
              </Nav.Item>
              {useTicketingSystem && (
                <Nav.Item>
                  <Button 
                    variant="outline-light" 
                    size="sm"
                    onClick={() => router.push('/tickets')}
                    className="ms-2"
                  >
                    🎫 Ticket
                  </Button>
                </Nav.Item>
              )}
              <Nav.Item>
                {/* Menu suspenso para Financeiro */}
                <Dropdown className="ms-2">
                  <Dropdown.Toggle variant="outline-light" size="sm" id="dropdown-financeiro">
                    💰 Financeiro
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    <Dropdown.Item onClick={() => router.push('/financeiro')}>Dashboard Financeiro</Dropdown.Item>
                    <Dropdown.Item onClick={() => router.push('/financeiro-condominio')}>Financeiro do Condomínio</Dropdown.Item>
                    <Dropdown.Item onClick={() => router.push('/financeiro-colaboradores')}>Financeiro do Colaborador</Dropdown.Item>
                    <Dropdown.Item onClick={() => router.push('/financeiro-morador')}>Financeiro do Morador</Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              </Nav.Item>
            </>
          )}
          
          {userType === 'morador' && (
            <>
              
              <Nav.Item>
                <Button 
                  variant="outline-light" 
                  size="sm"
                  onClick={() => router.push('/eventos')}
                  className="ms-2"
                >
                  📅 Eventos
                </Button>
              </Nav.Item>
              <Nav.Item>
                <Button 
                  variant="outline-light" 
                  size="sm"
                  onClick={() => router.push('/portal-pagamento')}
                  className="ms-2"
                >
                  💳 Meus Pagamentos
                </Button>
              </Nav.Item>
              {useTicketingSystem && (
                <Nav.Item>
                  <Button 
                    variant="outline-light" 
                    size="sm"
                    onClick={() => router.push('/tickets')}
                    className="ms-2"
                  >
                    🎫 Ticket
                  </Button>
                </Nav.Item>
              )}
              {userSubtipo === 'proprietario' && (
                <Nav.Item>
                  <Button 
                    variant="outline-light" 
                    size="sm"
                    onClick={() => router.push('/meu-inquilino')}
                    className="ms-2"
                  >
                    Meu Inquilino
                  </Button>
                </Nav.Item>
              )}
            </>
          )}
        </Nav>

        {showLogout && (
          <Nav className="ms-auto">
            <Nav.Item className="d-flex align-items-center">
              <div className="text-light me-3">
                <div className="fw-bold">{userName}</div>
                <small>
                  {userType === 'master' && 'Master'}
                  {userType === 'adm' && `${userSubtipo?.charAt(0).toUpperCase()}${userSubtipo?.slice(1)}`}
                  {userType === 'adm' && condominioNome && ` - ${condominioNome}`}
                  {userType === 'colaborador' && `Colaborador - ${condominioNome}`}
                  {userType === 'morador' && `Morador - ${condominioNome}`}
                </small>
              </div>
              <Button variant="danger" size="sm" onClick={handleLogout}>
                Sair
              </Button>
            </Nav.Item>
          </Nav>
        )}
      </Container>
    </Navbar>
    
    {/* Mobile Menu */}
    <div className="mobile-menu-container d-block d-lg-none">
      <div className="mobile-menu">
        {mobileMenuItems.map((item, index) => (
          <button
            key={index}
            className={`mobile-menu-item ${activeTab === item.path ? 'active' : ''}`}
            onClick={() => handleNavigation(item.path)}
          >
            <div className="mobile-menu-icon">{item.icon}</div>
            <div className="mobile-menu-label">{item.label}</div>
          </button>
        ))}
        <button
          className="mobile-menu-item"
          onClick={handleLogout}
          title="Sair"
        >
          <div className="mobile-menu-icon">🚪</div>
          <div className="mobile-menu-label">Sair</div>
        </button>
      </div>
    </div>
    </>
  )
}
