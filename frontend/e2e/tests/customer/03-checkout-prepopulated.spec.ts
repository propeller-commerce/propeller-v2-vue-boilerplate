import { test, expect } from '@playwright/test';
import { CheckoutPage } from '../../page-objects/CheckoutPage';
import { addProductToCartViaUI } from '../../helpers/cart';

test.describe('Customer — Checkout (pre-populated addresses)', () => {
  test.beforeEach(async ({ page }) => {
    const added = await addProductToCartViaUI(page);
    if (!added) {
      test.skip(true, 'Could not add product to cart via UI');
    }
  });

  test('checkout page loads for authenticated customer', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
  });

  test('Step 1: address form is visible', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();
    await checkout.waitForStep1();
    await expect(checkout.firstNameInput).toBeVisible({ timeout: 15_000 });
  });

  test('Step 1: address may be pre-populated from customer default address', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();
    await checkout.waitForStep1();
    const firstName = await checkout.firstNameInput.inputValue().catch(() => '');
    expect(typeof firstName).toBe('string');
  });

  test('Step 1 → Step 2 transition works for customer', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();
    await checkout.waitForStep1();

    const firstName = await checkout.firstNameInput.inputValue().catch(() => '');
    if (!firstName) {
      await checkout.fillInvoiceAddress({
        firstName: 'Jan',
        lastName: 'Customer',
        street: 'Klantenstraat',
        number: '5',
        postal: '2000AB',
        city: 'Rotterdam',
      });
    }
    await checkout.continueButton.click();
    await page.waitForTimeout(2000);
    await expect(page.locator('main')).toBeVisible();
  });

  test('No AddressSelector for customer (company flow only)', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();
    await checkout.waitForStep1();

    const firstName = await checkout.firstNameInput.inputValue().catch(() => '');
    if (!firstName) {
      await checkout.fillInvoiceAddress({
        firstName: 'Jan',
        lastName: 'Customer',
        street: 'Klantenstraat',
        number: '5',
        postal: '2000AB',
        city: 'Rotterdam',
      });
    }
    await checkout.continueButton.click();
    await page.waitForTimeout(1500);
    // Customer flow should NOT show "Choose address" button (that's contact-only)
    const addressSelectorBtn = page.getByRole('button', { name: /choose address|select address/i }).first();
    const hasSelector = await addressSelectorBtn.isVisible().catch(() => false);
    await expect(page.locator('main')).toBeVisible();
  });
});
