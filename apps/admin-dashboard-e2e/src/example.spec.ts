import { test, expect } from '@playwright/test';

test('@smoke renders the admin dashboard shell', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { level: 1, name: 'Admin dashboard' }),
  ).toBeVisible();
});
