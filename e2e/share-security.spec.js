const { test, expect, request: apiRequest } = require('@playwright/test');
const {
  BACKEND_BASE_URL,
  loginViaApi,
  registerUserViaApi,
  waitForBackend
} = require('./helpers');

test('share renderer is bounded and snapshots require staff authorization', async ({
  page,
  request
}) => {
  await waitForBackend(page);
  const timestamp = Date.now();
  const user = {
    username: `e2eshare${timestamp}`,
    email: `e2eshare${timestamp}@example.com`,
    password: 'SharePass123!'
  };
  const registration = await registerUserViaApi(request, user);
  expect(registration.ok()).toBeTruthy();

  const login = await loginViaApi(request, user.email, user.password);
  expect(login.response.ok()).toBeTruthy();
  const userToken = login.data.token;
  const createPost = await request.post(`${BACKEND_BASE_URL}/api/posts`, {
    headers: { 'x-auth-token': userToken },
    data: {
      title: `Share renderer ${timestamp}`,
      content: 'Security test for the generated social image.',
      type: 'discussion',
      photos: []
    }
  });
  expect(createPost.status()).toBe(201);
  const post = await createPost.json();

  const missing = await request.get(
    `${BACKEND_BASE_URL}/share/post/not-a-real-post/image.jpg`
  );
  expect(missing.status()).toBe(404);

  const image = await request.get(
    `${BACKEND_BASE_URL}/share/post/${post.id}/image.jpg`
  );
  expect(image.status()).toBe(200);
  expect(image.headers()['content-type']).toContain('image/jpeg');

  const anonymousContext = await apiRequest.newContext();
  try {
    const anonymousSnapshot = await anonymousContext.get(
      `${BACKEND_BASE_URL}/share/post/${post.id}/snapshot.jpg`
    );
    expect(anonymousSnapshot.status()).toBe(401);
  } finally {
    await anonymousContext.dispose();
  }

  const userSnapshot = await request.get(
    `${BACKEND_BASE_URL}/share/post/${post.id}/snapshot.jpg`,
    { headers: { 'x-auth-token': userToken } }
  );
  expect(userSnapshot.status()).toBe(403);

  const moderatorLogin = await loginViaApi(
    request,
    'moderator@site.local',
    'E2e-Staff-Only-2026!'
  );
  expect(moderatorLogin.response.status()).toBe(202);
  const twoFactor = await request.post(`${BACKEND_BASE_URL}/api/auth/verify-2fa`, {
    data: {
      challengeToken: moderatorLogin.data.challengeToken,
      code: moderatorLogin.data.testTwoFactorCode
    }
  });
  expect(twoFactor.ok()).toBeTruthy();
  const moderatorData = await twoFactor.json();

  const unsafeCharacterImport = await request.post(
    `${BACKEND_BASE_URL}/api/characters`,
    {
      headers: { 'x-auth-token': moderatorData.token },
      data: {
        name: `Unsafe import ${timestamp}`,
        universe: 'Security test',
        image: 'https://127.0.0.1/private.png'
      }
    }
  );
  expect(unsafeCharacterImport.status()).toBe(400);

  const staffSnapshot = await request.get(
    `${BACKEND_BASE_URL}/share/post/${post.id}/snapshot.jpg`,
    { headers: { 'x-auth-token': moderatorData.token } }
  );
  expect(staffSnapshot.status()).toBe(200);
  expect(staffSnapshot.headers()['content-type']).toContain('image/jpeg');
});
