// Platform scope pages and routing (P2.1-T10; AC08, AC16 part, T-04 on Postgres): the super admin
// lists and edits every tenant; tenant users never see /platform; a tenant user cannot reach another
// tenant by naming it.
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { scanA11y } from './a11y';
import {
  DASHBOARD,
  WIDGET_PUBLIC,
  gotoHydrated,
  readJson,
  resetLocalState,
  signIn,
  signInPlatform,
  signInWithSwitcher,
} from './helpers';

test.describe.configure({ mode: 'serial' });
test.beforeAll(resetLocalState);
test.afterAll(resetLocalState);

test('the super admin lands on /platform and sees the three real tenants', async ({
  page,
  context,
}) => {
  await signInPlatform(context);
  await signInWithSwitcher(page, 'Sign in as Platform Admin (super admin)');
  await expect(page).toHaveURL(`${DASHBOARD}/platform`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tenants');
  const rows = page.getByTestId('tenant-list').locator('tbody tr');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText('Acme Corp');
  await expect(rows.nth(0)).toContainText('wk_acme_demo');
  await expect(rows.nth(0)).toContainText('1');
  await expect(page.getByTestId('tenant-list')).not.toContainText('broken');
  await expect(page.getByTestId('dev-badge')).toContainText(
    'platform · u_platform_admin',
  );
});

test('P2.1-AC08: a super admin is redirected from tenant routes to /platform', async ({
  page,
  context,
}) => {
  await signInPlatform(context);
  for (const url of [
    '/',
    '/settings/theme',
    '/settings/widget',
    '/settings/dashboard',
  ]) {
    await page.goto(url);
    await expect(page).toHaveURL(`${DASHBOARD}/platform`);
  }
});

test('P2.1-AC08: tenant users get 404 on /platform/** (the route is not revealed)', async ({
  page,
  context,
}) => {
  await signIn(context, 't_acme');
  for (const url of [
    '/platform',
    '/platform/tenants/t_acme',
    '/platform/tenants/t_acme/theme',
    '/platform/tenants/t_globex/dashboard',
    '/platform/tenants/t_globex/widget',
  ]) {
    expect((await page.goto(url))?.status(), url).toBe(404);
  }
});

test('an unknown or malformed tenant is a 404 for the super admin', async ({
  page,
  context,
}) => {
  await signInPlatform(context);
  for (const url of [
    '/platform/tenants/t_nobody',
    '/platform/tenants/not-a-tenant/theme',
  ]) {
    expect((await page.goto(url))?.status(), url).toBe(404);
  }
});

test('T-04: API calls cannot name another tenant; the super admin must name one', async ({
  context,
}) => {
  await signIn(context, 't_acme');
  const own = await context.request.get(`${DASHBOARD}/api/theme/revisions`);
  expect(own.status()).toBe(200);
  const sameTenant = await context.request.get(
    `${DASHBOARD}/api/theme/revisions?tenantId=t_acme`,
  );
  expect(sameTenant.status()).toBe(200);
  for (const path of [
    '/api/theme/revisions?tenantId=t_globex',
    '/api/theme/revisions?tenantId=t_nobody',
  ]) {
    expect(
      (await context.request.get(`${DASHBOARD}${path}`)).status(),
      path,
    ).toBe(403);
  }
  for (const [method, path] of [
    ['post', '/api/theme/publish?tenantId=t_globex'],
    ['post', '/api/theme/draft?tenantId=t_globex'],
    ['post', '/api/widget/origins?tenantId=t_globex'],
    ['post', '/api/tenant-config?tenantId=t_globex'],
  ] as const) {
    const res = await context.request[method](`${DASHBOARD}${path}`, {
      data: {},
    });
    expect(res.status(), path).toBe(403);
  }
  expect(
    (
      await context.request.get(
        `${DASHBOARD}/api/theme/revisions?tenantId=../x`,
      )
    ).status(),
  ).toBe(400);

  const platform = await (
    await import('@playwright/test')
  ).request.newContext();
  await signInPlatform(platform);
  expect(
    (await platform.get(`${DASHBOARD}/api/theme/revisions`)).status(),
  ).toBe(400);
  const other = await platform.get(
    `${DASHBOARD}/api/theme/revisions?tenantId=t_globex`,
  );
  expect(other.status()).toBe(200);
  expect((await other.json()).current).toBe(1);
  await platform.dispose();
});

test('platform publish: the super admin edits, previews and publishes for a tenant', async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  await signInPlatform(context);
  await gotoHydrated(page, `${DASHBOARD}/platform/tenants/t_acme/theme`);
  // The chrome stays on the platform design (D-25): the brand is the platform's, not Acme's.
  await expect(page.getByTestId('brand-name')).toHaveText('Byteflock');
  await expect(page.getByTestId('preview-state')).toHaveText(
    'Preview connected.',
    { timeout: 15_000 },
  );
  await page.getByLabel('Brand name').fill('Acme By Platform');
  await expect(page.getByTestId('checks-ok')).toBeVisible();
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByTestId('editor-status')).toHaveText(
    'Published revision 2.',
    { timeout: 20_000 },
  );
  expect(
    readJson(path.join(WIDGET_PUBLIC, 'config', 'wk_acme_demo.json'))
      .themeRevision,
  ).toBe(2);
  expect(
    readJson(path.join(WIDGET_PUBLIC, 'themes', 't_acme', '2.json')).brand.name,
  ).toBe('Acme By Platform');

  // Globex is untouched.
  expect(
    readJson(path.join(WIDGET_PUBLIC, 'config', 'wk_globex_demo.json'))
      .themeRevision,
  ).toBe(1);

  // The tenant's own dashboard now shows the published theme.
  const acme = await context.browser()!.newContext();
  await signIn(acme, 't_acme');
  const acmePage = await acme.newPage();
  await acmePage.goto(`${DASHBOARD}/`);
  await expect(acmePage.getByTestId('brand-name')).toHaveText(
    'Acme By Platform',
  );
  await acme.close();
});

test('platform: the super admin changes a tenant dashboard config and widget origins', async ({
  context,
}) => {
  await signInPlatform(context);
  const config = await context.request.post(
    `${DASHBOARD}/api/tenant-config?tenantId=t_globex`,
    {
      data: {
        config: {
          schemaVersion: 1,
          modules: { themeEditor: true, widgetSettings: false },
          defaults: { locale: 'en-US' },
          home: { title: 'Globex by platform', notice: '' },
        },
      },
    },
  );
  expect(config.status()).toBe(200);
  const origins = await context.request.post(
    `${DASHBOARD}/api/widget/origins?tenantId=t_globex`,
    { data: { origins: ['https://www.example.com', 'http://localhost:4300'] } },
  );
  expect(origins.status()).toBe(200);
  expect(
    readJson(path.join(WIDGET_PUBLIC, 'config', 'wk_globex_demo.json'))
      .allowedOrigins,
  ).toEqual(['https://www.example.com', 'http://localhost:4300']);

  // The platform is exempt from a tenant's disabled module; the tenant is not.
  expect(
    (
      await context.request.get(
        `${DASHBOARD}/api/theme/revisions?tenantId=t_globex`,
      )
    ).status(),
  ).toBe(200);
  const tenant = await (await import('@playwright/test')).request.newContext();
  await signIn(tenant, 't_globex');
  expect(
    (
      await tenant.post(`${DASHBOARD}/api/widget/origins`, {
        data: { origins: ['https://a.example'] },
      })
    ).status(),
  ).toBe(404);
  await tenant.dispose();
});

for (const url of [
  '/platform',
  '/platform/tenants/t_acme',
  '/platform/tenants/t_globex/dashboard',
  '/platform/tenants/t_initech/widget',
]) {
  test(`axe: no serious or critical issues on ${url} (P2.1-AC16)`, async ({
    page,
    context,
  }) => {
    await signInPlatform(context);
    await page.goto(`${DASHBOARD}${url}`);
    await page.getByRole('heading', { level: 1 }).waitFor();
    const results = await scanA11y(page);
    const bad = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(bad.map((v) => v.id)).toEqual([]);
  });
}
