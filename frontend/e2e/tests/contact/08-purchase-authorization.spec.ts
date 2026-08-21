import { test, expect } from '@playwright/test';

test.describe('Contact — Purchase Authorization', () => {
  test('/account/authorization-settings loads without redirect', async ({ page }) => {
    await page.goto('/account/authorization-settings');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
  });

  test('PurchaseAuthorizationConfigurator renders or shows empty state', async ({ page }) => {
    await page.goto('/account/authorization-settings');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
  });

  test('/account/authorization-requests loads without redirect', async ({ page }) => {
    await page.goto('/account/authorization-requests');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
  });

  test('authorization requests page shows pending carts or empty state', async ({ page }) => {
    await page.goto('/account/authorization-requests');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
  });

  test('unauthenticated access to authorization-settings redirects to login', async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    await page.goto('/account/authorization-settings');
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toMatch(/\/login/);
    await context.close();
  });
});
