import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { readDb } from '../services/jsonDb.js';

dotenv.config();

const getArgValue = (flag, fallback = null) => {
  const index = process.argv.indexOf(flag);
  if (index >= 0 && process.argv[index + 1]) {
    return process.argv[index + 1];
  }
  return fallback;
};

const run = async () => {
  const db = await readDb();
  const modeRaw = process.env.DATABASE || process.env.Database || 'local';
  const mode = ['mongo', 'mongodb'].includes(modeRaw.toLowerCase())
    ? 'mongo'
    : 'local';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = getArgValue('--dir', 'backups');
  const filename = getArgValue(
    '--file',
    `backup-${mode}-${timestamp}.json`
  );
  const targetDir = path.resolve(process.cwd(), outputDir);
  const targetPath = path.resolve(targetDir, filename);

  await fs.mkdir(targetDir, { recursive: true });
  const payload = {
    version: 1,
    createdAt: new Date().toISOString(),
    sourceMode: mode,
    data: db
  };
  await fs.writeFile(targetPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`Backup created: ${targetPath}`);
};

run().catch((error) => {
  console.error('Backup failed:', error);
  process.exitCode = 1;
});

