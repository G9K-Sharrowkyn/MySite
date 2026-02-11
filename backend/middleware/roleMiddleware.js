import { isPrimaryAdminEmail } from '../utils/primaryAdmin.js';

export default (roles = []) => (req, res, next) => {
  const user = req.user || {};
  const role = String(user.role || '').trim().toLowerCase();
  const allowedRoles = Array.isArray(roles)
    ? roles.map((entry) => String(entry || '').trim().toLowerCase())
    : [];

  if (!user.id) {
    return res.status(403).json({ msg: 'Access denied: missing authenticated user.' });
  }

  // Always allow the primary admin account, even if legacy data has stale role.
  if (isPrimaryAdminEmail(user.email)) {
    return next();
  }

  if (!role) {
    return res.status(403).json({ msg: 'Access denied: missing user role.' });
  }

  if (!allowedRoles.includes(role)) {
    return res.status(403).json({ msg: 'Access denied: insufficient permissions.' });
  }

  return next();
};
