import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import {
  changeUserRole,
  getMyProfile,
  getNicknameChangeLogs,
  getProfile,
  updateProfile
} from '../controllers/profileController.js';
import { getLeaderboard, getUserStats, getUserAchievements } from '../controllers/statsController.js';
import auth from '../middleware/auth.js';
import { readDb, withDb } from '../repositories/index.js';
import { buildProfileFights } from '../utils/profileFights.js';
import { getUserDisplayName } from '../utils/userDisplayName.js';

const router = express.Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.resolve(__dirname, '..', 'uploads', 'backgrounds');
const avatarDir = path.resolve(__dirname, '..', 'uploads', 'avatars');
fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(avatarDir, { recursive: true });

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (String(file.mimetype || '').startsWith('image/')) {
      cb(null, true);
      return;
    }
    cb(new Error('Only image uploads are allowed'));
  }
});

const saveOptimizedImage = async (file, targetDir, { maxWidth, maxHeight, quality }) => {
  const filename = `${Date.now()}-${Math.random().toString(16).slice(2)}.webp`;
  const outputPath = path.join(targetDir, filename);

  await sharp(file.buffer)
    .rotate()
    .resize({
      width: maxWidth,
      height: maxHeight,
      fit: 'inside',
      withoutEnlargement: true
    })
    .webp({ quality })
    .toFile(outputPath);

  return filename;
};

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
      displayName: getUserDisplayName(user),
      email: user.email,
      role: user.role,
      profilePicture: user.profile?.profilePicture || user.profile?.avatar || '',
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

// @route   GET api/profile/nickname-logs
// @desc    Get nickname change logs (admin/moderator)
// @access  Private
router.get('/nickname-logs', auth, getNicknameChangeLogs);

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
router.post('/avatar', auth, imageUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No avatar file uploaded' });
    }

    const avatarFilename = await saveOptimizedImage(req.file, avatarDir, {
      maxWidth: 640,
      maxHeight: 640,
      quality: 82
    });
    const avatarPath = `/uploads/avatars/${avatarFilename}`;
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
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'Image must be 8 MB or smaller' });
    }
    if (error.message === 'Only image uploads are allowed') {
      return res.status(400).json({ message: error.message });
    }
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
router.post('/background-upload', auth, imageUpload.single('background'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No background file uploaded' });
    }

    const backgroundFilename = await saveOptimizedImage(req.file, uploadDir, {
      maxWidth: 1920,
      maxHeight: 1080,
      quality: 80
    });
    const backgroundPath = `/uploads/backgrounds/${backgroundFilename}`;
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
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'Image must be 8 MB or smaller' });
    }
    if (error.message === 'Only image uploads are allowed') {
      return res.status(400).json({ message: error.message });
    }
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

// @route   POST api/profile/:userId/role
// @desc    Grant/revoke moderator role (admin only)
// @access  Private
router.post('/:userId/role', auth, changeUserRole);

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

