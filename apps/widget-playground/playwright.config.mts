import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

/**
 * Playground scenarios for the widget (PoC-A). Two origins are required and must differ:
 * the playground (host pages, 4300) and the widget (loader, launcher, frame, 4400).
 *
 * Both servers start with Vite directly rather than 'nx run …:dev': Nx would otherwise start them
 * as task dependencies and collide with a running 'pnpm stack' on the strict ports. With
 * reuseExistingServer, a running stack is reused.
 *
 * A third server, the built widget under 'vite preview' on 4401, lets T-12 assert the production
 * headers (P1.5-T09). It builds first; Nx's cache makes repeat builds quick.
 *
 * Tests tagged @measure only run with MEASURE=1 (PoC-A-T11), against a built widget.
 */
export default defineConfig({
  ...nxE2EPreset(import.meta.dirname, { testDir: './src/tests' }),
  grepInvert: process.env['MEASURE'] ? undefined : /@measure/,
  use: {
    baseURL: process.env['BASE_URL'] || 'http://localhost:4300',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'pnpm exec vite --config apps/widget-playground/vite.config.mts',
      url: 'http://localhost:4300',
      reuseExistingServer: true,
      cwd: workspaceRoot,
    },
    {
      command: 'pnpm exec vite --config apps/widget/vite.config.mts',
      url: 'http://localhost:4400/v1/loader.js',
      reuseExistingServer: true,
      cwd: workspaceRoot,
    },
    // The production-header server (T-12) is not needed for visual runs.
    ...(process.env.VISUAL
      ? []
      : [
          {
            command:
              'pnpm nx run @byteflock/widget:build --output-style=static && pnpm exec vite preview --config apps/widget/vite.config.mts --port 4401',
            url: 'http://localhost:4401/v1/loader.js',
            reuseExistingServer: true,
            cwd: workspaceRoot,
            timeout: 180_000,
          },
        ]),
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
