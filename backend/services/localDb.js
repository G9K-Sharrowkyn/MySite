import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
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

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const atomicWriteFile = async (targetPath, contents) => {
  const tempPath = `${targetPath}.${process.pid}.${randomUUID()}.tmp`;
  let handle;
  try {
    handle = await fs.open(tempPath, 'wx');
    await handle.writeFile(contents, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    await fs.rename(tempPath, targetPath);
  } catch (error) {
    if (handle) {
      await handle.close().catch(() => {});
    }
    await fs.unlink(tempPath).catch(() => {});
    throw error;
  }
};

const ensureDbFile = async () => {
  try {
    await fs.access(DB_PATH);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await atomicWriteFile(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2));
    } else {
      throw error;
    }
  }
};

export const readDb = async () => {
  await ensureDbFile();
  const raw = await fs.readFile(DB_PATH, 'utf8');
  // PowerShell's Set-Content -Encoding UTF8 writes a BOM; tolerate it.
  const sanitized = raw.replace(/^\uFEFF/, '');
  if (!sanitized.trim()) {
    return normalizeDb(DEFAULT_DB);
  }
  return normalizeDb(JSON.parse(sanitized));
};

export const writeDb = async (data) => {
  const normalized = normalizeDb(data);
  await enqueueWrite(() =>
    atomicWriteFile(DB_PATH, JSON.stringify(normalized, null, 2))
  );
  return normalized;
};

export const updateDb = async (mutator) => {
  return enqueueWrite(async () => {
    const data = await readDb();
    // Mutators are expected to mutate `data` in-place.
    // Ignoring the return value prevents accidental partial returns from wiping keys.
    await mutator(data);
    const updated = normalizeDb(data);
    await atomicWriteFile(DB_PATH, JSON.stringify(updated, null, 2));
    return updated;
  });
};

export const readCollection = async (collectionKey) => {
  const db = await readDb();
  return ensureArray(db[collectionKey]);
};

export const updateCollection = async (collectionKey, mutator) => {
  let updated;
  await updateDb((db) => {
    const current = ensureArray(db[collectionKey]);
    const working = [...current];
    const next = mutator(working);
    const resolvedNext = Array.isArray(next) ? next : working;
    db[collectionKey] = resolvedNext;
    updated = resolvedNext;
    return db;
  });
  return updated;
};

export const getDbPath = () => DB_PATH;
