const { test, expect } = require('@playwright/test');
const { loginViaUi } = require('./helpers');

test('moderator can access moderator panel', async ({ page }) => {
  await loginViaUi(page, 'moderator@site.local', 'Admin123!');
  await page.goto('/moderator');
  await expect(page.locator('.moderator-panel')).toBeVisible({ timeout: 15000 });
});

test('admin can access admin panels', async ({ page }) => {
  await loginViaUi(page, 'admin@site.local', 'Admin123!');
  await page.goto('/admin');
  await expect(page.locator('.admin-panel')).toBeVisible({ timeout: 15000 });

  await page.goto('/admin/divisions');
  await expect(page.locator('.admin-divisions-page')).toBeVisible({ timeout: 15000 });
});
