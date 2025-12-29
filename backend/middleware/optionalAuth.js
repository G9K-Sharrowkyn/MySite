import jwt from 'jsonwebtoken';

// Optional auth - allows both authenticated and anonymous users
export const optionalAuth = (req, res, next) => {
  const token = req.header('x-auth-token');

  if (!token) {
    // No token - continue as anonymous
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded.user;
    next();
  } catch (err) {
    // Invalid token - continue as anonymous
    req.user = null;
    next();
  }
};
