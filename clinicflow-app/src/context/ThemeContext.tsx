import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeId = 
  | 'dark-obsidian'
  | 'dark-emerald'
  | 'dark-violet'
  | 'light-snow'
  | 'light-warm'
  | 'light-nordic';

export interface ThemeOption {
  id: ThemeId;
  name: string;
  category: 'dark' | 'light';
  previewBg: string;
  previewAccent: string;
  previewCard: string;
  description: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  // 🌙 Modos Escuros
  {
    id: 'dark-obsidian',
    name: 'Obsidian Cyber',
    category: 'dark',
    previewBg: '#080b11',
    previewAccent: '#6366f1',
    previewCard: '#101624',
    description: 'Fundo preto profundo com Indigo & Cyan'
  },
  {
    id: 'dark-emerald',
    name: 'Emerald Midnight',
    category: 'dark',
    previewBg: '#041210',
    previewAccent: '#10b981',
    previewCard: '#0a1f1c',
    description: 'Verde esmeralda escuro e calmo'
  },
  {
    id: 'dark-violet',
    name: 'Royal Violet',
    category: 'dark',
    previewBg: '#0d0914',
    previewAccent: '#8b5cf6',
    previewCard: '#171024',
    description: 'Tom violeta noturno executivo'
  },
  // ☀️ Modos Claros
  {
    id: 'light-snow',
    name: 'Clinical Snow',
    category: 'light',
    previewBg: '#f8fafc',
    previewAccent: '#2563eb',
    previewCard: '#ffffff',
    description: 'Branco cirúrgico de alto contraste'
  },
  {
    id: 'light-warm',
    name: 'Warm Healthcare',
    category: 'light',
    previewBg: '#faf8f5',
    previewAccent: '#059669',
    previewCard: '#ffffff',
    description: 'Marfim acolhedor com verde sálvia'
  },
  {
    id: 'light-nordic',
    name: 'Nordic Cyan',
    category: 'light',
    previewBg: '#f0f7ff',
    previewAccent: '#0284c7',
    previewCard: '#ffffff',
    description: 'Azul nórdico gelado e minimalista'
  }
];

interface ThemeContextType {
  currentTheme: ThemeId;
  setTheme: (themeId: ThemeId) => void;
  toggleDarkLight: () => void;
  activeOption: ThemeOption;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTheme, setCurrentThemeState] = useState<ThemeId>(() => {
    const saved = localStorage.getItem('clinicflow_theme_key');
    if (saved && THEME_OPTIONS.some(t => t.id === saved)) {
      return saved as ThemeId;
    }
    return 'dark-obsidian';
  });

  const setTheme = (themeId: ThemeId) => {
    setCurrentThemeState(themeId);
    localStorage.setItem('clinicflow_theme_key', themeId);
    document.documentElement.setAttribute('data-theme', themeId);
  };

  const activeOption = THEME_OPTIONS.find(t => t.id === currentTheme) || THEME_OPTIONS[0];
  const isDark = activeOption.category === 'dark';

  const toggleDarkLight = () => {
    if (isDark) {
      setTheme('light-snow');
    } else {
      setTheme('dark-obsidian');
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
  }, [currentTheme]);

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme, toggleDarkLight, activeOption, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme deve ser usado dentro de um ThemeProvider');
  }
  return context;
};
