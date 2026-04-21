import { Page, Locator } from '@playwright/test';

export class HomePage {
  readonly page: Page;
  readonly mainContent: Locator;
  readonly heroHeading: Locator;
  readonly browseProductsLink: Locator;
  readonly categoriesMenuButton: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.mainContent = page.locator('main, #app > div, .bg-background').first();
    this.heroHeading = page.getByRole('heading', { name: /welcome to propeller/i });
    this.browseProductsLink = page.getByRole('link', { name: /browse products/i });
    // Header "Browse Categories" button
    this.categoriesMenuButton = page.getByRole('button', { name: /browse categories/i }).first();
    this.searchInput = page.locator('input[type="text"], input[placeholder*="search" i]').first();
  }

  async goto() {
    await this.page.goto('/');
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Wait for the hero section to be visible (Vue home page structure).
   * HomeView renders a hero section with heading + "Browse Products" link.
   */
  async waitForHeroSection() {
    await this.heroHeading.waitFor({ state: 'visible', timeout: 15_000 });
  }

  /**
   * Open header menu and get category links from dropdown.
   */
  async openMenuAndGetCategoryLinks(): Promise<Locator> {
    await this.categoriesMenuButton.waitFor({ state: 'visible', timeout: 10_000 });
    await this.categoriesMenuButton.click();
    // Wait for dropdown to appear
    await this.page.locator('a[href*="/category/"]').first().waitFor({ state: 'visible', timeout: 10_000 });
    return this.page.locator('a[href*="/category/"]');
  }
}
