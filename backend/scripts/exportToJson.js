import dotenv from 'dotenv';
import { readDb as readMongoDb, closeMongo } from '../services/mongoDb.js';
import { writeDb as writeLocalDb } from '../services/localDb.js';

dotenv.config();

const run = async () => {
  const data = await readMongoDb();
  await writeLocalDb(data);
  console.log('Export complete: MongoDB -> local JSON');
  await closeMongo();
};

run().catch(async (error) => {
  console.error('Export failed:', error);
  try {
    await closeMongo();
  } finally {
    process.exit(1);
  }
});
