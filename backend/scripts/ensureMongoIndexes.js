import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(backendRoot, '.env') });
dotenv.config({ path: path.join(backendRoot, '.env.production') });
process.env.DATABASE = 'mongo';

const { closeMongo, getMongoConfig, getMongoDb } = await import('../services/mongoDb.js');

try {
  const db = await getMongoDb();
  const config = getMongoConfig();
  console.log(`Mongo indexes ensured: database=${db.databaseName}, host=${config.host}`);
} finally {
  await closeMongo();
}
