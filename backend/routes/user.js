import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { coinTransactionsRepo, usersRepo, withDb } from '../repositories/index.js';
import { syncRankFromPoints } from '../utils/rankSystem.js';

const router = express.Router();

const resolveUserId = (user) => user?.id || user?._id;

// POST /api/user/rewards
router.post('/rewards', async (req, res) => {
  try {
    const { userId, reward } = req.body || {};
    if (!userId || !reward) {
      return res.status(400).json({ message: 'Missing reward data' });
    }

    await withDb(async (db) => {
      const user = await usersRepo.findOne(
        (entry) => resolveUserId(entry) === userId,
        { db }
      );
      if (!user) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      user.stats = user.stats || {};
      if (reward.xp) {
        user.stats.experience = (user.stats.experience || 0) + Number(reward.xp || 0);
      }
      if (reward.points) {
        user.stats.points = (user.stats.points || 0) + Number(reward.points || 0);
        syncRankFromPoints(user);
      }

      if (reward.coins) {
        user.coins = user.coins || {
          balance: 0,
          totalEarned: 0,
          totalSpent: 0,
          lastBonusDate: new Date().toISOString()
        };
        user.coins.balance = (user.coins.balance || 0) + Number(reward.coins || 0);
        user.coins.totalEarned = (user.coins.totalEarned || 0) + Number(reward.coins || 0);
        user.virtualCoins = user.coins.balance;

        await coinTransactionsRepo.insert({
          id: uuidv4(),
          _id: uuidv4(),
          userId,
          amount: Number(reward.coins || 0),
          type: 'earned',
          description: 'Challenge reward',
          balance: user.coins.balance,
          createdAt: new Date().toISOString()
        }, { db });
      }

      user.updatedAt = new Date().toISOString();
      return db;
    });

    res.json({ message: 'Rewards applied' });
  } catch (error) {
    if (error.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: 'User not found' });
    }
    console.error('Error applying rewards:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
