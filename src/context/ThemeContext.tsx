import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

export type ThemeColor = 'blue' | 'green' | 'orange' | 'red' | 'slate';

interface ThemeContextType {
  theme: ThemeColor;
  setTheme: (theme: ThemeColor) => Promise<void>;
  themeColors: {
    primary: string;
    primaryHover: string;
    primaryLight: string;
    primaryDark: string;
    bg: string;
    text: string;
  };
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const themeConfig: Record<ThemeColor, {
  primary: string;
  primaryHover: string;
  primaryLight: string;
  primaryDark: string;
  bg: string;
  text: string;
}> = {
  blue: {
    primary: 'bg-blue-600',
    primaryHover: 'hover:bg-blue-700',
    primaryLight: 'bg-blue-50',
    primaryDark: 'bg-blue-800',
    bg: 'bg-blue-100',
    text: 'text-blue-600'
  },
  green: {
    primary: 'bg-green-600',
    primaryHover: 'hover:bg-green-700',
    primaryLight: 'bg-green-50',
    primaryDark: 'bg-green-800',
    bg: 'bg-green-100',
    text: 'text-green-600'
  },
  orange: {
    primary: 'bg-orange-600',
    primaryHover: 'hover:bg-orange-700',
    primaryLight: 'bg-orange-50',
    primaryDark: 'bg-orange-800',
    bg: 'bg-orange-100',
    text: 'text-orange-600'
  },
  red: {
    primary: 'bg-red-600',
    primaryHover: 'hover:bg-red-700',
    primaryLight: 'bg-red-50',
    primaryDark: 'bg-red-800',
    bg: 'bg-red-100',
    text: 'text-red-600'
  },
  slate: {
    primary: 'bg-slate-600',
    primaryHover: 'hover:bg-slate-700',
    primaryLight: 'bg-slate-50',
    primaryDark: 'bg-slate-800',
    bg: 'bg-slate-100',
    text: 'text-slate-600'
  }
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<ThemeColor>('blue');

  useEffect(() => {
    const loadTheme = async () => {
      if (!user?.id) {
        setThemeState('blue');
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .select('theme_preference')
        .eq('id', user.id)
        .single();

      if (!error && data?.theme_preference) {
        setThemeState(data.theme_preference as ThemeColor);
      }
    };

    loadTheme();
  }, [user?.id]);

  const setTheme = async (newTheme: ThemeColor) => {
    if (!user?.id) return;

    const { error } = await supabase
      .from('users')
      .update({ theme_preference: newTheme })
      .eq('id', user.id);

    if (!error) {
      setThemeState(newTheme);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themeColors: themeConfig[theme] }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
