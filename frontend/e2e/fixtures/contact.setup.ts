import { test as setup } from '@playwright/test';

// Credentials come from env, with no fallback: this repo is mirrored to a
// public GitHub repo and is the source for scaffolded shops, so a hardcoded
// account is a real login published to everyone who runs the accelerator.
const EMAIL = process.env.TEST_CONTACT_USERNAME || '';
const PASSWORD = process.env.TEST_CONTACT_PASSWORD || '';
if (!EMAIL || !PASSWORD) {
  throw new Error(
    'Contact e2e credentials missing. Set TEST_CONTACT_USERNAME and TEST_CONTACT_PASSWORD.'
  );
}

setup('authenticate as contact', async ({ page }) => {
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
  await page.context().storageState({ path: 'e2e/storage-state/contact.json' });
});
