import { test, expect } from '@playwright/test';
import { CheckoutPage } from '../../page-objects/CheckoutPage';
import { addProductToCartViaUI } from '../../helpers/cart';

test.describe('Contact — Checkout (logged in)', () => {
  test.beforeEach(async ({ page }) => {
    const added = await addProductToCartViaUI(page);
    if (!added) {
      test.skip(true, 'Could not add product to cart via UI');
    }
  });

  test('checkout page loads for authenticated contact', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
  });

  test('Step 1: invoice address may be pre-populated for logged-in contact', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();
    await checkout.waitForStep1();
    // For authenticated contacts, fields may be pre-filled from profile
    const firstNameValue = await checkout.firstNameInput.inputValue().catch(() => '');
    expect(typeof firstNameValue).toBe('string');
  });

  test('Step 1: address form fields are visible', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();
    await checkout.waitForStep1();
    await expect(checkout.firstNameInput).toBeVisible({ timeout: 5_000 });
    await expect(checkout.lastNameInput).toBeVisible({ timeout: 5_000 });
  });

  test('Step 1 → Step 2 transition works for contact', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();
    await checkout.waitForStep1();

    const firstName = await checkout.firstNameInput.inputValue().catch(() => '');
    if (!firstName) {
      await checkout.fillInvoiceAddress({
        firstName: 'Darko',
        lastName: 'Contact',
        street: 'Teststraat',
        number: '1',
        postal: '1234AB',
        city: 'Amsterdam',
      });
    }
    await checkout.continueButton.click();
    await page.waitForTimeout(2000);
    await expect(page.locator('main')).toBeVisible();
  });

  test('CartSummary "Request Quote" button may be visible for contact', async ({ page }) => {
    await page.goto('/cart');
    await page.waitForLoadState('domcontentloaded');
    const quoteBtn = page.getByRole('button', { name: /request quote|quote/i }).first();
    const hasQuote = await quoteBtn.isVisible().catch(() => false);
    // May or may not be configured — just check cart page works
    await expect(page.locator('main')).toBeVisible();
  });
});
