const { test, expect } = require('@playwright/test');
const { waitForBackend, registerUserViaApi, loginViaApi, loginViaUi } = require('./helpers');

test('user can vote on a fight', async ({ page, request }) => {
  const timestamp = Date.now();
  const user = {
    username: `e2efight${timestamp}`,
    email: `e2efight${timestamp}@example.com`,
    password: 'FightPass123!'
  };

  await waitForBackend(page);
  const registration = await registerUserViaApi(request, user);
  expect(registration.ok()).toBeTruthy();

  const login = await loginViaApi(request, user.email, user.password);
  expect(login.response.ok()).toBeTruthy();
  const token = login.data.token;

  const createFight = await request.post('http://localhost:5001/api/fights', {
    data: {
      title: `E2E Fight ${timestamp}`,
      description: 'Automated fight for voting test',
      fighter1: 'Fighter One',
      fighter2: 'Fighter Two',
      fighter1Image: '/placeholder-character.png',
      fighter2Image: '/placeholder-character.png',
      category: 'Test',
      type: 'feed'
    },
    headers: { 'x-auth-token': token }
  });
  expect(createFight.ok()).toBeTruthy();
  const fightData = await createFight.json();

  await loginViaUi(page, user.email, user.password);
  await page.goto(`/fight/${fightData.fight.id}`);

  const fighterOneVote = page.locator('.fighter1 .vote-btn');
  await fighterOneVote.click();
  await expect(fighterOneVote).toHaveClass(/voted/);

  const voteResponse = await request.get(
    `http://localhost:5001/api/votes/fight/${fightData.fight.id}/user`,
    { headers: { 'x-auth-token': token } }
  );
  expect(voteResponse.ok()).toBeTruthy();
  const voteData = await voteResponse.json();
  expect(voteData.choice).toBe('fighter1');
});
