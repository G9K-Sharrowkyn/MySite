const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');

// @route   GET api/stats/site
// @desc    Get site statistics
// @access  Public
router.get('/site', statsController.getSiteStats);

// @route   GET api/stats/user/:userId
// @desc    Get user statistics
// @access  Public
router.get('/user/:userId', statsController.getUserStats);

// @route   GET api/stats/fight/:fightId
// @desc    Get fight statistics
// @access  Public
router.get('/fight/:fightId', statsController.getFightStats);

module.exports = router;