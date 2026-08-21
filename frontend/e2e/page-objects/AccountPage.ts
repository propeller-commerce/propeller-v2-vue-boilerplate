import { Page, Locator } from '@playwright/test';

export class AccountPage {
  readonly page: Page;
  readonly pageHeading: Locator;
  // AccountIconAndMenu sidebar renders nav items as <button> elements
  readonly ordersLink: Locator;
  readonly addressesLink: Locator;
  readonly favoritesLink: Locator;
  readonly quotesLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageHeading = page.locator('h1').first();
    this.ordersLink = page.getByRole('button', { name: /^orders$/i }).first();
    this.addressesLink = page.getByRole('button', { name: /^addresses?$/i }).first();
    this.favoritesLink = page.getByRole('button', { name: /^favorites?$|^favourites?$/i }).first();
    this.quotesLink = page.getByRole('button', { name: /^quotes?$/i }).first();
  }

  async goto() {
    await this.page.goto('/account');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async gotoOrders() {
    await this.page.goto('/account/orders');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async gotoAddresses() {
    await this.page.goto('/account/addresses');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async gotoFavorites() {
    await this.page.goto('/account/favorites');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async gotoQuotes() {
    await this.page.goto('/account/quotes');
    await this.page.waitForLoadState('domcontentloaded');
  }
}
