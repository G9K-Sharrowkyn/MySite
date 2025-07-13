import express from 'express';
import { vote, getUserVote, getFightVoteStats, removeVote, getUserVotes } from '../controllers/voteController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// @route   POST api/votes
// @desc    Create a vote
// @access  Private
router.post('/', auth, vote);

// @route   GET api/votes/fight/:fightId/user
// @desc    Get user's vote for a fight
// @access  Private
router.get('/fight/:fightId/user', auth, getUserVote);

// @route   GET api/votes/fight/:fightId/stats
// @desc    Get vote statistics for a fight
// @access  Public
router.get('/fight/:fightId/stats', getFightVoteStats);

// @route   DELETE api/votes/fight/:fightId
// @desc    Remove vote
// @access  Private
router.delete('/fight/:fightId', auth, removeVote);

// @route   GET api/votes/user/me
// @desc    Get all votes by user
// @access  Private
router.get('/user/me', auth, getUserVotes);

export default router;