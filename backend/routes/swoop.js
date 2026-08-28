import express from 'express';
import auth from '../middleware/auth.js';
import { readDb, withDb } from '../repositories/index.js';

const router = express.Router();

const TRACK_IDS = new Set(['taris', 'tatooine', 'manaan', 'korriban']);
const MIN_RACE_TIME_MS = 15_000;
const MAX_RACE_TIME_MS = 10 * 60_000;
const MAX_COLLISIONS = 1_000;
const LEADERBOARD_LIMIT = 100;

const resolveUserId = (user) => user?.id || user?._id || null;

const normalizeTrackId = (value) => {
  const trackId = String(value || '').trim().toLowerCase();
  return TRACK_IDS.has(trackId) ? trackId : null;
};

const normalizeInteger = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
};

const compareRuns = (left, right) =>
  left.timeMs - right.timeMs ||
  left.collisions - right.collisions ||
  new Date(left.updatedAt || 0).getTime() - new Date(right.updatedAt || 0).getTime();

const buildLeaderboard = (db, trackId) => {
  const usersById = new Map(
    (db.users || []).map((user) => [resolveUserId(user), user])
  );

  return (db.swoopRuns || [])
    .filter((run) => run.trackId === trackId)
    .sort(compareRuns)
    .slice(0, LEADERBOARD_LIMIT)
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

router.get('/leaderboard/:trackId', async (req, res) => {
  const trackId = normalizeTrackId(req.params.trackId);
  if (!trackId) {
    return res.status(400).json({ message: 'Unknown swoop track.' });
  }

  try {
    const db = await readDb();
    return res.json({
      trackId,
      limit: LEADERBOARD_LIMIT,
      leaderboard: buildLeaderboard(db, trackId)
    });
  } catch (error) {
    console.error('Error fetching swoop leaderboard:', error);
    return res.status(500).json({ message: 'Could not load the swoop leaderboard.' });
  }
});

router.post('/runs', auth, async (req, res) => {
  const trackId = normalizeTrackId(req.body?.trackId);
  const timeMs = normalizeInteger(req.body?.timeMs);
  const collisions = normalizeInteger(req.body?.collisions);

  if (!trackId) {
    return res.status(400).json({ message: 'Unknown swoop track.' });
  }
  if (timeMs === null || timeMs < MIN_RACE_TIME_MS || timeMs > MAX_RACE_TIME_MS) {
    return res.status(400).json({ message: 'Race time is outside the accepted range.' });
  }
  if (collisions === null || collisions < 0 || collisions > MAX_COLLISIONS) {
    return res.status(400).json({ message: 'Collision count is outside the accepted range.' });
  }

  const userId = resolveUserId(req.user);
  let accepted = false;
  let personalBest = null;
  let responseDb = null;

  try {
    await withDb(async (db) => {
      const user = (db.users || []).find((entry) => resolveUserId(entry) === userId);
      if (!user) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      db.swoopRuns = Array.isArray(db.swoopRuns) ? db.swoopRuns : [];
      const existingIndex = db.swoopRuns.findIndex(
        (run) => run.userId === userId && run.trackId === trackId
      );
      const existing = existingIndex >= 0 ? db.swoopRuns[existingIndex] : null;
      const now = new Date().toISOString();
      const candidate = {
        id: existing?.id || `${userId}:${trackId}`,
        userId,
        nickname:
          user.displayName || user.profile?.displayName || user.username || req.user.username || 'Racer',
        trackId,
        timeMs,
        collisions,
        createdAt: existing?.createdAt || now,
        updatedAt: now
      };

      if (!existing || compareRuns(candidate, existing) < 0) {
        if (existingIndex >= 0) db.swoopRuns[existingIndex] = candidate;
        else db.swoopRuns.push(candidate);
        personalBest = candidate;
        accepted = true;
      } else {
        personalBest = existing;
      }
      responseDb = db;
    });

    const leaderboard = buildLeaderboard(responseDb, trackId);
    const rank = leaderboard.find((entry) => entry.userId === userId)?.rank || null;
    return res.status(accepted ? 201 : 200).json({
      accepted,
      rank,
      personalBest: {
        trackId: personalBest.trackId,
        timeMs: personalBest.timeMs,
        collisions: personalBest.collisions
      },
      leaderboard
    });
  } catch (error) {
    if (error.code === 'USER_NOT_FOUND') {
      return res.status(401).json({ message: 'User account was not found.' });
    }
    console.error('Error saving swoop result:', error);
    return res.status(500).json({ message: 'Could not save the swoop result.' });
  }
});

export default router;
