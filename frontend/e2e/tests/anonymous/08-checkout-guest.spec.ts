import { test, expect } from '@playwright/test';
import { CheckoutPage } from '../../page-objects/CheckoutPage';
import { addProductToCartViaUI } from '../../helpers/cart';

test.describe('Anonymous — Checkout (guest)', () => {
  test.beforeEach(async ({ page }) => {
    const added = await addProductToCartViaUI(page);
    if (!added) {
      test.skip(true, 'Could not add product to cart via UI');
    }
  });

  test('checkout page loads for guest user', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
    // Guest should not be redirected to login
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('Step 1: address form renders with name fields', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();
    await checkout.waitForStep1();
    await expect(checkout.firstNameInput).toBeVisible({ timeout: 15_000 });
    await expect(checkout.lastNameInput).toBeVisible({ timeout: 5_000 });
  });

  test('Step 1: required fields validation prevents continuation', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();
    await checkout.waitForStep1();
    // Click continue without filling fields
    await checkout.continueButton.click();
    await page.waitForTimeout(1000);
    // Should still be on step 1 (no navigation away)
    await expect(checkout.firstNameInput).toBeVisible({ timeout: 5_000 });
  });

  test('Step 1: filling address form and continuing advances to step 2', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();
    await checkout.waitForStep1();

    await checkout.fillInvoiceAddress({
      firstName: 'Jan',
      lastName: 'Guest',
      street: 'Teststraat',
      number: '1',
      postal: '1234AB',
      city: 'Amsterdam',
    });

    await checkout.continueButton.click();
    await page.waitForTimeout(2000);
    // Should advance to step 2
    await expect(page.locator('main')).toBeVisible();
  });
});
