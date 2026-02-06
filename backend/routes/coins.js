import express from 'express';
import { coinTransactionsRepo, usersRepo, withDb } from '../repositories/index.js';
import { ensureCoinAccount } from '../utils/coinBonus.js';

const router = express.Router();

const resolveUserId = (user) => user?.id || user?._id;

const findUserById = (db, userId) =>
  (db.users || []).find((entry) => resolveUserId(entry) === userId);

// GET /api/coins/balance/:userId
router.get('/balance/:userId', async (req, res) => {
  try {
    let balance = 0;
    await withDb(async (db) => {
      const user = await usersRepo.findOne(
        (entry) => resolveUserId(entry) === req.params.userId,
        { db }
      );
      if (!user) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      ensureCoinAccount(user);
      balance = user.coins.balance || 0;
      return db;
    });
    res.json({ balance });
  } catch (error) {
    if (error.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: 'User not found' });
    }
    console.error('Error fetching coin balance:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/coins/transactions/:userId
router.get('/transactions/:userId', async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    let response;
    await withDb(async (db) => {
      const user = await usersRepo.findOne(
        (entry) => resolveUserId(entry) === req.params.userId,
        { db }
      );
      if (!user) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      ensureCoinAccount(user);
      const all = (await coinTransactionsRepo.filter(
        (entry) => entry.userId === req.params.userId,
        { db }
      )).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      const paged = all.slice((page - 1) * limit, page * limit);
      response = {
        transactions: paged,
        totalPages: Math.ceil(all.length / limit) || 1,
        totalTransactions: all.length
      };
      return db;
    });
    res.json(response);
  } catch (error) {
    if (error.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: 'User not found' });
    }
    console.error('Error fetching coin transactions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/coins/stats/:userId
router.get('/stats/:userId', async (req, res) => {
  try {
    let stats;
    await withDb(async (db) => {
      const user = await usersRepo.findOne(
        (entry) => resolveUserId(entry) === req.params.userId,
        { db }
      );
      if (!user) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      ensureCoinAccount(user);
      const transactions = await coinTransactionsRepo.filter(
        (entry) => entry.userId === req.params.userId,
        { db }
      );
      stats = {
        totalEarned: user.coins.totalEarned || 0,
        totalSpent: user.coins.totalSpent || 0,
        currentBalance: user.coins.balance || 0,
        totalTransactions: transactions.length
      };
      return db;
    });
    res.json(stats);
  } catch (error) {
    if (error.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: 'User not found' });
    }
    console.error('Error fetching coin stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
