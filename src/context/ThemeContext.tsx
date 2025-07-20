'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'comfort';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const themeClasses: Record<Theme, string> = {
  light: '',
  dark: 'theme-dark',
  comfort: 'theme-comfort',
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  // Inicializar com o tema salvo para evitar flash
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme') as Theme | null;
      if (savedTheme && themeClasses.hasOwnProperty(savedTheme)) {
        return savedTheme;
      }
    }
    return 'light';
  });

  useEffect(() => {
    // Este useEffect agora só é necessário para verificação adicional
    const savedTheme = localStorage.getItem('theme') as Theme | null;
    if (savedTheme && themeClasses.hasOwnProperty(savedTheme) && savedTheme !== theme) {
      setThemeState(savedTheme);
    }
  }, [theme]);

  useEffect(() => {
    const currentClass = themeClasses[theme];
    console.log('ThemeContext: Aplicando tema', theme, 'com classe', currentClass || 'nenhuma');

    Object.values(themeClasses).forEach(className => {
      if (className) {
        console.log('ThemeContext: Removendo classe', className);
        document.body.classList.remove(className);
      }
    });

    if (currentClass) {
      console.log('ThemeContext: Adicionando classe', currentClass);
      document.body.classList.add(currentClass);
    }
    
    console.log('ThemeContext: Classes finais do body:', document.body.className);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
