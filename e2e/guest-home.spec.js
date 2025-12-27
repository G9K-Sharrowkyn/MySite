const { test, expect } = require('@playwright/test');

test('guest sees the landing page call to action', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('.hero-section')).toBeVisible();
  await expect(page.locator('a[href="/register"]').first()).toBeVisible();
  await expect(page.locator('a[href="/login"]').first()).toBeVisible();
});
