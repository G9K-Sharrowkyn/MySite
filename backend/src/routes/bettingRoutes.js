const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { 
  placeBet, 
  getUserBets, 
  getFightBets, 
  getBettingStats 
} = require('../controllers/bettingController');

const router = express.Router();

// All routes require authentication
router.use(protect);

// POST /api/betting/fight/:fightId - Place a bet on a fight
router.post('/fight/:fightId', placeBet);

// GET /api/betting/user - Get user's bets
router.get('/user', getUserBets);

// GET /api/betting/user/:userId - Get specific user's bets (public)
router.get('/user/:userId', getUserBets);

// GET /api/betting/fight/:fightId - Get all bets for a fight
router.get('/fight/:fightId', getFightBets);

// GET /api/betting/stats - Get user's betting statistics
router.get('/stats', getBettingStats);

// GET /api/betting/stats/:userId - Get specific user's betting statistics (public)
router.get('/stats/:userId', getBettingStats);

module.exports = router; 