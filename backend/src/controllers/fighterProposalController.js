const FighterProposal = require('../models/fighterProposalModel');
const Character = require('../models/characterModel');
const User = require('../models/userModel');

// GET /api/fighter-proposals - Get all proposals (moderator only)
const getProposals = async (req, res) => {
  try {
    if (req.user.role !== 'moderator') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    const proposals = await FighterProposal.getPendingProposals();
    res.json(proposals);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/fighter-proposals/user - Get user's proposals
const getUserProposals = async (req, res) => {
  try {
    const proposals = await FighterProposal.getUserProposals(req.user._id);
    res.json(proposals);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/fighter-proposals/:id - Get specific proposal
const getProposalById = async (req, res) => {
  try {
    const proposal = await FighterProposal.findById(req.params.id)
      .populate('proposedBy', 'username')
      .populate('reviewedBy', 'username')
      .populate('approvedCharacter');
    
    if (!proposal) {
      return res.status(404).json({ message: 'Proposal not found' });
    }
    
    // Check if user can view this proposal
    if (proposal.proposedBy._id.toString() !== req.user._id.toString() && req.user.role !== 'moderator') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    res.json(proposal);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/fighter-proposals - Create new proposal
const createProposal = async (req, res) => {
  try {
    const { name, universe, description, image, suggestedDivision, powerLevel } = req.body;
    
    // Validate required fields
    if (!name || !universe || !description || !image || !suggestedDivision || !powerLevel) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    // Check if character already exists
    const existingCharacter = await Character.findOne({ 
      name: { $regex: new RegExp(name, 'i') },
      universe: { $regex: new RegExp(universe, 'i') }
    });
    
    if (existingCharacter) {
      return res.status(400).json({ message: 'Character already exists in database' });
    }
    
    // Check if user has already proposed this character
    const existingProposal = await FighterProposal.findOne({
      proposedBy: req.user._id,
      name: { $regex: new RegExp(name, 'i') },
      universe: { $regex: new RegExp(universe, 'i') },
      status: { $in: ['pending', 'approved'] }
    });
    
    if (existingProposal) {
      return res.status(400).json({ message: 'You have already proposed this character' });
    }
    
    // Create proposal
    const proposal = await FighterProposal.create({
      proposedBy: req.user._id,
      name,
      universe,
      description,
      image,
      suggestedDivision,
      powerLevel
    });
    
    // Populate user info
    await proposal.populate('proposedBy', 'username');
    
    res.status(201).json(proposal);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/fighter-proposals/:id/approve - Approve proposal (moderator only)
const approveProposal = async (req, res) => {
  try {
    if (req.user.role !== 'moderator') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    const proposal = await FighterProposal.findById(req.params.id);
    if (!proposal) {
      return res.status(404).json({ message: 'Proposal not found' });
    }
    
    if (proposal.status !== 'pending') {
      return res.status(400).json({ message: 'Proposal is not pending' });
    }
    
    const { reviewNotes } = req.body;
    
    // Approve proposal and create character
    const character = await proposal.approve(req.user._id, reviewNotes);
    
    // Award points to user who proposed
    await User.findByIdAndUpdate(proposal.proposedBy, {
      $inc: { 'activity.fighterProposals': 1, virtualCoins: 100 }
    });
    
    res.json({ 
      message: 'Proposal approved and character created',
      character,
      proposal
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/fighter-proposals/:id/reject - Reject proposal (moderator only)
const rejectProposal = async (req, res) => {
  try {
    if (req.user.role !== 'moderator') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    const proposal = await FighterProposal.findById(req.params.id);
    if (!proposal) {
      return res.status(404).json({ message: 'Proposal not found' });
    }
    
    if (proposal.status !== 'pending') {
      return res.status(400).json({ message: 'Proposal is not pending' });
    }
    
    const { reviewNotes } = req.body;
    
    // Reject proposal
    await proposal.reject(req.user._id, reviewNotes);
    
    res.json({ 
      message: 'Proposal rejected',
      proposal
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/fighter-proposals/:id - Delete proposal (user or moderator)
const deleteProposal = async (req, res) => {
  try {
    const proposal = await FighterProposal.findById(req.params.id);
    if (!proposal) {
      return res.status(404).json({ message: 'Proposal not found' });
    }
    
    // Check if user can delete this proposal
    if (proposal.proposedBy.toString() !== req.user._id.toString() && req.user.role !== 'moderator') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Only allow deletion of pending proposals
    if (proposal.status !== 'pending') {
      return res.status(400).json({ message: 'Can only delete pending proposals' });
    }
    
    await FighterProposal.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Proposal deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/fighter-proposals/stats - Get proposal statistics (moderator only)
const getProposalStats = async (req, res) => {
  try {
    if (req.user.role !== 'moderator') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    const stats = await FighterProposal.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const result = {
      pending: 0,
      approved: 0,
      rejected: 0,
      total: 0
    };
    
    stats.forEach(stat => {
      result[stat._id] = stat.count;
      result.total += stat.count;
    });
    
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getProposals,
  getUserProposals,
  getProposalById,
  createProposal,
  approveProposal,
  rejectProposal,
  deleteProposal,
  getProposalStats
}; 