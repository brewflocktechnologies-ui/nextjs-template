import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

/**
 * Visual regression (P1.7-T03): the dashboard home and the FilterDialog composite under each tenant.
 * Runs only in the pinned Linux Playwright container (`pnpm visual`); snapshots are `*-linux.png`.
 */
test.skip(!process.env['VISUAL'], 'Linux container only: run `pnpm visual`');
test.use({ viewport: { width: 1280, height: 800 } });

const shot = { animations: 'disabled', maxDiffPixelRatio: 0.002 } as const;

test('@visual dashboard home (Acme)', async ({ page, context }) => {
  await signIn(context, 't_acme');
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot('home-acme.png', shot);
});

for (const tenant of ['t_acme', 't_globex', 't_initech']) {
  test(`@visual FilterDialog open: ${tenant}`, async ({ page, context }) => {
    await signIn(context, tenant);
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    // Retried: the first click can land before hydration on a cold dev server.
    await expect(async () => {
      await page.getByRole('button', { name: /Filter by agent/ }).click();
      await expect(
        page.getByRole('dialog', { name: 'Filter conversations' }),
      ).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    await expect(page).toHaveScreenshot(`filter-dialog-${tenant}.png`, shot);
  });
}
