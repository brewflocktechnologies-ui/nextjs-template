/// <reference types='vitest' />
import { defineConfig } from 'vite';
import { nxReadySignal } from '@nx/vite/plugins/nx-ready-signal.plugin';
import { widgetOriginPlugin } from './src/dev-server-plugin';

export default defineConfig(() => ({
  root: import.meta.dirname,
  // A static asset origin: unknown paths must 404, never fall back to index.html.
  appType: 'mpa' as const,
  cacheDir: '../../node_modules/.vite/apps/widget',
  server: {
    port: 4400,
    host: 'localhost',
    strictPort: true,
  },
  preview: {
    port: 4400,
    host: 'localhost',
    strictPort: true,
  },
  plugins: [nxReadySignal(), widgetOriginPlugin()],
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
    name: '@byteflock/widget',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
