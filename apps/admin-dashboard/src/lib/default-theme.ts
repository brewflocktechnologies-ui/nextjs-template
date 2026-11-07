// Starting point for a tenant with no draft and no published theme: the neutral platform theme
// (SPECS/validation/tenant-fixtures.md), the same palette as the widget frame's embedded default.
import type { Theme } from '@byteflock/theme';

const light: Theme['color']['light'] = {
  primary: '#334155',
  onPrimary: '#ffffff',
  surface: '#ffffff',
  onSurface: '#0f172a',
  surfaceVariant: '#f1f5f9',
  onSurfaceVariant: '#334155',
  outline: '#64748b',
  accent: '#334155',
  onAccent: '#ffffff',
  success: '#15803d',
  warning: '#b45309',
  danger: '#b91c1c',
  focusRing: '#2563eb',
};

export const DEFAULT_THEME: Theme = {
  schemaVersion: 1,
  revision: 1,
  appearance: { mode: 'light' },
  color: {
    light,
    dark: {
      ...light,
      primary: '#cbd5e1',
      onPrimary: '#0f172a',
      surface: '#0f172a',
      onSurface: '#f8fafc',
      surfaceVariant: '#1e293b',
      onSurfaceVariant: '#cbd5e1',
      accent: '#cbd5e1',
      onAccent: '#0f172a',
      focusRing: '#60a5fa',
    },
  },
  typography: { fontFamily: 'system', scale: 'md' },
  shape: { radius: 'md' },
  elevation: 'low',
  density: 'comfortable',
  brand: { name: 'My company' },
  launcher: { position: 'bottom-right', shape: 'circle', icon: 'chat' },
};
