import express from 'express';
import {
  getTronLeaderboard,
  normalizeTronMonthKey
} from '../services/tronLeaderboard.js';

const router = express.Router();

router.get('/leaderboard', async (req, res) => {
  const monthKey = normalizeTronMonthKey(req.query?.month);
  if (!monthKey) {
    return res.status(400).json({ message: 'Month must use the YYYY-MM format.' });
  }
  try {
    return res.json(await getTronLeaderboard(monthKey));
  } catch (error) {
    console.error('Error fetching TRON leaderboard:', error);
    return res.status(500).json({ message: 'Could not load the TRON leaderboard.' });
  }
});

export default router;
