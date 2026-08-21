import { test as setup } from '@playwright/test';

// Credentials come from env, with no fallback: this repo is mirrored to a
// public GitHub repo and is the source for scaffolded shops, so a hardcoded
// account is a real login published to everyone who runs the accelerator.
const EMAIL = process.env.TEST_CUSTOMER_USERNAME || '';
const PASSWORD = process.env.TEST_CUSTOMER_PASSWORD || '';
if (!EMAIL || !PASSWORD) {
  throw new Error(
    'Customer e2e credentials missing. Set TEST_CUSTOMER_USERNAME and TEST_CUSTOMER_PASSWORD.'
  );
}

setup('authenticate as customer', async ({ page }) => {
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');

  const emailInput = page.getByLabel(/email/i);
  await emailInput.waitFor({ state: 'visible', timeout: 15_000 });
  await emailInput.fill(EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /login|sign in|log in|submit/i }).click();

  // Wait for redirect to account
  await page.waitForURL(/\/account/, { timeout: 20_000 });

  // Save auth state (includes auth_token + auth_user in localStorage)
  await page.context().storageState({ path: 'e2e/storage-state/customer.json' });
});
