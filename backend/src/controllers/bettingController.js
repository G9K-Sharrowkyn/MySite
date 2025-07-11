const Bet = require('../models/betModel');
const Fight = require('../models/fightModel');
const User = require('../models/userModel');
const { addCoins, deductCoins } = require('./coinController');
const { useFallback, fallbackData } = require('../config/db');

// Place a bet on a fight
const placeBet = async (req, res) => {
  try {
    const { fightId } = req.params;
    const { predictedWinner, betAmount } = req.body;
    const userId = req.user._id;

    // Validate bet amount
    if (!betAmount || betAmount < 1) {
      return res.status(400).json({ message: 'Invalid bet amount' });
    }

    // Validate prediction
    if (!['A', 'B', 'draw'].includes(predictedWinner)) {
      return res.status(400).json({ message: 'Invalid prediction' });
    }

    // Check if fight exists and is open for betting
    let fight;
    if (useFallback()) {
      fight = fallbackData.fights.find(f => f._id === fightId);
    } else {
      fight = await Fight.findById(fightId);
    }

    if (!fight) {
      return res.status(404).json({ message: 'Fight not found' });
    }

    // Check if fight is open for betting (24 hours before start)
    const fightStartTime = new Date(fight.startsAt || fight.createdAt);
    const bettingDeadline = new Date(fightStartTime.getTime() - (24 * 60 * 60 * 1000)); // 24 hours before
    const now = new Date();

    if (now > bettingDeadline) {
      return res.status(400).json({ message: 'Betting is closed for this fight' });
    }

    // Check if user already bet on this fight
    let existingBet;
    if (useFallback()) {
      existingBet = fallbackData.bets.find(b => b.userId === userId && b.fightId === fightId);
    } else {
      existingBet = await Bet.findOne({ userId, fightId });
    }

    if (existingBet) {
      return res.status(400).json({ message: 'You have already placed a bet on this fight' });
    }

    // Check if user has enough coins
    let user;
    if (useFallback()) {
      user = fallbackData.users.find(u => u._id === userId);
    } else {
      user = await User.findById(userId);
    }

    if (!user || (user.coins || 0) < betAmount) {
      return res.status(400).json({ message: 'Insufficient coins' });
    }

    // Calculate odds based on current bets
    const odds = await calculateOdds(fightId, predictedWinner);
    const potentialWinnings = Math.floor(betAmount * odds);

    // Create bet
    let bet;
    if (useFallback()) {
      bet = {
        _id: Date.now().toString(),
        userId,
        fightId,
        betAmount,
        predictedWinner,
        odds,
        potentialWinnings,
        status: 'pending',
        createdAt: new Date()
      };
      fallbackData.bets.push(bet);
    } else {
      bet = await Bet.create({
        userId,
        fightId,
        betAmount,
        predictedWinner,
        odds,
        potentialWinnings,
        status: 'pending'
      });
    }

    // Deduct coins from user
    await deductCoins(userId, betAmount, `Bet on fight: ${fight.title || fightId}`, fightId, 'Fight');

    res.status(201).json({
      message: 'Bet placed successfully',
      bet: {
        id: bet._id,
        betAmount,
        predictedWinner,
        odds,
        potentialWinnings,
        status: bet.status
      }
    });
  } catch (error) {
    console.error('Error placing bet:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get user's bets
const getUserBets = async (req, res) => {
  try {
    const userId = req.params.userId || req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    if (useFallback()) {
      const userBets = fallbackData.bets
        .filter(b => b.userId === userId)
        .slice(skip, skip + limit);
      
      return res.json({
        bets: userBets,
        total: fallbackData.bets.filter(b => b.userId === userId).length,
        page,
        totalPages: Math.ceil(fallbackData.bets.filter(b => b.userId === userId).length / limit)
      });
    }

    const bets = await Bet.find({ userId })
      .populate('fightId', 'title teamA teamB status startsAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Bet.countDocuments({ userId });

    res.json({
      bets,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error getting user bets:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get fight bets
const getFightBets = async (req, res) => {
  try {
    const { fightId } = req.params;

    if (useFallback()) {
      const fightBets = fallbackData.bets.filter(b => b.fightId === fightId);
      return res.json({ bets: fightBets });
    }

    const bets = await Bet.find({ fightId })
      .populate('userId', 'username')
      .sort({ createdAt: -1 });

    res.json({ bets });
  } catch (error) {
    console.error('Error getting fight bets:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get betting statistics
const getBettingStats = async (req, res) => {
  try {
    const userId = req.params.userId || req.user._id;

    if (useFallback()) {
      const userBets = fallbackData.bets.filter(b => b.userId === userId);
      const stats = {
        totalBets: userBets.length,
        totalWagered: userBets.reduce((sum, bet) => sum + bet.betAmount, 0),
        totalWinnings: userBets.reduce((sum, bet) => sum + (bet.winningsPaid || 0), 0),
        wins: userBets.filter(bet => bet.status === 'won').length,
        losses: userBets.filter(bet => bet.status === 'lost').length,
        pending: userBets.filter(bet => bet.status === 'pending').length
      };
      return res.json(stats);
    }

    const stats = await Bet.aggregate([
      { $match: { userId: new require('mongoose').Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          totalBets: { $sum: 1 },
          totalWagered: { $sum: '$betAmount' },
          totalWinnings: { $sum: '$winningsPaid' },
          wins: { $sum: { $cond: [{ $eq: ['$status', 'won'] }, 1, 0] } },
          losses: { $sum: { $cond: [{ $eq: ['$status', 'lost'] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } }
        }
      }
    ]);

    res.json(stats[0] || {
      totalBets: 0,
      totalWagered: 0,
      totalWinnings: 0,
      wins: 0,
      losses: 0,
      pending: 0
    });
  } catch (error) {
    console.error('Error getting betting stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Calculate odds for a prediction
const calculateOdds = async (fightId, prediction) => {
  try {
    if (useFallback()) {
      // Return mock odds
      return 2.0;
    }

    const bets = await Bet.find({ fightId, status: 'pending' });
    
    const totalBetAmount = bets.reduce((sum, bet) => sum + bet.betAmount, 0);
    const predictionBets = bets.filter(bet => bet.predictedWinner === prediction);
    const predictionTotal = predictionBets.reduce((sum, bet) => sum + bet.betAmount, 0);

    if (predictionTotal === 0) {
      return 2.0; // Default odds if no bets on this prediction
    }

    // Simple odds calculation: total / prediction_total
    return Math.max(1.1, totalBetAmount / predictionTotal);
  } catch (error) {
    console.error('Error calculating odds:', error);
    return 2.0; // Default odds
  }
};

// Settle bets for a fight (called when fight ends)
const settleBets = async (fightId, winner) => {
  try {
    if (useFallback()) {
      const fightBets = fallbackData.bets.filter(b => b.fightId === fightId && b.status === 'pending');
      
      fightBets.forEach(bet => {
        bet.status = bet.predictedWinner === winner ? 'won' : 'lost';
        bet.actualWinner = winner;
        bet.resolvedAt = new Date();
        
        if (bet.status === 'won') {
          bet.winningsPaid = bet.potentialWinnings;
          // Add winnings to user's coins
          const userIndex = fallbackData.users.findIndex(u => u._id === bet.userId);
          if (userIndex !== -1) {
            fallbackData.users[userIndex].coins = (fallbackData.users[userIndex].coins || 0) + bet.winningsPaid;
          }
        }
      });
      return;
    }

    const bets = await Bet.find({ fightId, status: 'pending' });

    for (const bet of bets) {
      bet.status = bet.predictedWinner === winner ? 'won' : 'lost';
      bet.actualWinner = winner;
      bet.resolvedAt = new Date();

      if (bet.status === 'won') {
        bet.winningsPaid = bet.potentialWinnings;
        // Add winnings to user's coins
        await addCoins(bet.userId, bet.winningsPaid, `Won bet on fight: ${fightId}`, fightId, 'Fight');
      }

      await bet.save();
    }
  } catch (error) {
    console.error('Error settling bets:', error);
  }
};

module.exports = {
  placeBet,
  getUserBets,
  getFightBets,
  getBettingStats,
  calculateOdds,
  settleBets
}; 