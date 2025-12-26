import jwt from 'jsonwebtoken';

export default function (req, res, next) {
  // Get token from header
  const authHeader = req.header('authorization') || req.header('Authorization');
  const bearerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null;
  const token = bearerToken || req.header('x-auth-token');

  // Check if not token
  if (!token) {
    return res.status(401).json({ msg: 'Brak tokena, autoryzacja zabroniona' });
  }

  // Verify token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Token nie jest prawidłowy' });
  }
};
