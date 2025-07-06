const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const auth = require('../middleware/authMiddleware');

// @route   GET api/profile/all
// @desc    Get all user profiles (public data)
// @access  Public
router.get('/all', profileController.getAllProfiles);

// @route   GET api/profile/leaderboard
// @desc    Get user leaderboard
// @access  Public
router.get('/leaderboard', profileController.getLeaderboard);

// @route   GET api/profile/search
// @desc    Search user profiles by username
// @access  Public
router.get('/search', profileController.searchProfiles);

// @route   GET api/profile/me
// @desc    Get current user's profile
// @access  Private
router.get('/me', auth, profileController.getMyProfile);

// @route   PUT api/profile/me
// @desc    Update user profile
// @access  Private
router.put('/me', auth, profileController.updateProfile);

// @route   GET api/profile/:userId
// @desc    Get user profile by ID
// @access  Public
router.get('/:userId', profileController.getProfile);

module.exports = router;
