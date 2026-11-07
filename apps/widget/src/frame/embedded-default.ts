// The grey embedded default theme (SPECS/validation/tenant-fixtures.md): used before the tenant
// theme loads and whenever config or theme loading fails, so the frame is never unstyled and the
// fallback is recognisable. A unit test checks it passes the contract guard.
import type { Theme } from '@byteflock/theme/guard';

const neutralLight: Theme['color']['light'] = {
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

export const EMBEDDED_DEFAULT: Theme = {
  schemaVersion: 1,
  revision: 1,
  appearance: { mode: 'light' },
  color: {
    light: neutralLight,
    dark: {
      ...neutralLight,
      primary: '#cbd5e1',
      onPrimary: '#0f172a',
      surface: '#0f172a',
      onSurface: '#f8fafc',
      surfaceVariant: '#1e293b',
      onSurfaceVariant: '#cbd5e1',
      accent: '#cbd5e1',
      onAccent: '#0f172a',
    },
  },
  typography: { fontFamily: 'system', scale: 'md' },
  shape: { radius: 'md' },
  elevation: 'low',
  density: 'comfortable',
  brand: { name: 'Chat' },
  launcher: { position: 'bottom-right', shape: 'circle', icon: 'chat' },
};
