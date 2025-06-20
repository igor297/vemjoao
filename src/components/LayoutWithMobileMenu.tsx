'use client'

import { useState, useEffect } from 'react'
import MobileMenu from './MobileMenu'

interface LayoutWithMobileMenuProps {
  children: React.ReactNode
  showMobileMenu?: boolean
}

export default function LayoutWithMobileMenu({ 
  children, 
  showMobileMenu = true 
}: LayoutWithMobileMenuProps) {
  const [userType, setUserType] = useState<string>('')
  const [userSubtipo, setUserSubtipo] = useState<string>('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    const loadUserData = () => {
      if (typeof window !== 'undefined') {
        const userData = localStorage.getItem('userData')
        if (userData) {
          try {
            const user = JSON.parse(userData)
            setUserType(user.tipo || 'master')
            setUserSubtipo(user.subtipo || '')
          } catch (error) {
            setUserType('master')
          }
        } else {
          setUserType('master')
        }
      }
    }

    loadUserData()
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <>
      <main className="main-content">
        {children}
      </main>
      {showMobileMenu && (
        <MobileMenu userType={userType || 'master'} userSubtipo={userSubtipo} />
      )}
    </>
  )
}