import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import type { StorybookConfig } from '@storybook/web-components-vite';

/**
 * chat-widget Storybook (ADR-008, P1.5-T06): Lit elements in the real DOM, port 4700 (D-10).
 * Stories are the element spec and the element test (`test-storybook`).
 */
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.ts'],
  addons: [
    getAbsolutePath('@storybook/addon-a11y'),
    getAbsolutePath('@storybook/addon-vitest'),
  ],
  framework: {
    name: getAbsolutePath(
      '@storybook/web-components-vite',
    ) as '@storybook/web-components-vite',
    options: {},
  },
};

function getAbsolutePath(value: string): string {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}

export default config;
