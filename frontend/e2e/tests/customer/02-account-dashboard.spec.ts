import { test, expect } from '@playwright/test';
import { AccountPage } from '../../page-objects/AccountPage';

test.describe('Customer — Account dashboard', () => {
  test('account dashboard loads without redirect', async ({ page }) => {
    const accountPage = new AccountPage(page);
    await accountPage.goto();
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
  });

  test('sidebar navigation buttons are present', async ({ page }) => {
    const accountPage = new AccountPage(page);
    await accountPage.goto();
    // AccountIconAndMenu sidebar renders as buttons
    await expect(accountPage.ordersLink).toBeVisible({ timeout: 10_000 });
  });

  test('/account/addresses loads for customer (personal addresses)', async ({ page }) => {
    await page.goto('/account/addresses');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
  });

  test('/account/orders loads customer order history', async ({ page }) => {
    await page.goto('/account/orders');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
  });

  test('/account/favorites loads for customer', async ({ page }) => {
    await page.goto('/account/favorites');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
  });
});
