'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { ResolvedVars, Theme } from '@byteflock/theme/guard';

const ThemeContext = createContext<ResolvedVars | null>(null);

export interface ThemeProviderProps {
  /** Already-resolved variables; the server resolves the tenant theme, never the component. */
  vars: ResolvedVars;
  children?: ReactNode;
}

export function ThemeProvider({ vars, children }: ThemeProviderProps) {
  return <ThemeContext.Provider value={vars}>{children}</ThemeContext.Provider>;
}

/** The resolved variables of the nearest ThemeProvider. Throws outside one. */
export function useTheme(): ResolvedVars {
  const vars = useContext(ThemeContext);
  if (!vars) throw new Error('useTheme() must be used inside <ThemeProvider>');
  return vars;
}

export interface ThemeAttributes {
  'data-appearance': Theme['appearance']['mode'];
  'data-density': Theme['density'];
}

/** Attributes for the theme root element, so CSS can follow appearance and density. */
export function themeAttributes(
  theme: Pick<Theme, 'appearance' | 'density'>,
): ThemeAttributes {
  return {
    'data-appearance': theme.appearance.mode,
    'data-density': theme.density,
  };
}
