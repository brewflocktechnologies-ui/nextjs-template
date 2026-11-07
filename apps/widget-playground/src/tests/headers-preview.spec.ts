import { expect, test } from '@playwright/test';

/**
 * T-12 (P1.5-T09): the production build, served by `vite preview` on 4401, carries the ENDP-01 and
 * ENDP-03 headers. The dev-server test in interaction.spec.ts covers `vite dev`; this one covers
 * what the static host serves.
 */
const PREVIEW = 'http://localhost:4401';
const IMMUTABLE = 'public, max-age=31536000, immutable';

test.describe('T-12 production headers (vite preview of dist)', () => {
  test('frame document and assets carry the security headers; the CSP allows no other network origin', async ({
    request,
  }) => {
    const doc = await request.get(`${PREVIEW}/v1/frame/?key=wk_acme_demo`);
    expect(doc.status()).toBe(200);
    const h = doc.headers();
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(h['permissions-policy']).toBe(
      'camera=(), microphone=(), geolocation=(), payment=()',
    );
    expect(h['cross-origin-opener-policy']).toBe('same-origin');
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['cache-control']).toBe('public, max-age=60, must-revalidate');

    const csp = h['content-security-policy'];
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("require-trusted-types-for 'script'");
    // P1.5-AC10: the realtime placeholder is the only non-self connect-src.
    const connect = csp
      .split(';')
      .map((d) => d.trim())
      .find((d) => d.startsWith('connect-src'));
    expect(connect).toBe("connect-src 'self' https://rt.byteflock.invalid");

    const asset = (await doc.text()).match(
      /\/v1\/frame\/assets\/[^"]+\.js/,
    )?.[0];
    expect(asset).toBeTruthy();
    const assetRes = await request.get(`${PREVIEW}${asset}`);
    expect(assetRes.headers()['cache-control']).toBe(IMMUTABLE);
    expect(assetRes.headers()['content-security-policy']).toBe(csp);
  });

  test('loader, launcher and fonts are cached as specified; the launcher allows CORS', async ({
    request,
  }) => {
    const loader = await request.get(`${PREVIEW}/v1/loader.js`);
    expect(loader.headers()['cache-control']).toBe('public, max-age=300');
    const launcherPath = (await loader.text()).match(
      /\/v1\/launcher\.[a-f0-9]+\.js/,
    )?.[0];
    expect(launcherPath).toBeTruthy();
    const launcher = await request.get(`${PREVIEW}${launcherPath}`);
    expect(launcher.headers()['cache-control']).toBe(IMMUTABLE);
    expect(launcher.headers()['access-control-allow-origin']).toBe('*');

    const font = await request.get(
      `${PREVIEW}/v1/fonts/roboto/roboto-latin-400-normal.woff2`,
    );
    expect(font.status()).toBe(200);
    expect(font.headers()['cache-control']).toBe(IMMUTABLE);
  });

  test('unknown paths return 404', async ({ request }) => {
    expect((await request.get(`${PREVIEW}/v1/nope.js`)).status()).toBe(404);
    expect((await request.get(`${PREVIEW}/index.html`)).status()).toBe(404);
  });
});
