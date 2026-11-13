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
  plugins: [
    react(),
    tailwindcss(),
    storybookTest({
      configDir: '.storybook',
      // A11Y_NEGATIVE=1 runs only the deliberately inaccessible story, which must fail (P1.4-T07).
      ...(process.env.A11Y_NEGATIVE
        ? { tags: { include: ['a11y-negative'], exclude: [] } }
        : {}),
    }),
  ],
  // Pre-bundle every dependency the stories import. Otherwise Vite discovers one mid-run on a cold
  // cache, re-optimises and reloads the test page, failing every story (seen in the PoC-B dry run).
  optimizeDeps: {
    include: [
      '@base-ui/react/button',
      '@base-ui/react/checkbox',
      '@base-ui/react/combobox',
      '@base-ui/react/csp-provider',
      '@base-ui/react/dialog',
      '@base-ui/react/input',
      '@base-ui/react/popover',
      '@base-ui/react/select',
      '@base-ui/react/tooltip',
      '@tanstack/react-table',
      'class-variance-authority',
      'clsx',
      'lucide-react',
      'tailwind-merge',
      'react',
      'react-dom',
      'react/jsx-dev-runtime',
    ],
  },
  test: {
    name: 'ui-react-storybook',
    // D-26: results and each story's axe report feed the quality report (test-output/reports).
    reporters: [
      'default',
      'json',
      '../../tools/reporters/vitest-story-a11y.mjs',
    ],
    outputFile: { json: 'test-output/reports/storybook/vitest.json' },
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
