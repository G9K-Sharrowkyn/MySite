import { isMongoMode, readDb, updateDb, writeDb } from '../services/jsonDb.js';

export const withDb = async (mutator) => updateDb(mutator);

export const withRepositoryTransaction = async (handler) => {
  if (typeof handler !== 'function') {
    throw new TypeError('Repository transaction handler must be a function.');
  }
  if (isMongoMode()) {
    const { withMongoTransaction } = await import('../services/mongoDb.js');
    return withMongoTransaction(handler);
  }
  let result;
  await updateDb(async (db) => {
    result = await handler({ db });
    return db;
  });
  return result;
};

export { readDb, updateDb, writeDb };
