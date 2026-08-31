import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';
import { randomUUID } from 'crypto';
import { COLLECTION_KEYS, normalizeDb } from './dbSchema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.resolve(__dirname, '..');

const getMongoUri = () =>
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.MONGO_URL ||
  process.env.DATABASE_URL ||
  '';

const parseCsv = (value) =>
  String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const isAutoBackupEnabled = () =>
  String(process.env.MONGO_AUTO_BACKUP_DISABLED || '').trim().toLowerCase() !==
  'true';

const getAutoBackupCollections = () => {
  const configured = parseCsv(process.env.MONGO_AUTO_BACKUP_COLLECTIONS);
  if (configured.length > 0) {
    return new Set(configured);
  }
  return new Set(COLLECTION_KEYS);
};

const getAutoBackupMinIntervalMs = () =>
  Number.parseInt(process.env.MONGO_AUTO_BACKUP_MIN_INTERVAL_MS || '300000', 10); // 5 min

const getAutoBackupMaxFiles = () =>
  Number.parseInt(process.env.MONGO_AUTO_BACKUP_MAX_FILES || '50', 10);

const getAutoBackupDir = () =>
  path.resolve(BACKEND_ROOT, 'backups', 'auto-mongo');

const lastBackupByCollection = new Map();
let cleanupPromise;

const safeFilePart = (value) =>
  String(value || '')
    .replace(/[^a-z0-9._-]+/gi, '_')
    .slice(0, 80);

const cleanupBackupDir = async (dir) => {
  if (cleanupPromise) return cleanupPromise;
  cleanupPromise = (async () => {
    try {
      const maxFiles = getAutoBackupMaxFiles();
      if (!Number.isFinite(maxFiles) || maxFiles <= 0) return;

      const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
      const files = entries.filter((e) => e.isFile()).map((e) => e.name);
      if (files.length <= maxFiles) return;

      const stats = await Promise.all(
        files.map(async (name) => {
          const filePath = path.join(dir, name);
          const st = await fs.stat(filePath).catch(() => null);
          return st ? { name, mtimeMs: st.mtimeMs } : null;
        })
      );

      const sorted = stats
        .filter(Boolean)
        .sort((a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0));

      const toDelete = sorted.slice(maxFiles);
      await Promise.all(
        toDelete.map(({ name }) =>
          fs.unlink(path.join(dir, name)).catch(() => null)
        )
      );
    } finally {
      cleanupPromise = null;
    }
  })();
  return cleanupPromise;
};

const maybeAutoBackupCollection = async (db, collectionKey, meta = {}) => {
  if (!isAutoBackupEnabled()) return;

  const allow = getAutoBackupCollections();
  if (!allow.has(collectionKey)) return;

  const now = Date.now();
  const lastAt = lastBackupByCollection.get(collectionKey) || 0;
  const minInterval = getAutoBackupMinIntervalMs();
  if (now - lastAt < minInterval) {
    return;
  }

  const dir = getAutoBackupDir();
  await fs.mkdir(dir, { recursive: true });

  // Snapshot current collection state BEFORE deleteMany/insertMany.
  const docs = await db
    .collection(collectionKey)
    .find({})
    .project({ _id: 0 })
    .toArray();

  const payload = {
    version: 1,
    createdAt: new Date(now).toISOString(),
    dbName: db.databaseName,
    collection: collectionKey,
    count: docs.length,
    meta: {
      reason: meta.reason || 'pre_replace',
      actor: meta.actor || null
    },
    docs
  };

  const stamp = new Date(now).toISOString().replace(/[:.]/g, '-');
  const filename = `auto-${safeFilePart(db.databaseName)}-${safeFilePart(collectionKey)}-${stamp}-${safeFilePart(payload.meta.reason)}.json`;
  const targetPath = path.join(dir, filename);
  await fs.writeFile(targetPath, JSON.stringify(payload, null, 2), 'utf8');

  lastBackupByCollection.set(collectionKey, now);
  cleanupBackupDir(dir).catch(() => null);

  console.log(
    `Auto-backup saved: ${targetPath} (collection=${collectionKey}, count=${docs.length})`
  );
};

const deriveMongoHostFromUri = (uri) => {
  const raw = String(uri || '').trim();
  if (!raw) return '';
  const match = raw.match(/^mongodb(?:\+srv)?:\/\/([^/]+)/i);
  if (!match) return '';
  const authority = String(match[1] || '').trim();
  if (!authority) return '';
  // Strip credentials if present: user:pass@host
  const withoutCreds = authority.includes('@')
    ? authority.slice(authority.lastIndexOf('@') + 1)
    : authority;
  return withoutCreds.trim();
};

const deriveDbNameFromUri = (uri) => {
  const raw = String(uri || '').trim();
  if (!raw) return '';

  // Example: mongodb+srv://user:pass@cluster.mongodb.net/mydb?retryWrites=true&w=majority
  const match = raw.match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]*)/i);
  if (!match) return '';
  const candidate = String(match[1] || '').trim();
  if (!candidate) return '';
  try {
    return decodeURIComponent(candidate);
  } catch (_error) {
    return candidate;
  }
};

const DEFAULT_MONGO_DB_NAME = 'versusversevault';

const resolveMongoDbName = () => {
  const explicit = String(process.env.MONGO_DB_NAME || '').trim();
  if (explicit) {
    return { dbName: explicit, source: 'env' };
  }

  const derived = deriveDbNameFromUri(getMongoUri());
  if (derived) {
    return { dbName: derived, source: 'uri' };
  }

  return { dbName: DEFAULT_MONGO_DB_NAME, source: 'default' };
};

const getMongoDbName = () => resolveMongoDbName().dbName;
const getMongoConnectTimeoutMs = () =>
  Number.parseInt(process.env.MONGO_CONNECT_TIMEOUT_MS || '10000', 10);
const getMongoCacheTtlMs = () =>
  Number.parseInt(process.env.MONGO_CACHE_TTL_MS || '0', 10);

let client;
let clientPromise;
let dbCache;
let dbCacheTimestamp = 0;
let dbCacheRevision = 0;
const collectionCache = new Map();
let indexesReadyPromise;

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

const getCollectionFromCache = (key) => {
  if (!isCacheEnabled()) return null;
  const cached = collectionCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.timestamp >= getMongoCacheTtlMs()) {
    collectionCache.delete(key);
    return null;
  }
  return cached.data;
};

const setCollectionCache = (key, data) => {
  if (!isCacheEnabled()) {
    collectionCache.delete(key);
    return;
  }
  collectionCache.set(key, { data, timestamp: Date.now() });
};

const clearCollectionCache = (key) => {
  collectionCache.delete(key);
};

const clearDatabaseCache = (collectionKey) => {
  if (collectionKey) clearCollectionCache(collectionKey);
  dbCache = undefined;
  dbCacheTimestamp = 0;
};

const ensureIndexes = async (db) => {
  if (indexesReadyPromise) return indexesReadyPromise;

  indexesReadyPromise = (async () => {
    await db.collection('_app_meta').updateOne(
      { _id: 'db_revision' },
      { $setOnInsert: { revision: 0, createdAt: new Date() } },
      { upsert: true }
    );

    const uniqueId = {
      key: { id: 1 },
      options: {
        name: 'uniq_id',
        unique: true,
        partialFilterExpression: { id: { $type: 'string' } }
      }
    };
    const indexKeysEqual = (left, right) =>
      JSON.stringify(left || {}) === JSON.stringify(right || {});
    const collationCompatible = (existing, requested) =>
      !requested ||
      (
        existing?.locale === requested.locale &&
        Number(existing?.strength) === Number(requested.strength)
      );
    const partialFilterCompatible = (existing, requested) =>
      !requested ||
      !existing ||
      JSON.stringify(existing) === JSON.stringify(requested);
    const ensureCollectionIndex = async (collection, spec) => {
      const options = spec.options || {};
      const indexes = await collection.indexes().catch(() => []);
      const compatible = indexes.some((existing) =>
        indexKeysEqual(existing.key, spec.key) &&
        (!options.unique || existing.unique === true) &&
        collationCompatible(existing.collation, options.collation) &&
        partialFilterCompatible(
          existing.partialFilterExpression,
          options.partialFilterExpression
        )
      );
      if (compatible) return false;
      await collection.createIndex(spec.key, {
        background: true,
        ...options
      });
      return true;
    };
    const specs = [
      ['users', [
        uniqueId,
        {
          key: { username: 1 },
          options: {
            name: 'uniq_username_ci',
            unique: true,
            collation: { locale: 'en', strength: 2 },
            partialFilterExpression: { username: { $type: 'string' } }
          }
        },
        {
          key: { email: 1 },
          options: {
            name: 'uniq_email_ci',
            unique: true,
            collation: { locale: 'en', strength: 2 },
            partialFilterExpression: { email: { $type: 'string' } }
          }
        },
        { key: { role: 1 } },
        { key: { 'divisions.$**': 1 } },
        { key: { 'stats.experience': -1 } },
        { key: { 'stats.points': -1, 'stats.fightsWon': -1 } },
        { key: { 'stats.fights.total': -1 } },
        { key: { 'stats.fights.wins': -1 } }
      ]],
      ['posts', [
        uniqueId,
        { key: { authorId: 1, createdAt: -1 } },
        { key: { 'moderation.deleted.isDeleted': 1, createdAt: -1 } },
        { key: { group: 1, createdAt: -1 } },
        { key: { type: 1, createdAt: -1 } },
        { key: { category: 1, createdAt: -1 } },
        { key: { isOfficial: 1, 'moderation.deleted.isDeleted': 1, createdAt: -1 } },
        { key: { 'fight.opponentId': 1, 'fight.status': 1, 'fight.expiresAt': 1 } },
        { key: { 'fight.challengerId': 1, 'fight.status': 1, createdAt: -1 } },
        {
          key: { authorId: 1, idempotencyKey: 1 },
          options: {
            name: 'uniq_post_idempotency',
            unique: true,
            partialFilterExpression: {
              authorId: { $type: 'string' },
              idempotencyKey: { $type: 'string' }
            }
          }
        }
      ]],
      ['comments', [
        uniqueId,
        { key: { postId: 1, createdAt: 1 } },
        { key: { targetId: 1, createdAt: -1 } },
        { key: { fightId: 1, createdAt: -1 } },
        { key: { authorId: 1, createdAt: -1 } },
        { key: { type: 1 } },
        { key: { threadId: 1, parentId: 1 } },
        {
          key: { authorId: 1, targetId: 1, idempotencyKey: 1 },
          options: {
            name: 'uniq_comment_idempotency',
            unique: true,
            partialFilterExpression: {
              authorId: { $type: 'string' },
              targetId: { $type: 'string' },
              idempotencyKey: { $type: 'string' }
            }
          }
        }
      ]],
      ['messages', [
        uniqueId,
        { key: { senderId: 1, recipientId: 1, createdAt: -1 } },
        { key: { recipientId: 1, read: 1, deleted: 1 } },
        { key: { conversationId: 1, createdAt: 1 } },
        { key: { conversationId: 1, recipientId: 1, read: 1 } }
      ]],
      ['chatMessages', [uniqueId, { key: { createdAt: -1 } }]],
      ['conversations', [
        uniqueId,
        { key: { participants: 1, updatedAt: -1 } },
        {
          key: { participantKey: 1 },
          options: {
            name: 'uniq_participant_key',
            unique: true,
            partialFilterExpression: { participantKey: { $type: 'string' } }
          }
        }
      ]],
      ['notifications', [uniqueId, { key: { userId: 1, read: 1, createdAt: -1 } }]],
      ['friendRequests', [
        uniqueId,
        { key: { fromUserId: 1, toUserId: 1, status: 1 } },
        { key: { toUserId: 1, status: 1, createdAt: -1 } },
        {
          key: { requestKey: 1 },
          options: {
            name: 'uniq_pending_friend_request',
            unique: true,
            partialFilterExpression: {
              requestKey: { $type: 'string' },
              status: 'pending'
            }
          }
        }
      ]],
      ['friendships', [
        uniqueId,
        { key: { userId1: 1, userId2: 1 } },
        { key: { userId1: 1 } },
        { key: { userId2: 1 } },
        {
          key: { friendshipKey: 1 },
          options: {
            name: 'uniq_friendship_key',
            unique: true,
            partialFilterExpression: { friendshipKey: { $type: 'string' } }
          }
        }
      ]],
      ['blocks', [
        uniqueId,
        { key: { blockerId: 1, blockedId: 1 } },
        { key: { blockerId: 1 } },
        {
          key: { blockKey: 1 },
          options: {
            name: 'uniq_block_key',
            unique: true,
            partialFilterExpression: { blockKey: { $type: 'string' } }
          }
        }
      ]],
      ['feedback', [uniqueId, { key: { status: 1, createdAt: -1 } }, { key: { type: 1 } }]],
      ['tournaments', [
        uniqueId,
        { key: { status: 1, createdAt: -1 } },
        { key: { status: 1, id: 1 } },
        { key: { status: 1, recruitmentEndDate: 1 } },
        { key: { createdBy: 1, createdAt: -1 } },
        { key: { 'participants.userId': 1 } }
      ]],
      ['fights', [
        uniqueId,
        { key: { status: 1, createdAt: -1 } },
        { key: { isOfficial: 1, createdAt: -1 } },
        { key: { category: 1, createdAt: -1 } },
        { key: { 'participants.userId': 1, createdAt: -1 } },
        { key: { userId: 1, createdAt: -1 } },
        { key: { createdBy: 1, createdAt: -1 } }
      ]],
      ['votes', [
        uniqueId,
        { key: { fightId: 1, team: 1, createdAt: -1 } },
        { key: { userId: 1, createdAt: -1 } },
        {
          key: { fightId: 1, userId: 1 },
          options: {
            name: 'uniq_fight_user_vote',
            unique: true,
            partialFilterExpression: {
              fightId: { $type: 'string' },
              userId: { $type: 'string' }
            }
          }
        }
      ]],
      ['divisionFights', [
        uniqueId,
        { key: { divisionId: 1, status: 1, createdAt: -1 } },
        { key: { divisionId: 1, fightType: 1, status: 1, createdAt: -1 } },
        { key: { status: 1, endTime: 1 } },
        { key: { bettingCloses: 1, createdAt: -1 } },
        { key: { 'team1.userId': 1, createdAt: -1 } },
        { key: { 'team2.userId': 1, createdAt: -1 } }
      ]],
      ['divisionSeasons', [uniqueId, { key: { isLocked: 1, startAt: 1, endAt: 1 } }]],
      ['divisionTeamSlots', [
        uniqueId,
        { key: { divisionId: 1, userId: 1 } },
        {
          key: { divisionId: 1, characterId: 1 },
          options: {
            name: 'uniq_division_character_slot',
            unique: true,
            partialFilterExpression: {
              divisionId: { $type: 'string' },
              characterId: { $type: 'string' }
            }
          }
        }
      ]],
      ['characters', [
        uniqueId,
        { key: { name: 1 } },
        { key: { division: 1, universe: 1, name: 1 } }
      ]],
      ['badges', [
        uniqueId,
        { key: { isActive: 1, category: 1, rarity: 1 } }
      ]],
      ['userBadges', [
        uniqueId,
        { key: { userId: 1, isActive: 1, earnedAt: -1 } },
        { key: { badgeId: 1, isActive: 1, earnedAt: 1 } },
        { key: { userId: 1, type: 1, displayOnProfile: 1, wonAt: -1 } },
        {
          key: { userId: 1, badgeId: 1 },
          options: {
            name: 'uniq_user_badge',
            unique: true,
            partialFilterExpression: {
              userId: { $type: 'string' },
              badgeId: { $type: 'string' }
            }
          }
        }
      ]],
      ['bets', [
        uniqueId,
        { key: { fightId: 1, status: 1, createdAt: -1 } },
        { key: { userId: 1, status: 1, createdAt: -1 } },
        { key: { createdAt: -1 } }
      ]],
      ['coinTransactions', [uniqueId, { key: { userId: 1, createdAt: -1 } }]],
      ['storePurchases', [uniqueId, { key: { userId: 1, purchasedAt: -1 } }]],
      ['challengeProgress', [
        uniqueId,
        {
          key: { userId: 1 },
          options: {
            name: 'uniq_challenge_progress_user',
            unique: true,
            partialFilterExpression: { userId: { $type: 'string' } }
          }
        }
      ]],
      ['legalConsents', [uniqueId, { key: { userId: 1, createdAt: -1 } }]],
      ['emailVerificationTokens', [
        uniqueId,
        { key: { userId: 1, usedAt: 1, expiresAt: 1 } },
        {
          key: { tokenHash: 1 },
          options: {
            name: 'uniq_verification_token_hash',
            unique: true,
            partialFilterExpression: { tokenHash: { $type: 'string' } }
          }
        }
      ]],
      ['authChallenges', [
        uniqueId,
        { key: { userId: 1, purpose: 1, expiresAt: 1 } },
        { key: { token: 1 } }
      ]],
      ['pushSubscriptions', [
        uniqueId,
        { key: { userId: 1 } },
        {
          key: { 'subscription.endpoint': 1 },
          options: {
            name: 'uniq_push_endpoint',
            unique: true,
            partialFilterExpression: { 'subscription.endpoint': { $type: 'string' } }
          }
        }
      ]],
      ['nicknameChangeLogs', [{ key: { userId: 1, changedAt: -1 } }, { key: { username: 1, changedAt: -1 } }]],
      ['moderatorActionLogs', [uniqueId, { key: { createdAt: -1 } }, { key: { actorId: 1, createdAt: -1 } }, { key: { targetType: 1, createdAt: -1 } }]],
      ['swoopRuns', [
        uniqueId,
        { key: { trackId: 1, timeMs: 1, collisions: 1 } },
        {
          key: { userId: 1, trackId: 1 },
          options: {
            name: 'uniq_user_track',
            unique: true,
            partialFilterExpression: {
              userId: { $type: 'string' },
              trackId: { $type: 'string' }
            }
          }
        }
      ]],
      ['tronWins', [
        uniqueId,
        { key: { monthKey: 1, wonAt: -1 } },
        { key: { userId: 1, monthKey: 1 } },
        {
          key: { roomId: 1, round: 1, userId: 1 },
          options: {
            name: 'uniq_room_round_winner',
            unique: true,
            partialFilterExpression: {
              roomId: { $type: 'string' },
              round: { $type: 'number' },
              userId: { $type: 'string' }
            }
          }
        }
      ]],
      ['characterMedia', [
        {
          key: { characterId: 1 },
          options: {
            name: 'uniq_character_media',
            unique: true
          }
        },
        { key: { updatedAt: -1 } }
      ]]
    ];

    for (const collectionName of COLLECTION_KEYS) {
      try {
        await ensureCollectionIndex(db.collection(collectionName), uniqueId);
      } catch (error) {
        console.error(
          `Unique id index ensure failed for ${collectionName}:`,
          error?.message || error
        );
        if (process.env.NODE_ENV === 'production') throw error;
      }
    }

    for (const [collectionName, indexes] of specs) {
      try {
        const collection = db.collection(collectionName);
        for (const index of indexes) {
          await ensureCollectionIndex(collection, index);
        }
      } catch (error) {
        console.error(`Index ensure failed for ${collectionName}:`, error?.message || error);
        if (process.env.NODE_ENV === 'production') {
          throw error;
        }
      }
    }

  })();

  return indexesReadyPromise;
};

const ensureMongoUri = () => {
  const uri = getMongoUri();
  if (!uri || typeof uri !== 'string' || !uri.trim()) {
    throw new Error(
      'MongoDB is enabled but no connection string is set. Provide one of: MONGO_URI, MONGODB_URI, MONGO_URL, DATABASE_URL.'
    );
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

  clientPromise = client
    .connect()
    .then(async () => {
      const db = client.db(getMongoDbName());
      await ensureIndexes(db);
      return client;
    })
    .catch((error) => {
      clientPromise = undefined;
      client = undefined;
      throw error;
    });
  return clientPromise;
};

const getDb = async () => {
  const activeClient = await getClient();
  return activeClient.db(getMongoDbName());
};

export const getMongoDb = async () => getDb();

export const withMongoTransaction = async (handler) => {
  if (typeof handler !== 'function') {
    throw new TypeError('Mongo transaction handler must be a function.');
  }
  const activeClient = await getClient();
  const mongoDb = activeClient.db(getMongoDbName());
  const session = activeClient.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      result = await handler({ mongoDb, session });
    });
    return result;
  } finally {
    await session.endSession();
    for (const key of COLLECTION_KEYS) clearCollectionCache(key);
  }
};

export const findMongoDocument = async (
  collectionKey,
  filter,
  options = {}
) => {
  assertCollectionKey(collectionKey);
  const db = await getDb();
  const document = await db.collection(collectionKey).findOne(filter || {}, {
    projection: options.projection,
    collation: options.collation
  });
  return document ? stripMongoId(document) : null;
};

export const findMongoDocuments = async (
  collectionKey,
  filter = {},
  options = {}
) => {
  assertCollectionKey(collectionKey);
  const db = await getDb();
  let cursor = db.collection(collectionKey).find(filter, {
    projection: options.projection,
    collation: options.collation
  });
  if (options.sort) cursor = cursor.sort(options.sort);
  if (Number.isFinite(options.skip) && options.skip > 0) {
    cursor = cursor.skip(Math.floor(options.skip));
  }
  if (Number.isFinite(options.limit) && options.limit > 0) {
    cursor = cursor.limit(Math.floor(options.limit));
  }
  return (await cursor.toArray()).map(stripMongoId);
};

export const countMongoDocuments = async (collectionKey, filter = {}) => {
  assertCollectionKey(collectionKey);
  const db = await getDb();
  return db.collection(collectionKey).countDocuments(filter);
};

export const distinctMongoValues = async (
  collectionKey,
  field,
  filter = {}
) => {
  assertCollectionKey(collectionKey);
  const db = await getDb();
  return db.collection(collectionKey).distinct(field, filter);
};

export const aggregateMongoDocuments = async (
  collectionKey,
  pipeline = []
) => {
  assertCollectionKey(collectionKey);
  const db = await getDb();
  return db.collection(collectionKey).aggregate(pipeline).toArray();
};

export const insertMongoDocument = async (collectionKey, rawDocument) => {
  assertCollectionKey(collectionKey);
  const db = await getDb();
  const document = sanitizeDoc(rawDocument);
  if (!resolveDocumentId(document)) document.id = randomUUID();
  await db.collection(collectionKey).insertOne(document);
  clearDatabaseCache(collectionKey);
  return cloneData(document);
};

export const upsertMongoDocument = async (
  collectionKey,
  filter,
  rawDocument
) => {
  assertCollectionKey(collectionKey);
  const db = await getDb();
  const document = sanitizeDoc(rawDocument);
  if (!resolveDocumentId(document)) document.id = randomUUID();
  const result = await db.collection(collectionKey).updateOne(
    filter || {},
    { $setOnInsert: document },
    { upsert: true }
  );
  const stored = await db.collection(collectionKey).findOne(filter || {});
  clearDatabaseCache(collectionKey);
  return {
    item: stored ? stripMongoId(stored) : cloneData(document),
    inserted: result.upsertedCount === 1
  };
};

export const insertMongoDocumentsAtomically = async (entries = []) => {
  const normalizedEntries = entries.map(({ collectionKey, document }) => {
    assertCollectionKey(collectionKey);
    const sanitized = sanitizeDoc(document);
    if (!resolveDocumentId(sanitized)) sanitized.id = randomUUID();
    return { collectionKey, document: sanitized };
  });
  if (normalizedEntries.length === 0) return [];

  const activeClient = await getClient();
  const db = activeClient.db(getMongoDbName());
  const session = activeClient.startSession();
  try {
    await session.withTransaction(async () => {
      for (const entry of normalizedEntries) {
        await db.collection(entry.collectionKey).insertOne(entry.document, { session });
      }
    });
  } finally {
    await session.endSession();
  }
  for (const { collectionKey } of normalizedEntries) {
    clearDatabaseCache(collectionKey);
  }
  return cloneData(normalizedEntries.map((entry) => entry.document));
};

export const updateMongoDocument = async (
  collectionKey,
  filter,
  updater,
  options = {}
) => {
  assertCollectionKey(collectionKey);
  if (typeof updater !== 'function') {
    throw new TypeError('Mongo document updater must be a function.');
  }

  const activeClient = await getClient();
  const db = activeClient.db(getMongoDbName());
  const session = activeClient.startSession();
  let result = null;
  try {
    await session.withTransaction(async () => {
      const currentRaw = await db.collection(collectionKey).findOne(filter || {}, {
        session,
        collation: options.collation
      });
      if (!currentRaw) {
        result = null;
        return;
      }

      const current = stripMongoId(currentRaw);
      const draft = cloneData(current);
      const updated = await updater(draft);
      const replacement = sanitizeDoc(
        updated && typeof updated === 'object' ? updated : draft
      );
      replacement.id = resolveDocumentId(replacement) || current.id || randomUUID();

      await db.collection(collectionKey).replaceOne(
        { _id: currentRaw._id },
        replacement,
        { session }
      );
      result = replacement;
    });
  } finally {
    await session.endSession();
  }

  clearDatabaseCache(collectionKey);
  return result ? cloneData(result) : null;
};

export const removeMongoDocument = async (
  collectionKey,
  filter,
  options = {}
) => {
  assertCollectionKey(collectionKey);
  const db = await getDb();
  const result = await db.collection(collectionKey).findOneAndDelete(filter || {}, {
    collation: options.collation
  });
  clearDatabaseCache(collectionKey);
  return result ? stripMongoId(result) : null;
};

export const removeMongoDocuments = async (
  collectionKey,
  filter
) => {
  assertCollectionKey(collectionKey);
  const db = await getDb();
  const result = await db.collection(collectionKey).deleteMany(filter || {});
  clearDatabaseCache(collectionKey);
  return { deletedCount: result.deletedCount };
};

export const patchMongoDocuments = async (
  collectionKey,
  filter,
  patch
) => {
  assertCollectionKey(collectionKey);
  const db = await getDb();
  const result = await db.collection(collectionKey).updateMany(
    filter || {},
    { $set: sanitizeDoc(patch || {}) }
  );
  clearDatabaseCache(collectionKey);
  return {
    matchedCount: result.matchedCount,
    modifiedCount: result.modifiedCount
  };
};

export const unsetMongoDocumentPaths = async (
  collectionKey,
  filter,
  paths
) => {
  assertCollectionKey(collectionKey);
  const safePaths = (Array.isArray(paths) ? paths : [])
    .map(String)
    .filter(Boolean);
  if (!safePaths.length) return { matchedCount: 0, modifiedCount: 0 };
  const db = await getDb();
  const result = await db.collection(collectionKey).updateMany(
    filter || {},
    { $unset: Object.fromEntries(safePaths.map((path) => [path, ''])) }
  );
  clearDatabaseCache(collectionKey);
  return {
    matchedCount: result.matchedCount,
    modifiedCount: result.modifiedCount
  };
};

export const verifyMongoTransactions = async () => {
  const db = await getDb();
  const activeClient = await getClient();
  const session = activeClient.startSession();
  try {
    await session.withTransaction(async () => {
      await db
        .collection('_app_meta')
        .findOne({ _id: 'db_revision' }, { session });
    });
  } catch (error) {
    throw new Error(
      `MongoDB transactions are unavailable. Production requires a replica set or sharded cluster: ${error?.message || error}`,
      { cause: error }
    );
  } finally {
    await session.endSession();
  }
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

const assertCollectionKey = (collectionKey) => {
  if (!COLLECTION_KEYS.includes(collectionKey)) {
    throw new Error(`Unknown collection: ${collectionKey}`);
  }
};

const resolveDocumentId = (document) =>
  document && typeof document.id === 'string' && document.id.trim()
    ? document.id.trim()
    : null;

export const buildCollectionDiff = (beforeItems = [], afterItems = []) => {
  const beforeById = new Map();
  const afterById = new Map();

  for (const raw of beforeItems) {
    const document = sanitizeDoc(raw);
    const id = resolveDocumentId(document);
    if (!id) continue;
    beforeById.set(id, document);
  }

  for (const raw of afterItems) {
    const document = sanitizeDoc(raw);
    const id = resolveDocumentId(document) || randomUUID();
    if (afterById.has(id)) {
      const error = new Error(`Duplicate document id in collection update: ${id}`);
      error.code = 'DUPLICATE_DOCUMENT_ID';
      throw error;
    }
    document.id = id;
    afterById.set(id, document);
  }

  const upserts = [];
  for (const [id, document] of afterById) {
    const previous = beforeById.get(id);
    if (!previous || JSON.stringify(previous) !== JSON.stringify(document)) {
      upserts.push(document);
    }
  }

  const removedIds = [];
  for (const id of beforeById.keys()) {
    if (!afterById.has(id)) removedIds.push(id);
  }

  return {
    upserts,
    removedIds,
    documents: [...afterById.values()]
  };
};

const applyCollectionDiff = async (
  db,
  collectionKey,
  beforeItems,
  afterItems,
  { session } = {}
) => {
  const diff = buildCollectionDiff(beforeItems, afterItems);
  const collection = db.collection(collectionKey);
  const operations = [
    ...diff.upserts.map((document) => ({
      replaceOne: {
        filter: { id: document.id },
        replacement: document,
        upsert: true
      }
    })),
    ...diff.removedIds.map((id) => ({
      deleteOne: { filter: { id } }
    }))
  ];

  if (operations.length > 0) {
    await collection.bulkWrite(operations, { ordered: false, session });
  }
  return diff.documents;
};

const normalizeItemsWithIds = (items) =>
  items.map((item) => {
    const sanitized = sanitizeDoc(item);
    if (!sanitized.id || typeof sanitized.id !== 'string') {
      sanitized.id = randomUUID();
    }
    return sanitized;
  });

const replaceCollection = async (db, key, items, { session } = {}) => {
  try {
    await maybeAutoBackupCollection(db, key, { reason: 'replace_collection' });
  } catch (error) {
    // Best-effort safety net: never break the request flow due to backup issues.
    console.error(
      `Auto-backup failed for collection ${key}:`,
      error?.message || error
    );
  }

  const collection = db.collection(key);
  const docs = normalizeItemsWithIds(items);
  if (docs.length > 0) {
    await collection.bulkWrite(
      docs.map((doc) => ({
        replaceOne: {
          filter: { id: doc.id },
          replacement: doc,
          upsert: true
        }
      })),
      { ordered: false, session }
    );
  }
  const ids = docs.map((doc) => doc.id);
  await collection.deleteMany(
    ids.length > 0 ? { id: { $nin: ids } } : {},
    { session }
  );
  return docs;
};

const loadDbSnapshot = async ({ session, collectionKeys = COLLECTION_KEYS } = {}) => {
  const db = await getDb();
  const [entries, revisionRecord] = await Promise.all([
    Promise.all(
      collectionKeys.map(async (key) => {
        const docs = await db.collection(key).find({}, { session }).toArray();
        return [key, docs.map(stripMongoId)];
      })
    ),
    db.collection('_app_meta').findOne({ _id: 'db_revision' }, { session })
  ]);
  const data = collectionKeys.length === COLLECTION_KEYS.length
    ? normalizeDb(Object.fromEntries(entries))
    : Object.fromEntries(entries);
  return {
    data,
    revision: Number(revisionRecord?.revision || 0)
  };
};

export const readDb = async () => {
  if (hasFreshCache()) {
    return cloneData(dbCache);
  }

  const snapshot = await loadDbSnapshot();
  const normalized = snapshot.data;
  setCache(normalized);
  dbCacheRevision = snapshot.revision;
  for (const key of COLLECTION_KEYS) {
    setCollectionCache(key, normalized[key] || []);
  }
  return cloneData(normalized);
};

export const readCollection = async (collectionKey) => {
  if (!COLLECTION_KEYS.includes(collectionKey)) {
    throw new Error(`Unknown collection: ${collectionKey}`);
  }
  const cached = getCollectionFromCache(collectionKey);
  if (cached) {
    return cloneData(cached);
  }

  const db = await getDb();
  const docs = await db.collection(collectionKey).find({}).toArray();
  const normalized = docs.map(stripMongoId);
  setCollectionCache(collectionKey, normalized);
  return cloneData(normalized);
};

export const writeDb = async (data) => {
  const normalized = normalizeDb(data);
  const db = await getDb();
  const snapshot = await loadDbSnapshot();
  const committed = await commitCollections(
    db,
    COLLECTION_KEYS.map((key) => [key, normalized[key]]),
    snapshot.revision
  );

  setCache(committed);
  for (const key of COLLECTION_KEYS) {
    setCollectionCache(key, normalized[key] || []);
  }
  return cloneData(committed);
};

const commitCollections = async (db, entries, expectedRevision) => {
  const activeClient = await getClient();
  const session = activeClient.startSession();
  const committed = {};
  try {
    await session.withTransaction(async () => {
      const revisionUpdate = await db.collection('_app_meta').updateOne(
        { _id: 'db_revision', revision: expectedRevision },
        { $inc: { revision: 1 }, $set: { updatedAt: new Date() } },
        { session }
      );
      if (revisionUpdate.modifiedCount !== 1) {
        const error = new Error('Concurrent database update detected');
        error.code = 'WRITE_CONFLICT';
        throw error;
      }

      for (const [key, items] of entries) {
        committed[key] = await replaceCollection(db, key, items, { session });
      }
    });
    dbCacheRevision = expectedRevision + 1;
    return committed;
  } catch (error) {
    if (error?.code === 11000) {
      error.code = 'WRITE_CONFLICT';
    }
    throw error;
  } finally {
    await session.endSession();
  }
};

export const updateCollection = async (collectionKey, mutator) => {
  assertCollectionKey(collectionKey);
  const activeClient = await getClient();
  const db = activeClient.db(getMongoDbName());
  const session = activeClient.startSession();
  let result = [];
  try {
    await session.withTransaction(async () => {
      const documents = await db
        .collection(collectionKey)
        .find({}, { session })
        .toArray();
      const before = documents.map(stripMongoId);
      const working = cloneData(before);
      const next = await mutator(working);
      const resolved = Array.isArray(next) ? next : working;
      result = await applyCollectionDiff(
        db,
        collectionKey,
        before,
        resolved,
        { session }
      );
    });
  } finally {
    await session.endSession();
  }
  clearDatabaseCache(collectionKey);
  return cloneData(result);
};

export const updateDb = async (mutator) => {
  const activeClient = await getClient();
  const db = activeClient.db(getMongoDbName());
  const session = activeClient.startSession();
  let updated = normalizeDb({});
  try {
    await session.withTransaction(async () => {
      const snapshot = await loadDbSnapshot({ session });
      const original = snapshot.data;
      const working = cloneData(original);
      await mutator(working);
      updated = normalizeDb(working);

      for (const key of COLLECTION_KEYS) {
        if (JSON.stringify(original[key] || []) === JSON.stringify(updated[key] || [])) {
          continue;
        }
        updated[key] = await applyCollectionDiff(
          db,
          key,
          original[key] || [],
          updated[key] || [],
          { session }
        );
      }
    });
  } finally {
    await session.endSession();
  }

  for (const key of COLLECTION_KEYS) clearCollectionCache(key);
  setCache(updated);
  return cloneData(updated);
};

export const closeMongo = async () => {
  if (client) {
    await client.close();
    client = undefined;
    clientPromise = undefined;
  }
  dbCache = undefined;
  dbCacheTimestamp = 0;
  dbCacheRevision = 0;
  collectionCache.clear();
  indexesReadyPromise = undefined;
};

export const getMongoConfig = () => ({
  uri: getMongoUri(),
  dbName: getMongoDbName(),
  dbNameSource: resolveMongoDbName().source,
  host: deriveMongoHostFromUri(getMongoUri()),
  connectTimeoutMs: getMongoConnectTimeoutMs(),
  cacheTtlMs: getMongoCacheTtlMs()
});
