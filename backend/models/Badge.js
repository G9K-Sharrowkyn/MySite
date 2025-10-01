import mongoose from 'mongoose';

const badgeSchema = new mongoose.Schema({
  id: { 
    type: String, 
    required: true, 
    unique: true 
  },
  name: { 
    type: String, 
    required: true 
  },
  description: { 
    type: String, 
    required: true 
  },
  icon: { 
    type: String, 
    required: true 
  },
  category: { 
    type: String, 
    required: true,
    enum: [
      'fighting', 
      'social', 
      'achievement', 
      'division', 
      'championship', 
      'betting', 
      'special',
      'milestone',
      'community'
    ]
  },
  rarity: { 
    type: String, 
    required: true,
    enum: ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'],
    default: 'common'
  },
  color: { 
    type: String, 
    required: true 
  },
  requirements: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  // For division championship badges
  divisionId: String,
  // For time-limited badges
  expiresAt: Date,
  // Badge tier (for progressive badges)
  tier: {
    type: Number,
    default: 1,
    min: 1,
    max: 10
  }
}, { timestamps: true });

// Indexes for performance
badgeSchema.index({ category: 1 });
badgeSchema.index({ rarity: 1 });
badgeSchema.index({ isActive: 1 });
badgeSchema.index({ divisionId: 1 });

const Badge = mongoose.model('Badge', badgeSchema);
export default Badge;