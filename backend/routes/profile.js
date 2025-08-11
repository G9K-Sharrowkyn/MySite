import express from 'express';
import express from 'express';
import multer from 'multer';
import path from 'path';
import { getMyProfile, getProfile, updateProfile, uploadProfileBackground, removeProfileBackground } from '../controllers/profileController.js';
import { getLeaderboard } from '../controllers/statsController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/backgrounds/');
  },
  filename: function (req, file, cb) {
    cb(null, req.user.id + '-' + Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// @route   GET api/profile
// @desc    Get current user's profile
// @access  Private
router.get('/', auth, getMyProfile);

// @route   GET api/profile/leaderboard
// @desc    Get leaderboard (alias for stats leaderboard)
// @access  Public
router.get('/leaderboard', getLeaderboard);

// @route   GET api/profile/me
// @desc    Get current user's profile (alias for root route)
// @access  Private
router.get('/me', auth, getMyProfile);

// @route   PUT api/profile
// @desc    Update current user's profile
// @access  Private
router.put('/', auth, updateProfile);

// @route   POST api/profile/avatar
// @desc    Upload profile avatar
// @access  Private
router.post('/avatar', auth, (req, res) => {
  res.status(501).json({ message: 'Avatar upload not implemented yet' });
});

// @route   POST api/profile/background-upload
// @desc    Upload profile background
// @access  Private
router.post('/background-upload', [auth, upload.single('background')], uploadProfileBackground);

// @route   DELETE api/profile/background
// @desc    Remove profile background
// @access  Private
router.delete('/background', auth, removeProfileBackground);

// @route   GET api/profile/:userId
// @desc    Get profile by user ID
// @access  Public
router.get('/:userId', getProfile);

// @route   GET api/profile/:userId/stats
// @desc    Get user statistics
// @access  Public
router.get('/:userId/stats', (req, res) => {
  res.status(501).json({ message: 'Stats endpoint not implemented yet' });
});

// @route   GET api/profile/:userId/fights
// @desc    Get user's fights
// @access  Public
router.get('/:userId/fights', (req, res) => {
  res.status(501).json({ message: 'Fights endpoint not implemented yet' });
});

// @route   GET api/profile/:userId/achievements
// @desc    Get user's achievements
// @access  Public
router.get('/:userId/achievements', (req, res) => {
  res.status(501).json({ message: 'Achievements endpoint not implemented yet' });
});

export default router;
