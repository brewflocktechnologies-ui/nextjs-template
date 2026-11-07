import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test('@smoke renders the admin dashboard shell for a tenant', async ({
  page,
  context,
}) => {
  await signIn(context, 't_acme');
  await page.goto('/');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Admin dashboard' }),
  ).toBeVisible();
  await expect(page.getByTestId('brand-name')).toHaveText('Acme Corp');
  await expect(page.getByTestId('dev-badge')).toContainText(
    't_acme · u_acme_admin',
  );
});

test('@smoke /dev/session switches tenants in one click', async ({ page }) => {
  await page.goto('/dev/session');
  await page.getByRole('button', { name: 'Sign in as Globex' }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByTestId('brand-name')).toHaveText('Globex');
});
