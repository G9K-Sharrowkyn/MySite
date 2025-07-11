const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { 
  getUserBalance, 
  getTransactionHistory, 
  getEarningRates, 
  getUserCoinStats 
} = require('../controllers/coinController');

const router = express.Router();

// GET /api/coins/balance - Get user's coin balance
router.get('/balance', protect, getUserBalance);

// GET /api/coins/balance/:userId - Get specific user's coin balance (public)
router.get('/balance/:userId', getUserBalance);

// GET /api/coins/transactions - Get user's transaction history
router.get('/transactions', protect, getTransactionHistory);

// GET /api/coins/transactions/:userId - Get specific user's transaction history (public)
router.get('/transactions/:userId', getTransactionHistory);

// GET /api/coins/rates - Get coin earning rates (public)
router.get('/rates', getEarningRates);

// GET /api/coins/stats - Get user's coin statistics
router.get('/stats', protect, getUserCoinStats);

// GET /api/coins/stats/:userId - Get specific user's coin statistics (public)
router.get('/stats/:userId', getUserCoinStats);

module.exports = router; 