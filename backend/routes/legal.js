import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { updateDb } from '../services/jsonDb.js';

const router = express.Router();

// POST /api/legal/consent
router.post('/consent', async (req, res) => {
  try {
    const { userId, analytics, marketing, functional } = req.body || {};
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    await updateDb((db) => {
      db.legalConsents = Array.isArray(db.legalConsents) ? db.legalConsents : [];
      db.legalConsents.push({
        id: uuidv4(),
        userId,
        analytics: Boolean(analytics),
        marketing: Boolean(marketing),
        functional: functional !== false,
        createdAt: new Date().toISOString()
      });

      const user = (db.users || []).find((entry) => entry.id === userId || entry._id === userId);
      if (user) {
        user.privacy = user.privacy || {};
        user.privacy.cookieConsent = {
          given: true,
          analytics: Boolean(analytics),
          marketing: Boolean(marketing),
          functional: functional !== false,
          date: new Date().toISOString()
        };
      }

      return db;
    });

    res.json({ message: 'Consent saved' });
  } catch (error) {
    console.error('Error saving consent:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
