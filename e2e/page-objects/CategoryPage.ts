import { Page, Locator } from '@playwright/test';

export class CategoryPage {
  readonly page: Page;
  readonly mainContent: Locator;
  readonly productCards: Locator;
  readonly filterSidebar: Locator;

  constructor(page: Page) {
    this.page = page;
    this.mainContent = page.locator('main');
    // ProductCard renders as divs containing links
    this.productCards = page.locator('main a[href*="/product/"], main a[href*="/cluster/"]');
    this.filterSidebar = page.locator('[class*="filter"], aside').first();
  }

  async goto(url: string) {
    await this.page.goto(url);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async waitForProducts() {
    await this.productCards.first().waitFor({ state: 'visible', timeout: 20_000 });
  }
}
