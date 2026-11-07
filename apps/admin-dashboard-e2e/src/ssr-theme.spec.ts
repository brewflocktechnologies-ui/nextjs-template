import { expect, test } from '@playwright/test';
import { DASHBOARD, cssVar, signIn, themeStyle } from './helpers';

const html = async (
  request: import('@playwright/test').APIRequestContext,
  cookie: string,
  url = '/',
) => {
  const res = await request.get(`${DASHBOARD}${url}`, {
    headers: { cookie },
  });
  expect(res.status()).toBe(200);
  return { res, text: await res.text() };
};

test.describe('SSR tenant theme (P1.6-T04, D-20)', () => {
  test('T-04 two tenants in sequence in one server process get distinct themes; the third render matches the first', async ({
    request,
  }) => {
    const acme = await signIn(request, 't_acme');
    const globex = await signIn(request, 't_globex');
    const first = themeStyle((await html(request, acme)).text);
    const second = themeStyle((await html(request, globex)).text);
    const third = themeStyle((await html(request, acme)).text);
    expect(cssVar(first, '--sem-color-accent')).toBe('#7c3aed');
    expect(cssVar(second, '--sem-color-accent')).toBe('#fbbf24');
    expect(third).toBe(first);
    expect(second).not.toBe(first);
  });

  test('each tenant gets the full variable map, one nonce’d <style> and its appearance on <html>', async ({
    request,
  }) => {
    for (const [tenant, appearance, density] of [
      ['t_acme', 'light', 'comfortable'],
      ['t_globex', 'dark', 'spacious'],
      ['t_initech', 'light', 'compact'],
    ]) {
      const { text } = await html(request, await signIn(request, tenant));
      const css = themeStyle(text);
      expect(css.match(/--sem-[a-z-]+:/g)?.length).toBeGreaterThanOrEqual(18);
      expect(text).toMatch(
        /<style nonce="[A-Za-z0-9+/=]+" data-byteflock-theme/,
      );
      expect(text).toMatch(
        new RegExp(`<html[^>]*data-appearance="${appearance}"`),
      );
      expect(text).toMatch(new RegExp(`<html[^>]*data-density="${density}"`));
    }
  });

  test('nonces differ between requests', async ({ request }) => {
    const cookie = await signIn(request, 't_acme');
    const nonce = async () =>
      (await html(request, cookie)).text.match(
        /<style nonce="([^"]+)" data-byteflock-theme/,
      )?.[1];
    expect(await nonce()).not.toBe(await nonce());
  });

  test('T-03 a malicious stored theme never reaches the <style>; SSR falls back to the defaults', async ({
    request,
  }) => {
    // .env.development maps t_broken to libs/theme/fixtures/malicious/css-injection-colour.json.
    const broken = themeStyle(
      (await html(request, await signIn(request, 't_broken'))).text,
    );
    const defaults = themeStyle(
      await (await request.get(`${DASHBOARD}/dev/session`)).text(),
    );
    expect(broken).toBe(defaults);
    expect(broken).not.toMatch(/red|url\(|expression|<\/style/i);
  });
});

test.describe('caching posture (P1.6-T05, AC02)', () => {
  test('authenticated pages and APIs are not cacheable; /healthz is no-store', async ({
    request,
  }) => {
    const cookie = await signIn(request, 't_acme');
    for (const url of ['/', '/settings/theme', '/settings/widget']) {
      const { res } = await html(request, cookie, url);
      // `next dev` sends "no-store"; production sends "private, no-cache, no-store, …".
      expect(res.headers()['cache-control']).toContain('no-store');
    }
    const api = await request.get(`${DASHBOARD}/api/theme/revisions`, {
      headers: { cookie },
    });
    expect(api.headers()['cache-control']).toBe('private, no-store');
    const health = await request.get(`${DASHBOARD}/healthz`);
    expect(health.headers()['cache-control']).toBe('no-store');
  });

  test('without a session, pages redirect to /dev/session and APIs refuse', async ({
    request,
  }) => {
    const page = await request.get(`${DASHBOARD}/settings/theme`, {
      maxRedirects: 0,
    });
    expect(page.status()).toBe(307);
    expect(page.headers()['location']).toContain('/dev/session');
    const forged = await request.post(`${DASHBOARD}/api/theme/publish`, {
      headers: { cookie: 'dev-session=forged.value' },
    });
    expect(forged.status()).toBe(401);
  });
});

test.describe('production build (P1.6-AC07)', () => {
  const PROD = 'http://localhost:3005';
  test('no dev-only routes; /healthz is no-store', async ({ request }) => {
    expect((await request.get(`${PROD}/dev/session`)).status()).toBe(404);
    expect(
      (
        await request.post(`${PROD}/dev/session/select`, {
          form: { tenantId: 't_acme' },
        })
      ).status(),
    ).toBe(404);
    const health = await request.get(`${PROD}/healthz`);
    expect(health.status()).toBe(200);
    expect(health.headers()['cache-control']).toBe('no-store');
  });
});
