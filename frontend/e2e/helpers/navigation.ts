import { Page } from '@playwright/test';

/**
 * Discover a category URL that is guaranteed to have products.
 * Strategy: find a product via search → navigate to product page → get leaf category from breadcrumbs.
 */
export async function discoverCategoryUrl(page: Page): Promise<string> {
  // Get a product URL via search (most reliable — always returns real products)
  const productUrl = await discoverProductUrl(page, '');

  // Navigate to product page and find the LAST category in breadcrumbs (leaf category)
  await page.goto(productUrl);
  await page.waitForLoadState('domcontentloaded');

  // Wait for breadcrumbs to render
  const breadcrumbNav = page.locator('nav[aria-label="Breadcrumb"]');
  const hasBreadcrumbs = await breadcrumbNav.waitFor({ state: 'visible', timeout: 15_000 }).then(() => true).catch(() => false);

  if (hasBreadcrumbs) {
    const categoryLinks = breadcrumbNav.locator('a[href*="/category/"]');
    const count = await categoryLinks.count();
    if (count > 0) {
      // Use the last (leaf) category link — most likely to have products
      const href = await categoryLinks.nth(count - 1).getAttribute('href');
      if (href) return href;
    }
  }

  // Fallback: use header menu
  return discoverCategoryUrlFromMenu(page);
}

/**
 * Fallback: discover category URL from header menu dropdown.
 */
async function discoverCategoryUrlFromMenu(page: Page): Promise<string> {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  const menuBtn = page.getByRole('button', { name: /browse categories/i }).first();
  await menuBtn.waitFor({ state: 'visible', timeout: 15_000 });
  await menuBtn.click();

  const l1Links = page.locator('a[href*="/category/"]');
  await l1Links.first().waitFor({ state: 'visible', timeout: 15_000 });

  // Hover over first L1 to show L2 subcategories
  await l1Links.first().hover();
  await page.waitForTimeout(500);

  const allLinks = page.locator('a[href*="/category/"]');
  const count = await allLinks.count();
  const idx = count > 1 ? 1 : 0;
  const href = await allLinks.nth(idx).getAttribute('href');
  if (!href) throw new Error('Could not find a category link in menu dropdown');

  await page.keyboard.press('Escape');
  await page.mouse.click(10, 10);
  return href;
}

/**
 * Discover a product URL. If categoryUrl is empty, uses search page directly.
 */
export async function discoverProductUrl(page: Page, categoryUrl: string): Promise<string> {
  // If a category URL is provided, try it first
  if (categoryUrl) {
    await page.goto(categoryUrl);
    await page.waitForLoadState('domcontentloaded');

    const anyProductLink = page.locator('main a[href*="/product/"], main a[href*="/cluster/"]').first();
    const hasProducts = await anyProductLink.waitFor({ state: 'visible', timeout: 12_000 }).then(() => true).catch(() => false);

    if (hasProducts) {
      const productLinks = page.locator('main a[href*="/product/"]');
      const productCount = await productLinks.count();
      if (productCount > 0) {
        const href = await productLinks.first().getAttribute('href');
        if (href) return href;
      }
      const href = await anyProductLink.getAttribute('href');
      if (href) return href;
    }
  }

  // Use search page to find a product URL (most reliable)
  await page.goto('/search/kabel');
  await page.waitForLoadState('domcontentloaded');
  const searchProductLink = page.locator('main a[href*="/product/"]').first();
  await searchProductLink.waitFor({ state: 'visible', timeout: 25_000 });
  const href = await searchProductLink.getAttribute('href');
  if (!href) throw new Error('Could not find a product link on search page');
  return href;
}

/**
 * Discover a cluster URL from a category page. Falls back to search.
 */
export async function discoverClusterUrl(page: Page, categoryUrl: string): Promise<string> {
  if (categoryUrl) {
    await page.goto(categoryUrl);
    await page.waitForLoadState('domcontentloaded');

    const clusterLink = page.locator('main a[href*="/cluster/"]').first();
    const found = await clusterLink.waitFor({ state: 'visible', timeout: 12_000 }).then(() => true).catch(() => false);
    if (found) {
      const href = await clusterLink.getAttribute('href');
      if (href) return href;
    }
  }

  // Fallback: search for clusters
  await page.goto('/search/kabel');
  await page.waitForLoadState('domcontentloaded');
  const searchClusterLink = page.locator('main a[href*="/cluster/"]').first();
  const foundInSearch = await searchClusterLink.waitFor({ state: 'visible', timeout: 20_000 }).then(() => true).catch(() => false);
  if (foundInSearch) {
    const href = await searchClusterLink.getAttribute('href');
    if (href) return href;
  }
  throw new Error('Could not find a cluster link');
}
