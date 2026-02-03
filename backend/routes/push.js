import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pushSubscriptionsRepo } from '../repositories/index.js';
import { optionalAuth } from '../middleware/optionalAuth.js';
import { getVapidPublicKey } from '../services/pushService.js';

const router = express.Router();

router.get('/vapid-public-key', (_req, res) => {
  res.json({ publicKey: getVapidPublicKey() });
});

// POST /api/push/subscribe
router.post('/subscribe', optionalAuth, async (req, res) => {
  try {
    const { subscription, userId } = req.body || {};
    if (!subscription) {
      return res.status(400).json({ message: 'Subscription is required' });
    }
    const resolvedUserId = req.user?.id || userId || null;

    await pushSubscriptionsRepo.updateAll((subscriptions) => {
      const existing = subscriptions.find(
        (entry) => entry.subscription?.endpoint === subscription.endpoint
      );
      if (!existing) {
        subscriptions.push({
          id: uuidv4(),
          userId: resolvedUserId,
          subscription,
          createdAt: new Date().toISOString()
        });
      } else if (resolvedUserId && existing.userId !== resolvedUserId) {
        existing.userId = resolvedUserId;
      }

      return subscriptions;
    });

    res.json({ message: 'Subscribed' });
  } catch (error) {
    console.error('Error subscribing push:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/push/unsubscribe
router.post('/unsubscribe', async (req, res) => {
  try {
    const { subscription } = req.body || {};
    if (!subscription) {
      return res.status(400).json({ message: 'Subscription is required' });
    }

    await pushSubscriptionsRepo.updateAll((subscriptions) =>
      subscriptions.filter(
        (entry) => entry.subscription?.endpoint !== subscription.endpoint
      )
    );

    res.json({ message: 'Unsubscribed' });
  } catch (error) {
    console.error('Error unsubscribing push:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
