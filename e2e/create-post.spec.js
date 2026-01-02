const { test, expect } = require('@playwright/test');
const { waitForBackend, registerUserViaApi, loginViaUi } = require('./helpers');

test('user can create a discussion post', async ({ page }) => {
  const timestamp = Date.now();
  const username = `e2epost${timestamp}`;
  const email = `e2epost${timestamp}@example.com`;
  const password = 'PostPass123!';
  const title = `E2E discussion ${timestamp}`;
  const content = 'This is an automated discussion post created by Playwright.';

  await waitForBackend(page);
  const registration = await registerUserViaApi(page.request, { username, email, password });
  expect(registration.ok()).toBeTruthy();

  await loginViaUi(page, email, password);
  await expect(page).toHaveURL(/\/feed/, { timeout: 20000 });

  await page.locator('.create-post-prompt').click();
  await page.locator('input.title-input').fill(title);
  await page.locator('textarea.content-input').fill(content);
  await page.locator('button.submit-btn').click();

  const postTitle = page.locator('.post-title', { hasText: title });
  await expect(postTitle).toBeVisible({ timeout: 20000 });
});
