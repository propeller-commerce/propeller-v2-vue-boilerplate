import { Page, Locator } from '@playwright/test';

export class ProductPage {
  readonly page: Page;
  readonly productTitle: Locator;
  readonly addToCartButton: Locator;
  readonly quantityInput: Locator;
  readonly toastMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.productTitle = page.locator('h1').first();
    this.addToCartButton = page.getByRole('button', { name: /add to cart/i }).first();
    this.quantityInput = page.locator('input[type="number"]').first();
    this.toastMessage = page.locator('[class*="toast"], [role="status"], [class*="notification"]').first();
  }

  async goto(url: string) {
    await this.page.goto(url);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async addToCart() {
    await this.addToCartButton.click();
  }
}
