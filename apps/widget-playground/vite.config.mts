/// <reference types='vitest' />
import { defineConfig } from 'vite';
import { nxReadySignal } from '@nx/vite/plugins/nx-ready-signal.plugin';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/widget-playground',
  server: {
    port: 4300,
    host: 'localhost',
    strictPort: true,
  },
  preview: {
    port: 4300,
    host: 'localhost',
    strictPort: true,
  },
  plugins: [nxReadySignal()],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [],
  // },
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  test: {
    name: '@byteflock/widget-playground',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    // Playwright specs live in src/tests and run through the e2e target, not Vitest.
    exclude: ['src/tests/**', 'node_modules/**'],
    // D-26: the JSON copy feeds the quality report; Nx caches it with the test task.
    reporters: ['default', 'json'],
    outputFile: { json: 'test-output/reports/test/vitest.json' },
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
