const { test, expect } = require('@playwright/test');
const { waitForBackend, registerUserViaApi, loginViaApi, loginViaUi } = require('./helpers');

test('user sees a notification for a reply to their comment', async ({ page, request }) => {
  const timestamp = Date.now();
  const author = {
    username: `e2enotifyA${timestamp}`,
    email: `e2enotifyA${timestamp}@example.com`,
    password: 'NotifyPass123!'
  };
  const replier = {
    username: `e2enotifyB${timestamp}`,
    email: `e2enotifyB${timestamp}@example.com`,
    password: 'NotifyPass123!'
  };

  await waitForBackend(page);
  const regAuthor = await registerUserViaApi(request, author);
  const regReplier = await registerUserViaApi(request, replier);
  expect(regAuthor.ok()).toBeTruthy();
  expect(regReplier.ok()).toBeTruthy();

  const authorLogin = await loginViaApi(request, author.email, author.password);
  const replierLogin = await loginViaApi(request, replier.email, replier.password);
  expect(authorLogin.response.ok()).toBeTruthy();
  expect(replierLogin.response.ok()).toBeTruthy();

  const authorToken = authorLogin.data.token;
  const replierToken = replierLogin.data.token;

  const createPost = await request.post('http://localhost:5000/api/posts', {
    data: {
      title: `Notify post ${timestamp}`,
      content: 'Post used to trigger notifications',
      type: 'discussion',
      photos: [],
      pollOptions: [],
      voteDuration: '3d',
      category: 'discussion'
    },
    headers: { 'x-auth-token': authorToken }
  });
  expect(createPost.ok()).toBeTruthy();
  const postData = await createPost.json();

  const parentComment = await request.post(
    `http://localhost:5000/api/comments/post/${postData.id || postData._id}`,
    {
      data: { text: 'Parent comment for notification.' },
      headers: { 'x-auth-token': authorToken }
    }
  );
  expect(parentComment.ok()).toBeTruthy();
  const parentData = await parentComment.json();

  const reply = await request.post(
    `http://localhost:5000/api/comments/post/${postData.id || postData._id}`,
    {
      data: { text: 'Reply comment', parentId: parentData.id },
      headers: { 'x-auth-token': replierToken }
    }
  );
  expect(reply.ok()).toBeTruthy();

  await loginViaUi(page, author.email, author.password);
  await page.goto('/notifications');
  await expect(page.locator('.notifications-page')).toBeVisible();

  const notificationItem = page.locator('.notification-item').first();
  await expect(notificationItem).toContainText('New reply');
});

