import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(backendRoot, '.env') });
dotenv.config({ path: path.join(backendRoot, '.env.production') });

const port = Number.parseInt(process.env.PORT || '5000', 10);
const healthUrl = `http://127.0.0.1:${port}/readyz`;
const timeoutMs = Number.parseInt(process.env.DEPLOY_HEALTH_TIMEOUT_MS || '30000', 10);
const deadline = Date.now() + timeoutMs;
let lastError;

while (Date.now() < deadline) {
  try {
    const response = await fetch(healthUrl, {
      signal: AbortSignal.timeout(3000),
      headers: { accept: 'application/json' }
    });
    const payload = await response.json();
    if (response.ok && payload?.ok === true) {
      console.log(`Deployment healthcheck passed: ${healthUrl}`);
      process.exit(0);
    }
    lastError = new Error(`HTTP ${response.status}: ${JSON.stringify(payload)}`);
  } catch (error) {
    lastError = error;
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));
}

console.error(`Deployment healthcheck failed: ${healthUrl}`);
console.error(lastError?.message || 'No healthy response received');
process.exit(1);
