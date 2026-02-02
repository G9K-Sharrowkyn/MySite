import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { getMyProfile, getProfile, updateProfile } from '../controllers/profileController.js';
import { getLeaderboard, getUserStats, getUserAchievements } from '../controllers/statsController.js';
import auth from '../middleware/auth.js';
import { readDb, withDb } from '../repositories/index.js';
import { buildProfileFights } from '../utils/profileFights.js';

const router = express.Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.resolve(__dirname, '..', 'uploads', 'backgrounds');
const avatarDir = path.resolve(__dirname, '..', 'uploads', 'avatars');
fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(avatarDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`);
  }
});

const upload = multer({ storage });

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, avatarDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`);
  }
});

const avatarUpload = multer({ storage: avatarStorage });

const resolveUserId = (user) => user?.id || user?._id;

// @route   GET api/profile
// @desc    Get current user's profile
// @access  Private
router.get('/', auth, getMyProfile);

// @route   GET api/profile/all
// @desc    Get all users (admin/moderator only)
// @access  Private (admin/moderator)
router.get('/all', auth, async (req, res) => {
  try {
    // Check if user is admin or moderator
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const db = await readDb();
    const users = (db.users || []).map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      profilePicture: user.profilePicture,
      joinedDate: user.joinedDate,
      stats: user.stats,
      badges: user.badges
    }));

    res.json(users);
  } catch (error) {
    console.error('Error fetching all users:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

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

// @route   PUT api/profile/me
// @desc    Update current user's profile (alias for root route)
// @access  Private
router.put('/me', auth, updateProfile);

// @route   POST api/profile/avatar
// @desc    Upload profile avatar
// @access  Private
router.post('/avatar', auth, avatarUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No avatar file uploaded' });
    }

    const avatarPath = `/uploads/avatars/${req.file.filename}`;
    await withDb((db) => {
      const user = (db.users || []).find(
        (entry) => resolveUserId(entry) === req.user.id
      );
      if (!user) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      user.profile = user.profile || {};
      user.profile.profilePicture = avatarPath;
      user.profile.avatar = avatarPath;
      user.updatedAt = new Date().toISOString();
      return db;
    });

    res.json({ avatar: avatarPath, profilePicture: avatarPath });
  } catch (error) {
    if (error.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: 'User not found' });
    }
    console.error('Error uploading avatar:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST api/profile/background-upload
// @desc    Upload profile background
// @access  Private
router.post('/background-upload', auth, upload.single('background'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No background file uploaded' });
    }

    const backgroundPath = `/uploads/backgrounds/${req.file.filename}`;
    await withDb((db) => {
      const user = (db.users || []).find(
        (entry) => resolveUserId(entry) === req.user.id
      );
      if (!user) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      user.profile = user.profile || {};
      user.profile.backgroundImage = backgroundPath;
      user.updatedAt = new Date().toISOString();
      return db;
    });

    res.json({ backgroundPath });
  } catch (error) {
    if (error.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: 'User not found' });
    }
    console.error('Error uploading background:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE api/profile/background
// @desc    Remove profile background
// @access  Private
router.delete('/background', auth, async (req, res) => {
  try {
    await withDb((db) => {
      const user = (db.users || []).find(
        (entry) => resolveUserId(entry) === req.user.id
      );
      if (!user) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      user.profile = user.profile || {};
      user.profile.backgroundImage = '';
      user.updatedAt = new Date().toISOString();
      return db;
    });

    res.json({ message: 'Background removed' });
  } catch (error) {
    if (error.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: 'User not found' });
    }
    console.error('Error removing background:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET api/profile/:userId
// @desc    Get profile by user ID
// @access  Public
router.get('/:userId', getProfile);

// @route   GET api/profile/:userId/stats
// @desc    Get user statistics
// @access  Public
router.get('/:userId/stats', (req, res) => {
  return getUserStats(req, res);
});

// @route   GET api/profile/:userId/fights
// @desc    Get user's fights
// @access  Public
router.get('/:userId/fights', (req, res) => {
  return readDb()
    .then((db) => res.json(buildProfileFights(db, req.params.userId)))
    .catch((error) => {
      console.error('Error fetching profile fights:', error);
      res.status(500).json({ message: 'Server error' });
    });
});

// @route   GET api/profile/:userId/achievements
// @desc    Get user's achievements
// @access  Public
router.get('/:userId/achievements', (req, res) => {
  return getUserAchievements(req, res);
});

export default router;

