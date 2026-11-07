import { useLayoutEffect, type ReactNode } from 'react';
import type { Decorator, Preview } from '@storybook/react-vite';
import { ThemeStyleTag } from '../src/theme';
import {
  storyTheme,
  TENANTS,
  type AppearanceChoice,
  type TenantId,
} from './themes';
import './preview.css';

/**
 * Tenant theming for every story (P1.4-T04): resolves the selected tenant fixture, renders its
 * variables with ThemeStyleTag and puts appearance and density on <html>, so portalled content
 * (dialogs, popovers) is themed too.
 */
function TenantTheme({
  globals,
  children,
}: {
  globals: Record<string, unknown>;
  children: ReactNode;
}) {
  const prefersDark =
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = storyTheme(
    (globals.tenant ?? 'acme') as TenantId,
    (globals.appearance ?? 'tenant') as AppearanceChoice,
    prefersDark,
  );

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.appearance = theme.appearance;
    if (theme.density) root.dataset.density = theme.density;
    else delete root.dataset.density;
  }, [theme.appearance, theme.density]);

  return (
    <>
      {theme.vars && <ThemeStyleTag vars={theme.vars} />}
      {children}
    </>
  );
}

const withTenantTheme: Decorator = (Story, { globals }) => (
  <TenantTheme globals={globals}>
    <Story />
  </TenantTheme>
);

const preview: Preview = {
  decorators: [withTenantTheme],
  globalTypes: {
    tenant: {
      description: 'Tenant theme fixture',
      toolbar: {
        title: 'Tenant',
        icon: 'paintbrush',
        dynamicTitle: true,
        items: [
          ...Object.entries(TENANTS).map(([value, { title }]) => ({
            value,
            title,
          })),
          { value: 'default', title: 'Default (platform)' },
        ],
      },
    },
    appearance: {
      description: 'Appearance',
      toolbar: {
        title: 'Appearance',
        icon: 'mirror',
        dynamicTitle: true,
        items: [
          { value: 'tenant', title: "Tenant's choice" },
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
          { value: 'system', title: 'System' },
        ],
      },
    },
  },
  initialGlobals: { tenant: 'acme', appearance: 'tenant' },
  parameters: {
    // axe runs on every story and any violation fails `test-storybook` (P1.4-T07). The addon has
    // no severity threshold, so moderate and minor violations block too (stricter than the spec).
    a11y: { test: 'error' },
    controls: { matchers: { color: /(background|color)$/i } },
  },
};

export default preview;
