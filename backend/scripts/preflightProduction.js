import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(backendRoot, '.env') });
dotenv.config({ path: path.join(backendRoot, '.env.production') });

process.env.NODE_ENV = 'production';

const { assertEmailConfiguration } = await import('../services/emailService.js');
const {
  assertProductionDatabaseConfiguration,
  closeDb,
  readDb,
  verifyProductionDatabaseCapabilities
} = await import('../services/jsonDb.js');
const { assertProductionLegalConfiguration } = await import(
  '../config/legalConfig.js'
);
const { assertProductionRuntimeConfiguration } = await import(
  '../config/runtimeConfig.js'
);

assertEmailConfiguration();
assertProductionDatabaseConfiguration();
assertProductionLegalConfiguration();
assertProductionRuntimeConfiguration();
await readDb();
await verifyProductionDatabaseCapabilities();
await closeDb();

console.log('Production preflight passed: auth, MongoDB, SMTP and legal configuration.');
