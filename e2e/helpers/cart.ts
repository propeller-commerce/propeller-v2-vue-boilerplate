import { Page } from '@playwright/test';
import { discoverCategoryUrl, discoverProductUrl } from './navigation';

/**
 * Add a product to the cart via UI interaction.
 * Navigates to the first available product page and clicks Add to Cart.
 * Returns true if successful.
 */
export async function addProductToCartViaUI(page: Page): Promise<boolean> {
  const categoryUrl = await discoverCategoryUrl(page);
  const productUrl = await discoverProductUrl(page, categoryUrl);

  await page.goto(productUrl);
  await page.waitForLoadState('domcontentloaded');

  // Find Add to Cart button
  const addBtn = page.getByRole('button', { name: /add to cart/i }).first();
  const btnVisible = await addBtn.isVisible().catch(() => false);
  if (!btnVisible) {
    // Product may be a cluster requiring attribute selection — skip
    return false;
  }

  await addBtn.click();
  await page.waitForTimeout(1500);
  return true;
}

/**
 * Set the cart_id in localStorage so the app can fetch the cart on load.
 * NOTE: You must navigate to the site first (page.goto('/')) before calling this.
 * This only sets the ID — the CartIconAndSidebar will fetch the full cart from the API.
 */
export async function setCartId(page: Page, cartId: string): Promise<void> {
  await page.evaluate((id) => {
    localStorage.setItem('cart_id', id);
  }, cartId);
}

/**
 * Get the current cart_id from localStorage.
 */
export async function getCartId(page: Page): Promise<string | null> {
  return page.evaluate(() => localStorage.getItem('cart_id'));
}
