import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  coinTransactionsRepo,
  storePurchasesRepo,
  usersRepo,
  withRepositoryTransaction
} from '../repositories/index.js';
import { ensureCoinAccount } from '../utils/coinBonus.js';
import auth from '../middleware/auth.js';
import { getStoreItem } from '../config/storeCatalog.js';

const router = express.Router();

const resolveUserId = (user) => user?.id || user?._id;

// POST /api/store/purchase
router.post('/purchase', auth, async (req, res) => {
  try {
    const { itemId, category } = req.body || {};
    const userId = req.user.id;
    if (!itemId || !category) {
      return res.status(400).json({ message: 'Missing purchase data' });
    }
    const catalogItem = getStoreItem(itemId, category);
    if (!catalogItem) {
      return res.status(400).json({ message: 'Unknown store item' });
    }

    let purchase;
    let balance = 0;

    await withRepositoryTransaction(async (context) => {
      const user = await usersRepo.findById(userId, context);
      if (!user) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      ensureCoinAccount(user);

      const itemCost = catalogItem.cost;
      if (user.coins.balance < itemCost) {
        const error = new Error('Insufficient eurodolary');
        error.code = 'INSUFFICIENT_COINS';
        throw error;
      }

      const updatedUser = await usersRepo.updateById(userId, (storedUser) => {
        ensureCoinAccount(storedUser);
        if (storedUser.coins.balance < itemCost) {
          const error = new Error('Insufficient eurodolary');
          error.code = 'INSUFFICIENT_COINS';
          throw error;
        }
        storedUser.coins.balance -= itemCost;
        storedUser.coins.totalSpent = (storedUser.coins.totalSpent || 0) + itemCost;
        storedUser.virtualCoins = storedUser.coins.balance;
        storedUser.updatedAt = new Date().toISOString();
        return storedUser;
      }, context);

      purchase = {
        id: uuidv4(),
        userId,
        itemId,
        category,
        cost: itemCost,
        purchasedAt: new Date().toISOString()
      };
      await storePurchasesRepo.insert(purchase, context);

      await coinTransactionsRepo.insert({
        id: uuidv4(),
        _id: uuidv4(),
        userId,
        amount: -itemCost,
        type: 'purchase',
        description: `Store purchase: ${itemId}`,
        balance: updatedUser.coins.balance,
        createdAt: new Date().toISOString()
      }, context);

      balance = updatedUser.coins.balance;
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
