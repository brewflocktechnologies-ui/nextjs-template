import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
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

/** The theme <style> in a page's HTML. */
export function themeStyle(html: string): string {
  const all = [
    ...html.matchAll(/<style[^>]*data-byteflock-theme[^>]*>([^<]*)<\/style>/g),
  ];
  if (all.length !== 1)
    throw new Error(`expected one theme <style>, found ${all.length}`);
  return all[0][1];
}

export const cssVar = (css: string, name: string) =>
  css.match(new RegExp(`${name}:([^;}]+)`))?.[1];

export const readJson = (file: string) =>
  JSON.parse(fs.readFileSync(file, 'utf8'));

/**
 * Undoes local publishes and drafts (P2.1): the dashboard's database is dropped, recreated,
 * migrated and seeded (published revisions are immutable, so they cannot be deleted), then the
 * widget fixtures are copied back to apps/widget/public/v1.
 */
export function resetLocalState() {
  execFileSync(process.execPath, ['tools/scripts/db/recreate.mjs'], {
    cwd: ROOT,
  });
  execFileSync(process.execPath, ['tools/scripts/stack-reset.mjs'], {
    cwd: ROOT,
  });
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
