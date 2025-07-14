"use client";
import { usePathname, useRouter } from "next/navigation";
import Header from "./Header";
import { ReactNode, useEffect, useState } from "react";

export default function ClientShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const hideShell = pathname === "/login";

  useEffect(() => {
    // Lógica de autenticação existente
    const userData = localStorage.getItem('userData');
    
    if (!userData && !hideShell) {
      router.push('/login');
      return;
    }
    
    if (userData) {
      try {
        JSON.parse(userData); 
        setIsAuthenticated(true);
      } catch (error) {
        localStorage.removeItem('userData');
        if (!hideShell) {
          router.push('/login');
          return;
        }
      }
    }
    
    setIsLoading(false);

    // Lógica de tema
    const applyTheme = (theme: string) => {
      console.log('🎨 ClientShell: Aplicando tema:', theme)
      if (document.body) {
        if (theme === 'dark') {
          document.body.classList.add('dark-mode');
          console.log('🎨 ClientShell: Classe dark-mode adicionada ao body')
        } else {
          document.body.classList.remove('dark-mode');
          console.log('🎨 ClientShell: Classe dark-mode removida do body')
        }
        console.log('🎨 ClientShell: Classes do body:', document.body.className)
      }
    };

    const savedTheme = localStorage.getItem('theme');
    console.log('🎨 ClientShell: Tema salvo no localStorage:', savedTheme)
    if (savedTheme) {
      applyTheme(savedTheme);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      // Detecta a preferência do sistema operacional se não houver tema salvo
      console.log('🎨 ClientShell: Usando preferência do sistema (dark)')
      applyTheme('dark');
    } else {
      console.log('🎨 ClientShell: Usando tema padrão (light)')
      applyTheme('light');
    }

    const handleThemeChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('🎨 ClientShell: Evento themeChange recebido:', customEvent.detail)
      applyTheme(customEvent.detail);
    };

    window.addEventListener('themeChange', handleThemeChange);

    return () => {
      window.removeEventListener('themeChange', handleThemeChange);
    };

  }, [pathname, router, hideShell]);

  // Mostrar loading enquanto verifica autenticação
  if (isLoading && !hideShell) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Carregando...</span>
        </div>
      </div>
    );
  }

  // Se está na página de login, mostrar sem verificações
  if (hideShell) {
    return children;
  }

  // Se não está autenticado, não mostrar conteúdo
  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <Header />
      <div className="main-content">
        {children}
      </div>
    </>
  );
}
