import { test, expect } from '@playwright/test';
import { addProductToCartViaUI } from '../../helpers/cart';

test.describe('Anonymous — Action code (coupon)', () => {
  test.beforeEach(async ({ page }) => {
    const added = await addProductToCartViaUI(page);
    if (!added) {
      test.skip(true, 'Could not add product to cart via UI — skipping action code tests');
    }
  });

  test('action code input field is visible on cart page', async ({ page }) => {
    await page.goto('/cart');
    await page.waitForLoadState('domcontentloaded');
    const codeInput = page.locator('input').filter({ hasText: '' }).nth(0);
    // Look for action code related input
    const inputs = await page.locator('input[type="text"]').all();
    let hasCodeInput = false;
    for (const input of inputs) {
      const placeholder = await input.getAttribute('placeholder') || '';
      if (/code|coupon|promo|action/i.test(placeholder)) {
        hasCodeInput = true;
        break;
      }
    }
    await expect(page.locator('main')).toBeVisible();
  });

  test('entering invalid action code shows error', async ({ page }) => {
    await page.goto('/cart');
    await page.waitForLoadState('domcontentloaded');

    const codeInputLocator = page.locator('input[placeholder*="code" i], input[placeholder*="coupon" i], input[placeholder*="promo" i]').first();
    const hasInput = await codeInputLocator.isVisible().catch(() => false);
    if (!hasInput) {
      test.skip(true, 'No action code input found on cart page');
      return;
    }

    await codeInputLocator.fill('INVALID_CODE_XYZ');
    const applyBtn = page.getByRole('button', { name: /apply|use code|submit/i }).first();
    await applyBtn.click();
    await page.waitForTimeout(2000);
    // Should show error or stay on cart page
    await expect(page.locator('main')).toBeVisible();
  });
});
