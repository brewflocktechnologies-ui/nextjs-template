/// <reference types='vitest' />
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { nxReadySignal } from '@nx/vite/plugins/nx-ready-signal.plugin';
import { widgetOriginPlugin } from './src/dev-server-plugin.ts';

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string };

/**
 * Build-time constants (src/env.d.ts). scripts/build.mjs reuses them and overrides
 * __LAUNCHER_PATH__ with the hashed launcher file for production.
 */
export const defines = {
  __DASHBOARD_ORIGIN__: JSON.stringify(
    process.env.DASHBOARD_ORIGIN ?? 'http://localhost:3000',
  ),
  __PLAYGROUND_ORIGINS__: JSON.stringify(['http://localhost:4300']),
  __FRAME_VERSION__: JSON.stringify(pkg.version),
  __LAUNCHER_PATH__: JSON.stringify('/src/launcher/index.ts'),
};

export default defineConfig(() => ({
  root: import.meta.dirname,
  // A static asset origin: unknown paths must 404, never fall back to index.html.
  appType: 'mpa' as const,
  cacheDir: '../../node_modules/.vite/apps/widget',
  define: defines,
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
  // Production builds go through scripts/build.mjs (frame, launcher, loader: D-15).
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
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
