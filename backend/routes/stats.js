import express from 'express';
import { getSiteStats, getUserStats, getLeaderboard, getUserAchievements } from '../controllers/statsController.js';

const router = express.Router();

// @route   GET api/stats
// @desc    Get global statistics
// @access  Public
router.get('/', getSiteStats);

// @route   GET api/stats/user/:userId
// @desc    Get user statistics
// @access  Public
router.get('/user/:userId', getUserStats);

// @route   GET api/stats/user/:userId/achievements
// @desc    Get user achievements
// @access  Public
router.get('/user/:userId/achievements', getUserAchievements);

// @route   GET api/stats/leaderboard
// @desc    Get leaderboard
// @access  Public
router.get('/leaderboard', getLeaderboard);

export default router;