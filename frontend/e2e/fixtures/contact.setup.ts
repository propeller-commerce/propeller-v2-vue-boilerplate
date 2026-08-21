import { test as setup } from '@playwright/test';

setup('authenticate as contact', async ({ page }) => {
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');

  const emailInput = page.getByLabel(/email/i);
  await emailInput.waitFor({ state: 'visible', timeout: 15_000 });
  await emailInput.fill('d.krstev@propel.us');
  await page.getByLabel(/password/i).fill('darko000');
  await page.getByRole('button', { name: /login|sign in|log in|submit/i }).click();

  // Wait for redirect to account
  await page.waitForURL(/\/account/, { timeout: 20_000 });

  // Save auth state (includes auth_token + auth_user in localStorage)
  await page.context().storageState({ path: 'e2e/storage-state/contact.json' });
});
