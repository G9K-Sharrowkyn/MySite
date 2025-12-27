const { test, expect } = require('@playwright/test');

const waitForBackend = async (page) => {
  await expect.poll(async () => {
    const response = await page.request.get('http://localhost:5001/');
    return response.ok();
  }, { timeout: 15000 }).toBeTruthy();
};

test('user can log in and open the global chat', async ({ page }) => {
  const timestamp = Date.now();
  const username = `e2elogin${timestamp}`;
  const email = `e2elogin${timestamp}@example.com`;
  const password = 'TestPass123!';

  await waitForBackend(page);
  const registration = await page.request.post('http://localhost:5001/api/auth/register', {
    data: { username, email, password }
  });
  expect(registration.ok()).toBeTruthy();

  await page.goto('/login');

  await page.getByPlaceholder('Email address').fill(email);
  await page.getByPlaceholder('Password').fill(password);
  await page.locator('input[type="submit"]').click();

  await expect(page).toHaveURL(/\/feed/, { timeout: 20000 });
  await expect(page.locator('.feed-container')).toBeVisible();

  const chatHeader = page.locator('.global-chat-container .chat-header');
  await expect(chatHeader).toBeVisible();
  await expect(page.locator('.connection-status.connected')).toBeVisible({ timeout: 15000 });

  await chatHeader.click();

  const chatInput = page.locator('.chat-input');
  await expect(chatInput).toBeVisible();
  await expect(chatInput).toBeEnabled();
});
