import { createContext, useContext } from 'react';

export type Theme = 'light' | 'dark';

export const ThemeContext = createContext<Theme | null>(null);

export function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('ThemeContext is not available.');
  return theme;
}
