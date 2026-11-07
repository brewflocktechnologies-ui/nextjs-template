import { expect, test } from '@playwright/test';
import { launcherButton, openWidget, waitReady, widgetFrame } from './helpers';

/**
 * Visual regression (P1.7-T03): launcher states and the open frame per tenant. Runs only in the
 * pinned Linux Playwright container (`pnpm visual`), so snapshots are `*-linux.png` and Windows
 * font rendering never enters the baselines.
 */
test.skip(!process.env['VISUAL'], 'Linux container only: run `pnpm visual`');
test.use({ viewport: { width: 1024, height: 720 } });

const shot = { animations: 'disabled', maxDiffPixelRatio: 0.002 } as const;

test('@visual launcher, ready (Acme, unread badge)', async ({ page }) => {
  await page.goto('/clean.html?key=wk_acme_demo');
  await waitReady(page);
  await expect(launcherButton(page)).toHaveAttribute('aria-label', /unread/);
  await expect(launcherButton(page)).toHaveScreenshot(
    'launcher-acme.png',
    shot,
  );
});

test('@visual launcher, unavailable (frame blocked by CSP)', async ({
  page,
}) => {
  await page.goto('/frame-blocked.html?key=wk_acme_demo');
  await expect(page.locator('script[data-widget-key]')).toHaveAttribute(
    'data-byteflock-chat',
    'unavailable',
    { timeout: 10_000 },
  );
  await expect(launcherButton(page)).toHaveScreenshot(
    'launcher-unavailable.png',
    shot,
  );
});

for (const key of ['wk_acme_demo', 'wk_globex_demo', 'wk_initech_demo']) {
  test(`@visual frame open: ${key}`, async ({ page }) => {
    await page.goto(`/clean.html?key=${key}`);
    await waitReady(page);
    await openWidget(page);
    const frame = await widgetFrame(page, key);
    await frame.evaluate(() => document.fonts.ready);
    const inFrame = page.frameLocator(`iframe[src*="key=${key}"]`);
    await expect(inFrame.locator('textarea')).toBeFocused();
    await expect(page).toHaveScreenshot(`frame-open-${key}.png`, {
      ...shot,
      // Message times change with the clock.
      mask: [inFrame.locator('time')],
    });
  });
}
