import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { ThemeContext } from './ThemeContext';
import type { ThemeName } from './types';

interface ThemeProviderProps {
  children: ReactNode;
  initialTheme?: ThemeName;
}

function getPreferredTheme(): ThemeName {
  if (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }

  return 'light';
}

export function ThemeProvider({ children, initialTheme }: ThemeProviderProps) {
  const [theme, setTheme] = useState<ThemeName>(() => initialTheme ?? getPreferredTheme());

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => {
        setTheme((currentTheme) => (currentTheme === 'light' ? 'dark' : 'light'));
      },
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
