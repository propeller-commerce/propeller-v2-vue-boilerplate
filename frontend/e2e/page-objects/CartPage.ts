import { Page, Locator } from '@playwright/test';

export class CartPage {
  readonly page: Page;
  readonly emptyCartMessage: Locator;
  readonly cartHeading: Locator;
  readonly proceedToCheckoutLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emptyCartMessage = page.locator('p').filter({ hasText: /your cart is empty/i }).first();
    this.cartHeading = page.locator('h1').filter({ hasText: /shopping cart/i }).first();
    this.proceedToCheckoutLink = page.getByRole('link', { name: /proceed to checkout/i }).first();
  }

  async goto() {
    await this.page.goto('/cart');
    await this.page.waitForLoadState('domcontentloaded');
  }

  getCartItems(): Locator {
    return this.page.locator('[class*="cart-item"], .space-y-4 > div').first();
  }
}
