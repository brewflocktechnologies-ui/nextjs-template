// Runs every story as a test in a real browser (Storybook Vitest addon, ADR-008): render, play()
// interactions and axe accessibility checks. Target: `pnpm nx run @byteflock/ui-react:test-storybook`.
import { defineConfig } from 'vitest/config';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/ui-react-storybook',
  plugins: [react(), tailwindcss(), storybookTest({ configDir: '.storybook' })],
  test: {
    name: 'ui-react-storybook',
    watch: false,
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
    setupFiles: ['.storybook/vitest.setup.ts'],
  },
});
