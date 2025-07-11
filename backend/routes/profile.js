const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const profileController = require('../controllers/profileController');
const auth = require('../middleware/auth');

// Configure multer for file uploads
const uploadDir = path.join(__dirname, '../../public/profile-backgrounds');

// Create upload directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${req.user.id}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

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

// Get champion status for a user
router.get('/:userId/champion-status', async (req, res) => {
  try {
    await req.db.read();
    const { userId } = req.params;
    
    const user = req.db.data.users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const championDivisions = [];
    let isChampion = false;
    
    if (user.divisions) {
      Object.entries(user.divisions).forEach(([divisionId, divisionData]) => {
        if (divisionData.isChampion) {
          isChampion = true;
          championDivisions.push({
            divisionId,
            title: divisionData.championTitle,
            since: divisionData.championSince,
            titleDefenses: divisionData.titleDefenses || 0
          });
        }
      });
    }
    
    res.json({
      isChampion,
      divisions: championDivisions,
      username: user.username
    });
  } catch (error) {
    console.error('Error fetching champion status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload profile background
router.post('/background-upload', auth, upload.single('background'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    await req.db.read();
    const userIndex = req.db.data.users.findIndex(u => u.id === req.user.id);
    
    if (userIndex === -1) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete old background if it exists
    const oldBackground = req.db.data.users[userIndex].profile?.backgroundImage;
    if (oldBackground && oldBackground.startsWith('/profile-backgrounds/')) {
      const oldPath = path.join(__dirname, '../../public', oldBackground);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    // Update user profile with new background path
    const backgroundPath = `/profile-backgrounds/${req.file.filename}`;
    
    if (!req.db.data.users[userIndex].profile) {
      req.db.data.users[userIndex].profile = {};
    }
    
    req.db.data.users[userIndex].profile.backgroundImage = backgroundPath;
    await req.db.write();

    res.json({
      message: 'Background uploaded successfully',
      backgroundPath
    });
  } catch (error) {
    console.error('Error uploading background:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove profile background
router.delete('/background', auth, async (req, res) => {
  try {
    await req.db.read();
    const userIndex = req.db.data.users.findIndex(u => u.id === req.user.id);
    
    if (userIndex === -1) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete background file if it exists
    const backgroundPath = req.db.data.users[userIndex].profile?.backgroundImage;
    if (backgroundPath && backgroundPath.startsWith('/profile-backgrounds/')) {
      const filePath = path.join(__dirname, '../../public', backgroundPath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Remove background from user profile
    if (req.db.data.users[userIndex].profile) {
      req.db.data.users[userIndex].profile.backgroundImage = null;
    }
    
    await req.db.write();

    res.json({ message: 'Background removed successfully' });
  } catch (error) {
    console.error('Error removing background:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
