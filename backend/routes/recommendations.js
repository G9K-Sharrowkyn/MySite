import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { recommendationEventsRepo } from '../repositories/index.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// POST /api/recommendations/track
router.post('/track', auth, async (req, res) => {
  try {
    const { characterId, category } = req.body;
    if (!characterId) {
      return res.status(400).json({ message: 'Missing tracking data' });
    }

    await recommendationEventsRepo.insert({
      id: uuidv4(),
      userId: req.user.id,
      characterId,
      category: String(category || 'unknown').slice(0, 100),
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString()
    });

    res.json({ message: 'Tracked' });
  } catch (error) {
    console.error('Error tracking recommendation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
