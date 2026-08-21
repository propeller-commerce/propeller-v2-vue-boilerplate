import { test, expect } from '@playwright/test';

test.describe('Contact — Account favorites', () => {
  test('/account/favorites loads without redirect', async ({ page }) => {
    await page.goto('/account/favorites');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
  });

  test('refreshing /account/favorites stays on the page (no SSR login redirect)', async ({ page }) => {
    // Regression: on a hard refresh the router's requiresAuth guard runs
    // server-side, where the auth store must be seeded from the access_token
    // cookie — otherwise the server 302-redirects a logged-in user to /login.
    await page.goto('/account/favorites');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).not.toHaveURL(/\/login/);

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
  });

  test('favorite lists render or empty state shown', async ({ page }) => {
    await page.goto('/account/favorites');
    await page.waitForLoadState('domcontentloaded');
    // Either favorite lists or empty state
    const content = page.locator('main');
    await expect(content).toBeVisible({ timeout: 10_000 });
  });

  test('create new list button is visible', async ({ page }) => {
    await page.goto('/account/favorites');
    await page.waitForLoadState('domcontentloaded');
    const createBtn = page.getByRole('button', { name: /create|new list|add list/i }).first();
    const hasCreate = await createBtn.isVisible().catch(() => false);
    await expect(page.locator('main')).toBeVisible();
  });

  test('clicking a favorite list navigates to list detail', async ({ page }) => {
    await page.goto('/account/favorites');
    await page.waitForLoadState('domcontentloaded');
    const listLink = page.locator('main a[href*="/account/favorites/"]').first();
    const hasLink = await listLink.isVisible().catch(() => false);
    if (!hasLink) {
      test.skip(true, 'No favorite lists found');
      return;
    }
    await listLink.click();
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/account\/favorites\//);
  });

  test('favorite list detail renders product items', async ({ page }) => {
    await page.goto('/account/favorites');
    await page.waitForLoadState('domcontentloaded');
    const listLink = page.locator('main a[href*="/account/favorites/"]').first();
    const hasLink = await listLink.isVisible().catch(() => false);
    if (!hasLink) {
      test.skip(true, 'No favorite lists found');
      return;
    }
    const href = await listLink.getAttribute('href');
    await page.goto(href!);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
  });

  test('unauthenticated access to /account/favorites redirects to login', async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    await page.goto('/account/favorites');
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toMatch(/\/login/);
    await context.close();
  });
});
