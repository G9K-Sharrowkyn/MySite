const fs = require('fs/promises');
const path = require('path');

const BACKEND_BASE_URL = 'http://localhost:5001';

const waitForBackend = async (page, timeoutMs = 15000) => {
  await page.waitForLoadState('domcontentloaded');
  const start = Date.now();
  let lastError = null;
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await page.request.get(`${BACKEND_BASE_URL}/`);
      if (response.ok()) {
        return;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (lastError) {
    throw lastError;
  }
  throw new Error('Backend did not respond in time.');
};

const registerUserViaApi = async (request, user) => {
  const response = await request.post(`${BACKEND_BASE_URL}/api/auth/register`, {
    data: user
  });
  return response;
};

const loginViaApi = async (request, email, password) => {
  const response = await request.post(`${BACKEND_BASE_URL}/api/auth/login`, {
    data: { email, password }
  });
  const data = await response.json();
  return { response, data };
};

const loginViaUi = async (page, email, password) => {
  await page.goto('/login');
  await page.getByPlaceholder('Email address').fill(email);
  await page.getByPlaceholder('Password').fill(password);
  await page.locator('input[type="submit"]').click();
  await page.waitForFunction(() => Boolean(localStorage.getItem('token')), null, {
    timeout: 15000
  });
};

const openUserMenu = async (page) => {
  const userButton = page.locator('.user-button');
  await userButton.waitFor({ state: 'visible' });
  await userButton.click();
};

const logoutViaUi = async (page) => {
  await openUserMenu(page);
  await page.locator('.logout-item').click();
};

const getE2eDbPath = () =>
  path.resolve(__dirname, '..', 'backend', '.tmp', 'db.e2e.json');

const readE2eDb = async () => {
  const dbPath = getE2eDbPath();
  const raw = await fs.readFile(dbPath, 'utf8');
  return JSON.parse(raw);
};

const getResetTokenForEmail = async (email) => {
  const db = await readE2eDb();
  const user = (db.users || []).find((entry) => entry.email === email);
  return user?.resetPasswordToken || null;
};

module.exports = {
  BACKEND_BASE_URL,
  waitForBackend,
  registerUserViaApi,
  loginViaApi,
  loginViaUi,
  openUserMenu,
  logoutViaUi,
  getResetTokenForEmail
};
