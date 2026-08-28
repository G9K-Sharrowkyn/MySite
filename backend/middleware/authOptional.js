import jwt from 'jsonwebtoken';
import { getAuthCookieToken } from '../utils/authCookie.js';
import { readDb } from '../repositories/index.js';

export default async function authOptional(req, _res, next) {
  const authHeader = req.header('authorization') || req.header('Authorization');
  const bearerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null;
  const presentedToken = bearerToken || req.header('x-auth-token');
  const token =
    presentedToken && presentedToken !== 'cookie-session'
      ? presentedToken
      : getAuthCookieToken(req.headers.cookie);

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const tokenUser = decoded.user;
    const db = await readDb();
    const currentUser = (db.users || []).find(
      (user) => (user.id || user._id) === (tokenUser?.id || tokenUser?._id)
    );
    if (
      currentUser &&
      Number(tokenUser?.tokenVersion || 0) ===
        Number(currentUser.tokenVersion || 0)
    ) {
      req.user = {
        ...tokenUser,
        id: currentUser.id || currentUser._id,
        role: currentUser.role
      };
    }
  } catch (_error) {
    // Ignore invalid token in optional mode.
  }
  return next();
}
