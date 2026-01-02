const path = require('path');
const { test, expect } = require('@playwright/test');
const { waitForBackend, registerUserViaApi, loginViaUi } = require('./helpers');

test('user can update profile description and avatar', async ({ page }) => {
  const timestamp = Date.now();
  const username = `e2eprofile${timestamp}`;
  const email = `e2eprofile${timestamp}@example.com`;
  const password = 'ProfilePass123!';
  const description = 'Updated profile description from e2e tests.';

  await waitForBackend(page);
  const registration = await registerUserViaApi(page.request, { username, email, password });
  expect(registration.ok()).toBeTruthy();

  await loginViaUi(page, email, password);
  await expect(page).toHaveURL(/\/feed/, { timeout: 20000 });

  await page.goto('/profile/me');
  await expect(page).toHaveURL(new RegExp(`/profile/${username}`), { timeout: 10000 });
  await page.locator('.edit-profile-btn').click();
  await expect(page.locator('.edit-profile-form')).toBeVisible();

  await page.locator('.edit-profile-form textarea').fill(description);

  const imagePath = path.resolve(__dirname, '..', 'public', 'placeholder-character.png');
  const imageInput = page.locator('.edit-profile-form .image-upload input[type="file"]');
  await imageInput.setInputFiles(imagePath);
  await expect(page.locator('.edit-profile-form .image-preview img')).toBeVisible();

  const [updateResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/api/profile/me') &&
      response.request().method() === 'PUT'
    ),
    page.locator('.edit-profile-form button.btn-primary').click()
  ]);
  expect(updateResponse.ok()).toBeTruthy();
  const updateData = await updateResponse.json();
  expect(updateData.user?.description).toBe(description);
  expect(updateData.user?.profilePicture).toMatch(/^data:image/);

  await expect(page).toHaveURL(new RegExp(`/profile/${username}`), { timeout: 10000 });
  await expect(page.locator('.edit-profile-form')).toBeHidden({ timeout: 10000 });
  const token = await page.evaluate(() => localStorage.getItem('token'));
  expect(token).toBeTruthy();

  const profileResponse = await page.request.get('/api/profile/me', {
    headers: { 'x-auth-token': token }
  });
  expect(profileResponse.ok()).toBeTruthy();

  const profileData = await profileResponse.json();
  expect(profileData.description).toBe(description);
  expect(profileData.profilePicture).toMatch(/^data:image/);
});
