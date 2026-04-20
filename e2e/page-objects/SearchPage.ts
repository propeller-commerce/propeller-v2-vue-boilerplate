import { Page, Locator } from '@playwright/test';

export class SearchPage {
  readonly page: Page;
  readonly mainContent: Locator;
  readonly productLinks: Locator;

  constructor(page: Page) {
    this.page = page;
    this.mainContent = page.locator('main');
    this.productLinks = page.locator('main a[href*="/product/"], main a[href*="/cluster/"]');
  }

  async goto(term?: string) {
    const url = term ? `/search/${encodeURIComponent(term)}` : '/search';
    await this.page.goto(url);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async waitForResults() {
    await this.productLinks.first().waitFor({ state: 'visible', timeout: 20_000 });
  }
}
