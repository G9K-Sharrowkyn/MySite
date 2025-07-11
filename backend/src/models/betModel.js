const mongoose = require('mongoose');

const betSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fightId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Fight',
    required: true
  },
  betAmount: {
    type: Number,
    required: true,
    min: 1
  },
  predictedWinner: {
    type: String,
    enum: ['A', 'B', 'draw'],
    required: true
  },
  odds: {
    type: Number,
    required: true,
    default: 1.0
  },
  potentialWinnings: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'won', 'lost', 'cancelled'],
    default: 'pending'
  },
  actualWinner: {
    type: String,
    enum: ['A', 'B', 'draw']
  },
  winningsPaid: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  resolvedAt: {
    type: Date
  }
});

// Index for efficient queries
betSchema.index({ userId: 1, fightId: 1 });
betSchema.index({ status: 1, createdAt: 1 });
betSchema.index({ fightId: 1, status: 1 });

const Bet = mongoose.model('Bet', betSchema);

module.exports = Bet; 