import jwt from 'jsonwebtoken';
import { readDb, usersRepo } from '../repositories/index.js';

const resolveUserId = (user) => user?.id || user?._id || null;

const getActiveSuspension = (user) => {
  const suspension = user?.moderation?.suspension;
  if (!suspension?.active) return null;
  if (suspension.type === 'time' && suspension.until) {
    if (new Date(suspension.until).getTime() <= Date.now()) {
      return null;
    }
  }
  return suspension;
};

export default async function authMiddleware(req, res, next) {
  const authHeader = req.header('authorization') || req.header('Authorization');
  const bearerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null;
  const token = bearerToken || req.header('x-auth-token');

  if (!token) {
    return res.status(401).json({ msg: 'Authentication token is required.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user;

    const db = await readDb();
    const currentUser = await usersRepo.findOne(
      (entry) => resolveUserId(entry) === resolveUserId(req.user),
      { db }
    );
    const suspension = getActiveSuspension(currentUser);
    if (suspension) {
      return res.status(403).json({
        msg:
          suspension.type === 'time'
            ? `Account suspended until ${suspension.until}.`
            : 'Account suspended.',
        suspended: true,
        suspension
      });
    }

    return next();
  } catch (error) {
    return res.status(401).json({ msg: 'Invalid authentication token.' });
  }
}
