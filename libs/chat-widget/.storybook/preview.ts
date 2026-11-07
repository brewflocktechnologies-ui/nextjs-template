import type { Decorator, Preview } from '@storybook/web-components-vite';
import '@byteflock/design-tokens/css/semantic.css';
import { dirOf } from '../src/i18n/t';
import { defineAll } from '../src/index';
import {
  applyTenant,
  TENANTS,
  type AppearanceChoice,
  type TenantId,
} from './themes';
import './preview.css';

defineAll();

/** Applies the tenant theme, appearance and text direction before every story renders. */
const withFrameContext: Decorator = (story, { globals }) => {
  applyTenant(
    (globals.tenant ?? 'acme') as TenantId,
    (globals.appearance ?? 'tenant') as AppearanceChoice,
  );
  const locale = String(globals.locale ?? 'en');
  document.documentElement.lang = locale;
  document.documentElement.dir = dirOf(locale);
  return story();
};

const preview: Preview = {
  decorators: [withFrameContext],
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
    locale: {
      description: 'Locale',
      toolbar: {
        title: 'Locale',
        icon: 'globe',
        dynamicTitle: true,
        items: ['en', 'en-AU', 'ar'],
      },
    },
  },
  initialGlobals: { tenant: 'acme', appearance: 'tenant', locale: 'en' },
  parameters: {
    // Any axe violation fails `test-storybook` (P1.5-AC08), as in ui-react.
    a11y: { test: 'error' },
  },
};

export default preview;
