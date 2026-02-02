const { test, expect } = require('@playwright/test');
const {
  waitForBackend,
  registerUserViaApi,
  loginViaUi,
  logoutViaUi
} = require('./helpers');

test('tournament creation and multi-user join flow', async ({ page, request }) => {
  await waitForBackend(page);

  const timestamp = Date.now();
  const password = 'TestPass123!';
  const users = Array.from({ length: 5 }, (_, index) => ({
    username: `e2etourney${timestamp}${index}`,
    email: `e2etourney${timestamp}${index}@example.com`,
    password
  }));

  for (const user of users) {
    const response = await registerUserViaApi(request, user);
    expect(response.ok()).toBeTruthy();
  }

  const tournamentTitle = `E2E Tournament ${timestamp}`;
  const tournamentDescription = 'E2E tournament multi-user join flow.';

  await loginViaUi(page, users[0].email, users[0].password);
  await page.goto('/tournaments');

  await page.locator('.tournaments-header .create-tournament-btn').click();
  const form = page.locator('.create-tournament-form');
  await expect(form).toBeVisible();
  await form.locator('input[name="title"]').fill(tournamentTitle);
  await form.locator('textarea[name="description"]').fill(tournamentDescription);
  await expect(form.locator('input[name="battleDate"]')).toHaveValue(/.+/);
  await form.locator('button[type="submit"]').click();

  const getTournamentCard = () =>
    page.locator('.tournament-card', { hasText: tournamentTitle });

  await expect(getTournamentCard()).toBeVisible({ timeout: 20000 });

  const joinTournament = async () => {
    const card = getTournamentCard();
    await expect(card).toBeVisible();

    const joinButton = card.locator('button.btn-join');
    await expect(joinButton).toBeVisible();
    await joinButton.click();

    const modal = page.locator('.join-modal');
    await expect(modal).toBeVisible();

    const firstCharacter = modal.locator('.characters-grid .character-card').first();
    await expect(firstCharacter).toBeVisible();
    await firstCharacter.click();

    const confirmJoin = modal.locator('button.btn-join');
    await expect(confirmJoin).toBeEnabled();
    await confirmJoin.click();

    await expect(modal).toBeHidden({ timeout: 15000 });
    await expect(getTournamentCard().locator('.participant-badge')).toBeVisible();
  };

  for (let index = 0; index < users.length; index += 1) {
    if (index > 0) {
      await loginViaUi(page, users[index].email, users[index].password);
      await page.goto('/tournaments');
      await expect(getTournamentCard()).toBeVisible({ timeout: 20000 });
    }

    await joinTournament();

    if (index < users.length - 1) {
      await logoutViaUi(page);
    }
  }
});
