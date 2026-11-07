import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

const baseURL = process.env['BASE_URL'] || 'http://localhost:3000';

/**
 * Dashboard end-to-end tests (P1.6-T09). Servers, all reused when `pnpm stack` already runs them:
 * - the dashboard in development on 3000 (dev session, theme fixture override from .env.development);
 * - the widget origin on 4400 and the playground on 4300, for the preview and allowlist flows;
 * - a production build of the dashboard on 3005 (P1.6-AC07: no dev-only routes).
 *
 * Generated as a .mts file so Node forces ESM regardless of workspace `type`.
 */
export default defineConfig({
  ...nxE2EPreset(import.meta.dirname, { testDir: './src' }),
  // A cold `next dev` compiles each route on first request; give tests room for that.
  timeout: 60_000,
  // Several tests publish into the widget's static folder; run them one at a time.
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: [
    // First: the production build must finish before the dev server starts (they share the app
    // folder; a build running beside a cold dev server broke hydration in the dev pages).
    {
      command:
        'pnpm exec next build && git checkout -- next-env.d.ts && pnpm exec next start --port 3005',
      // Built from the app folder, like the Nx build target; `next build <dir>` from the workspace
      // root fails to prerender. A separate distDir keeps a running dev server intact; the build
      // rewrites the committed next-env.d.ts for that distDir, so it is restored before starting.
      env: { NEXT_DIST_DIR: '.next-e2e-prod' },
      url: 'http://localhost:3005/healthz',
      reuseExistingServer: true,
      cwd: `${workspaceRoot}/apps/admin-dashboard`,
      timeout: 300_000,
    },
    {
      command: 'pnpm exec next dev apps/admin-dashboard --port 3000',
      url: 'http://localhost:3000/healthz',
      reuseExistingServer: true,
      cwd: workspaceRoot,
      timeout: 180_000,
    },
    {
      command: 'pnpm exec vite --config apps/widget/vite.config.mts',
      url: 'http://localhost:4400/v1/loader.js',
      reuseExistingServer: true,
      cwd: workspaceRoot,
    },
    {
      command: 'pnpm exec vite --config apps/widget-playground/vite.config.mts',
      url: 'http://localhost:4300',
      reuseExistingServer: true,
      cwd: workspaceRoot,
    },
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
