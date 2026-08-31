import {
  readDb,
  swoopRunsRepo,
  usersRepo,
  withDb
} from '../repositories/index.js';
import { isMongoMode } from './jsonDb.js';

const resolveUserId = (user) => user?.id || user?._id || null;

export const compareSwoopRuns = (left, right) =>
  left.timeMs - right.timeMs ||
  left.collisions - right.collisions ||
  new Date(left.updatedAt || 0).getTime() - new Date(right.updatedAt || 0).getTime();

export const buildSwoopLeaderboard = (db, trackId, limit = 100) => {
  const usersById = new Map(
    (db.users || []).map((user) => [resolveUserId(user), user])
  );
  return (db.swoopRuns || [])
    .filter((run) => run.trackId === trackId)
    .sort(compareSwoopRuns)
    .slice(0, limit)
    .map((run, index) => {
      const user = usersById.get(run.userId);
      return {
        rank: index + 1,
        userId: run.userId,
        nickname:
          user?.displayName ||
          user?.profile?.displayName ||
          user?.username ||
          run.nickname ||
          'Racer',
        trackId: run.trackId,
        timeMs: run.timeMs,
        collisions: run.collisions,
        updatedAt: run.updatedAt
      };
    });
};

export const getSwoopLeaderboard = async (trackId, limit = 100) => {
  if (!isMongoMode()) {
    return buildSwoopLeaderboard(await readDb(), trackId, limit);
  }
  const { aggregateMongoDocuments } = await import('./mongoDb.js');
  const rows = await aggregateMongoDocuments('swoopRuns', [
    { $match: { trackId } },
    { $sort: { timeMs: 1, collisions: 1, updatedAt: 1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: 'id',
        as: 'user'
      }
    },
    { $set: { user: { $first: '$user' } } },
    {
      $project: {
        _id: 0,
        userId: 1,
        trackId: 1,
        timeMs: 1,
        collisions: 1,
        updatedAt: 1,
        nickname: {
          $ifNull: [
            '$user.displayName',
            {
              $ifNull: [
                '$user.profile.displayName',
                { $ifNull: ['$user.username', '$nickname'] }
              ]
            }
          ]
        }
      }
    }
  ]);
  return rows.map((entry, index) => ({ rank: index + 1, ...entry }));
};

export const saveSwoopBest = async ({ userId, nickname, trackId, timeMs, collisions }) => {
  const user = await usersRepo.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.code = 'USER_NOT_FOUND';
    throw error;
  }
  const now = new Date().toISOString();
  const displayName =
    user.displayName || user.profile?.displayName || user.username || nickname || 'Racer';

  if (isMongoMode()) {
    const { getMongoDb } = await import('./mongoDb.js');
    const db = await getMongoDb();
    let accepted = false;
    try {
      const result = await db.collection('swoopRuns').updateOne(
        {
          userId,
          trackId,
          $or: [
            { timeMs: { $gt: timeMs } },
            { timeMs, collisions: { $gt: collisions } }
          ]
        },
        {
          $setOnInsert: { id: `${userId}:${trackId}`, userId, trackId, createdAt: now },
          $set: { nickname: displayName, timeMs, collisions, updatedAt: now }
        },
        { upsert: true }
      );
      accepted = result.upsertedCount === 1 || result.modifiedCount === 1;
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
    const personalBest = await swoopRunsRepo.findOneBy({ userId, trackId });
    return { accepted, personalBest };
  }

  let accepted = false;
  let personalBest = null;
  await withDb(async (db) => {
    db.swoopRuns = Array.isArray(db.swoopRuns) ? db.swoopRuns : [];
    const existingIndex = db.swoopRuns.findIndex(
      (run) => run.userId === userId && run.trackId === trackId
    );
    const existing = existingIndex >= 0 ? db.swoopRuns[existingIndex] : null;
    const candidate = {
      id: existing?.id || `${userId}:${trackId}`,
      userId,
      nickname: displayName,
      trackId,
      timeMs,
      collisions,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };
    if (!existing || compareSwoopRuns(candidate, existing) < 0) {
      if (existingIndex >= 0) db.swoopRuns[existingIndex] = candidate;
      else db.swoopRuns.push(candidate);
      personalBest = candidate;
      accepted = true;
    } else {
      personalBest = existing;
    }
    return db;
  });
  return { accepted, personalBest };
};
