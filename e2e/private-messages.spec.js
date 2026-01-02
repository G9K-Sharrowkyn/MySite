const { test, expect } = require('@playwright/test');
const { waitForBackend, registerUserViaApi, loginViaUi } = require('./helpers');

test('user can send and receive a private message', async ({ browser, request }) => {
  const timestamp = Date.now();
  const userA = {
    username: `e2emsgA${timestamp}`,
    email: `e2emsgA${timestamp}@example.com`,
    password: 'MsgPass123!'
  };
  const userB = {
    username: `e2emsgB${timestamp}`,
    email: `e2emsgB${timestamp}@example.com`,
    password: 'MsgPass123!'
  };

  const bootPage = await browser.newPage();
  await waitForBackend(bootPage);
  await bootPage.close();
  const regA = await registerUserViaApi(request, userA);
  const regB = await registerUserViaApi(request, userB);
  expect(regA.ok()).toBeTruthy();
  expect(regB.ok()).toBeTruthy();
  const dataA = await regA.json();
  const dataB = await regB.json();

  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();
  await loginViaUi(pageA, userA.email, userA.password);
  await pageA.goto(`/messages/${dataB.userId}`);
  const messageText = `Hello from ${userA.username}`;
  await pageA.locator('.message-input').fill(messageText);
  await pageA.locator('.send-btn').click();
  await expect(pageA.locator('.message-bubble.sent')).toContainText(messageText);

  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await loginViaUi(pageB, userB.email, userB.password);
  await pageB.goto(`/messages/${dataA.userId}`);
  await expect(pageB.locator('.message-bubble.received')).toContainText(messageText);

  await contextA.close();
  await contextB.close();
});
