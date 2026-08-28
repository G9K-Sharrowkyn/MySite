const { test, expect } = require('@playwright/test');
const { waitForBackend, registerUserViaApi, loginViaUi } = require('./helpers');

const selectThumbsUp = async (page) => {
  await page
    .locator('.reaction-menu .reaction-category')
    .filter({ has: page.locator('.category-label', { hasText: /^Like$/ }) })
    .locator('.category-btn')
    .click();
  await page.locator('.reaction-menu .reaction-option', { hasText: 'Thumbs Up' }).click();
};

test('post reactions survive reload, can be removed, and rapid comment submit stores once', async ({
  page
}) => {
  const timestamp = Date.now();
  const username = `e2einteractions${timestamp}`;
  const email = `e2einteractions${timestamp}@example.com`;
  const password = 'InteractionPass123!';
  const title = `E2E interactions ${timestamp}`;
  const comment = `Only one comment ${timestamp}`;

  await waitForBackend(page);
  const registration = await registerUserViaApi(page.request, {
    username,
    email,
    password
  });
  expect(registration.ok()).toBeTruthy();

  await loginViaUi(page, email, password);
  await expect(page).toHaveURL(/\/feed/, { timeout: 20000 });

  await page.locator('.create-post-prompt').click();
  await page.locator('input.title-input').fill(title);
  await page
    .locator('textarea.content-input')
    .fill('Post used to verify idempotent interactions.');
  await page.locator('button.submit-btn').click();

  const getPostCard = () =>
    page.locator('.post-card').filter({
      has: page.locator('.post-title', { hasText: title })
    });
  await expect(getPostCard()).toBeVisible({ timeout: 20000 });

  const addReaction = page.waitForResponse(
    (response) =>
      response.url().includes('/api/posts/') &&
      response.url().endsWith('/reaction') &&
      response.request().method() === 'POST'
  );
  await getPostCard().locator('.react-btn').click();
  await selectThumbsUp(page);
  expect((await addReaction).ok()).toBeTruthy();
  await expect(getPostCard().locator('.react-btn')).toHaveClass(/reacted/);

  await page.reload();
  await expect(getPostCard()).toBeVisible({ timeout: 20000 });
  await expect(getPostCard().locator('.react-btn')).toHaveClass(/reacted/);

  const removeReaction = page.waitForResponse(
    (response) =>
      response.url().includes('/api/posts/') &&
      response.url().includes('/react/like1') &&
      response.request().method() === 'DELETE'
  );
  await getPostCard().locator('.react-btn').click();
  await selectThumbsUp(page);
  expect((await removeReaction).ok()).toBeTruthy();
  await expect(getPostCard().locator('.react-btn')).not.toHaveClass(/reacted/);

  await getPostCard().locator('.comment-btn').click();
  await getPostCard().locator('.comment-input').fill(comment);
  const createComment = page.waitForResponse(
    (response) =>
      response.url().includes('/api/comments/post/') &&
      response.request().method() === 'POST'
  );
  await getPostCard().locator('.comment-submit').evaluate((button) => {
    button.click();
    button.click();
  });
  expect((await createComment).ok()).toBeTruthy();
  await expect(getPostCard().locator('.comment-text', { hasText: comment })).toHaveCount(1);
});
