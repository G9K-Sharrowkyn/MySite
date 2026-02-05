import jwt from 'jsonwebtoken';

export default function authOptional(req, _res, next) {
  const authHeader = req.header('authorization') || req.header('Authorization');
  const bearerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null;
  const token = bearerToken || req.header('x-auth-token');

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user;
  } catch (_error) {
    // Ignore invalid token in optional mode.
  }
  return next();
}

