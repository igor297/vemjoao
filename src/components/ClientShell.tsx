"use client";
import { usePathname, useRouter } from "next/navigation";
import Header from "./Header";
import { ReactNode, useEffect, useState } from "react";
import { ThemeProvider } from "@/context/ThemeContext";

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

    // Tema agora é gerenciado exclusivamente pelo ThemeContext
    // Removida lógica duplicada para evitar conflitos

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
    return <ThemeProvider>{children}</ThemeProvider>;
  }

  // Se não está autenticado, não mostrar conteúdo
  if (!isAuthenticated) {
    return null;
  }

  return (
    <ThemeProvider>
      <Header />
      <div className="main-content">
        {children}
      </div>
    </ThemeProvider>
  );
}
