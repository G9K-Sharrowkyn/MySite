import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  coinTransactionsRepo,
  storePurchasesRepo,
  usersRepo,
  withDb
} from '../repositories/index.js';
import { applyDailyBonus } from '../utils/coinBonus.js';

const router = express.Router();

const resolveUserId = (user) => user?.id || user?._id;

// POST /api/store/purchase
router.post('/purchase', async (req, res) => {
  try {
    const { userId, itemId, category, cost } = req.body;
    if (!userId || !itemId || !category) {
      return res.status(400).json({ message: 'Missing purchase data' });
    }

    let purchase;
    let balance = 0;

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

      applyDailyBonus(db, user);

      const itemCost = Number(cost || 0);
      if (user.coins.balance < itemCost) {
        const error = new Error('Insufficient eurodolary');
        error.code = 'INSUFFICIENT_COINS';
        throw error;
      }

      user.coins.balance -= itemCost;
      user.coins.totalSpent = (user.coins.totalSpent || 0) + itemCost;
      user.virtualCoins = user.coins.balance;

      purchase = {
        id: uuidv4(),
        userId,
        itemId,
        category,
        cost: itemCost,
        purchasedAt: new Date().toISOString()
      };
      await storePurchasesRepo.insert(purchase, { db });

      await coinTransactionsRepo.insert({
        id: uuidv4(),
        _id: uuidv4(),
        userId,
        amount: -itemCost,
        type: 'purchase',
        description: `Store purchase: ${itemId}`,
        balance: user.coins.balance,
        createdAt: new Date().toISOString()
      }, { db });

      balance = user.coins.balance;
      return db;
    });

    res.json({ purchase, balance });
  } catch (error) {
    if (error.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: 'User not found' });
    }
    if (error.code === 'INSUFFICIENT_COINS') {
      return res.status(400).json({ message: 'Insufficient eurodolary' });
    }
    console.error('Error processing purchase:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
