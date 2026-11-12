/// <reference types='vitest' />
import { defineConfig } from 'vite';
import { nxReadySignal } from '@nx/vite/plugins/nx-ready-signal.plugin';
import fs from 'node:fs';

// D-27: this project's coverage floor (tools/coverage-floor.json); raise it with
// node tools/scripts/coverage-floor.mjs --write
const floor = JSON.parse(
  fs.readFileSync(
    new URL('../../tools/coverage-floor.json', import.meta.url),
    'utf8',
  ),
).projects['apps/widget-playground'];

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
    // D-27: coverage is collected on every run and must stay at or above the floor.
    coverage: {
      provider: 'v8' as const,
      enabled: true,
      reportsDirectory: './test-output/reports/test/coverage',
      reporter: ['json-summary', 'text-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.{spec,test,stories}.*',
        '**/*.d.ts',
        '**/generated/**',
        '**/test-setup.*',
      ],
      thresholds: floor,
    },
  },
}));
