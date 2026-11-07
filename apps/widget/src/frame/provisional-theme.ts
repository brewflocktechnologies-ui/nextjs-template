// PROVISIONAL — replaced by @byteflock/theme in P1.5.
//
// PoC-A runs in parallel with the theme contract (P1.3), so the frame needs a temporary guard and
// mapper for theme documents shaped like THEME-02. It covers only what the PoC renders. P1.5 deletes
// this file and uses isSupportedTheme and resolveTheme from @byteflock/theme; P1.5-AC01 checks.
import type { LauncherTheme, Radius } from '../bridge/protocol';

export type Appearance = 'light' | 'dark';

interface ColorSet {
  primary: string;
  onPrimary: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  outline: string;
  accent: string;
  onAccent: string;
  success: string;
  warning: string;
  danger: string;
  focusRing: string;
}

export interface ProvisionalTheme {
  schemaVersion: 1;
  appearance: { mode: 'light' | 'dark' | 'system' };
  color: { light: ColorSet; dark: ColorSet };
  typography: { fontFamily: 'system' | 'inter' | 'roboto' | 'source-sans' | 'noto-sans'; scale: 'sm' | 'md' | 'lg' };
  shape: { radius: Radius };
  density: 'compact' | 'comfortable' | 'spacious';
  brand: { name: string };
  launcher: { position: 'bottom-right' | 'bottom-left'; shape: 'circle' | 'pill'; icon: 'chat' | 'help' | 'message' };
}

const ROLES: (keyof ColorSet)[] = [
  'primary', 'onPrimary', 'surface', 'onSurface', 'surfaceVariant', 'onSurfaceVariant',
  'outline', 'accent', 'onAccent', 'success', 'warning', 'danger', 'focusRing',
];
const COLOR = /^#[0-9a-f]{6}$/;
const oneOf = (v: unknown, values: readonly string[]) => typeof v === 'string' && values.includes(v);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export type GuardResult = { ok: true; theme: ProvisionalTheme } | { ok: false; code: 'THEME_INVALID' | 'THEME_UNSUPPORTED_VERSION' };

/** Structural check of the fields the PoC uses. The full schema check is the publish step's job. */
export function checkTheme(doc: unknown): GuardResult {
  if (!isObj(doc)) return { ok: false, code: 'THEME_INVALID' };
  if (doc.schemaVersion !== 1) return { ok: false, code: 'THEME_UNSUPPORTED_VERSION' };
  const color = doc.color;
  const sets = isObj(color) ? [color.light, color.dark] : [];
  const colorsOk = sets.length === 2 && sets.every((s) => isObj(s) && ROLES.every((r) => typeof s[r] === 'string' && COLOR.test(s[r] as string)));
  const t = doc as Record<string, Record<string, unknown>>;
  const ok =
    colorsOk &&
    isObj(t.appearance) && oneOf(t.appearance.mode, ['light', 'dark', 'system']) &&
    isObj(t.typography) && oneOf(t.typography.fontFamily, ['system', 'inter', 'roboto', 'source-sans', 'noto-sans']) &&
    oneOf(t.typography.scale, ['sm', 'md', 'lg']) &&
    isObj(t.shape) && oneOf(t.shape.radius, ['none', 'sm', 'md', 'lg', 'full']) &&
    oneOf(doc.density, ['compact', 'comfortable', 'spacious']) &&
    isObj(t.brand) && typeof t.brand.name === 'string' && t.brand.name.length > 0 && t.brand.name.length <= 60 &&
    isObj(t.launcher) && oneOf(t.launcher.position, ['bottom-right', 'bottom-left']) &&
    oneOf(t.launcher.shape, ['circle', 'pill']) && oneOf(t.launcher.icon, ['chat', 'help', 'message']);
  return ok ? { ok: true, theme: doc as unknown as ProvisionalTheme } : { ok: false, code: 'THEME_INVALID' };
}

const neutral: ColorSet = {
  primary: '#334155', onPrimary: '#ffffff', surface: '#ffffff', onSurface: '#0f172a',
  surfaceVariant: '#f1f5f9', onSurfaceVariant: '#334155', outline: '#64748b', accent: '#334155',
  onAccent: '#ffffff', success: '#15803d', warning: '#b45309', danger: '#b91c1c', focusRing: '#2563eb',
};

/** The grey embedded default (SPECS/validation/tenant-fixtures.md), recognisable as a fallback. */
export const EMBEDDED_DEFAULT: ProvisionalTheme = {
  schemaVersion: 1,
  appearance: { mode: 'light' },
  color: {
    light: neutral,
    dark: { ...neutral, primary: '#cbd5e1', onPrimary: '#0f172a', surface: '#0f172a', onSurface: '#f8fafc', surfaceVariant: '#1e293b', onSurfaceVariant: '#cbd5e1', accent: '#cbd5e1', onAccent: '#0f172a' },
  },
  typography: { fontFamily: 'system', scale: 'md' },
  shape: { radius: 'md' },
  density: 'comfortable',
  brand: { name: 'Chat' },
  launcher: { position: 'bottom-right', shape: 'circle', icon: 'chat' },
};

const RADIUS: Record<Radius, string> = { none: '0px', sm: '4px', md: '8px', lg: '16px', full: '9999px' };
const DENSITY = { compact: '0.85', comfortable: '1', spacious: '1.2' } as const;
const TYPE_SCALE = { sm: '0.875', md: '1', lg: '1.125' } as const;
export const FONT_STACKS = {
  system: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  inter: 'Inter, system-ui, sans-serif',
  roboto: 'Roboto, system-ui, sans-serif',
  'source-sans': '"Source Sans 3", system-ui, sans-serif',
  'noto-sans': '"Noto Sans", system-ui, sans-serif',
} as const;

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** Maps a checked theme to --sem-* variables for one appearance. Values come only from tables or validated colours. */
export function themeToVars(theme: ProvisionalTheme, appearance: Appearance): Record<string, string> {
  const colors = theme.color[appearance];
  const vars: Record<string, string> = {};
  for (const role of ROLES) vars[`--sem-color-${kebab(role)}`] = colors[role];
  vars['--sem-radius-md'] = RADIUS[theme.shape.radius];
  vars['--sem-font-family-sans'] = FONT_STACKS[theme.typography.fontFamily];
  vars['--sem-density-factor'] = DENSITY[theme.density];
  vars['--sem-type-scale'] = TYPE_SCALE[theme.typography.scale];
  return vars;
}

export function launcherThemeOf(theme: ProvisionalTheme, appearance: Appearance): LauncherTheme {
  const c = theme.color[appearance];
  return {
    bg: c.primary,
    fg: c.onPrimary,
    radius: theme.shape.radius,
    icon: theme.launcher.icon,
    position: theme.launcher.position,
    shape: theme.launcher.shape,
  };
}
