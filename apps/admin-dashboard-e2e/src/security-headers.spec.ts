// Dashboard security headers and CSP (D-28, P2.1-T19). The headers come from next.config.js (every
// response) and proxy.ts (the per-request nonce CSP). The CSP test opens the main tenant and
// platform pages and fails on any violation the browser reports, so a stricter policy or a new
// inline script or style shows up here, not in production.
import { expect, test, type Page } from '@playwright/test';
import { DASHBOARD, rootNonce, signIn, signInPlatform } from './helpers';

const PROD = 'http://localhost:3005';
const WIDGET_ORIGIN = 'http://localhost:4400';
const STATIC_HEADERS: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'cross-origin-opener-policy': 'same-origin',
};

const directives = (csp: string) =>
  Object.fromEntries(
    csp
      .split(';')
      .map((d) => d.trim().split(/\s+/))
      .filter((d) => d[0])
      .map(([name, ...values]) => [name, values]),
  );

function expectStaticHeaders(headers: Record<string, string>, where: string) {
  for (const [name, value] of Object.entries(STATIC_HEADERS))
    expect(headers[name], `${where}: ${name}`).toBe(value);
  expect(headers['x-powered-by'], `${where}: x-powered-by`).toBeUndefined();
}

test('pages carry the security headers and a nonce CSP that matches the theme style', async ({
  request,
}) => {
  const cookie = await signIn(request, 't_acme');
  const res = await request.get(`${DASHBOARD}/settings/theme`, {
    headers: { cookie },
  });
  expect(res.status()).toBe(200);
  const headers = res.headers();
  expectStaticHeaders(headers, '/settings/theme');

  const csp = directives(headers['content-security-policy'] ?? '');
  const nonce = rootNonce(await res.text());
  expect(nonce, 'theme <style> nonce').toBeTruthy();
  expect(csp['script-src']).toContain(`'nonce-${nonce}'`);
  expect(csp['style-src']).toContain(`'nonce-${nonce}'`);
  expect(csp['script-src']).toContain("'strict-dynamic'");
  expect(csp['script-src']).not.toContain("'unsafe-inline'");
  expect(csp['style-src']).not.toContain("'unsafe-inline'");
  expect(csp['frame-src']).toEqual([WIDGET_ORIGIN]);
  expect(csp['frame-ancestors']).toEqual(["'none'"]);
  expect(csp['base-uri']).toEqual(["'none'"]);
  expect(csp['object-src']).toEqual(["'none'"]);

  // A new nonce for every request.
  const again = await request.get(`${DASHBOARD}/settings/theme`, {
    headers: { cookie },
  });
  expect(again.headers()['content-security-policy']).not.toBe(
    headers['content-security-policy'],
  );
});

test('static files and public routes carry the security headers', async ({
  request,
}) => {
  const health = await request.get(`${DASHBOARD}/healthz`);
  expectStaticHeaders(health.headers(), '/healthz');
  expect(health.headers()['content-security-policy']).toBeTruthy();
  const icon = await request.get(`${DASHBOARD}/favicon.ico`);
  expectStaticHeaders(icon.headers(), '/favicon.ico');
});

test('production build: the same headers, and no unsafe-eval', async ({
  request,
}) => {
  const res = await request.get(`${PROD}/healthz`);
  expect(res.status()).toBe(200);
  expectStaticHeaders(res.headers(), 'production /healthz');
  const csp = directives(res.headers()['content-security-policy'] ?? '');
  expect(csp['script-src']).toBeTruthy();
  expect(csp['script-src']).not.toContain("'unsafe-eval'");
});

/**
 * Records every CSP violation the page reports, from the start of each document. Violations by
 * Next.js's own development overlay (styles it injects into the shadow root of `<nextjs-portal>`,
 * and its `__nextjs-` font in the head; both exist only under `next dev`) are kept apart: they are not the dashboard's code and do not
 * occur in a production build (see the production test below).
 */
async function collectViolations(page: Page) {
  const seen: string[] = [];
  const devOverlay: string[] = [];
  await page.exposeFunction(
    '__reportCspViolation',
    (v: string, fromDevOverlay: boolean) =>
      (fromDevOverlay ? devOverlay : seen).push(v),
  );
  await page.addInitScript(() => {
    document.addEventListener(
      'securitypolicyviolation',
      (e) => {
        // The event is composed: at the document its target is the shadow host, so look at
        // the element that actually violated.
        const origin = (e.composedPath()[0] ?? e.target) as Node;
        const root = origin.getRootNode?.() as ShadowRoot | Document;
        const host =
          root && 'host' in root
            ? root.host?.tagName
            : (e.target as Element | null)?.tagName;
        (
          window as unknown as {
            __reportCspViolation: (v: string, dev: boolean) => void;
          }
        ).__reportCspViolation(
          `${e.violatedDirective} blocked ${e.blockedURI || 'inline'} at ${e.documentURI}${e.sample ? `: ${e.sample}` : ''}`,
          host === 'NEXTJS-PORTAL' ||
            // The overlay's font, injected into the document head.
            (e.sample ?? '').startsWith("@font-face{font-family:'__nextjs-"),
        );
      },
      true,
    );
  });
  return { seen, devOverlay };
}

test('no CSP violations on the main tenant pages', async ({
  page,
  context,
}) => {
  const { seen, devOverlay } = await collectViolations(page);
  await context.addCookies([
    {
      ...cookieOf(await signIn(context, 't_acme')),
      url: DASHBOARD,
    },
  ]);
  for (const url of [
    '/',
    '/settings/theme',
    '/settings/widget',
    '/settings/dashboard',
  ]) {
    await page.goto(`${DASHBOARD}${url}`);
    await page.getByRole('heading', { level: 1 }).waitFor();
    await settled(page);
  }
  expect(seen).toEqual([]);
  test.info().annotations.push({
    type: 'next-dev-overlay-violations',
    description: String(devOverlay.length),
  });
});

test('no CSP violations on the platform pages', async ({ page, context }) => {
  const { seen, devOverlay } = await collectViolations(page);
  await context.addCookies([
    { ...cookieOf(await signInPlatform(context)), url: DASHBOARD },
  ]);
  for (const url of [
    '/platform',
    '/platform/tenants/t_acme',
    '/platform/tenants/t_acme/theme',
  ]) {
    await page.goto(`${DASHBOARD}${url}`);
    await page.getByRole('heading', { level: 1 }).waitFor();
    await settled(page);
  }
  expect(seen).toEqual([]);
  test.info().annotations.push({
    type: 'next-dev-overlay-violations',
    description: String(devOverlay.length),
  });
});

test('production build: a rendered page reports no CSP violation', async ({
  page,
}) => {
  const { seen, devOverlay } = await collectViolations(page);
  // Production has no session, so the page is the 404 for the removed /dev/session: still a full
  // Next.js document with its scripts and styles.
  const res = await page.goto(`${PROD}/dev/session`);
  expect(res?.status()).toBe(404);
  await settled(page);
  expect(await page.evaluate(() => document.scripts.length)).toBeGreaterThan(0);
  expect([...seen, ...devOverlay]).toEqual([]);
});

/** After load and hydration: the browser is idle, so styles and scripts have been applied. */
async function settled(page: Page) {
  await page.waitForLoadState('load');
  await page.evaluate(
    () => new Promise((resolve) => requestIdleCallback(() => resolve(null))),
  );
}

function cookieOf(header: string) {
  const [name, ...rest] = header.split('=');
  return { name, value: rest.join('=') };
}
