import { usersRepo } from '../repositories/index.js';
import { isPrimaryAdminEmail } from '../utils/primaryAdmin.js';

const resolveUserId = (user) => user?.id || user?._id;

const moderatorAuth = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    const user = await usersRepo.findOne(
      (entry) => resolveUserId(entry) === req.user.id
    );
    if (!user) {
      return res.status(401).json({ msg: 'User not found' });
    }

    const hasAccess =
      user.role === 'moderator' ||
      user.role === 'admin' ||
      isPrimaryAdminEmail(user.email);
    if (!hasAccess) {
      return res
        .status(403)
        .json({ msg: 'Access denied. Moderator or admin role required.' });
    }

    next();
  } catch (error) {
    console.error('Moderator auth middleware error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

export default moderatorAuth;
