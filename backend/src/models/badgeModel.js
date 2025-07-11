const mongoose = require('mongoose');

const badgeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  displayName: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  icon: {
    type: String,
    required: true,
    trim: true
  },
  color: {
    type: String,
    default: '#666666'
  },
  category: {
    type: String,
    enum: ['achievement', 'champion', 'participation', 'special'],
    default: 'achievement'
  },
  rarity: {
    type: String,
    enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
    default: 'common'
  },
  criteria: {
    type: {
      type: String,
      enum: ['posts', 'comments', 'votes', 'wins', 'champion', 'streak', 'custom'],
      required: true
    },
    value: {
      type: Number,
      required: true
    },
    division: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Division'
    },
    timeFrame: {
      type: String,
      enum: ['lifetime', 'monthly', 'weekly', 'daily'],
      default: 'lifetime'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isSecret: {
    type: Boolean,
    default: false
  },
  awardedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// User Badge Schema (junction table)
const userBadgeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  badge: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Badge',
    required: true
  },
  awardedAt: {
    type: Date,
    default: Date.now
  },
  awardedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  metadata: {
    // For champion badges
    division: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Division'
    },
    reignStart: {
      type: Date
    },
    reignEnd: {
      type: Date
    },
    titleDefenses: {
      type: Number,
      default: 0
    },
    // For achievement badges
    achievedValue: {
      type: Number
    },
    // For custom badges
    customText: {
      type: String
    }
  }
}, {
  timestamps: true
});

// Indexes
badgeSchema.index({ category: 1, rarity: 1 });
badgeSchema.index({ 'criteria.type': 1 });
badgeSchema.index({ isActive: 1 });

userBadgeSchema.index({ user: 1, badge: 1 }, { unique: true });
userBadgeSchema.index({ user: 1, awardedAt: -1 });
userBadgeSchema.index({ badge: 1, awardedAt: -1 });

// Badge methods
badgeSchema.methods.checkEligibility = async function(userId) {
  const User = require('./userModel');
  const user = await User.findById(userId);
  
  if (!user) return false;
  
  switch (this.criteria.type) {
    case 'posts':
      return user.stats.posts >= this.criteria.value;
    
    case 'comments':
      return user.stats.comments >= this.criteria.value;
    
    case 'votes':
      return user.stats.votes >= this.criteria.value;
    
    case 'wins':
      if (this.criteria.division) {
        const division = user.divisions.find(d => d.division.toString() === this.criteria.division.toString());
        return division && division.wins >= this.criteria.value;
      }
      return user.stats.wins >= this.criteria.value;
    
    case 'champion':
      if (this.criteria.division) {
        const Division = require('./divisionModel');
        const division = await Division.findById(this.criteria.division);
        return division && division.currentChampion && 
               division.currentChampion.user.toString() === userId.toString();
      }
      return false;
    
    case 'streak':
      return user.stats.currentStreak >= this.criteria.value;
    
    default:
      return false;
  }
};

// User Badge methods
userBadgeSchema.statics.getUserBadges = function(userId) {
  return this.find({ user: userId })
    .populate('badge')
    .populate('metadata.division', 'name')
    .sort({ awardedAt: -1 });
};

userBadgeSchema.statics.getBadgeRecipients = function(badgeId) {
  return this.find({ badge: badgeId })
    .populate('user', 'username profile.avatar')
    .populate('metadata.division', 'name')
    .sort({ awardedAt: -1 });
};

userBadgeSchema.statics.awardBadge = async function(userId, badgeId, awardedBy = null, metadata = {}) {
  // Check if user already has this badge
  const existing = await this.findOne({ user: userId, badge: badgeId });
  if (existing) {
    return existing;
  }
  
  // Award the badge
  const userBadge = await this.create({
    user: userId,
    badge: badgeId,
    awardedBy: awardedBy,
    metadata: metadata
  });
  
  await userBadge.populate('badge');
  return userBadge;
};

// Static methods for Badge
badgeSchema.statics.getActiveBadges = function() {
  return this.find({ isActive: true }).sort({ category: 1, rarity: 1 });
};

badgeSchema.statics.getByCategory = function(category) {
  return this.find({ category, isActive: true }).sort({ rarity: 1 });
};

badgeSchema.statics.getByRarity = function(rarity) {
  return this.find({ rarity, isActive: true }).sort({ category: 1 });
};

// Create models
const Badge = mongoose.model('Badge', badgeSchema);
const UserBadge = mongoose.model('UserBadge', userBadgeSchema);

module.exports = {
  Badge,
  UserBadge
}; 