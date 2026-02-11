import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';
import { COLLECTION_KEYS, normalizeDb } from './dbSchema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.resolve(__dirname, '..');

const getMongoUri = () =>
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.MONGO_URL ||
  process.env.DATABASE_URL ||
  '';

const parseCsv = (value) =>
  String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const isAutoBackupEnabled = () =>
  String(process.env.MONGO_AUTO_BACKUP_DISABLED || '').trim().toLowerCase() !==
  'true';

const getAutoBackupCollections = () => {
  const configured = parseCsv(process.env.MONGO_AUTO_BACKUP_COLLECTIONS);
  if (configured.length > 0) {
    return new Set(configured);
  }
  // Safe default: protect the most painful-to-recreate data.
  return new Set(['characters', 'users', 'posts']);
};

const getAutoBackupMinIntervalMs = () =>
  Number.parseInt(process.env.MONGO_AUTO_BACKUP_MIN_INTERVAL_MS || '300000', 10); // 5 min

const getAutoBackupMaxFiles = () =>
  Number.parseInt(process.env.MONGO_AUTO_BACKUP_MAX_FILES || '50', 10);

const getAutoBackupDir = () =>
  path.resolve(BACKEND_ROOT, 'backups', 'auto-mongo');

const lastBackupByCollection = new Map();
let cleanupPromise;

const safeFilePart = (value) =>
  String(value || '')
    .replace(/[^a-z0-9._-]+/gi, '_')
    .slice(0, 80);

const cleanupBackupDir = async (dir) => {
  if (cleanupPromise) return cleanupPromise;
  cleanupPromise = (async () => {
    try {
      const maxFiles = getAutoBackupMaxFiles();
      if (!Number.isFinite(maxFiles) || maxFiles <= 0) return;

      const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
      const files = entries.filter((e) => e.isFile()).map((e) => e.name);
      if (files.length <= maxFiles) return;

      const stats = await Promise.all(
        files.map(async (name) => {
          const filePath = path.join(dir, name);
          const st = await fs.stat(filePath).catch(() => null);
          return st ? { name, mtimeMs: st.mtimeMs } : null;
        })
      );

      const sorted = stats
        .filter(Boolean)
        .sort((a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0));

      const toDelete = sorted.slice(maxFiles);
      await Promise.all(
        toDelete.map(({ name }) =>
          fs.unlink(path.join(dir, name)).catch(() => null)
        )
      );
    } finally {
      cleanupPromise = null;
    }
  })();
  return cleanupPromise;
};

const maybeAutoBackupCollection = async (db, collectionKey, meta = {}) => {
  if (!isAutoBackupEnabled()) return;

  const allow = getAutoBackupCollections();
  if (!allow.has(collectionKey)) return;

  const now = Date.now();
  const lastAt = lastBackupByCollection.get(collectionKey) || 0;
  const minInterval = getAutoBackupMinIntervalMs();
  if (now - lastAt < minInterval) {
    return;
  }

  const dir = getAutoBackupDir();
  await fs.mkdir(dir, { recursive: true });

  // Snapshot current collection state BEFORE deleteMany/insertMany.
  const docs = await db
    .collection(collectionKey)
    .find({})
    .project({ _id: 0 })
    .toArray();

  const payload = {
    version: 1,
    createdAt: new Date(now).toISOString(),
    dbName: db.databaseName,
    collection: collectionKey,
    count: docs.length,
    meta: {
      reason: meta.reason || 'pre_replace',
      actor: meta.actor || null
    },
    docs
  };

  const stamp = new Date(now).toISOString().replace(/[:.]/g, '-');
  const filename = `auto-${safeFilePart(db.databaseName)}-${safeFilePart(collectionKey)}-${stamp}-${safeFilePart(payload.meta.reason)}.json`;
  const targetPath = path.join(dir, filename);
  await fs.writeFile(targetPath, JSON.stringify(payload, null, 2), 'utf8');

  lastBackupByCollection.set(collectionKey, now);
  cleanupBackupDir(dir).catch(() => null);

  console.log(
    `Auto-backup saved: ${targetPath} (collection=${collectionKey}, count=${docs.length})`
  );
};

const deriveMongoHostFromUri = (uri) => {
  const raw = String(uri || '').trim();
  if (!raw) return '';
  const match = raw.match(/^mongodb(?:\+srv)?:\/\/([^/]+)/i);
  if (!match) return '';
  const authority = String(match[1] || '').trim();
  if (!authority) return '';
  // Strip credentials if present: user:pass@host
  const withoutCreds = authority.includes('@')
    ? authority.slice(authority.lastIndexOf('@') + 1)
    : authority;
  return withoutCreds.trim();
};

const deriveDbNameFromUri = (uri) => {
  const raw = String(uri || '').trim();
  if (!raw) return '';

  // Example: mongodb+srv://user:pass@cluster.mongodb.net/mydb?retryWrites=true&w=majority
  const match = raw.match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]*)/i);
  if (!match) return '';
  const candidate = String(match[1] || '').trim();
  if (!candidate) return '';
  try {
    return decodeURIComponent(candidate);
  } catch (_error) {
    return candidate;
  }
};

const DEFAULT_MONGO_DB_NAME = 'versusversevault';

const resolveMongoDbName = () => {
  const explicit = String(process.env.MONGO_DB_NAME || '').trim();
  if (explicit) {
    return { dbName: explicit, source: 'env' };
  }

  const derived = deriveDbNameFromUri(getMongoUri());
  if (derived) {
    return { dbName: derived, source: 'uri' };
  }

  return { dbName: DEFAULT_MONGO_DB_NAME, source: 'default' };
};

const getMongoDbName = () => resolveMongoDbName().dbName;
const getMongoConnectTimeoutMs = () =>
  Number.parseInt(process.env.MONGO_CONNECT_TIMEOUT_MS || '10000', 10);
const getMongoCacheTtlMs = () =>
  Number.parseInt(process.env.MONGO_CACHE_TTL_MS || '300000', 10);

let client;
let clientPromise;
let dbCache;
let dbCacheTimestamp = 0;
const collectionCache = new Map();
let indexesReadyPromise;

const cloneData = (value) => {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};

const isCacheEnabled = () => getMongoCacheTtlMs() > 0;

const hasFreshCache = () => {
  if (!isCacheEnabled() || !dbCache) {
    return false;
  }
  return Date.now() - dbCacheTimestamp < getMongoCacheTtlMs();
};

const setCache = (data) => {
  if (!isCacheEnabled()) {
    dbCache = undefined;
    dbCacheTimestamp = 0;
    return;
  }
  dbCache = data;
  dbCacheTimestamp = Date.now();
};

const getCollectionFromCache = (key) => {
  if (!isCacheEnabled()) return null;
  const cached = collectionCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.timestamp >= getMongoCacheTtlMs()) {
    collectionCache.delete(key);
    return null;
  }
  return cached.data;
};

const setCollectionCache = (key, data) => {
  if (!isCacheEnabled()) {
    collectionCache.delete(key);
    return;
  }
  collectionCache.set(key, { data, timestamp: Date.now() });
};

const clearCollectionCache = (key) => {
  collectionCache.delete(key);
};

const ensureIndexes = async (db) => {
  if (indexesReadyPromise) return indexesReadyPromise;

  indexesReadyPromise = (async () => {
    const specs = [
      ['users', [{ key: { id: 1 } }, { key: { username: 1 } }, { key: { email: 1 } }, { key: { role: 1 } }]],
      ['posts', [{ key: { id: 1 } }, { key: { authorId: 1 } }, { key: { createdAt: -1 } }, { key: { type: 1 } }, { key: { category: 1 } }]],
      ['comments', [{ key: { id: 1 } }, { key: { postId: 1 } }, { key: { targetId: 1 } }, { key: { authorId: 1 } }, { key: { type: 1 } }, { key: { createdAt: -1 } }]],
      ['messages', [{ key: { id: 1 } }, { key: { senderId: 1, recipientId: 1, createdAt: -1 } }, { key: { recipientId: 1, read: 1, deleted: 1 } }]],
      ['notifications', [{ key: { id: 1 } }, { key: { userId: 1, read: 1, createdAt: -1 } }]],
      ['friendRequests', [{ key: { id: 1 } }, { key: { fromUserId: 1, toUserId: 1, status: 1 } }, { key: { toUserId: 1, status: 1, createdAt: -1 } }]],
      ['friendships', [{ key: { id: 1 } }, { key: { userId1: 1, userId2: 1 } }, { key: { userId1: 1 } }, { key: { userId2: 1 } }]],
      ['blocks', [{ key: { id: 1 } }, { key: { blockerId: 1, blockedId: 1 } }, { key: { blockerId: 1 } }]],
      ['feedback', [{ key: { id: 1 } }, { key: { status: 1, createdAt: -1 } }, { key: { type: 1 } }]],
      ['tournaments', [{ key: { id: 1 } }, { key: { status: 1, createdAt: -1 } }]],
      ['nicknameChangeLogs', [{ key: { userId: 1, changedAt: -1 } }, { key: { username: 1, changedAt: -1 } }]],
      ['moderatorActionLogs', [{ key: { createdAt: -1 } }, { key: { actorId: 1, createdAt: -1 } }, { key: { targetType: 1, createdAt: -1 } }]]
    ];

    for (const [collectionName, indexes] of specs) {
      try {
        const collection = db.collection(collectionName);
        for (const index of indexes) {
          await collection.createIndex(index.key, {
            background: true,
            ...(index.options || {})
          });
        }
      } catch (error) {
        console.error(`Index ensure failed for ${collectionName}:`, error?.message || error);
      }
    }
  })();

  return indexesReadyPromise;
};

const ensureMongoUri = () => {
  const uri = getMongoUri();
  if (!uri || typeof uri !== 'string' || !uri.trim()) {
    throw new Error(
      'MongoDB is enabled but no connection string is set. Provide one of: MONGO_URI, MONGODB_URI, MONGO_URL, DATABASE_URL.'
    );
  }
  return uri;
};

const getClient = async () => {
  if (clientPromise) {
    return clientPromise;
  }

  const uri = ensureMongoUri();
  const timeoutMs = getMongoConnectTimeoutMs();

  client = new MongoClient(uri, {
    serverSelectionTimeoutMS: timeoutMs
  });

  clientPromise = client.connect().then(async () => {
    const db = client.db(getMongoDbName());
    await ensureIndexes(db);
    return client;
  });
  return clientPromise;
};

const getDb = async () => {
  const activeClient = await getClient();
  return activeClient.db(getMongoDbName());
};

export const getMongoDb = async () => getDb();

const stripMongoId = (doc) => {
  if (!doc || typeof doc !== 'object') {
    return doc;
  }
  const { _id, ...rest } = doc;
  return rest;
};

const sanitizeDoc = (doc) => {
  if (!doc || typeof doc !== 'object') {
    return doc;
  }
  const copy = { ...doc };
  if ('_id' in copy) {
    delete copy._id;
  }
  return copy;
};

const replaceCollection = async (db, key, items) => {
  try {
    await maybeAutoBackupCollection(db, key, { reason: 'replace_collection' });
  } catch (error) {
    // Best-effort safety net: never break the request flow due to backup issues.
    console.error(
      `Auto-backup failed for collection ${key}:`,
      error?.message || error
    );
  }

  const collection = db.collection(key);
  await collection.deleteMany({});
  if (items.length > 0) {
    const docs = items.map(sanitizeDoc);
    await collection.insertMany(docs, { ordered: false });
  }
};

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

export const readDb = async () => {
  if (hasFreshCache()) {
    return cloneData(dbCache);
  }

  const db = await getDb();
  const entries = await Promise.all(
    COLLECTION_KEYS.map(async (key) => {
      const docs = await db.collection(key).find({}).toArray();
      return [key, docs.map(stripMongoId)];
    })
  );

  const data = Object.fromEntries(entries);
  const normalized = normalizeDb(data);
  setCache(normalized);
  for (const key of COLLECTION_KEYS) {
    setCollectionCache(key, normalized[key] || []);
  }
  return cloneData(normalized);
};

export const readCollection = async (collectionKey) => {
  if (!COLLECTION_KEYS.includes(collectionKey)) {
    throw new Error(`Unknown collection: ${collectionKey}`);
  }
  const cached = getCollectionFromCache(collectionKey);
  if (cached) {
    return cloneData(cached);
  }

  const db = await getDb();
  const docs = await db.collection(collectionKey).find({}).toArray();
  const normalized = docs.map(stripMongoId);
  setCollectionCache(collectionKey, normalized);
  return cloneData(normalized);
};

export const writeDb = async (data) => {
  const normalized = normalizeDb(data);
  const db = await getDb();

  await Promise.all(
    COLLECTION_KEYS.map((key) => replaceCollection(db, key, normalized[key]))
  );

  setCache(normalized);
  for (const key of COLLECTION_KEYS) {
    setCollectionCache(key, normalized[key] || []);
  }
  return cloneData(normalized);
};

export const updateCollection = async (collectionKey, mutator) => {
  if (!COLLECTION_KEYS.includes(collectionKey)) {
    throw new Error(`Unknown collection: ${collectionKey}`);
  }

  return enqueueWrite(async () => {
    const current = await readCollection(collectionKey);
    const working = [...current];
    const next = mutator(working);
    const resolved = Array.isArray(next) ? next : working;
    const db = await getDb();
    await replaceCollection(db, collectionKey, resolved);
    clearCollectionCache(collectionKey);
    if (dbCache && typeof dbCache === 'object') {
      dbCache[collectionKey] = resolved;
      dbCacheTimestamp = Date.now();
    }
    return cloneData(resolved);
  });
};

export const updateDb = async (mutator) => {
  return enqueueWrite(async () => {
    const data = await readDb();
    const beforeSnapshots = new Map();

    for (const key of COLLECTION_KEYS) {
      beforeSnapshots.set(key, JSON.stringify(data[key] || []));
    }

    // Mutators in this codebase are expected to mutate `data` in-place.
    // Never trust the return value here, because returning a partial object (e.g. `{ ok: true }`)
    // would normalize into DEFAULT_DB and could wipe collections in Mongo.
    await mutator(data);
    const updated = normalizeDb(data);
    const db = await getDb();

    const writes = [];
    const changedKeys = [];
    for (const key of COLLECTION_KEYS) {
      const before = beforeSnapshots.get(key);
      const after = JSON.stringify(updated[key] || []);
      if (before !== after) {
        writes.push(replaceCollection(db, key, updated[key] || []));
        changedKeys.push(key);
      }
    }

    if (writes.length === 0) {
      setCache(updated);
      // Keep per-collection cache coherent with the db-level cache.
      for (const key of COLLECTION_KEYS) {
        setCollectionCache(key, updated[key] || []);
      }
      return cloneData(updated);
    }

    await Promise.all(writes);
    setCache(updated);
    // Clear/update per-collection caches for any collections we modified.
    for (const key of changedKeys) {
      clearCollectionCache(key);
      setCollectionCache(key, updated[key] || []);
    }
    return cloneData(updated);
  });
};

export const closeMongo = async () => {
  if (client) {
    await client.close();
    client = undefined;
    clientPromise = undefined;
  }
  dbCache = undefined;
  dbCacheTimestamp = 0;
  collectionCache.clear();
  indexesReadyPromise = undefined;
};

export const getMongoConfig = () => ({
  uri: getMongoUri(),
  dbName: getMongoDbName(),
  dbNameSource: resolveMongoDbName().source,
  host: deriveMongoHostFromUri(getMongoUri()),
  connectTimeoutMs: getMongoConnectTimeoutMs(),
  cacheTtlMs: getMongoCacheTtlMs()
});
