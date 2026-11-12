import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/theme',
  test: {
    name: 'theme',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    // D-26: the JSON copy feeds the quality report; Nx caches it with the test task.
    reporters: ['default', 'json'],
    outputFile: { json: 'test-output/reports/test/vitest.json' },
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
