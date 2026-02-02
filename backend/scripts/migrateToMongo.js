import dotenv from 'dotenv';
import { readDb as readLocalDb } from '../services/localDb.js';
import { writeDb as writeMongoDb, closeMongo } from '../services/mongoDb.js';

dotenv.config();

const run = async () => {
  const data = await readLocalDb();
  await writeMongoDb(data);
  console.log('Migration complete: local JSON -> MongoDB');
  await closeMongo();
};

run().catch(async (error) => {
  console.error('Migration failed:', error);
  try {
    await closeMongo();
  } finally {
    process.exit(1);
  }
});
