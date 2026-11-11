// SSR tenant theme (P1.6-T04, D-20): published theme → full validation → resolveTheme → the full
// variable map for the dashboard chrome. Anything that fails validation falls back to the platform
// defaults here, at the data layer, never at render (THEME-05, T-03).
import 'server-only';
import {
  SEMANTIC_DEFAULTS_DARK,
  SEMANTIC_DEFAULTS_LIGHT,
} from '@byteflock/design-tokens';
import {
  RESOLVED_KEYS,
  resolveTheme,
  validateTheme,
  type ResolvedVars,
  type Theme,
} from '@byteflock/theme';
import { getPublishedTheme } from '../data/themes';
import type { RequestContext } from './session/types';

export interface TenantThemeView {
  /** Variables for `:root`: light for light/system tenants, dark for dark ones. */
  vars: ResolvedVars;
  /** Dark variables for `system` tenants, emitted under prefers-color-scheme. */
  darkVars?: ResolvedVars;
  appearance: Theme['appearance']['mode'];
  density: Theme['density'];
  brandName: string;
  logoUrl?: string;
  /** True when a stored theme existed but failed validation (dev banner). */
  invalid: boolean;
}

const pick = (source: Readonly<Record<string, string>>) =>
  Object.fromEntries(RESOLVED_KEYS.map((k) => [k, source[k]])) as ResolvedVars;

/** The platform defaults (design tokens), as the same allow-listed variables. */
export const DEFAULT_VARS = {
  light: pick(SEMANTIC_DEFAULTS_LIGHT),
  dark: pick(SEMANTIC_DEFAULTS_DARK),
};

const defaults = (invalid: boolean): TenantThemeView => ({
  vars: DEFAULT_VARS.light,
  appearance: 'light',
  density: 'comfortable',
  brandName: 'Byteflock',
  invalid,
});

/** Placeholder asset resolver until asset storage exists: brand.logoAssetId → /brand/<id>.svg. */
const logoUrlOf = (theme: Theme) =>
  theme.brand.logoAssetId ? `/brand/${theme.brand.logoAssetId}.svg` : undefined;

export async function tenantThemeView(
  ctx: RequestContext | null,
): Promise<TenantThemeView> {
  // Platform scope always shows the platform default design on the chrome (D-25, ADR-013).
  if (!ctx || ctx.scope === 'platform') return defaults(false);
  const published = await getPublishedTheme(ctx.tenantId);
  if (!published) return defaults(false);
  const result = validateTheme(published.doc);
  if (!result.ok) return defaults(true);
  const theme = result.value;
  const mode = theme.appearance.mode;
  return {
    vars: resolveTheme(theme, {
      appearance: mode === 'dark' ? 'dark' : 'light',
    }),
    darkVars:
      mode === 'system'
        ? resolveTheme(theme, { appearance: 'dark' })
        : undefined,
    appearance: mode,
    density: theme.density,
    brandName: theme.brand.name,
    logoUrl: logoUrlOf(theme),
    invalid: false,
  };
}
