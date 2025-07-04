const express = require('express');
const router = express.Router();
const voteController = require('../controllers/voteController');
const auth = require('../middleware/auth');

// @route   POST api/votes/fight/:fightId
// @desc    Vote for team A or B in a fight
// @access  Private
router.post('/fight/:fightId', auth, voteController.voteForFight);

// @route   GET api/votes/fight/:fightId
// @desc    Get vote results for a fight
// @access  Public
router.get('/fight/:fightId', voteController.getFightVotes);

// @route   GET api/votes/user/:userId
// @desc    Get user's voting history
// @access  Private
router.get('/user/:userId', auth, voteController.getUserVotes);

module.exports = router;