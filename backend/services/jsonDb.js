import {
  readDb as readLocalDb,
  writeDb as writeLocalDb,
  updateDb as updateLocalDb,
  getDbPath as getLocalDbPath
} from './localDb.js';

const resolveDatabaseMode = () =>
  (process.env.DATABASE || process.env.Database || 'local').toLowerCase();

const isMongoMode = () => {
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

export const getDbPath = () =>
  (isMongoMode() ? 'mongo' : getLocalDbPath());
