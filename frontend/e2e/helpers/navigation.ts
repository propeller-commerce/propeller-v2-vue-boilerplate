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
 * Discover a product URL by navigating to a search page, clicking the first
 * product card, and reading the resulting URL.
 *
 * `ProductCard` no longer wraps the card in an `<a href>` — it uses
 * programmatic navigation via an `onProductClick` callback (see propeller-vue
 * memory: card moved from router-link to click-driven routing). So we cannot
 * read the URL from an attribute; we have to drive the click and observe.
 */
export async function discoverProductUrl(page: Page, categoryUrl: string): Promise<string> {
  const tryClickCard = async (): Promise<string | null> => {
    // The card root + the clickable name area inside it.
    const card = page.locator('main .propeller-product-card').first()
    const visible = await card.waitFor({ state: 'visible', timeout: 25_000 }).then(() => true).catch(() => false)
    if (!visible) return null
    // The product name span carries the click handler. Falling back to the
    // card itself works because the click bubbles to the same handler.
    const clickable = card.locator('[class*="cursor-pointer"]').first()
    const target = (await clickable.count()) > 0 ? clickable : card
    await target.click()
    await page.waitForURL(/\/(product|cluster)\//, { timeout: 15_000 }).catch(() => undefined)
    const url = page.url()
    return /\/(product|cluster)\//.test(url) ? new URL(url).pathname + (new URL(url).search || '') : null
  }

  if (categoryUrl) {
    await page.goto(categoryUrl)
    await page.waitForLoadState('domcontentloaded')
    const href = await tryClickCard()
    if (href) return href
  }

  await page.goto('/search/kabel')
  await page.waitForLoadState('domcontentloaded')
  const href = await tryClickCard()
  if (!href) throw new Error('Could not navigate to a product page from search results')
  return href
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
