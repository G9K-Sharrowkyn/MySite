import { MongoClient } from 'mongodb';
import { COLLECTION_KEYS, normalizeDb } from './dbSchema.js';

const getMongoUri = () => process.env.MONGO_URI;
const getMongoDbName = () => process.env.MONGO_DB_NAME || 'geekfights';
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
  if (!uri || typeof uri !== 'string') {
    throw new Error('MONGO_URI is not set. Set DATABASE=mongo and MONGO_URI to enable MongoDB.');
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

    const result = await mutator(data);
    const updated = normalizeDb(result || data);
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
  connectTimeoutMs: getMongoConnectTimeoutMs(),
  cacheTtlMs: getMongoCacheTtlMs()
});
