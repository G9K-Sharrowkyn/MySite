const { test, expect } = require('@playwright/test');
const {
  waitForBackend,
  registerUserViaApi,
  loginViaUi,
  getResetTokenForEmail
} = require('./helpers');

const waitForResetToken = async (email, timeoutMs = 10000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const token = await getResetTokenForEmail(email);
    if (token) {
      return token;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return null;
};

test('user can request password reset and set a new password', async ({ page }) => {
  const timestamp = Date.now();
  const username = `e2ereset${timestamp}`;
  const email = `e2ereset${timestamp}@example.com`;
  const password = 'OldPass123!';
  const newPassword = 'ResetPass123!';

  await waitForBackend(page);
  const registration = await registerUserViaApi(page.request, { username, email, password });
  expect(registration.ok()).toBeTruthy();

  await page.goto('/forgot-password');
  await page.getByPlaceholder('your.email@example.com').fill(email);
  await page.getByRole('button', { name: 'Send Reset Link' }).click();

  const token = await waitForResetToken(email);
  expect(token).toBeTruthy();

  await page.goto(`/reset-password?token=${token}`);
  await page.locator('input[name="password"]').fill(newPassword);
  await page.locator('input[name="confirmPassword"]').fill(newPassword);
  await page.getByRole('button', { name: 'Reset Password' }).click();

  await expect(page.locator('.toast-message')).toContainText('Password reset successful');
  await page.waitForURL(/\/login/, { timeout: 5000 });

  await loginViaUi(page, email, newPassword);
  await expect(page).toHaveURL(/\/feed/, { timeout: 20000 });
});
