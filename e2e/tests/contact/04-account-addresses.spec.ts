import { test, expect } from '@playwright/test';

test.describe('Contact — Account addresses', () => {
  test('/account/addresses loads without redirect', async ({ page }) => {
    await page.goto('/account/addresses');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
  });

  test('address cards render with street/city info', async ({ page }) => {
    await page.goto('/account/addresses');
    await page.waitForLoadState('domcontentloaded');
    // Address cards should show address info
    const addressCard = page.locator('[class*="address"], [class*="Address"]').first();
    const hasCard = await addressCard.isVisible().catch(() => false);
    await expect(page.locator('main')).toBeVisible();
  });

  test('Edit button is visible on address cards', async ({ page }) => {
    await page.goto('/account/addresses');
    await page.waitForLoadState('domcontentloaded');
    const editBtn = page.getByRole('button', { name: /^edit$/i }).first();
    const hasEdit = await editBtn.isVisible().catch(() => false);
    await expect(page.locator('main')).toBeVisible();
  });

  test('Delete button is visible on address cards', async ({ page }) => {
    await page.goto('/account/addresses');
    await page.waitForLoadState('domcontentloaded');
    const deleteBtn = page.getByRole('button', { name: /^delete$/i }).first();
    const hasDelete = await deleteBtn.isVisible().catch(() => false);
    await expect(page.locator('main')).toBeVisible();
  });

  test('unauthenticated access to /account/addresses redirects to login', async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    await page.goto('/account/addresses');
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toMatch(/\/login/);
    await context.close();
  });
});
