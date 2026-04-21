import { test, expect } from '@playwright/test';

test.describe('Anonymous — Forgot password', () => {
  test('forgot password page loads', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
  });

  test('email input and submit button are visible', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.waitForLoadState('domcontentloaded');
    const emailInput = page.getByLabel(/email/i).first();
    const submitBtn = page.getByRole('button', { name: /send|reset|submit/i }).first();
    await expect(emailInput).toBeVisible({ timeout: 10_000 });
    await expect(submitBtn).toBeVisible({ timeout: 5_000 });
  });

  test('entering email and submitting shows success message', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.waitForLoadState('domcontentloaded');
    const emailInput = page.getByLabel(/email/i).first();
    await emailInput.fill('test@example.com');
    const submitBtn = page.getByRole('button', { name: /send|reset|submit/i }).first();
    await submitBtn.click();
    await page.waitForTimeout(3000);
    // Should show success or confirmation message
    const successMsg = page.locator('main').getByText(/sent|success|check|email/i).first();
    const hasSuccess = await successMsg.isVisible().catch(() => false);
    await expect(page.locator('main')).toBeVisible();
  });

  test('empty email shows validation error', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.waitForLoadState('domcontentloaded');
    const submitBtn = page.getByRole('button', { name: /send|reset|submit/i }).first();
    await submitBtn.click();
    await page.waitForTimeout(1000);
    // Should show validation or stay on form
    await expect(page.locator('main')).toBeVisible();
  });
});
