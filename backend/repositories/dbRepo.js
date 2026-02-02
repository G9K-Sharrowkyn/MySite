import { readDb, updateDb, writeDb } from '../services/jsonDb.js';

export const withDb = async (mutator) => updateDb(mutator);

export { readDb, updateDb, writeDb };
