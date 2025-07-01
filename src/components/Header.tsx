'use client'

import { useState, useEffect } from 'react'
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
  const router = useRouter()

  useEffect(() => {
    const loadUserData = () => {
      const userData = localStorage.getItem('userData')
      if (userData) {
        try {
          const user = JSON.parse(userData)
          setUserType(user.tipo || '')
          setUserName(user.nome || '')
          setUserSubtipo(user.subtipo || '')
          setCondominioNome(user.condominio_nome || '')
          
          // Para masters, carregar condomínio ativo
          if (user.tipo === 'master') {
            const activeName = localStorage.getItem('activeCondominioName')
            setActiveCondominioName(activeName || '')
          }
        } catch (error) {
          console.error('Error parsing user data:', error)
        }
      }
    }

    loadUserData()

    // Detectar página atual para destacar o menu ativo
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname
      setActiveTab(currentPath)
    }

    // Escutar mudanças no localStorage (quando condomínio ativo é alterado)
    const handleStorageChange = (e: any) => {
      // Também escutar eventos custom disparados pelo dashboard
      loadUserData()
    }

    // Escutar tanto mudanças de storage quanto eventos custom
    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('condominioChanged', handleStorageChange)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('condominioChanged', handleStorageChange)
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('userData')
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

    switch (userType) {
      case 'master':
        return [
          ...baseItems,
          { icon: '🏢', label: 'Condomínios', path: '/condominio' },
          { icon: '👥', label: 'Moradores', path: '/moradores' },
          { icon: '💰', label: 'Financeiro', path: '/financeiro' },
          { icon: '📅', label: 'Eventos', path: '/eventos' }
        ]
      case 'adm':
        return [
          ...baseItems,
          { icon: '👥', label: 'Moradores', path: '/moradores' },
          { icon: '🤝', label: 'Colaborador', path: '/colaborador' },
          { icon: '💰', label: 'Financeiro', path: '/financeiro' },
          { icon: '📅', label: 'Eventos', path: '/eventos' }
        ]
      case 'colaborador':
        return [
          ...baseItems,
          { icon: '💰', label: 'Financeiro', path: '/financeiro-colaboradores' },
          { icon: '📅', label: 'Eventos', path: '/eventos' }
        ]
      case 'morador':
        return [
          ...baseItems,
          { icon: '👤', label: 'Perfil', path: '/morador-dashboard' },
          { icon: '📅', label: 'Eventos', path: '/eventos' },
          { icon: '💳', label: 'Pagamentos', path: '/portal-pagamento' }
        ]
      default:
        return baseItems
    }
  }

  // URLs para os subitens do menu financeiro
  const financeiroLinks = {
    master: '/financeiro-condominio',
    adm: '/financeiro-condominio',
    colaborador: '/financeiro-colaboradores',
    morador: '/financeiro-morador'
  }

  // Label para o dashboard financeiro principal
  const financeiroDashboardLabel = {
    master: 'Financeiro do Condomínio',
    adm: 'Financeiro do Condomínio',
    colaborador: 'Financeiro do Colaborador',
    morador: 'Financeiro do Morador'
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
                  onClick={() => router.push('/morador-dashboard')}
                  className="ms-2"
                >
                  Meu Perfil
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
              <Nav.Item>
                <Button 
                  variant="outline-success" 
                  size="sm"
                  onClick={() => router.push('/portal-pagamento')}
                  className="ms-2"
                >
                  💳 Meus Pagamentos
                </Button>
              </Nav.Item>
              {userSubtipo === 'proprietario' && (
                <Nav.Item>
                  <Button 
                    variant="outline-light" 
                    size="sm"
                    onClick={() => router.push('/meu-inquilino')}
                    className="ms-2"
                  >
                    Meus Inquilinos
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