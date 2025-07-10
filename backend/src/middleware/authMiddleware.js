const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

const protect = async (req, res, next) => {
  let token;

  // Check for token in headers (multiple formats for compatibility)
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.headers['x-auth-token']) {
    token = req.headers['x-auth-token'];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, token missing' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Handle both new format (id) and old format (user.id)
    const userId = decoded.id || decoded.user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: 'Invalid token format' });
    }

    req.user = await User.findById(userId).select('-password');
    if (!req.user) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    next();
  } catch (error) {
    console.error('JWT Error:', error);
    res.status(401).json({ message: 'Not authorized, token invalid' });
  }
};

module.exports = { protect };