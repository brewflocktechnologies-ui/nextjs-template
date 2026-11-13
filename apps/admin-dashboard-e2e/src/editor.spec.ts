import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { scanA11y } from './a11y';
import {
  WIDGET_PUBLIC,
  gotoHydrated,
  readJson,
  resetLocalState,
  signIn,
} from './helpers';

const acmeConfig = () =>
  readJson(path.join(WIDGET_PUBLIC, 'config', 'wk_acme_demo.json'));

test.beforeAll(resetLocalState);

// A cold `next dev` compiles each route on first visit and may then reload the page once, which
// can swallow input typed in between. Visit every page once in a browser before the tests.
test.beforeAll(async ({ browser }) => {
  test.setTimeout(180_000);
  const context = await browser.newContext();
  await signIn(context, 't_acme');
  const page = await context.newPage();
  for (const url of ['/settings/theme', '/settings/widget']) {
    await gotoHydrated(page, `http://localhost:3000${url}`);
  }
  await context.close();
});
test.afterAll(resetLocalState);

async function colour(page: Page, role: string, value: string) {
  const field = page.getByRole('textbox', { name: role, exact: true });
  await field.fill(value);
}

test.describe('theme editor (P1.6-T07)', () => {
  test('editor flow: violation shown and publish blocked; fix; publish moves the pointer; rollback', async ({
    page,
    context,
  }) => {
    await signIn(context, 't_acme');
    await gotoHydrated(page, '/settings/theme');
    await expect(page.getByTestId('checks-ok')).toBeVisible();

    // A contrast violation is listed and blocks publishing (P1.6-AC06, UI side).
    await colour(page, 'On Primary', '#1d4ed8');
    await expect(page.getByTestId('violations')).toContainText(
      'On Primary on Primary',
    );
    await expect(page.getByRole('button', { name: 'Publish' })).toBeDisabled();

    // Fix it, change the brand name, publish.
    await colour(page, 'On Primary', '#ffffff');
    await page.getByLabel('Brand name').fill('Acme Published');
    await expect(page.getByTestId('checks-ok')).toBeVisible();
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page.getByTestId('editor-status')).toHaveText(
      'Published revision 2.',
      { timeout: 20_000 },
    );
    expect(acmeConfig().themeRevision).toBe(2);
    expect(
      readJson(path.join(WIDGET_PUBLIC, 'themes', 't_acme', '2.json')).brand
        .name,
    ).toBe('Acme Published');

    // The dashboard chrome now shows the published theme.
    await page.goto('/');
    await expect(page.getByTestId('brand-name')).toHaveText('Acme Published');

    // Rollback moves only the pointer.
    await gotoHydrated(page, '/settings/theme');
    await page.getByRole('button', { name: 'Use revision 1' }).click();
    await expect(page.getByTestId('editor-status')).toHaveText(
      'The widget now uses revision 1.',
      { timeout: 20_000 },
    );
    expect(acmeConfig().themeRevision).toBe(1);
  });

  test('preview: a colour change reaches the real frame without a reload (theme.preview)', async ({
    page,
    context,
  }) => {
    await signIn(context, 't_acme');
    await gotoHydrated(page, '/settings/theme');
    await expect(page.getByTestId('preview-state')).toHaveText(
      'Preview connected.',
      { timeout: 15_000 },
    );
    await colour(page, 'Primary', '#0f5132');
    const frame = page.frames().find((f) => f.url().includes('mode=preview'));
    expect(frame).toBeTruthy();
    await expect
      .poll(
        () =>
          frame?.evaluate(() =>
            getComputedStyle(document.documentElement)
              .getPropertyValue('--sem-color-primary')
              .trim(),
          ),
        { timeout: 10_000 },
      )
      .toBe('#0f5132');
  });
});

test.describe('widget domain settings (P1.6-T12, AC13)', () => {
  test('removing the playground origin makes the widget unavailable there; restoring it brings it back', async ({
    page,
    context,
  }) => {
    await signIn(context, 't_acme');
    const setOrigins = async (text: string) => {
      await gotoHydrated(page, '/settings/widget');
      await page.getByRole('textbox', { name: /Allowed origins/ }).fill(text);
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByTestId('widget-status')).toHaveText(/^Saved./, {
        timeout: 20_000, // the first API call compiles the route in next dev
      });
    };
    const playgroundStatus = async () => {
      const host = await context.newPage();
      await host.goto('http://localhost:4300/clean.html?key=wk_acme_demo');
      const script = host.locator('script[data-widget-key]');
      await expect(script).toHaveAttribute(
        'data-byteflock-chat',
        /ready|unavailable/,
        { timeout: 15_000 },
      );
      const status = await script.getAttribute('data-byteflock-chat');
      await host.close();
      return status;
    };

    await setOrigins('https://www.example.com');
    expect(acmeConfig().allowedOrigins).toEqual(['https://www.example.com']);
    expect(await playgroundStatus()).toBe('unavailable');

    await setOrigins('http://localhost:4300');
    expect(await playgroundStatus()).toBe('ready');
  });

  test('invalid origins are listed and cannot be saved', async ({
    page,
    context,
  }) => {
    await signIn(context, 't_acme');
    await gotoHydrated(page, '/settings/widget');
    await page
      .getByRole('textbox', { name: /Allowed origins/ })
      .fill('https://*.example.com');
    await expect(page.getByTestId('origin-problems')).toContainText(
      'not an exact origin',
    );
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});

test.describe('accessibility of the themed chrome (P1.6-AC12)', () => {
  for (const tenant of ['t_acme', 't_globex', 't_initech']) {
    test(`axe: no violations on /, /settings/theme and /settings/widget for ${tenant}`, async ({
      page,
      context,
    }) => {
      await signIn(context, tenant);
      for (const url of ['/', '/settings/theme', '/settings/widget']) {
        await page.goto(url);
        // The preview iframe is the widget's own document, covered by its own suite.
        const results = await scanA11y(page, { exclude: ['iframe'] });
        expect(
          results.violations.map((v) => `${url} ${v.id}: ${v.help}`),
        ).toEqual([]);
      }
    });
  }
});
