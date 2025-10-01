const mongoose = require('mongoose');

const fighterProposalSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  universe: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  powerLevel: {
    type: String,
    required: true,
    enum: ['Regular People', 'Metahuman', 'Planet Busters', 'God Tier', 'Universal Threat', 'Omnipotent'],
    default: 'Regular People'
  },
  abilities: {
    type: String,
    trim: true,
    maxlength: 500
  },
  imageUrl: {
    type: String,
    required: true
  },
  imageFilename: {
    type: String,
    required: true
  },
  proposedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  moderatorNotes: {
    type: String,
    trim: true,
    maxlength: 500
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
fighterProposalSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for efficient queries
fighterProposalSchema.index({ status: 1, createdAt: -1 });
fighterProposalSchema.index({ proposedBy: 1, createdAt: -1 });
fighterProposalSchema.index({ reviewedBy: 1, reviewedAt: -1 });

// Virtual for proposal age
fighterProposalSchema.virtual('age').get(function() {
  return Date.now() - this.createdAt;
});

// Method to approve proposal
fighterProposalSchema.methods.approve = function(moderatorId, notes = '') {
  this.status = 'approved';
  this.reviewedBy = moderatorId;
  this.reviewedAt = new Date();
  this.moderatorNotes = notes;
  return this.save();
};

// Method to reject proposal
fighterProposalSchema.methods.reject = function(moderatorId, notes = '') {
  this.status = 'rejected';
  this.reviewedBy = moderatorId;
  this.reviewedAt = new Date();
  this.moderatorNotes = notes;
  return this.save();
};

// Static method to get pending proposals
fighterProposalSchema.statics.getPending = function() {
  return this.find({ status: 'pending' })
    .populate('proposedBy', 'username email')
    .sort({ createdAt: -1 });
};

// Static method to get proposals by user
fighterProposalSchema.statics.getByUser = function(userId) {
  return this.find({ proposedBy: userId })
    .sort({ createdAt: -1 });
};

// Static method to get reviewed proposals
fighterProposalSchema.statics.getReviewed = function() {
  return this.find({ status: { $in: ['approved', 'rejected'] } })
    .populate('proposedBy', 'username email')
    .populate('reviewedBy', 'username')
    .sort({ reviewedAt: -1 });
};

// Static method to get statistics
fighterProposalSchema.statics.getStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
};

module.exports = mongoose.model('FighterProposal', fighterProposalSchema);