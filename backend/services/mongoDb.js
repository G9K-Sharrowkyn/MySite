import { MongoClient } from 'mongodb';
import { COLLECTION_KEYS, normalizeDb } from './dbSchema.js';

const getMongoUri = () => process.env.MONGO_URI;
const getMongoDbName = () => process.env.MONGO_DB_NAME || 'geekfights';
const getMongoConnectTimeoutMs = () =>
  Number.parseInt(process.env.MONGO_CONNECT_TIMEOUT_MS || '10000', 10);

let client;
let clientPromise;

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
  const db = await getDb();
  const entries = await Promise.all(
    COLLECTION_KEYS.map(async (key) => {
      const docs = await db.collection(key).find({}).toArray();
      return [key, docs.map(stripMongoId)];
    })
  );

  const data = Object.fromEntries(entries);
  return normalizeDb(data);
};

export const writeDb = async (data) => {
  const normalized = normalizeDb(data);
  const db = await getDb();

  await Promise.all(
    COLLECTION_KEYS.map((key) => replaceCollection(db, key, normalized[key]))
  );

  return normalized;
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
      return updated;
    }

    await Promise.all(writes);
    return updated;
  });
};

export const closeMongo = async () => {
  if (client) {
    await client.close();
    client = undefined;
    clientPromise = undefined;
  }
};

export const getMongoConfig = () => ({
  uri: getMongoUri(),
  dbName: getMongoDbName(),
  connectTimeoutMs: getMongoConnectTimeoutMs()
});
