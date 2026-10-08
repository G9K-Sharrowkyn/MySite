import express from 'express';
import auth from '../middleware/auth.js';
import {
  getSwoopLeaderboard,
  saveSwoopBest
} from '../services/swoopLeaderboard.js';

const router = express.Router();

const TRACK_IDS = new Set(['taris', 'taris2', 'tatooine', 'manaan', 'korriban']);
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

router.get('/leaderboard/:trackId', async (req, res) => {
  const trackId = normalizeTrackId(req.params.trackId);
  if (!trackId) {
    return res.status(400).json({ message: 'Unknown swoop track.' });
  }

  try {
    return res.json({
      trackId,
      limit: LEADERBOARD_LIMIT,
      leaderboard: await getSwoopLeaderboard(trackId, LEADERBOARD_LIMIT)
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
  try {
    const { accepted, personalBest } = await saveSwoopBest({
      userId,
      nickname: req.user.username,
      trackId,
      timeMs,
      collisions
    });

    const leaderboard = await getSwoopLeaderboard(trackId, LEADERBOARD_LIMIT);
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
