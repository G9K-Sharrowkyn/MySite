import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { recommendationEventsRepo } from '../repositories/index.js';

const router = express.Router();

// POST /api/recommendations/track
router.post('/track', async (req, res) => {
  try {
    const { userId, characterId, category, timestamp } = req.body;
    if (!userId || !characterId) {
      return res.status(400).json({ message: 'Missing tracking data' });
    }

    await recommendationEventsRepo.insert({
      id: uuidv4(),
      userId,
      characterId,
      category: category || 'unknown',
      timestamp: timestamp || new Date().toISOString(),
      createdAt: new Date().toISOString()
    });

    res.json({ message: 'Tracked' });
  } catch (error) {
    console.error('Error tracking recommendation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
