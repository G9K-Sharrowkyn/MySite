const { test, expect } = require('@playwright/test');
const {
  waitForBackend,
  registerUserViaApi,
  loginViaUi,
  logoutViaUi
} = require('./helpers');

test('settings page requires authentication', async ({ page }) => {
  await page.goto('/settings');
  await expect(page).toHaveURL(/\/login/);
});

test('user can change password and log in with new credentials', async ({ page }) => {
  const timestamp = Date.now();
  const username = `e2esettings${timestamp}`;
  const email = `e2esettings${timestamp}@example.com`;
  const password = 'StartPass123!';
  const newPassword = 'NextPass123!';

  await waitForBackend(page);
  const registration = await registerUserViaApi(page.request, { username, email, password });
  expect(registration.ok()).toBeTruthy();

  await loginViaUi(page, email, password);
  await expect(page).toHaveURL(/\/feed/, { timeout: 20000 });

  await page.goto('/settings');
  await expect(page).toHaveURL(/\/settings/, { timeout: 10000 });
  await expect(page.locator('.account-settings')).toBeVisible({ timeout: 15000 });

  const loading = page.locator('.account-settings .loading');
  if (await loading.isVisible()) {
    await loading.waitFor({ state: 'hidden', timeout: 20000 });
  }

  await expect(page.locator('.settings-container')).toBeVisible({ timeout: 20000 });

  const passwordSection = page.locator('.settings-section').first();
  await passwordSection.locator('input[name="currentPassword"]').fill(password);
  await passwordSection.locator('input[name="newPassword"]').fill(newPassword);
  await passwordSection.locator('input[name="confirmPassword"]').fill(newPassword);
  await passwordSection.locator('button.btn-submit').click();

  await expect(page.locator('.toast-message')).toContainText('Password changed successfully');

  await logoutViaUi(page);
  await expect(page).toHaveURL(/\/login/);

  await loginViaUi(page, email, newPassword);
  await expect(page).toHaveURL(/\/feed/, { timeout: 20000 });
});
