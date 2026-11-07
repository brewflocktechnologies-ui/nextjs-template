// The only CSS variables the resolver may emit (THEME-03). Every key is a design-token semantic
// variable (a test checks they all exist in SEMANTIC_VARIABLE_NAMES). Consumers that apply resolved
// variables (the frame's ThemeController, React's ThemeStyleTag) refuse any other key.
import type { ColorRole } from './schema/constants';

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

export const colorVar = (role: ColorRole) =>
  `--sem-color-${kebab(role)}` as const;

export const RESOLVED_KEYS = [
  '--sem-color-primary',
  '--sem-color-on-primary',
  '--sem-color-surface',
  '--sem-color-on-surface',
  '--sem-color-surface-variant',
  '--sem-color-on-surface-variant',
  '--sem-color-outline',
  '--sem-color-accent',
  '--sem-color-on-accent',
  '--sem-color-success',
  '--sem-color-warning',
  '--sem-color-danger',
  '--sem-color-focus-ring',
  '--sem-radius-md',
  '--sem-elevation-surface',
  '--sem-density-factor',
  '--sem-type-scale',
  '--sem-font-family-sans',
] as const;

export type ResolvedKey = (typeof RESOLVED_KEYS)[number];
export type ResolvedVars = Record<ResolvedKey, string>;

const KEYS = new Set<string>(RESOLVED_KEYS);
export const isResolvedKey = (key: string): key is ResolvedKey => KEYS.has(key);
