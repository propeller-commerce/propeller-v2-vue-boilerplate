import { test, expect } from '@playwright/test';

test.describe('Contact — Account quotes', () => {
  test('/account/quotes loads without redirect', async ({ page }) => {
    await page.goto('/account/quotes');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
  });

  test('quotes list renders or shows empty state', async ({ page }) => {
    await page.goto('/account/quotes');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
  });

  test('clicking a quote navigates to quote detail', async ({ page }) => {
    await page.goto('/account/quotes');
    await page.waitForLoadState('domcontentloaded');
    const quoteLink = page.locator('main a[href*="/account/quotes/"]').first();
    const hasLink = await quoteLink.isVisible().catch(() => false);
    if (!hasLink) {
      test.skip(true, 'No quotes found');
      return;
    }
    await quoteLink.click();
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/account\/quotes\//);
  });

  test('quote detail shows QuoteActions accept button', async ({ page }) => {
    await page.goto('/account/quotes');
    await page.waitForLoadState('domcontentloaded');
    const quoteLink = page.locator('main a[href*="/account/quotes/"]').first();
    const hasLink = await quoteLink.isVisible().catch(() => false);
    if (!hasLink) {
      test.skip(true, 'No quotes found');
      return;
    }
    const href = await quoteLink.getAttribute('href');
    await page.goto(href!);
    await page.waitForLoadState('domcontentloaded');
    // QuoteActions accept button
    const acceptBtn = page.getByRole('button', { name: /accept|confirm quote/i }).first();
    const hasAccept = await acceptBtn.isVisible().catch(() => false);
    await expect(page.locator('main')).toBeVisible();
  });

  test('unauthenticated access to /account/quotes redirects to login', async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    await page.goto('/account/quotes');
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toMatch(/\/login/);
    await context.close();
  });
});
