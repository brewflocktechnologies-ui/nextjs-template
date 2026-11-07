// Runs every story as a test in a real browser (Storybook Vitest addon, ADR-008): render, play()
// interactions and axe. Target: `pnpm nx run @byteflock/chat-widget:test-storybook`.
import { defineConfig } from 'vitest/config';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/chat-widget-storybook',
  plugins: [storybookTest({ configDir: '.storybook' })],
  // Pre-bundle story dependencies so a cold cache does not re-optimise mid-run (see ui-react).
  optimizeDeps: {
    include: ['lit', 'lit/decorators.js'],
  },
  test: {
    name: 'chat-widget-storybook',
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
