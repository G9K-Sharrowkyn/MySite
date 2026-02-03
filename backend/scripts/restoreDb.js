import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { writeDb } from '../services/jsonDb.js';

dotenv.config();

const getArgValue = (flag, fallback = null) => {
  const index = process.argv.indexOf(flag);
  if (index >= 0 && process.argv[index + 1]) {
    return process.argv[index + 1];
  }
  return fallback;
};

const run = async () => {
  const backupFileArg = getArgValue('--file');
  if (!backupFileArg) {
    throw new Error(
      'Missing --file argument. Example: node scripts/restoreDb.js --file backups/backup-local-2026-02-03.json'
    );
  }

  const backupPath = path.resolve(process.cwd(), backupFileArg);
  const raw = await fs.readFile(backupPath, 'utf8');
  const parsed = JSON.parse(raw);
  const data = parsed?.data && typeof parsed.data === 'object' ? parsed.data : parsed;

  if (!data || typeof data !== 'object') {
    throw new Error('Backup file is invalid.');
  }

  await writeDb(data);
  console.log(`Restore completed from: ${backupPath}`);
};

run().catch((error) => {
  console.error('Restore failed:', error);
  process.exitCode = 1;
});

