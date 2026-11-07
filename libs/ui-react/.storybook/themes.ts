// Tenant themes for the Storybook toolbar (P1.4-T04). The fixtures are the P1.3 contract fixtures,
// resolved with the same resolver the dashboard and the widget frame use.
import type { ResolvedVars, Theme } from '@byteflock/theme/guard';
import { appearanceOf, resolveTheme } from '@byteflock/theme/resolve';
import acme from '@byteflock/theme/fixtures/valid/acme-light.json';
import globex from '@byteflock/theme/fixtures/valid/globex-dark.json';
import initech from '@byteflock/theme/fixtures/valid/initech-compact.json';

export const TENANTS = {
  acme: { title: 'Acme', theme: acme as Theme },
  globex: { title: 'Globex', theme: globex as Theme },
  initech: { title: 'Initech', theme: initech as Theme },
} as const;

export type TenantId = keyof typeof TENANTS | 'default';
export type AppearanceChoice = 'tenant' | 'light' | 'dark' | 'system';

export interface StoryTheme {
  /** null for the platform default theme (semantic.css only). */
  vars: ResolvedVars | null;
  appearance: 'light' | 'dark';
  density: Theme['density'] | undefined;
}

export function storyTheme(
  tenant: TenantId,
  choice: AppearanceChoice,
  prefersDark: boolean,
): StoryTheme {
  const theme = tenant === 'default' ? undefined : TENANTS[tenant].theme;
  const appearance =
    choice === 'light' || choice === 'dark'
      ? choice
      : choice === 'system' || !theme
        ? prefersDark
          ? 'dark'
          : 'light'
        : appearanceOf(theme, prefersDark);
  return {
    vars: theme ? resolveTheme(theme, { appearance }) : null,
    appearance,
    density: theme?.density,
  };
}
