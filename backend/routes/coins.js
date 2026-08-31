import express from 'express';
import { coinTransactionsRepo, usersRepo } from '../repositories/index.js';
import auth from '../middleware/auth.js';
import { parsePagination } from '../utils/pagination.js';

const router = express.Router();

const requireSelf = (req, res, next) => {
  if (req.params.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }
  return next();
};

// GET /api/coins/balance/:userId
router.get('/balance/:userId', auth, requireSelf, async (req, res) => {
  try {
    const user = await usersRepo.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ balance: user.coins?.balance || 0 });
  } catch (error) {
    if (error.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: 'User not found' });
    }
    console.error('Error fetching coin balance:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/coins/transactions/:userId
router.get('/transactions/:userId', auth, requireSelf, async (req, res) => {
  try {
    const { page, limit } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 100
    });
    const user = await usersRepo.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const query = { userId: req.params.userId };
    const [transactions, totalTransactions] = await Promise.all([
      coinTransactionsRepo.findManyBy(query, {
        sort: { createdAt: -1 },
        skip: (page - 1) * limit,
        limit
      }),
      coinTransactionsRepo.countBy(query)
    ]);
    const response = {
      transactions,
      totalPages: Math.ceil(totalTransactions / limit) || 1,
      totalTransactions
    };
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
router.get('/stats/:userId', auth, requireSelf, async (req, res) => {
  try {
    const user = await usersRepo.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const totalTransactions = await coinTransactionsRepo.countBy({
      userId: req.params.userId
    });
    const stats = {
      totalEarned: user.coins?.totalEarned || 0,
      totalSpent: user.coins?.totalSpent || 0,
      currentBalance: user.coins?.balance || 0,
      totalTransactions
    };
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
