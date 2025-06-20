'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface MobileMenuProps {
  userType: string
  userSubtipo: string
}

export default function MobileMenu({ userType, userSubtipo }: MobileMenuProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<string>('')

  useEffect(() => {
    // Detectar página atual para destacar o menu ativo
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname
      setActiveTab(currentPath)
    }
  }, [])

  const handleNavigation = (path: string) => {
    setActiveTab(path)
    router.push(path)
  }

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('userData')
      router.push('/login')
    }
  }

  const getMenuItems = () => {
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
          { icon: '💰', label: 'Financeiro', path: '/financeiro-colaborador' },
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

  const menuItems = getMenuItems()

  return (
    <div className="mobile-menu-container">
      <div className="mobile-menu">
        {menuItems.map((item, index) => (
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
  )
}