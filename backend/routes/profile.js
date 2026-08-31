import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import sharp from 'sharp';
import {
  changeUserRole,
  getMyProfile,
  getNicknameChangeLogs,
  getProfile,
  updateProfile
} from '../controllers/profileController.js';
import { getLeaderboard, getUserStats, getUserAchievements } from '../controllers/statsController.js';
import auth from '../middleware/auth.js';
import authOptional from '../middleware/authOptional.js';
import {
  divisionFightsRepo,
  fightsRepo,
  usersRepo
} from '../repositories/index.js';
import { isPrimaryAdminEmail } from '../utils/primaryAdmin.js';
import { buildProfileFights } from '../utils/profileFights.js';
import { getUserDisplayName } from '../utils/userDisplayName.js';
import { profileUpdateValidation } from '../middleware/validation.js';
import {
  getUploadDirectory,
  removeManagedUpload
} from '../utils/uploadFiles.js';
import {
  isAllowedImageMimeType,
  isUnsafeImageError,
  isValidUploadedImage,
  MAX_IMAGE_INPUT_PIXELS
} from '../utils/imageSecurity.js';
import { parsePagination } from '../utils/pagination.js';

const router = express.Router();

const uploadDir = getUploadDirectory('backgrounds');
const avatarDir = getUploadDirectory('avatars');
fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(avatarDir, { recursive: true });

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isAllowedImageMimeType(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error('Only image uploads are allowed'));
  }
});

const saveOptimizedImage = async (file, targetDir, { maxWidth, maxHeight, quality }) => {
  const filename = `${Date.now()}-${Math.random().toString(16).slice(2)}.jpg`;
  const outputPath = path.join(targetDir, filename);

  await sharp(file.buffer, {
    failOn: 'error',
    limitInputPixels: MAX_IMAGE_INPUT_PIXELS,
    sequentialRead: true,
    animated: false
  })
    .rotate()
    .resize({
      width: maxWidth,
      height: maxHeight,
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({ quality, mozjpeg: true })
    .toFile(outputPath);

  return filename;
};

// @route   GET api/profile
// @desc    Get current user's profile
// @access  Private
router.get('/', auth, getMyProfile);

// @route   GET api/profile/all
// @desc    Get all users (admin/moderator only)
// @access  Private (admin/moderator)
router.get('/all', auth, async (req, res) => {
  try {
    const hasStaffAccess =
      req.user.role === 'admin' ||
      req.user.role === 'moderator' ||
      isPrimaryAdminEmail(req.user.email);

    if (!hasStaffAccess) {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const { page, limit } = parsePagination(req.query, {
      defaultLimit: 50,
      maxLimit: 100
    });
    const storedUsers = await usersRepo.findManyBy(
      {},
      { sort: { username: 1 }, skip: (page - 1) * limit, limit }
    );
    const users = storedUsers.map(user => ({
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
router.put('/', auth, profileUpdateValidation, updateProfile);

// @route   PUT api/profile/me
// @desc    Update current user's profile (alias for root route)
// @access  Private
router.put('/me', auth, profileUpdateValidation, updateProfile);

// @route   POST api/profile/avatar
// @desc    Upload profile avatar
// @access  Private
router.post('/avatar', auth, imageUpload.single('avatar'), async (req, res) => {
  let avatarPath = '';
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No avatar file uploaded' });
    }
    if (!isValidUploadedImage(req.file)) {
      return res.status(400).json({ message: 'Invalid or unsupported image file' });
    }

    const avatarFilename = await saveOptimizedImage(req.file, avatarDir, {
      maxWidth: 640,
      maxHeight: 640,
      quality: 82
    });
    avatarPath = `/uploads/avatars/${avatarFilename}`;
    let previousAvatar = '';
    const user = await usersRepo.updateById(req.user.id, (storedUser) => {
      storedUser.profile = storedUser.profile || {};
      previousAvatar = storedUser.profile.profilePicture || storedUser.profile.avatar || '';
      storedUser.profile.profilePicture = avatarPath;
      storedUser.profile.avatar = avatarPath;
      storedUser.updatedAt = new Date().toISOString();
      return storedUser;
    });
    if (!user) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
    }
    if (previousAvatar && previousAvatar !== avatarPath) {
      await removeManagedUpload(previousAvatar).catch((error) => {
        console.warn('Could not remove previous avatar:', error.message);
      });
    }

    res.json({ avatar: avatarPath, profilePicture: avatarPath });
  } catch (error) {
    if (avatarPath) {
      await removeManagedUpload(avatarPath).catch(() => {});
    }
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'Image must be 8 MB or smaller' });
    }
    if (error.message === 'Only image uploads are allowed') {
      return res.status(400).json({ message: error.message });
    }
    if (isUnsafeImageError(error)) {
      return res.status(400).json({ message: 'Invalid image dimensions or content' });
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
  let backgroundPath = '';
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No background file uploaded' });
    }
    if (!isValidUploadedImage(req.file)) {
      return res.status(400).json({ message: 'Invalid or unsupported image file' });
    }

    const backgroundFilename = await saveOptimizedImage(req.file, uploadDir, {
      maxWidth: 1920,
      maxHeight: 1080,
      quality: 80
    });
    backgroundPath = `/uploads/backgrounds/${backgroundFilename}`;
    let previousBackground = '';
    const user = await usersRepo.updateById(req.user.id, (storedUser) => {
      storedUser.profile = storedUser.profile || {};
      previousBackground = storedUser.profile.backgroundImage || '';
      storedUser.profile.backgroundImage = backgroundPath;
      storedUser.updatedAt = new Date().toISOString();
      return storedUser;
    });
    if (!user) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
    }
    if (previousBackground && previousBackground !== backgroundPath) {
      await removeManagedUpload(previousBackground).catch((error) => {
        console.warn('Could not remove previous background:', error.message);
      });
    }

    res.json({ backgroundPath });
  } catch (error) {
    if (backgroundPath) {
      await removeManagedUpload(backgroundPath).catch(() => {});
    }
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'Image must be 8 MB or smaller' });
    }
    if (error.message === 'Only image uploads are allowed') {
      return res.status(400).json({ message: error.message });
    }
    if (isUnsafeImageError(error)) {
      return res.status(400).json({ message: 'Invalid image dimensions or content' });
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
    let previousBackground = '';
    const user = await usersRepo.updateById(req.user.id, (storedUser) => {
      storedUser.profile = storedUser.profile || {};
      previousBackground = storedUser.profile.backgroundImage || '';
      storedUser.profile.backgroundImage = '';
      storedUser.updatedAt = new Date().toISOString();
      return storedUser;
    });
    if (!user) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
    }
    await removeManagedUpload(previousBackground).catch((error) => {
      console.warn('Could not remove profile background file:', error.message);
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
router.get('/:userId', authOptional, getProfile);

// @route   GET api/profile/:userId/stats
// @desc    Get user statistics
// @access  Public
router.get('/:userId/stats', (req, res) => {
  return getUserStats(req, res);
});

// @route   GET api/profile/:userId/fights
// @desc    Get user's fights
// @access  Public
router.get('/:userId/fights', async (req, res) => {
  try {
    const userId = req.params.userId;
    const [divisionFights, fights] = await Promise.all([
      divisionFightsRepo.findManyBy({
        $or: [{ 'team1.userId': userId }, { 'team2.userId': userId }]
      }),
      fightsRepo.findManyBy({
        $or: [
          { 'participants.userId': userId },
          { 'participants.id': userId },
          { userId },
          { createdBy: userId }
        ]
      })
    ]);
    res.json(buildProfileFights({ divisionFights, fights }, userId));
  } catch (error) {
    console.error('Error fetching profile fights:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET api/profile/:userId/achievements
// @desc    Get user's achievements
// @access  Public
router.get('/:userId/achievements', (req, res) => {
  return getUserAchievements(req, res);
});

export default router;

