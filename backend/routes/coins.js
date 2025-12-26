import express from 'express';
import { readDb } from '../services/jsonDb.js';

const router = express.Router();

const resolveUserId = (user) => user?.id || user?._id;

const findUserById = (db, userId) =>
  (db.users || []).find((entry) => resolveUserId(entry) === userId);

const ensureCoinAccount = (user) => {
  if (!user) return;
  user.coins = user.coins || {
    balance: 0,
    totalEarned: 0,
    totalSpent: 0,
    lastBonusDate: new Date().toISOString()
  };
};

// GET /api/coins/balance/:userId
router.get('/balance/:userId', async (req, res) => {
  try {
    const db = await readDb();
    const user = findUserById(db, req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    ensureCoinAccount(user);
    res.json({ balance: user.coins.balance || 0 });
  } catch (error) {
    console.error('Error fetching coin balance:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/coins/transactions/:userId
router.get('/transactions/:userId', async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const db = await readDb();
    const all = (db.coinTransactions || [])
      .filter((entry) => entry.userId === req.params.userId)
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const paged = all.slice((page - 1) * limit, page * limit);

    res.json({
      transactions: paged,
      totalPages: Math.ceil(all.length / limit) || 1,
      totalTransactions: all.length
    });
  } catch (error) {
    console.error('Error fetching coin transactions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/coins/stats/:userId
router.get('/stats/:userId', async (req, res) => {
  try {
    const db = await readDb();
    const user = findUserById(db, req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    ensureCoinAccount(user);
    const transactions = (db.coinTransactions || []).filter(
      (entry) => entry.userId === req.params.userId
    );

    res.json({
      totalEarned: user.coins.totalEarned || 0,
      totalSpent: user.coins.totalSpent || 0,
      currentBalance: user.coins.balance || 0,
      totalTransactions: transactions.length
    });
  } catch (error) {
    console.error('Error fetching coin stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
