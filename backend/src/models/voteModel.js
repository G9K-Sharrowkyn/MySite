const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fight: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Fight',
    required: true
  },
  team: {
    type: String,
    enum: ['A', 'B'],
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index to ensure one vote per user per fight
voteSchema.index({ user: 1, fight: 1 }, { unique: true });

// Virtual for vote age
voteSchema.virtual('age').get(function() {
  return Date.now() - this.createdAt;
});

// Instance method to check if vote is recent
voteSchema.methods.isRecent = function(hours = 24) {
  return this.age < hours * 60 * 60 * 1000;
};

// Static method to get vote statistics for a fight
voteSchema.statics.getFightStats = async function(fightId) {
  const stats = await this.aggregate([
    { $match: { fight: new mongoose.Types.ObjectId(fightId) } },
    {
      $group: {
        _id: '$team',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const result = { teamA: 0, teamB: 0, total: 0 };
  stats.forEach(stat => {
    if (stat._id === 'A') result.teamA = stat.count;
    if (stat._id === 'B') result.teamB = stat.count;
    result.total += stat.count;
  });
  
  return result;
};

// Static method to get user's voting history
voteSchema.statics.getUserVotes = async function(userId, limit = 50) {
  return this.find({ user: userId })
    .populate('fight', 'teamA teamB status endsAt')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to get recent votes
voteSchema.statics.getRecentVotes = async function(hours = 24) {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  return this.find({ createdAt: { $gte: cutoff } })
    .populate('user', 'username')
    .populate('fight', 'teamA teamB')
    .sort({ createdAt: -1 });
};

module.exports = mongoose.model('Vote', voteSchema); 