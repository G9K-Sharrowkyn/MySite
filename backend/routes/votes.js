const express = require('express');
const router = express.Router();
const voteController = require('../controllers/voteController');
const auth = require('../middleware/authMiddleware');

// @route   POST api/votes
// @desc    Vote on a fight
// @access  Private
router.post('/', auth, voteController.vote);

// @route   GET api/votes/fight/:fightId/user
// @desc    Get user's vote for a fight
// @access  Private
router.get('/fight/:fightId/user', auth, voteController.getUserVote);

// @route   GET api/votes/fight/:fightId/stats
// @desc    Get vote statistics for a fight
// @access  Public
router.get('/fight/:fightId/stats', voteController.getFightVoteStats);

// @route   DELETE api/votes/fight/:fightId
// @desc    Remove vote
// @access  Private
router.delete('/fight/:fightId', auth, voteController.removeVote);

// @route   GET api/votes/user/me
// @desc    Get all votes by user
// @access  Private
router.get('/user/me', auth, voteController.getUserVotes);

module.exports = router;