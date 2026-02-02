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

  clientPromise = client.connect().then(() => client);
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
  return cloneData(normalized);
};

export const writeDb = async (data) => {
  const normalized = normalizeDb(data);
  const db = await getDb();

  await Promise.all(
    COLLECTION_KEYS.map((key) => replaceCollection(db, key, normalized[key]))
  );

  setCache(normalized);
  return cloneData(normalized);
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
    for (const key of COLLECTION_KEYS) {
      const before = beforeSnapshots.get(key);
      const after = JSON.stringify(updated[key] || []);
      if (before !== after) {
        writes.push(replaceCollection(db, key, updated[key] || []));
      }
    }

    if (writes.length === 0) {
      setCache(updated);
      return cloneData(updated);
    }

    await Promise.all(writes);
    setCache(updated);
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
};

export const getMongoConfig = () => ({
  uri: getMongoUri(),
  dbName: getMongoDbName(),
  connectTimeoutMs: getMongoConnectTimeoutMs(),
  cacheTtlMs: getMongoCacheTtlMs()
});
