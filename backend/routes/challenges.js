import express from 'express';
import { readDb } from '../services/jsonDb.js';

const router = express.Router();

// GET /api/challenges/progress/:userId
router.get('/progress/:userId', async (req, res) => {
  try {
    const db = await readDb();
    const entry = (db.challengeProgress || []).find(
      (item) => item.userId === req.params.userId
    );

    const progress = Array.isArray(entry?.tasks)
      ? entry.tasks.reduce((acc, task) => {
          acc[task.id] = {
            progress: task.progress || 0,
            target: task.target || 0,
            completed: Boolean(task.completed)
          };
          return acc;
        }, {})
      : {};

    res.json({
      progress,
      streak: entry?.streak || 0
    });
  } catch (error) {
    console.error('Error fetching challenge progress:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
