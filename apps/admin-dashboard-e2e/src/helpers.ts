import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { APIRequestContext, BrowserContext } from '@playwright/test';

export const DASHBOARD = 'http://localhost:3000';
export const ROOT = path.resolve(__dirname, '../../..');
export const WIDGET_PUBLIC = path.join(ROOT, 'apps/widget/public/v1');

/** Signs a request context or a browser context in as a local tenant through /dev/session. */
export async function signIn(
  target: APIRequestContext | BrowserContext,
  tenantId: string,
): Promise<string> {
  const request = 'request' in target ? target.request : target;
  const res = await request.post(`${DASHBOARD}/dev/session/select`, {
    form: { tenantId },
    maxRedirects: 0,
  });
  const cookie = res.headers()['set-cookie']?.split(';')[0];
  if (!cookie) throw new Error(`no session cookie for ${tenantId}`);
  return cookie;
}

/** Signs in as the super admin (platform scope) through /dev/session. */
export async function signInPlatform(
  target: APIRequestContext | BrowserContext,
): Promise<string> {
  const request = 'request' in target ? target.request : target;
  const res = await request.post(`${DASHBOARD}/dev/session/select`, {
    form: { platform: '1' },
    maxRedirects: 0,
  });
  const cookie = res.headers()['set-cookie']?.split(';')[0];
  if (!cookie) throw new Error('no session cookie for the super admin');
  return cookie;
}

/** Every theme <style> in a page's HTML: [attributes, css]. */
function themeStyles(
  html: string,
): { nonce: string | undefined; css: string }[] {
  return [
    ...html.matchAll(
      /<style([^>]*)data-byteflock-theme[^>]*>([^<]*)<\/style>/g,
    ),
  ].map((m) => ({
    nonce: /nonce="([^"]*)"/.exec(m[0])?.[1],
    css: m[2],
  }));
}

/** The page's theme <style> on :root (the chrome). A page has exactly one. */
export function themeStyle(html: string): string {
  const root = themeStyles(html).filter((s) => s.css.startsWith(':root:root'));
  if (root.length !== 1)
    throw new Error(`expected one :root theme <style>, found ${root.length}`);
  return root[0].css;
}

/** The scoped preview <style> for one tenant (P2.1-T11), with its nonce. */
export function previewStyle(
  html: string,
  tenantId: string,
): { nonce: string | undefined; css: string } {
  const own = themeStyles(html).filter((s) =>
    s.css.startsWith(`[data-tenant-preview="${tenantId}"]`),
  );
  if (own.length !== 1)
    throw new Error(
      `expected one preview <style> for ${tenantId}, found ${own.length}`,
    );
  return own[0];
}

/** The nonce of the page's :root theme <style>. */
export function rootNonce(html: string): string | undefined {
  return themeStyles(html).find((s) => s.css.startsWith(':root:root'))?.nonce;
}

export const cssVar = (css: string, name: string) =>
  css.match(new RegExp(`${name}:([^;}]+)`))?.[1];

export const readJson = (file: string) =>
  JSON.parse(fs.readFileSync(file, 'utf8'));

/**
 * The database the dashboard server under test uses (P2.1-T15): set by global-setup.ts from the
 * server's /healthz; `byteflock_test` when Playwright started the server itself.
 */
export const e2eDatabase = () => process.env.E2E_DATABASE ?? 'byteflock_test';

/**
 * Runs one parameterised statement on the e2e database as the owner role (row-level security is
 * bypassed by the owner's platform scope). For tests that change the database behind the server's
 * back, such as removing a membership (P2.1-AC09). `pg` is a dashboard dependency; it is resolved
 * from there, like the database scripts do.
 */
export async function ownerQuery<T = Record<string, unknown>>(
  text: string,
  values: unknown[] = [],
): Promise<T[]> {
  const requirePg = createRequire(
    path.join(ROOT, 'apps', 'admin-dashboard', 'package.json'),
  );
  // A minimal local type: the e2e project does not depend on `pg` or its types.
  const { Client } = requirePg('pg') as {
    Client: new (options: { connectionString: string }) => {
      connect(): Promise<void>;
      query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
      end(): Promise<void>;
    };
  };
  // Same owner connection as the database scripts: MIGRATE_DATABASE_URL (CI) or the local stack.
  const url = new URL(
    process.env.MIGRATE_DATABASE_URL ??
      'postgres://byteflock:byteflock@127.0.0.1:5440/byteflock',
  );
  url.pathname = `/${e2eDatabase()}`;
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.scope', 'platform', true)");
    const { rows } = await client.query(text, values);
    await client.query('COMMIT');
    return rows as T[];
  } finally {
    await client.end();
  }
}

/**
 * Undoes local publishes and drafts (P2.1): the e2e database is dropped, recreated, migrated and
 * seeded (published revisions are immutable, so they cannot be deleted), then the widget fixtures
 * are copied back to apps/widget/public/v1.
 */
export function resetLocalState() {
  execFileSync(
    process.execPath,
    ['tools/scripts/db/recreate.mjs', `--database=${e2eDatabase()}`],
    { cwd: ROOT },
  );
  execFileSync(process.execPath, ['tools/scripts/stack-reset.mjs', '--files'], {
    cwd: ROOT,
  });
}

/**
 * Signs in through the /dev/session page by clicking a switcher button, and waits until the
 * browser has left that page. On a cold `next dev` the page can reload while a route compiles and
 * swallow the click, so it tries three times (P2.1-T12, T13).
 */
export async function signInWithSwitcher(
  page: import('@playwright/test').Page,
  button: string,
  { exact = false }: { exact?: boolean } = {},
) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.goto(`${DASHBOARD}/dev/session`);
    await page.getByRole('button', { name: button, exact }).click();
    try {
      await page.waitForURL((url) => !url.pathname.startsWith('/dev/session'), {
        timeout: 15_000,
      });
      return;
    } catch (e) {
      if (attempt === 3) throw e;
    }
  }
}

/**
 * Opens a page and waits for its main heading. On a cold `next dev`, a route that compiles while a
 * page is open can reload that page and abort the navigation; it tries three times (P2.1-T12).
 * Callers that read from the page afterwards wrap the step in `expect(...).toPass()`, because a
 * reload can still destroy the page's context later.
 */
export async function gotoSettled(
  page: import('@playwright/test').Page,
  url: string,
) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.goto(url);
      await page.getByRole('heading', { level: 1 }).waitFor();
      return;
    } catch (e) {
      if (attempt === 3) throw e;
    }
  }
}

/**
 * Opens a page and waits until its client form has hydrated (`form[data-hydrated]`). On the first
 * `next dev` start after a production build, a page occasionally never hydrates with no error in
 * the browser; a reload recovers it. Three attempts, then the test fails.
 */
export async function gotoHydrated(
  page: import('@playwright/test').Page,
  url: string,
) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (attempt === 1) await page.goto(url);
    else await page.reload();
    try {
      await page.locator('form[data-hydrated]').waitFor({ timeout: 20_000 });
      return;
    } catch (e) {
      if (attempt === 3) throw e;
    }
  }
}
