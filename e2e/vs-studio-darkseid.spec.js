/* eslint-disable testing-library/prefer-screen-queries */
const { test, expect } = require('@playwright/test');
const { loginViaUi } = require('./helpers');

test('Darkseid sequence owns the viewport and Escape returns to VS Studio', async ({ page }) => {
  await loginViaUi(page, 'admin@site.local', 'E2e-Staff-Only-2026!');
  await page.goto('/vs-studio');

  const studioFrame = page.frameLocator('iframe[title="VS Graphic Studio"]');
  await studioFrame.getByRole('button', { name: /Darkseid is\./i }).click();

  await expect(page.locator('header.header')).toHaveCount(0);
  await expect(page.locator('.vs-studio-page--immersive')).toBeVisible();
  await expect(studioFrame.locator('.vs-boot-screen')).toBeVisible();

  const viewport = page.viewportSize();
  const immersiveBounds = await page.locator('.vs-studio-page--immersive').boundingBox();
  expect(immersiveBounds).not.toBeNull();
  expect(Math.abs(immersiveBounds.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(immersiveBounds.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(immersiveBounds.width - viewport.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(immersiveBounds.height - viewport.height)).toBeLessThanOrEqual(1);

  await studioFrame.locator('body').press('Space');
  const searchFrame = studioFrame.frameLocator('iframe[title="Fight Search"]');
  await expect(searchFrame.locator('#s1')).toBeVisible({ timeout: 15000 });
  await expect(searchFrame.locator('header.header')).toHaveCount(0);
  const stationFrame = searchFrame.frameLocator('iframe[title="The cyberpunk station for netrunners"]');
  await expect(stationFrame.locator('.openingBox').first()).toBeVisible();
  await expect(stationFrame.locator('header.header')).toHaveCount(0);

  await searchFrame.locator('body').press('Escape');
  await expect(studioFrame.getByRole('button', { name: /Darkseid is\./i })).toBeVisible();
  await expect(page.locator('header.header')).toBeVisible();
  await expect(page.locator('.vs-studio-page--immersive')).toHaveCount(0);
});

test('packaged fights are discovered one at a time through search', async ({ page }) => {
  await loginViaUi(page, 'admin@site.local', 'E2e-Staff-Only-2026!');
  await page.goto('/vs-studio');
  await page.evaluate(() => localStorage.removeItem('vvv-fight-history-v1'));

  const studioFrame = page.frameLocator('iframe[title="VS Graphic Studio"]');
  await studioFrame.getByRole('button', { name: /Darkseid is\./i }).click();
  await studioFrame.locator('body').press('Space');

  const searchFrame = studioFrame.frameLocator('iframe[title="Fight Search"]');
  await expect(searchFrame.locator('#s1')).toBeVisible({ timeout: 15000 });
  await searchFrame.locator('body').evaluate(() => {
    window.postMessage({ type: 'vvv-dev-jump-stage', stage: 3 }, window.location.origin);
  });

  const searchInput = searchFrame.locator('#s6-input');
  await expect(searchInput).toBeVisible({ timeout: 10000 });
  await searchInput.fill('Thragg vs Demon King Piccolo');
  await searchInput.press('Enter');

  await expect(searchFrame.locator('#s3')).toBeVisible({ timeout: 10000 });
  await expect.poll(async () => page.evaluate(() => {
    const history = JSON.parse(localStorage.getItem('vvv-fight-history-v1') || '[]');
    return history.map((fight) => `${fight.fighterAName} vs ${fight.fighterBName}`);
  })).toEqual(['Thragg vs Demon King Piccolo']);

  await expect(searchFrame.locator('.s7-fight')).toBeVisible({ timeout: 20000 });
  await searchFrame.locator('body').evaluate(() => {
    window.parent.postMessage(
      { type: 'vvv-dev-open-fight-shortcut-request', key: '1' },
      window.location.origin
    );
  });
  const brandLogo = studioFrame.getByAltText('VersusVerseVault').first();
  await expect(brandLogo).toBeVisible({ timeout: 15000 });
  await expect.poll(() => brandLogo.evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
});
