// Tenant themes for the chat-widget Storybook (P1.5-T06): the P1.3 contract fixtures, applied with
// the same ThemeController the frame uses.
import { ThemeController } from '../src/controllers/theme-controller';
import { RESOLVED_KEYS, type Theme } from '@byteflock/theme/guard';
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

const controller = new ThemeController(null);

/** Applies a tenant (or the platform default) to the story document. */
export function applyTenant(tenant: TenantId, choice: AppearanceChoice): void {
  const root = document.documentElement;
  if (tenant === 'default') {
    for (const key of RESOLVED_KEYS) root.style.removeProperty(key);
    controller.applyAppearance(choice === 'tenant' ? 'light' : choice);
    delete root.dataset.density;
    return;
  }
  const theme = TENANTS[tenant].theme;
  controller.setTheme(
    choice === 'tenant' ? theme : { ...theme, appearance: { mode: choice } },
  );
  root.dataset.density = theme.density;
}
