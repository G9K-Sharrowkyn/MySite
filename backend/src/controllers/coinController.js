const CoinTransaction = require('../models/coinModel');
const User = require('../models/userModel');
const { useFallback, fallbackData } = require('../config/db');

// Get user's coin balance
const getUserBalance = async (req, res) => {
  try {
    const userId = req.params.userId || req.user._id;
    
    if (useFallback()) {
      const user = fallbackData.users.find(u => u._id === userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      return res.json({ balance: user.coins || 0 });
    }

    const user = await User.findById(userId).select('coins');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ balance: user.coins || 0 });
  } catch (error) {
    console.error('Error getting user balance:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get user's transaction history
const getTransactionHistory = async (req, res) => {
  try {
    const userId = req.params.userId || req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    if (useFallback()) {
      // Return mock data for fallback
      const mockTransactions = [
        {
          _id: '1',
          type: 'earned',
          amount: 50,
          description: 'Posted a fight',
          balance: 150,
          createdAt: new Date()
        },
        {
          _id: '2',
          type: 'spent',
          amount: -25,
          description: 'Bet on fight',
          balance: 100,
          createdAt: new Date()
        }
      ];
      return res.json({
        transactions: mockTransactions,
        total: mockTransactions.length,
        page,
        totalPages: 1
      });
    }

    const transactions = await CoinTransaction.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await CoinTransaction.countDocuments({ userId });

    res.json({
      transactions,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error getting transaction history:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Add coins to user (earned from activities)
const addCoins = async (userId, amount, description, relatedId = null, relatedModel = null) => {
  try {
    if (useFallback()) {
      const userIndex = fallbackData.users.findIndex(u => u._id === userId);
      if (userIndex !== -1) {
        fallbackData.users[userIndex].coins = (fallbackData.users[userIndex].coins || 0) + amount;
      }
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const newBalance = (user.coins || 0) + amount;
    
    // Update user's coin balance
    await User.findByIdAndUpdate(userId, { coins: newBalance });

    // Create transaction record
    await CoinTransaction.create({
      userId,
      type: 'earned',
      amount,
      description,
      relatedId,
      relatedModel,
      balance: newBalance
    });

    return newBalance;
  } catch (error) {
    console.error('Error adding coins:', error);
    throw error;
  }
};

// Deduct coins from user (spent on activities)
const deductCoins = async (userId, amount, description, relatedId = null, relatedModel = null) => {
  try {
    if (useFallback()) {
      const userIndex = fallbackData.users.findIndex(u => u._id === userId);
      if (userIndex !== -1) {
        const currentBalance = fallbackData.users[userIndex].coins || 0;
        if (currentBalance < amount) {
          throw new Error('Insufficient coins');
        }
        fallbackData.users[userIndex].coins = currentBalance - amount;
      }
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const currentBalance = user.coins || 0;
    if (currentBalance < amount) {
      throw new Error('Insufficient coins');
    }

    const newBalance = currentBalance - amount;
    
    // Update user's coin balance
    await User.findByIdAndUpdate(userId, { coins: newBalance });

    // Create transaction record
    await CoinTransaction.create({
      userId,
      type: 'spent',
      amount: -amount,
      description,
      relatedId,
      relatedModel,
      balance: newBalance
    });

    return newBalance;
  } catch (error) {
    console.error('Error deducting coins:', error);
    throw error;
  }
};

// Get coin earning rates
const getEarningRates = async (req, res) => {
  try {
    const rates = {
      post: 10,
      comment: 2,
      vote: 1,
      fightWin: 50,
      fightLoss: 5,
      dailyLogin: 5,
      tournamentWin: 100,
      tournamentParticipation: 10
    };

    res.json(rates);
  } catch (error) {
    console.error('Error getting earning rates:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get user's coin statistics
const getUserCoinStats = async (req, res) => {
  try {
    const userId = req.params.userId || req.user._id;

    if (useFallback()) {
      const user = fallbackData.users.find(u => u._id === userId);
      return res.json({
        totalEarned: 500,
        totalSpent: 200,
        currentBalance: user?.coins || 0,
        totalTransactions: 25
      });
    }

    const stats = await CoinTransaction.aggregate([
      { $match: { userId: new require('mongoose').Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          totalEarned: {
            $sum: {
              $cond: [{ $eq: ['$type', 'earned'] }, '$amount', 0]
            }
          },
          totalSpent: {
            $sum: {
              $cond: [{ $eq: ['$type', 'spent'] }, { $abs: '$amount' }, 0]
            }
          },
          totalTransactions: { $sum: 1 }
        }
      }
    ]);

    const user = await User.findById(userId).select('coins');
    const currentBalance = user?.coins || 0;

    res.json({
      totalEarned: stats[0]?.totalEarned || 0,
      totalSpent: stats[0]?.totalSpent || 0,
      currentBalance,
      totalTransactions: stats[0]?.totalTransactions || 0
    });
  } catch (error) {
    console.error('Error getting user coin stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getUserBalance,
  getTransactionHistory,
  addCoins,
  deductCoins,
  getEarningRates,
  getUserCoinStats
}; 