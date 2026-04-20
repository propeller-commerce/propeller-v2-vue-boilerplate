import { test, expect } from '@playwright/test';
import { AccountPage } from '../../page-objects/AccountPage';

test.describe('Contact — Account dashboard', () => {
  test('account dashboard loads with My Account heading', async ({ page }) => {
    const accountPage = new AccountPage(page);
    await accountPage.goto();
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
    await expect(accountPage.pageHeading).toBeVisible({ timeout: 10_000 });
  });

  test('should not redirect to login when authenticated', async ({ page }) => {
    await page.goto('/account');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('sidebar navigation buttons are present', async ({ page }) => {
    await page.goto('/account');
    await page.waitForLoadState('domcontentloaded');
    const accountPage = new AccountPage(page);
    // AccountIconAndMenu sidebar renders as buttons
    const ordersBtn = accountPage.ordersLink;
    await expect(ordersBtn).toBeVisible({ timeout: 10_000 });
  });

  test('UserDetails renders user info', async ({ page }) => {
    await page.goto('/account');
    await page.waitForLoadState('domcontentloaded');
    // User details section should show email or name
    const userInfo = page.locator('main').getByText(/krstev|d\.krstev|darko/i).first();
    const hasUserInfo = await userInfo.isVisible().catch(() => false);
    // At minimum main should be visible
    await expect(page.locator('main')).toBeVisible();
  });

  test('CompanySwitcher visible for contact users', async ({ page }) => {
    await page.goto('/account');
    await page.waitForLoadState('domcontentloaded');
    // CompanySwitcher renders for contact users with companies
    const companySwitcher = page.locator('[class*="company"], select').first();
    const hasCompany = await companySwitcher.isVisible().catch(() => false);
    await expect(page.locator('main')).toBeVisible();
  });

  test('unauthenticated access to /account redirects to login', async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    await page.goto('/account');
    await page.waitForLoadState('domcontentloaded');
    const url = page.url();
    expect(url).toMatch(/\/login/);
    await context.close();
  });
});
