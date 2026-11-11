// Default chrome and scoped preview (P2.1-T11; AC05, AC06): on the super admin's pages the chrome is
// always the platform design, and a tenant's design appears only inside its labelled preview
// container, through a style that targets nothing else.
import { expect, test } from '@playwright/test';
import {
  DASHBOARD,
  cssVar,
  previewStyle,
  rootNonce,
  signIn,
  signInPlatform,
  themeStyle,
} from './helpers';

const TENANTS = ['t_acme', 't_globex', 't_initech'] as const;
const PAGES = ['', '/theme', '/dashboard', '/widget'] as const;

async function html(
  request: import('@playwright/test').APIRequestContext,
  url: string,
) {
  const res = await request.get(`${DASHBOARD}${url}`);
  expect(res.status(), url).toBe(200);
  return res.text();
}

test('P2.1-AC05: the :root style on every platform page equals the platform defaults', async ({
  playwright,
}) => {
  // The platform defaults are what a page with no tenant (the sign-in page) renders.
  const anon = await playwright.request.newContext();
  const defaults = themeStyle(await html(anon, '/dev/session'));
  await anon.dispose();
  expect(defaults).toContain('--sem-color-primary:');

  const platform = await playwright.request.newContext();
  await signInPlatform(platform);
  const urls = [
    '/platform',
    ...TENANTS.flatMap((t) => PAGES.map((p) => `/platform/tenants/${t}${p}`)),
  ];
  for (const url of urls) {
    expect(themeStyle(await html(platform, url)), url).toBe(defaults);
  }
  await platform.dispose();

  // The three tenants' own chromes differ from the defaults and from each other.
  const own = new Set<string>();
  for (const tenant of TENANTS) {
    const ctx = await playwright.request.newContext();
    await signIn(ctx, tenant);
    const style = themeStyle(await html(ctx, '/'));
    expect(style).not.toBe(defaults);
    own.add(style);
    await ctx.dispose();
  }
  expect(own.size).toBe(3);
});

test('the preview style targets only its container and carries the page nonce', async ({
  playwright,
}) => {
  const platform = await playwright.request.newContext();
  await signInPlatform(platform);
  for (const tenant of TENANTS) {
    const text = await html(platform, `/platform/tenants/${tenant}`);
    const preview = previewStyle(text, tenant);
    expect(preview.css).not.toMatch(/:root|html|body|\*/);
    expect(preview.css.startsWith(`[data-tenant-preview="${tenant}"]{`)).toBe(
      true,
    );
    // Exactly one rule (plus the optional system-dark one): no other selector appears.
    expect(preview.css.match(/\{/g)?.length).toBeLessThanOrEqual(2);
    expect(preview.nonce).toBeTruthy();
    expect(preview.nonce).toBe(rootNonce(text));
  }
  await platform.dispose();
});

test('P2.1-AC06: computed variables are the default on html and the tenant’s inside the container', async ({
  page,
  context,
}) => {
  await signInPlatform(context);
  const defaultPrimary = cssVar(
    themeStyle(
      await (await context.request.get(`${DASHBOARD}/platform`)).text(),
    ),
    '--sem-color-primary',
  );

  const expected = {
    t_acme: '#1d4ed8',
    t_globex: '#5eead4',
    t_initech: '#b45309',
  } as const;
  for (const tenant of TENANTS) {
    await page.goto(`${DASHBOARD}/platform/tenants/${tenant}`);
    const preview = page.getByTestId('tenant-preview');
    await expect(preview).toBeVisible();

    const computed = await page.evaluate((id) => {
      const read = (el: Element, name: string) =>
        getComputedStyle(el).getPropertyValue(name).trim();
      const box = document.querySelector(`[data-tenant-preview="${id}"]`)!;
      return {
        htmlPrimary: read(document.documentElement, '--sem-color-primary'),
        bodyPrimary: read(document.body, '--sem-color-primary'),
        boxPrimary: read(box, '--sem-color-primary'),
        // The shadcn bridge is re-declared on the container, so components follow it.
        htmlShadcn: read(document.documentElement, '--primary'),
        boxShadcn: read(box, '--primary'),
        boxChild: read(box.querySelector('button')!, '--primary'),
        brand: document.querySelector('[data-testid=brand-name]')?.textContent,
      };
    }, tenant);

    expect(computed.htmlPrimary, tenant).toBe(defaultPrimary);
    expect(computed.bodyPrimary, tenant).toBe(defaultPrimary);
    expect(computed.boxPrimary, tenant).toBe(expected[tenant]);
    expect(computed.htmlShadcn, tenant).not.toBe(computed.boxShadcn);
    expect(computed.boxShadcn, tenant).toBe(expected[tenant]);
    expect(computed.boxChild, tenant).toBe(expected[tenant]);
    // The chrome is the platform's, not the tenant's.
    expect(computed.brand).toBe('Byteflock');
  }
});

test('the preview is labelled and the primary button inside really uses the tenant colour', async ({
  page,
  context,
}) => {
  await signInPlatform(context);
  await page.goto(`${DASHBOARD}/platform/tenants/t_acme`);
  await expect(page.getByTestId('preview-label')).toHaveText(
    'Preview: Acme Corp',
  );
  const bg = (selector: string) =>
    page
      .locator(selector)
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor);
  // rgb(29, 78, 216) is #1d4ed8, Acme's primary; the page's own primary button is not Acme blue.
  expect(await bg('[data-tenant-preview] button')).toBe('rgb(29, 78, 216)');
  await page.goto(`${DASHBOARD}/platform/tenants/t_globex`);
  await expect(page.getByTestId('preview-label')).toHaveText('Preview: Globex');
  expect(await bg('[data-tenant-preview] button')).not.toBe('rgb(29, 78, 216)');
});

test('the theme page shows the preview and the editor, and a tenant user never gets a preview', async ({
  page,
  context,
}) => {
  await signInPlatform(context);
  await page.goto(`${DASHBOARD}/platform/tenants/t_initech/theme`);
  await expect(page.getByTestId('preview-label')).toHaveText(
    'Preview: Initech',
  );
  await expect(page.getByLabel('Brand name')).toBeVisible();

  const tenant = await context.browser()!.newContext();
  await signIn(tenant, 't_acme');
  const tenantPage = await tenant.newPage();
  await tenantPage.goto(`${DASHBOARD}/`);
  await expect(tenantPage.locator('[data-tenant-preview]')).toHaveCount(0);
  await tenant.close();
});
