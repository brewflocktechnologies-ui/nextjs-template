import { test, expect } from '@playwright/test';

test('@smoke playground index loads and names the widget origin', async ({
  page,
}) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Byteflock widget playground',
    }),
  ).toBeVisible();
  await expect(page.locator('#widget-origin')).toHaveText(
    'http://localhost:4400',
  );
});
