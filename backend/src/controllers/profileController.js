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

module.exports = { getMyProfile, getAllProfiles, getLeaderboard };