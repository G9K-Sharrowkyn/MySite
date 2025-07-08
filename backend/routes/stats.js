const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const auth = require('../middleware/auth');

// @route   GET api/stats/site
// @desc    Get site statistics
// @access  Public
router.get('/site', statsController.getSiteStats);

// @route   GET api/stats/user/:userId
// @desc    Get user statistics
// @access  Public
router.get('/user/:userId', statsController.getUserStats);

// @route   GET api/stats/user/:userId/achievements
// @desc    Get user achievements
// @access  Public
router.get('/user/:userId/achievements', statsController.getUserAchievements);

// @route   POST api/stats/achievements/award
// @desc    Award achievement to user
// @access  Private
router.post('/achievements/award', auth, statsController.awardAchievement);

// @route   POST api/stats/achievements/streak
// @desc    Award streak achievement to user
// @access  Private
router.post('/achievements/streak', auth, statsController.awardStreakAchievement);

// @route   GET api/stats/leaderboard
// @desc    Get leaderboard
// @access  Public
router.get('/leaderboard', statsController.getLeaderboard);

// @route   GET api/stats/fight/:fightId
// @desc    Get fight statistics
// @access  Public
router.get('/fight/:fightId', statsController.getFightStats);

module.exports = router;