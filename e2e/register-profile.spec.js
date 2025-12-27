const { test, expect } = require('@playwright/test');

const waitForBackend = async (page) => {
  await expect.poll(async () => {
    const response = await page.request.get('http://localhost:5001/');
    return response.ok();
  }, { timeout: 15000 }).toBeTruthy();
};

test('user can register and reach their profile', async ({ page }) => {
  const timestamp = Date.now();
  const username = `e2euser${timestamp}`;
  const email = `e2e${timestamp}@example.com`;
  const password = 'TestPass123!';

  await page.goto('/register');

  await page.getByPlaceholder('Username').fill(username);
  await page.getByPlaceholder('Email address').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('input[name="password2"]').fill(password);

  await waitForBackend(page);
  await page.locator('input[type="submit"]').click();

  await expect(page).toHaveURL(/\/profile\//, { timeout: 20000 });
  await expect(page.locator('.profile-page')).toBeVisible();
  await expect(page.locator('.username-display')).toContainText(username);
});
