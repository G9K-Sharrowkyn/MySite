import mongoose from 'mongoose';

const userBadgeSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  badgeId: { 
    type: String, 
    required: true 
  },
  earnedAt: { 
    type: Date, 
    default: Date.now 
  },
  // For championship badges - when the championship was won
  championshipDate: Date,
  // For division championship badges
  divisionId: String,
  divisionName: String,
  // For progressive badges - current progress
  progress: {
    current: { type: Number, default: 0 },
    target: { type: Number, required: true },
    completed: { type: Boolean, default: false }
  },
  // Badge tier achieved (for tiered badges)
  tier: {
    type: Number,
    default: 1,
    min: 1,
    max: 10
  },
  // Additional metadata for specific badge types
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Whether badge is currently displayed on profile
  isDisplayed: { 
    type: Boolean, 
    default: true 
  },
  // For time-limited badges
  expiresAt: Date,
  isActive: { 
    type: Boolean, 
    default: true 
  }
}, { timestamps: true });

// Compound indexes for performance
userBadgeSchema.index({ userId: 1, badgeId: 1 }, { unique: true });
userBadgeSchema.index({ userId: 1, isDisplayed: 1 });
userBadgeSchema.index({ userId: 1, isActive: 1 });
userBadgeSchema.index({ badgeId: 1 });
userBadgeSchema.index({ divisionId: 1 });
userBadgeSchema.index({ earnedAt: -1 });
userBadgeSchema.index({ expiresAt: 1 });

// Virtual for badge details
userBadgeSchema.virtual('badge', {
  ref: 'Badge',
  localField: 'badgeId',
  foreignField: 'id',
  justOne: true
});

// Ensure virtual fields are serialized
userBadgeSchema.set('toJSON', { virtuals: true });
userBadgeSchema.set('toObject', { virtuals: true });

const UserBadge = mongoose.model('UserBadge', userBadgeSchema);
export default UserBadge;