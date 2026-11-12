// Tenant dashboard config (P2.1-T09, AC12): module gating, literal text, fallback, validation.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { DASHBOARD, gotoHydrated, resetLocalState, signIn } from './helpers';

test.describe.configure({ mode: 'serial' });
test.beforeAll(resetLocalState);
test.afterAll(resetLocalState);

const config = (patch: object = {}) => ({
  schemaVersion: 1,
  modules: { themeEditor: true, widgetSettings: true },
  defaults: { locale: 'en-AU' },
  home: { title: 'Acme support', notice: '' },
  ...patch,
});

async function save(
  request: import('@playwright/test').APIRequestContext,
  body: unknown,
) {
  return request.post(`${DASHBOARD}/api/tenant-config`, {
    data: { config: body },
  });
}

test('disabling themeEditor hides the nav entry and 404s its page and API (P2.1-AC12)', async ({
  page,
  context,
}) => {
  await signIn(context, 't_acme');
  expect(
    (
      await save(
        context.request,
        config({ modules: { themeEditor: false, widgetSettings: true } }),
      )
    ).status(),
  ).toBe(200);

  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link', { name: 'Theme' })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: 'Widget' })).toBeVisible();
  expect((await page.goto('/settings/theme'))?.status()).toBe(404);
  expect(
    (await context.request.get(`${DASHBOARD}/api/theme/revisions`)).status(),
  ).toBe(404);
  expect((await page.goto('/settings/widget'))?.status()).toBe(200);

  // Another tenant is unaffected.
  const other = await context.browser()!.newContext();
  await signIn(other, 't_globex');
  const otherPage = await other.newPage();
  await otherPage.goto(`${DASHBOARD}/`);
  await expect(
    otherPage
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Theme' }),
  ).toBeVisible();
  await other.close();
});

test('home title and notice render as literal text, never HTML (P2.1-AC12)', async ({
  page,
  context,
}) => {
  await signIn(context, 't_acme');
  const notice = '<img src=x onerror="window.__xss=1"><b>bold</b>';
  expect(
    (
      await save(
        context.request,
        config({ home: { title: '<i>Acme</i> help', notice } }),
      )
    ).status(),
  ).toBe(200);
  await page.goto('/');
  await expect(page.getByTestId('home-title')).toHaveText('<i>Acme</i> help');
  await expect(page.getByTestId('home-notice')).toHaveText(notice);
  expect(
    await page.locator('[data-testid=home-notice] b, img[src=x]').count(),
  ).toBe(0);
  expect(
    await page.evaluate(() => (window as unknown as { __xss?: number }).__xss),
  ).toBeUndefined();
});

test('invalid configs are refused with the problems listed', async ({
  context,
}) => {
  await signIn(context, 't_acme');
  for (const bad of [
    config({ extra: true }),
    config({ home: { title: 'x'.repeat(61), notice: '' } }),
    config({ defaults: { locale: 'fr-FR' } }),
    'not an object',
  ]) {
    const res = await save(context.request, bad);
    expect(res.status()).toBe(422);
    expect((await res.json()).problems.length).toBeGreaterThan(0);
  }
  expect((await save(context.request, undefined)).status()).toBe(422);
});

test('the editor saves and the change shows on the next page load', async ({
  page,
  context,
}) => {
  await signIn(context, 't_globex');
  await gotoHydrated(page, `${DASHBOARD}/settings/dashboard`);
  await page.getByLabel(/Home title/).fill('Globex help desk');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByTestId('dashboard-status')).toContainText('Saved');
  await page.goto('/');
  await expect(page.getByTestId('home-title')).toHaveText('Globex help desk');
});

test('a tenant on the default config shows the default title without an error page', async ({
  page,
  context,
}) => {
  await signIn(context, 't_initech');
  const res = await page.goto('/');
  expect(res?.status()).toBe(200);
  await expect(page.getByTestId('home-title')).toHaveText('Initech support');
});

test('unauthenticated requests are redirected to the session page, not served', async ({
  request,
}) => {
  const res = await request.post(`${DASHBOARD}/api/tenant-config`, {
    data: { config: config() },
    maxRedirects: 0,
  });
  expect(res.status()).toBe(307);
  expect(res.headers().location).toContain('/dev/session');
});

for (const tenant of ['t_acme', 't_globex', 't_initech']) {
  test(`axe: no serious or critical issues on /settings/dashboard for ${tenant} (P2.1-AC16)`, async ({
    page,
    context,
  }) => {
    await signIn(context, tenant);
    await gotoHydrated(page, `${DASHBOARD}/settings/dashboard`);
    const results = await new AxeBuilder({ page }).analyze();
    const bad = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(bad.map((v) => v.id)).toEqual([]);
  });
}
