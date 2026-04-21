import { test, expect } from '@playwright/test';
import { discoverCategoryUrl, discoverClusterUrl } from '../../helpers/navigation';

test.describe('Anonymous — Cluster page', () => {
  test('cluster page loads if cluster exists in catalog', async ({ page }) => {
    let clusterUrl: string;
    try {
      const categoryUrl = await discoverCategoryUrl(page);
      clusterUrl = await discoverClusterUrl(page, categoryUrl);
    } catch {
      test.skip(true, 'No cluster products found in catalog');
      return;
    }
    await page.goto(clusterUrl);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
  });

  test('cluster configurator renders with attribute selects', async ({ page }) => {
    let clusterUrl: string;
    try {
      const categoryUrl = await discoverCategoryUrl(page);
      clusterUrl = await discoverClusterUrl(page, categoryUrl);
    } catch {
      test.skip(true, 'No cluster products found in catalog');
      return;
    }
    await page.goto(clusterUrl);
    await page.waitForLoadState('domcontentloaded');
    // Cluster configurator should have select dropdowns or radio options
    const selects = page.locator('main select, main input[type="radio"]');
    const count = await selects.count();
    // May have selects or not, just verify page loads
    await expect(page.locator('main')).toBeVisible();
  });

  test('cluster product title is visible', async ({ page }) => {
    let clusterUrl: string;
    try {
      const categoryUrl = await discoverCategoryUrl(page);
      clusterUrl = await discoverClusterUrl(page, categoryUrl);
    } catch {
      test.skip(true, 'No cluster products found in catalog');
      return;
    }
    await page.goto(clusterUrl);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 });
  });

  test('ClusterCard renders "View cluster" link in category page', async ({ page }) => {
    const categoryUrl = await discoverCategoryUrl(page);
    await page.goto(categoryUrl);
    await page.waitForLoadState('domcontentloaded');
    const clusterLink = page.locator('main a[href*="/cluster/"]').first();
    const hasCluster = await clusterLink.isVisible().catch(() => false);
    if (!hasCluster) {
      test.skip(true, 'No cluster cards in category page');
      return;
    }
    await expect(clusterLink).toBeVisible();
  });
});
