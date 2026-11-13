// Development user switcher (P2.1-T12): every user from the database, grouped as Platform and per
// tenant; one click switches; the badge says who you are; an agent's settings are read-only; a
// forged choice is refused; production has no switcher at all (P2.1-AC15 part).
import { expect, test, type Page } from '@playwright/test';
import {
  DASHBOARD,
  signIn,
  signInPlatform,
  signInWithSwitcher,
} from './helpers';

const signInAs = (page: Page, name: string) =>
  signInWithSwitcher(page, name, { exact: true });

// Compile every route these tests visit once, before they run (a cold `next dev` compiles each
// route on first visit and may reload the page).
test.beforeAll(async ({ playwright }) => {
  test.setTimeout(180_000);
  const tenant = await playwright.request.newContext();
  await signIn(tenant, 't_acme');
  for (const url of [
    '/dev/session',
    '/',
    '/settings/theme',
    '/settings/widget',
    '/settings/dashboard',
  ])
    await tenant.get(`${DASHBOARD}${url}`);
  await tenant.dispose();
  const platform = await playwright.request.newContext();
  await signInPlatform(platform);
  await platform.get(`${DASHBOARD}/platform`);
  await platform.dispose();
});

test('lists every user, grouped as Platform and per tenant', async ({
  page,
}) => {
  await page.goto(`${DASHBOARD}/dev/session`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Choose a user',
  );
  const platform = page.getByRole('region', { name: 'Platform' });
  await expect(platform).toContainText('Platform Admin');
  await expect(platform).toContainText('u_platform_admin · super admin');

  const acme = page.getByTestId('group-t_acme');
  await expect(acme.getByRole('heading')).toContainText('Acme Corp');
  await expect(acme.getByRole('heading')).toContainText('wk_acme_demo');
  // Admins first, then agents.
  await expect(acme.locator('li')).toHaveCount(2);
  await expect(acme.locator('li').nth(0)).toContainText('u_acme_admin · admin');
  await expect(acme.locator('li').nth(1)).toContainText('u_acme_agent · agent');
  for (const tenant of ['t_globex', 't_initech']) {
    await expect(page.getByTestId(`group-${tenant}`).locator('li')).toHaveCount(
      1,
    );
  }
});

test('one click switches between the super admin and each tenant user', async ({
  page,
}) => {
  const steps = [
    [
      'Sign in as Platform Admin (super admin)',
      '/platform',
      'platform · u_platform_admin',
    ],
    [
      'Sign in as Acme Corp Admin (admin)',
      '/',
      't_acme · u_acme_admin · tenant_admin',
    ],
    [
      'Sign in as Globex Admin (admin)',
      '/',
      't_globex · u_globex_admin · tenant_admin',
    ],
    ['Sign in as Acme Agent (agent)', '/', 't_acme · u_acme_agent · agent'],
    [
      'Sign in as Initech Admin (admin)',
      '/',
      't_initech · u_initech_admin · tenant_admin',
    ],
    [
      'Sign in as Platform Admin (super admin)',
      '/platform',
      'platform · u_platform_admin',
    ],
  ] as const;
  for (const [button, landing, badge] of steps) {
    await signInAs(page, button);
    await expect(page).toHaveURL(`${DASHBOARD}${landing}`);
    await expect(page.getByTestId('dev-badge')).toHaveText(
      new RegExp(`^${badge.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
    );
  }
  // The switcher marks the current user.
  await page.goto(`${DASHBOARD}/dev/session`);
  await expect(
    page.getByRole('button', {
      name: 'Sign in as Platform Admin (super admin)',
    }),
  ).toHaveText('Signed in');
});

test('an agent sees read-only settings and cannot change anything', async ({
  page,
  context,
}) => {
  await signInAs(page, 'Sign in as Acme Agent (agent)');
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link', { name: 'Theme' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Dashboard' })).toHaveCount(0);

  await page.goto(`${DASHBOARD}/settings/theme`);
  await expect(page.getByTestId('read-only-note')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save draft' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Publish' })).toBeDisabled();

  await page.goto(`${DASHBOARD}/settings/widget`);
  await expect(page.getByTestId('read-only-note')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
  await expect(
    page.getByRole('textbox', { name: /Allowed origins/ }),
  ).toHaveAttribute('readonly', '');

  await page.goto(`${DASHBOARD}/settings/dashboard`);
  await expect(page.getByRole('status')).toHaveText(
    'Only a tenant admin can change these settings.',
  );

  // The server refuses too (the disabled buttons are not the protection).
  for (const path of [
    '/api/theme/publish',
    '/api/theme/draft',
    '/api/widget/origins',
    '/api/tenant-config',
  ]) {
    const res = await context.request.post(`${DASHBOARD}${path}`, { data: {} });
    expect(res.status(), path).toBe(403);
  }
  expect(
    (await context.request.get(`${DASHBOARD}/api/theme/revisions`)).status(),
  ).toBe(200);
});

test('a tenant admin keeps the editable settings', async ({
  page,
  context,
}) => {
  await signIn(context, 't_acme');
  await page.goto(`${DASHBOARD}/settings/theme`);
  await expect(page.getByTestId('read-only-note')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save draft' })).toBeEnabled();
});

test('a forged or mismatched choice is refused', async ({ request }) => {
  for (const as of [
    'u_acme_agent@t_globex', // not a member of Globex
    'u_acme_admin', // a tenant user without a tenant
    'u_nobody@t_acme',
    'u_nobody',
    'garbage',
    'u_acme_admin@t_acme@t_globex',
    "u_acme_admin@t_acme' OR 1=1",
  ]) {
    const res = await request.post(`${DASHBOARD}/dev/session/select`, {
      form: { as },
      maxRedirects: 0,
    });
    expect(res.status(), as).toBe(400);
    expect(res.headers()['set-cookie'], as).toBeUndefined();
  }
  // A super admin never signs in into a tenant: the tenant part is dropped.
  const res = await request.post(`${DASHBOARD}/dev/session/select`, {
    form: { as: 'u_platform_admin@t_acme' },
    maxRedirects: 0,
  });
  expect(res.status()).toBe(303);
  expect(res.headers().location).toContain('/platform');
});

test('production build: no switcher and no sign-in in any form (P2.1-AC15 part)', async ({
  request,
}) => {
  const PROD = 'http://localhost:3005';
  expect((await request.get(`${PROD}/dev/session`)).status()).toBe(404);
  const forms: Record<string, string>[] = [
    { as: 'u_platform_admin' },
    { as: 'u_acme_admin@t_acme' },
    { platform: '1' },
    { tenantId: 't_acme' },
  ];
  for (const form of forms) {
    const res = await request.post(`${PROD}/dev/session/select`, {
      form,
      maxRedirects: 0,
    });
    expect(res.status(), JSON.stringify(form)).toBe(404);
    expect(res.headers()['set-cookie']).toBeUndefined();
  }
});
