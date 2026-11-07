// Production build for the widget origin (D-15, ENDP-09). Run from apps/widget (the Nx target does).
//
//   1. Frame document and its assets      → dist/v1/frame/index.html, dist/v1/frame/assets/*
//      (public/ is copied too: config, themes, fonts → dist/v1/...)
//   2. Launcher, one ES module            → dist/v1/launcher.<content-hash>.js
//   3. Loader, classic IIFE, no imports   → dist/v1/loader.js (launcher path baked in)
//   4. Static host headers                → dist/_headers
//   5. Bundle assertions and sizes        → scripts/assert-bundle.mjs
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const pkg = JSON.parse(
  fs.readFileSync(path.join(root, 'package.json'), 'utf8'),
);
const defines = (launcherPath) => ({
  __DASHBOARD_ORIGIN__: JSON.stringify(
    process.env.DASHBOARD_ORIGIN ?? 'http://localhost:3000',
  ),
  __PLAYGROUND_ORIGINS__: JSON.stringify(['http://localhost:4300']),
  __FRAME_VERSION__: JSON.stringify(pkg.version),
  __LAUNCHER_PATH__: JSON.stringify(launcherPath),
  'process.env.NODE_ENV': JSON.stringify('production'),
});
const quiet = { logLevel: 'warn' };

// 1. Frame (uses vite.config.mts for plugins and public/ copying).
await build({
  ...quiet,
  root,
  configFile: path.join(root, 'vite.config.mts'),
  define: defines('/unused'),
  build: {
    outDir: dist,
    emptyOutDir: true,
    assetsDir: 'v1/frame/assets',
    rollupOptions: {
      input: { frame: path.join(root, 'v1', 'frame', 'index.html') },
    },
  },
});

// 2. Launcher as a single ES module, then content-hashed.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'widget-launcher-'));
await build({
  ...quiet,
  root,
  configFile: false,
  publicDir: false,
  define: defines('/unused'),
  build: {
    outDir: tmp,
    emptyOutDir: true,
    minify: true,
    lib: {
      entry: path.join(root, 'src', 'launcher', 'index.ts'),
      formats: ['es'],
      fileName: () => 'launcher.js',
    },
  },
});
const launcherCode = fs.readFileSync(path.join(tmp, 'launcher.js'));
const hash = createHash('sha256')
  .update(launcherCode)
  .digest('hex')
  .slice(0, 10);
const launcherFile = `launcher.${hash}.js`;
fs.writeFileSync(path.join(dist, 'v1', launcherFile), launcherCode);
fs.rmSync(tmp, { recursive: true, force: true });

// 3. Loader as a classic script with the hashed launcher path.
await build({
  ...quiet,
  root,
  configFile: false,
  publicDir: false,
  define: defines(`/v1/${launcherFile}`),
  build: {
    outDir: path.join(dist, 'v1'),
    emptyOutDir: false,
    minify: true,
    lib: {
      entry: path.join(root, 'src', 'loader.ts'),
      formats: ['iife'],
      name: 'ByteflockLoader',
      fileName: () => 'loader.js',
    },
  },
});

// 4. Static host headers from the single source of truth.
const { renderHeadersFile } = await import('../src/headers.config.ts');
fs.writeFileSync(path.join(dist, '_headers'), renderHeadersFile());

// The root placeholder page is not part of the widget origin's contract.
fs.rmSync(path.join(dist, 'index.html'), { force: true });

// 5. Assertions (leakage, loader shape, sizes against budgets).
await import('./assert-bundle.mjs');
