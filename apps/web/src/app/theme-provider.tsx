'use client';

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

export interface AppTheme {
  restaurantName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  buttonColor: string;
  cardColor: string;
  borderRadius: string;
  fontFamily: string;
  darkModeEnabled: boolean;
}

interface ThemeContextValue {
  theme: AppTheme;
  draftTheme: AppTheme;
  setDraftTheme: (theme: AppTheme) => void;
  updateDraft: (patch: Partial<AppTheme>) => void;
  saveTheme: () => Promise<void>;
  restoreDefault: () => Promise<void>;
}

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const localThemeKey = 'restaurant-theme';

const defaultTheme: AppTheme = {
  restaurantName: 'Mi Restaurante',
  logoUrl: null,
  primaryColor: '#0f766e',
  secondaryColor: '#d97706',
  backgroundColor: '#eef2f1',
  textColor: '#17211f',
  buttonColor: '#0f766e',
  cardColor: '#ffffff',
  borderRadius: '8px',
  fontFamily: 'Inter, system-ui, sans-serif',
  darkModeEnabled: false
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState(defaultTheme);
  const [draftTheme, setDraftTheme] = useState(defaultTheme);

  useEffect(() => {
    const controller = new AbortController();
    const localTheme = readLocalTheme();

    if (localTheme) {
      setTheme(localTheme);
      setDraftTheme(localTheme);
    }

    fetch(`${apiUrl}/theme/current`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : defaultTheme)
      .then((loadedTheme: AppTheme) => {
        const normalized = normalizeTheme(loadedTheme);
        window.localStorage.setItem(localThemeKey, JSON.stringify(normalized));
        setTheme(normalized);
        setDraftTheme(normalized);
      })
      .catch(() => {
        if (!localTheme) {
          setTheme(defaultTheme);
          setDraftTheme(defaultTheme);
        }
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    applyThemeVariables(draftTheme);
  }, [draftTheme]);

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    draftTheme,
    setDraftTheme,
    updateDraft: (patch) => setDraftTheme((current) => ({ ...current, ...patch })),
    saveTheme: async () => {
      const accessToken = window.localStorage.getItem('accessToken');

      if (!accessToken) {
        throw new Error('Inicia sesion con el backend real para guardar el tema.');
      }

      const response = await fetch(`${apiUrl}/theme`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify(draftTheme)
      });

      if (!response.ok) {
        throw new Error('No se pudo guardar el tema. Inicia sesion como ADMIN o MANAGER.');
      }

      const savedTheme = normalizeTheme(await response.json());
      window.localStorage.setItem(localThemeKey, JSON.stringify(savedTheme));
      setTheme(savedTheme);
      setDraftTheme(savedTheme);
    },
    restoreDefault: async () => {
      const accessToken = window.localStorage.getItem('accessToken');

      if (!accessToken) {
        throw new Error('Inicia sesion con el backend real para restaurar el tema.');
      }

      const response = await fetch(`${apiUrl}/theme/restore-default`, {
        method: 'POST',
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
      });

      if (!response.ok) {
        setTheme(defaultTheme);
        setDraftTheme(defaultTheme);
        return;
      }

      const restoredTheme = normalizeTheme(await response.json());
      window.localStorage.removeItem(localThemeKey);
      setTheme(restoredTheme);
      setDraftTheme(restoredTheme);
    }
  }), [draftTheme, theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function readLocalTheme() {
  try {
    const value = window.localStorage.getItem(localThemeKey);
    return value ? normalizeTheme(JSON.parse(value) as Partial<AppTheme>) : null;
  } catch {
    return null;
  }
}

export function useAppTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useAppTheme debe usarse dentro de ThemeProvider');
  }

  return context;
}

function normalizeTheme(theme: Partial<AppTheme>): AppTheme {
  return {
    ...defaultTheme,
    ...theme
  };
}

function applyThemeVariables(theme: AppTheme) {
  const root = document.documentElement;

  root.style.setProperty('--color-background', theme.backgroundColor);
  root.style.setProperty('--color-surface', theme.cardColor);
  root.style.setProperty('--color-surface-soft', theme.darkModeEnabled ? '#1f2937' : '#f7faf8');
  root.style.setProperty('--color-text', theme.textColor);
  root.style.setProperty('--color-muted', theme.darkModeEnabled ? '#cbd5e1' : '#66736f');
  root.style.setProperty('--color-primary', theme.primaryColor);
  root.style.setProperty('--color-primary-contrast', '#ffffff');
  root.style.setProperty('--color-accent', theme.secondaryColor);
  root.style.setProperty('--color-button', theme.buttonColor);
  root.style.setProperty('--color-border', theme.darkModeEnabled ? '#334155' : '#d8e0dd');
  root.style.setProperty('--radius-md', theme.borderRadius);
  root.style.setProperty('--font-family-app', theme.fontFamily);
  root.style.fontFamily = theme.fontFamily;
  root.dataset.themeMode = theme.darkModeEnabled ? 'dark' : 'light';
}
