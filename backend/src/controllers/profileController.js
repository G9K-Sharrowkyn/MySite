const User = require('../models/userModel');

// GET /api/profile/me
const getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/profile/me
const updateMyProfile = async (req, res) => {
  try {
    const updates = {};
    const allowedFields = ['description', 'profilePicture', 'selectedCharacters'];
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'description' || field === 'profilePicture') {
          updates[`profile.${field}`] = req.body[field];
        } else {
          updates[field] = req.body[field];
        }
      }
    });

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-password');
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/profile/all
const getAllProfiles = async (req, res) => {
  try {
    const users = await User.find().select('username profile stats role');
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/profile/leaderboard
const getLeaderboard = async (req, res) => {
  try {
    const users = await User.find().sort({ 'stats.wins': -1, 'stats.losses': 1 }).limit(50).select('username stats wins losses');
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getMyProfile, updateMyProfile, getAllProfiles, getLeaderboard };