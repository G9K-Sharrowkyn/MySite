const { spawn } = require('node:child_process');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const backendDirectory = path.join(projectRoot, 'backend');

const child = spawn(process.execPath, ['--use-system-ca', 'server.js'], {
  cwd: backendDirectory,
  stdio: 'inherit',
  env: {
    ...process.env,
    DATABASE: 'local',
    JSON_DB_PATH: '.tmp/db.e2e.json',
    JWT_SECRET:
      process.env.LOCAL_JWT_SECRET ||
      'playwright-only-secret-not-for-production',
    REQUIRE_EMAIL_VERIFICATION: 'false',
    E2E_TEST_MODE: 'true'
  }
});

child.on('error', (error) => {
  console.error('Could not start the local backend:', error.message);
  process.exitCode = 1;
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
