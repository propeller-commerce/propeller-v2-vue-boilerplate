import { test, expect } from '@playwright/test';
import { HomePage } from '../../page-objects/HomePage';

test.describe('Anonymous — Home page', () => {
  test('home page loads with hero section', async ({ page }) => {
    const home = new HomePage(page);
    await home.goto();
    await home.waitForHeroSection();
    await expect(home.heroHeading).toBeVisible();
  });

  test('"Browse Products" link navigates to /search', async ({ page }) => {
    const home = new HomePage(page);
    await home.goto();
    await home.waitForHeroSection();
    await expect(home.browseProductsLink).toBeVisible();
    await home.browseProductsLink.click();
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/search/);
  });

  test('Browse Categories button is visible in header', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const btn = page.getByRole('button', { name: /browse categories/i }).first();
    await expect(btn).toBeVisible({ timeout: 10_000 });
  });

  test('Browse Categories click shows menu dropdown with category links', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const btn = page.getByRole('button', { name: /browse categories/i }).first();
    await btn.click();
    // Category links should appear in dropdown
    const categoryLink = page.locator('a[href*="/category/"]').first();
    await expect(categoryLink).toBeVisible({ timeout: 10_000 });
  });

  test('category link in menu navigates to /category/', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const btn = page.getByRole('button', { name: /browse categories/i }).first();
    await btn.click();
    const firstLink = page.locator('a[href*="/category/"]').first();
    await firstLink.waitFor({ state: 'visible', timeout: 10_000 });
    const href = await firstLink.getAttribute('href');
    expect(href).toMatch(/\/category\//);
    await firstLink.click();
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/category\//);
  });

  test('search bar renders in header', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const searchInput = page.locator('header input[type="text"], header input[placeholder*="search" i]').first();
    await expect(searchInput).toBeVisible({ timeout: 10_000 });
  });

  test('searching navigates to /search/', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const searchInput = page.locator('header input[type="text"], header input[placeholder*="search" i]').first();
    await searchInput.fill('cable');
    await searchInput.press('Enter');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/search/);
  });

  test('header account icon is visible when not logged in', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const header = page.locator('header');
    await expect(header).toBeVisible();
    // Account icon button in header
    const accountBtn = header.locator('button[aria-label*="account" i], button[aria-label*="Account"], a[href*="account"]').first();
    await expect(accountBtn).toBeVisible({ timeout: 8_000 });
  });

  test('cart icon is visible in header', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const header = page.locator('header');
    // Cart icon or cart link in header
    const cartIcon = header.locator('[aria-label*="cart" i], a[href*="cart"], button[aria-label*="cart" i]').first();
    await expect(cartIcon).toBeVisible({ timeout: 8_000 });
  });
});
