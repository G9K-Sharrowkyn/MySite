const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { 
  getProposals, 
  getUserProposals, 
  getProposalById, 
  createProposal, 
  approveProposal, 
  rejectProposal, 
  deleteProposal, 
  getProposalStats 
} = require('../controllers/fighterProposalController');

const router = express.Router();

// All routes require authentication
router.use(protect);

// GET /api/fighter-proposals - Get all proposals (moderator only)
router.get('/', getProposals);

// GET /api/fighter-proposals/user - Get user's proposals
router.get('/user', getUserProposals);

// GET /api/fighter-proposals/stats - Get proposal statistics (moderator only)
router.get('/stats', getProposalStats);

// GET /api/fighter-proposals/:id - Get specific proposal
router.get('/:id', getProposalById);

// POST /api/fighter-proposals - Create new proposal
router.post('/', createProposal);

// PUT /api/fighter-proposals/:id/approve - Approve proposal (moderator only)
router.put('/:id/approve', approveProposal);

// PUT /api/fighter-proposals/:id/reject - Reject proposal (moderator only)
router.put('/:id/reject', rejectProposal);

// DELETE /api/fighter-proposals/:id - Delete proposal (user or moderator)
router.delete('/:id', deleteProposal);

module.exports = router; 