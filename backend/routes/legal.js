import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { legalConsentsRepo, usersRepo, withDb } from '../repositories/index.js';
import auth from '../middleware/auth.js';
import { getLegalConfig } from '../config/legalConfig.js';

const router = express.Router();

// POST /api/legal/consent
router.post('/consent', auth, async (req, res) => {
  try {
    const { preferences = {}, analytics, marketing, functional } = req.body || {};
    const userId = req.user.id;
    const normalized = {
      necessary: true,
      analytics: Boolean(preferences.analytics ?? analytics),
      marketing: Boolean(preferences.marketing ?? marketing),
      functional: (preferences.functional ?? functional) !== false
    };

    await withDb(async (db) => {
      await legalConsentsRepo.insert(
        {
          id: uuidv4(),
          userId,
          ...normalized,
          policyVersion: getLegalConfig().policyVersion,
          createdAt: new Date().toISOString()
        },
        { db }
      );

      const user = await usersRepo.findOne(
        (entry) => entry.id === userId || entry._id === userId,
        { db }
      );
      if (user) {
        user.privacy = user.privacy || {};
        user.privacy.cookieConsent = {
          given: true,
          ...normalized,
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
