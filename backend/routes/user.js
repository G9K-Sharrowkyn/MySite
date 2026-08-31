import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  coinTransactionsRepo,
  usersRepo,
  withRepositoryTransaction
} from '../repositories/index.js';
import { syncRankFromPoints } from '../utils/rankSystem.js';
import auth from '../middleware/auth.js';
import roleMiddleware from '../middleware/roleMiddleware.js';

const router = express.Router();

const resolveUserId = (user) => user?.id || user?._id;

// POST /api/user/rewards
router.post('/rewards', auth, roleMiddleware(['moderator', 'admin']), async (req, res) => {
  try {
    const { userId, reward } = req.body || {};
    if (!userId || !reward) {
      return res.status(400).json({ message: 'Missing reward data' });
    }

    await withRepositoryTransaction(async (context) => {
      const user = await usersRepo.findById(userId, context);
      if (!user) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }
      const values = ['xp', 'points', 'coins'].map((key) => Number(reward[key] || 0));
      if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 10000)) {
        const error = new Error('Invalid reward value');
        error.code = 'INVALID_REWARD';
        throw error;
      }

      const updatedUser = await usersRepo.updateById(userId, (storedUser) => {
        storedUser.stats = storedUser.stats || {};
        if (reward.xp) {
          storedUser.stats.experience = (storedUser.stats.experience || 0) + Number(reward.xp || 0);
        }
        if (reward.points) {
          storedUser.stats.points = (storedUser.stats.points || 0) + Number(reward.points || 0);
          syncRankFromPoints(storedUser);
        }
        if (reward.coins) {
          storedUser.coins = storedUser.coins || {
          balance: 0,
          totalEarned: 0,
          totalSpent: 0,
          lastBonusDate: new Date().toISOString()
          };
          storedUser.coins.balance = (storedUser.coins.balance || 0) + Number(reward.coins || 0);
          storedUser.coins.totalEarned = (storedUser.coins.totalEarned || 0) + Number(reward.coins || 0);
          storedUser.virtualCoins = storedUser.coins.balance;
        }
        storedUser.updatedAt = new Date().toISOString();
        return storedUser;
      }, context);

      if (reward.coins) {
        await coinTransactionsRepo.insert({
          id: uuidv4(),
          _id: uuidv4(),
          userId,
          amount: Number(reward.coins || 0),
          type: 'earned',
          description: 'Challenge reward',
          balance: updatedUser.coins.balance,
          createdAt: new Date().toISOString()
        }, context);
      }
    });

    res.json({ message: 'Rewards applied' });
  } catch (error) {
    if (error.code === 'INVALID_REWARD') {
      return res.status(400).json({ message: error.message });
    }
    if (error.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: 'User not found' });
    }
    console.error('Error applying rewards:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
