const User = require('../models/userModel');

// GET /api/users/search
const searchUsers = async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);
  
  try {
    const users = await User.find({
      username: { $regex: q, $options: 'i' }
    }).select('username avatar role').limit(10);
    
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { searchUsers };