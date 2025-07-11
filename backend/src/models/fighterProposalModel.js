const mongoose = require('mongoose');

const fighterProposalSchema = new mongoose.Schema({
  proposedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  universe: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  image: {
    type: String,
    required: true
  },
  suggestedDivision: {
    type: String,
    enum: ['Regular People', 'Metahuman', 'Planet Busters', 'God Tier', 'Universal Threat', 'Omnipotent'],
    required: true
  },
  powerLevel: {
    type: Number,
    min: 1,
    max: 6,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  },
  reviewNotes: {
    type: String,
    trim: true
  },
  approvedCharacter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Character'
  }
}, {
  timestamps: true
});

// Index for efficient querying
fighterProposalSchema.index({ status: 1, createdAt: -1 });
fighterProposalSchema.index({ proposedBy: 1, status: 1 });

// Virtual for proposal age
fighterProposalSchema.virtual('age').get(function() {
  return Date.now() - this.createdAt;
});

// Instance method to check if proposal is recent
fighterProposalSchema.methods.isRecent = function(hours = 24) {
  return this.age < hours * 60 * 60 * 1000;
};

// Static method to get pending proposals
fighterProposalSchema.statics.getPendingProposals = function() {
  return this.find({ status: 'pending' })
    .populate('proposedBy', 'username')
    .sort({ createdAt: -1 });
};

// Static method to get proposals by user
fighterProposalSchema.statics.getUserProposals = function(userId) {
  return this.find({ proposedBy: userId })
    .sort({ createdAt: -1 });
};

// Static method to approve proposal and create character
fighterProposalSchema.methods.approve = async function(reviewerId, notes = '') {
  const Character = require('./characterModel');
  
  try {
    // Create the character
    const character = await Character.create({
      name: this.name,
      universe: this.universe,
      description: this.description,
      image: this.image,
      division: this.suggestedDivision,
      powerLevel: this.powerLevel
    });
    
    // Update proposal status
    this.status = 'approved';
    this.reviewedBy = reviewerId;
    this.reviewedAt = new Date();
    this.reviewNotes = notes;
    this.approvedCharacter = character._id;
    
    await this.save();
    
    return character;
  } catch (error) {
    throw error;
  }
};

// Static method to reject proposal
fighterProposalSchema.methods.reject = async function(reviewerId, notes = '') {
  this.status = 'rejected';
  this.reviewedBy = reviewerId;
  this.reviewedAt = new Date();
  this.reviewNotes = notes;
  
  await this.save();
};

module.exports = mongoose.model('FighterProposal', fighterProposalSchema); 