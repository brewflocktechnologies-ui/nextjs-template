// Publish-time contrast policy (THEME-06, extended by D-20 because the tenant theme also styles the
// dashboard). WCAG 2.2 relative luminance and contrast ratio, implemented locally (no dependency).
import type { ColorRole, Theme } from './schema/theme.v1';

export interface ContrastRule {
  foreground: ColorRole;
  background: ColorRole;
  required: number;
  reason: string;
}

export interface PolicyViolation {
  appearance: 'light' | 'dark';
  pair: `${ColorRole}/${ColorRole}`;
  ratio: number;
  required: number;
  reason: string;
}

export const CONTRAST_RULES: readonly ContrastRule[] = [
  // THEME-06: text pairs, WCAG 2.2 AA.
  {
    foreground: 'onPrimary',
    background: 'primary',
    required: 4.5,
    reason: 'text on primary',
  },
  {
    foreground: 'onSurface',
    background: 'surface',
    required: 4.5,
    reason: 'body text',
  },
  {
    foreground: 'onSurfaceVariant',
    background: 'surfaceVariant',
    required: 4.5,
    reason: 'secondary text',
  },
  {
    foreground: 'onAccent',
    background: 'accent',
    required: 4.5,
    reason: 'text on accent',
  },
  {
    foreground: 'focusRing',
    background: 'surface',
    required: 3,
    reason: 'focus indicator',
  },
  // D-20: the dashboard uses the tenant theme too.
  {
    foreground: 'outline',
    background: 'surface',
    required: 3,
    reason: 'borders and inputs (WCAG 1.4.11)',
  },
  {
    foreground: 'primary',
    background: 'surface',
    required: 3,
    reason: 'primary controls as UI components',
  },
  {
    foreground: 'danger',
    background: 'surface',
    required: 3,
    reason: 'status icons and borders',
  },
  {
    foreground: 'success',
    background: 'surface',
    required: 3,
    reason: 'status icons and borders',
  },
  {
    foreground: 'warning',
    background: 'surface',
    required: 3,
    reason: 'status icons and borders',
  },
  {
    foreground: 'onSurface',
    background: 'surfaceVariant',
    required: 4.5,
    reason: 'text on panels and table rows',
  },
];

/** WCAG relative luminance of a #rrggbb colour. */
export function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG contrast ratio between two #rrggbb colours, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Every rule broken by the theme, in both colour sets. Empty means the theme may be published. */
export function checkContrastPolicy(theme: Theme): PolicyViolation[] {
  const violations: PolicyViolation[] = [];
  for (const appearance of ['light', 'dark'] as const) {
    const set = theme.color[appearance];
    for (const rule of CONTRAST_RULES) {
      const ratio = contrastRatio(set[rule.foreground], set[rule.background]);
      if (ratio < rule.required) {
        violations.push({
          appearance,
          pair: `${rule.foreground}/${rule.background}`,
          ratio: Math.round(ratio * 100) / 100,
          required: rule.required,
          reason: rule.reason,
        });
      }
    }
  }
  return violations;
}
