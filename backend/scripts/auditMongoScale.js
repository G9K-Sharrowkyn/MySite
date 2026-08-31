import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';
import { COLLECTION_KEYS } from '../services/dbSchema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(backendRoot, '.env') });
dotenv.config({ path: path.join(backendRoot, '.env.production') });

const uri =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.MONGO_URL ||
  process.env.DATABASE_URL ||
  '';

if (!uri) {
  throw new Error('Set MONGO_URI before running the Mongo scalability audit.');
}

const deriveDbName = () => {
  if (process.env.MONGO_DB_NAME) return process.env.MONGO_DB_NAME;
  const match = uri.match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]*)/i);
  return match?.[1] ? decodeURIComponent(match[1]) : 'versusversevault';
};

const findDuplicates = async (collection, match, expression) =>
  collection
    .aggregate([
      { $match: match },
      { $group: { _id: expression, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 20 }
    ])
    .toArray();

const hasUniqueIndex = (indexes, key, collation = null) =>
  indexes.some((index) => {
    if (!index.unique || JSON.stringify(index.key) !== JSON.stringify(key)) return false;
    if (!collation) return true;
    return (
      index.collation?.locale === collation.locale &&
      Number(index.collation?.strength) === Number(collation.strength)
    );
  });

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
let blockers = 0;

const requiredUniqueIndexes = [
  {
    collection: 'users',
    label: 'case-insensitive email',
    key: { email: 1 },
    collation: { locale: 'en', strength: 2 },
    match: { email: { $type: 'string' } },
    group: { $toLower: '$email' }
  },
  {
    collection: 'users',
    label: 'case-insensitive username',
    key: { username: 1 },
    collation: { locale: 'en', strength: 2 },
    match: { username: { $type: 'string' } },
    group: { $toLower: '$username' }
  },
  {
    collection: 'posts',
    label: 'author/idempotency key',
    key: { authorId: 1, idempotencyKey: 1 },
    match: {
      authorId: { $type: 'string' },
      idempotencyKey: { $type: 'string' }
    },
    group: { authorId: '$authorId', idempotencyKey: '$idempotencyKey' }
  },
  {
    collection: 'comments',
    label: 'author/target/idempotency key',
    key: { authorId: 1, targetId: 1, idempotencyKey: 1 },
    match: {
      authorId: { $type: 'string' },
      targetId: { $type: 'string' },
      idempotencyKey: { $type: 'string' }
    },
    group: {
      authorId: '$authorId',
      targetId: '$targetId',
      idempotencyKey: '$idempotencyKey'
    }
  },
  {
    collection: 'conversations',
    label: 'participant key',
    key: { participantKey: 1 },
    match: { participantKey: { $type: 'string' } },
    group: '$participantKey'
  },
  {
    collection: 'friendRequests',
    label: 'pending friend request',
    key: { requestKey: 1 },
    match: { requestKey: { $type: 'string' }, status: 'pending' },
    group: '$requestKey'
  },
  {
    collection: 'friendships',
    label: 'friendship key',
    key: { friendshipKey: 1 },
    match: { friendshipKey: { $type: 'string' } },
    group: '$friendshipKey'
  },
  {
    collection: 'blocks',
    label: 'block key',
    key: { blockKey: 1 },
    match: { blockKey: { $type: 'string' } },
    group: '$blockKey'
  },
  {
    collection: 'votes',
    label: 'fight/user vote',
    key: { fightId: 1, userId: 1 },
    match: { fightId: { $type: 'string' }, userId: { $type: 'string' } },
    group: { fightId: '$fightId', userId: '$userId' }
  },
  {
    collection: 'divisionTeamSlots',
    label: 'division character slot',
    key: { divisionId: 1, characterId: 1 },
    match: {
      divisionId: { $type: 'string' },
      characterId: { $type: 'string' }
    },
    group: { divisionId: '$divisionId', characterId: '$characterId' }
  },
  {
    collection: 'userBadges',
    label: 'user badge',
    key: { userId: 1, badgeId: 1 },
    match: { userId: { $type: 'string' }, badgeId: { $type: 'string' } },
    group: { userId: '$userId', badgeId: '$badgeId' }
  },
  {
    collection: 'challengeProgress',
    label: 'challenge progress user',
    key: { userId: 1 },
    match: { userId: { $type: 'string' } },
    group: '$userId'
  },
  {
    collection: 'emailVerificationTokens',
    label: 'verification token hash',
    key: { tokenHash: 1 },
    match: { tokenHash: { $type: 'string' } },
    group: '$tokenHash'
  },
  {
    collection: 'pushSubscriptions',
    label: 'push endpoint',
    key: { 'subscription.endpoint': 1 },
    match: { 'subscription.endpoint': { $type: 'string' } },
    group: '$subscription.endpoint'
  },
  {
    collection: 'characterMedia',
    label: 'character media record',
    key: { characterId: 1 },
    match: { characterId: { $type: 'string' } },
    group: '$characterId'
  },
  {
    collection: 'swoopRuns',
    label: 'user/track result',
    key: { userId: 1, trackId: 1 },
    match: { userId: { $type: 'string' }, trackId: { $type: 'string' } },
    group: { userId: '$userId', trackId: '$trackId' }
  },
  {
    collection: 'tronWins',
    label: 'room/round/winner',
    key: { roomId: 1, round: 1, userId: 1 },
    match: {
      roomId: { $type: 'string' },
      round: { $type: 'number' },
      userId: { $type: 'string' }
    },
    group: { roomId: '$roomId', round: '$round', userId: '$userId' }
  }
];

try {
  await client.connect();
  const db = client.db(deriveDbName());
  console.log(`Mongo scalability audit: database=${db.databaseName}`);

  for (const collectionName of COLLECTION_KEYS) {
    const collection = db.collection(collectionName);
    const indexes = await collection.indexes().catch(() => []);
    if (!hasUniqueIndex(indexes, { id: 1 })) {
      blockers += 1;
      console.error(`[BLOCKER] ${collectionName}: missing unique id index.`);
    }
    const duplicates = await findDuplicates(
      collection,
      { id: { $type: 'string' } },
      '$id'
    );
    if (duplicates.length > 0) {
      blockers += 1;
      console.error(
        `[BLOCKER] ${collectionName}: ${duplicates.length} duplicate id group(s) found.`
      );
    }
  }

  for (const spec of requiredUniqueIndexes) {
    const collection = db.collection(spec.collection);
    const indexes = await collection.indexes().catch(() => []);
    const duplicates = await findDuplicates(collection, spec.match, spec.group);
    if (duplicates.length > 0) {
      blockers += 1;
      console.error(
        `[BLOCKER] ${spec.collection}: ${duplicates.length} duplicate ${spec.label} group(s) found.`
      );
    }
    if (!hasUniqueIndex(indexes, spec.key, spec.collation)) {
      blockers += 1;
      console.error(
        `[BLOCKER] ${spec.collection}: missing unique ${spec.label} index.`
      );
    }
  }

  if (blockers > 0) {
    console.error(`Mongo scalability audit failed with ${blockers} blocker(s). No data was changed.`);
    process.exitCode = 1;
  } else {
    console.log('Mongo scalability audit passed. No data was changed.');
  }
} finally {
  await client.close();
}
