import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_DB, normalizeDb } from './dbSchema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rawDbPath =
  typeof process.env.JSON_DB_PATH === 'string' && process.env.JSON_DB_PATH.trim()
    ? process.env.JSON_DB_PATH.trim()
    : 'db.json';
const DB_PATH = path.resolve(__dirname, '..', rawDbPath);

let writeChain = Promise.resolve();

const enqueueWrite = async (task) => {
  let result;
  let error;

  writeChain = writeChain.then(
    async () => {
      try {
        result = await task();
      } catch (err) {
        error = err;
      }
    },
    async () => {
      try {
        result = await task();
      } catch (err) {
        error = err;
      }
    }
  );

  await writeChain;
  if (error) {
    throw error;
  }
  return result;
};

const ensureDbFile = async () => {
  try {
    await fs.access(DB_PATH);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.writeFile(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2), 'utf8');
    } else {
      throw error;
    }
  }
};

export const readDb = async () => {
  await ensureDbFile();
  const raw = await fs.readFile(DB_PATH, 'utf8');
  if (!raw.trim()) {
    return normalizeDb(DEFAULT_DB);
  }
  return normalizeDb(JSON.parse(raw));
};

export const writeDb = async (data) => {
  const normalized = normalizeDb(data);
  await enqueueWrite(() =>
    fs.writeFile(DB_PATH, JSON.stringify(normalized, null, 2), 'utf8')
  );
  return normalized;
};

export const updateDb = async (mutator) => {
  return enqueueWrite(async () => {
    const data = await readDb();
    const result = await mutator(data);
    const updated = normalizeDb(result || data);
    await fs.writeFile(DB_PATH, JSON.stringify(updated, null, 2), 'utf8');
    return updated;
  });
};

export const getDbPath = () => DB_PATH;
