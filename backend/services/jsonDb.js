import {
  readDb as readLocalDb,
  writeDb as writeLocalDb,
  updateDb as updateLocalDb,
  getDbPath as getLocalDbPath
} from './localDb.js';

const resolveDatabaseMode = () =>
  (() => {
    const explicit = process.env.DATABASE || process.env.Database;
    if (explicit) {
      return String(explicit).toLowerCase();
    }

    // Auto-enable Mongo when a connection string is present.
    const hasMongoUri =
      Boolean(process.env.MONGO_URI) ||
      Boolean(process.env.MONGODB_URI) ||
      Boolean(process.env.MONGO_URL) ||
      Boolean(process.env.DATABASE_URL);
    if (hasMongoUri) {
      return 'mongo';
    }

    return 'local';
  })();

export const isMongoMode = () => {
  const mode = resolveDatabaseMode();
  return mode === 'mongo' || mode === 'mongodb';
};

let mongoApi;
const loadMongoApi = async () => {
  if (!mongoApi) {
    mongoApi = await import('./mongoDb.js');
  }
  return mongoApi;
};

export const readDb = async (...args) => {
  if (isMongoMode()) {
    const { readDb: readMongoDb } = await loadMongoApi();
    return readMongoDb(...args);
  }
  return readLocalDb(...args);
};

export const writeDb = async (...args) => {
  if (isMongoMode()) {
    const { writeDb: writeMongoDb } = await loadMongoApi();
    return writeMongoDb(...args);
  }
  return writeLocalDb(...args);
};

export const updateDb = async (...args) => {
  if (isMongoMode()) {
    const { updateDb: updateMongoDb } = await loadMongoApi();
    return updateMongoDb(...args);
  }
  return updateLocalDb(...args);
};

export const readCollection = async (...args) => {
  if (isMongoMode()) {
    const { readCollection: readMongoCollection } = await loadMongoApi();
    return readMongoCollection(...args);
  }
  const { readCollection: readLocalCollection } = await import('./localDb.js');
  return readLocalCollection(...args);
};

export const updateCollection = async (...args) => {
  if (isMongoMode()) {
    const { updateCollection: updateMongoCollection } = await loadMongoApi();
    return updateMongoCollection(...args);
  }
  const { updateCollection: updateLocalCollection } = await import('./localDb.js');
  return updateLocalCollection(...args);
};

export const getDbPath = () =>
  (isMongoMode() ? 'mongo' : getLocalDbPath());
