import {
  feedbackRepo,
  moderatorActionLogsRepo,
  usersRepo,
  withRepositoryTransaction
} from '../repositories/index.js';
import { getUserDisplayName } from '../utils/userDisplayName.js';
import { logModerationAction } from '../utils/moderationAudit.js';

const isStaff = (user) => user?.role === 'admin' || user?.role === 'moderator';
const isAdmin = (user) => user?.role === 'admin';
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

const buildModerationUser = (user) => ({
  id: resolveUserId(user),
  username: user.username || '',
  displayName: getUserDisplayName(user),
  email: user.email || '',
  role: user.role || 'user',
  suspension: getActiveSuspension(user)
});

export const getModerationLogs = async (req, res) => {
  try {
    if (!isStaff(req.user)) {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const { limit = 200 } = req.query;
    const limitNumber = Math.max(1, Math.min(Number(limit) || 200, 1000));
    const sorted = await moderatorActionLogsRepo.findManyBy(
      {},
      { sort: { createdAt: -1 }, limit: limitNumber }
    );

    res.json(sorted);
  } catch (error) {
    console.error('Error fetching moderation logs:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

export const getReportsQueue = async (req, res) => {
  try {
    if (!isStaff(req.user)) {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const [statusCounts, queue, total] = await Promise.all([
      feedbackRepo.groupCountBy('status'),
      feedbackRepo.findManyBy(
        { status: { $in: ['pending', 'reviewed'] } },
        { sort: { createdAt: -1 }, limit: 200 }
      ),
      feedbackRepo.countBy({})
    ]);
    const counts = {
      pending: statusCounts.pending || 0,
      reviewed: statusCounts.reviewed || 0,
      resolved: statusCounts.resolved || 0,
      dismissed: statusCounts.dismissed || 0,
      approved: statusCounts.approved || 0
    };
    res.json({ counts, queue, total });
  } catch (error) {
    console.error('Error fetching reports queue:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

export const listUsersForModeration = async (req, res) => {
  try {
    if (!isStaff(req.user)) {
      return res.status(403).json({ msg: 'Access denied' });
    }
    const users = await usersRepo.findManyBy(
      { role: { $ne: 'admin' } },
      { sort: { username: 1 }, limit: 200 }
    );
    const filtered = users.map(buildModerationUser);
    return res.json(filtered);
  } catch (error) {
    console.error('Error listing users for moderation:', error);
    return res.status(500).json({ msg: 'Server error' });
  }
};

export const suspendUser = async (req, res) => {
  const targetUserId = String(req.params.userId || '');
  const type = String(req.body?.type || '').trim();
  const reason = String(req.body?.reason || '').trim();
  const durationHours = Number(req.body?.durationHours || 0);

  if (!['soft', 'time'].includes(type)) {
    return res.status(400).json({ msg: 'Suspension type must be soft or time.' });
  }
  if (!reason) {
    return res.status(400).json({ msg: 'Suspension reason is required.' });
  }
  if (type === 'time' && (!Number.isFinite(durationHours) || durationHours <= 0)) {
    return res.status(400).json({ msg: 'durationHours must be a positive number for time suspension.' });
  }

  try {
    let updated = null;
    await withRepositoryTransaction(async (context) => {
      const actor = await usersRepo.findById(req.user.id, context);
      if (!actor || !isStaff(actor)) {
        const err = new Error('Access denied');
        err.code = 'ACCESS_DENIED';
        throw err;
      }

      const target = await usersRepo.findById(targetUserId, context);
      if (!target) {
        const err = new Error('User not found');
        err.code = 'USER_NOT_FOUND';
        throw err;
      }
      if ((target.role || 'user') === 'admin') {
        const err = new Error('Cannot suspend admin account.');
        err.code = 'TARGET_ADMIN';
        throw err;
      }
      if ((target.role || 'user') === 'moderator' && !isAdmin(actor)) {
        const err = new Error('Only admin can suspend moderator accounts.');
        err.code = 'TARGET_MODERATOR';
        throw err;
      }

      const maxHours = isAdmin(actor) ? 24 * 365 : 24 * 30;
      const boundedHours = Math.min(Math.max(durationHours || 0, 1), maxHours);
      const now = new Date();
      const until = type === 'time' ? new Date(now.getTime() + boundedHours * 60 * 60 * 1000) : null;

      updated = await usersRepo.updateById(targetUserId, (storedTarget) => {
        storedTarget.moderation = storedTarget.moderation || {};
        storedTarget.moderation.suspension = {
          active: true,
          type,
          reason,
          startedAt: now.toISOString(),
          until: until ? until.toISOString() : null,
          createdById: resolveUserId(actor),
          createdByUsername: actor.username || '',
          createdByRole: actor.role || 'user'
        };
        storedTarget.updatedAt = now.toISOString();
        return storedTarget;
      }, context);

      await logModerationAction({
        db: context,
        actor,
        action: 'user.suspend',
        targetType: 'user',
        targetId: resolveUserId(target),
        details: {
          type,
          reason,
          durationHours: type === 'time' ? boundedHours : null
        }
      });

    });

    return res.json({ msg: 'User suspended successfully.', user: buildModerationUser(updated) });
  } catch (error) {
    if (error.code === 'ACCESS_DENIED') return res.status(403).json({ msg: 'Access denied' });
    if (error.code === 'USER_NOT_FOUND') return res.status(404).json({ msg: 'User not found' });
    if (error.code === 'TARGET_ADMIN') return res.status(400).json({ msg: error.message });
    if (error.code === 'TARGET_MODERATOR') return res.status(403).json({ msg: error.message });
    console.error('Error suspending user:', error);
    return res.status(500).json({ msg: 'Server error' });
  }
};

export const unsuspendUser = async (req, res) => {
  const targetUserId = String(req.params.userId || '');
  try {
    let updated = null;
    await withRepositoryTransaction(async (context) => {
      const actor = await usersRepo.findById(req.user.id, context);
      if (!actor || !isStaff(actor)) {
        const err = new Error('Access denied');
        err.code = 'ACCESS_DENIED';
        throw err;
      }

      const target = await usersRepo.findById(targetUserId, context);
      if (!target) {
        const err = new Error('User not found');
        err.code = 'USER_NOT_FOUND';
        throw err;
      }
      if ((target.role || 'user') === 'moderator' && !isAdmin(actor)) {
        const err = new Error('Only admin can unsuspend moderator accounts.');
        err.code = 'TARGET_MODERATOR';
        throw err;
      }

      const previous = target.moderation?.suspension || null;
      updated = await usersRepo.updateById(targetUserId, (storedTarget) => {
        storedTarget.moderation = storedTarget.moderation || {};
        storedTarget.moderation.suspension = {
          ...(previous || {}),
          active: false,
          endedAt: new Date().toISOString(),
          endedById: resolveUserId(actor),
          endedByUsername: actor.username || '',
          endedByRole: actor.role || 'user'
        };
        storedTarget.updatedAt = new Date().toISOString();
        return storedTarget;
      }, context);

      await logModerationAction({
        db: context,
        actor,
        action: 'user.unsuspend',
        targetType: 'user',
        targetId: resolveUserId(target),
        details: {
          previousType: previous?.type || null,
          previousReason: previous?.reason || null
        }
      });

    });

    return res.json({ msg: 'User suspension removed.', user: buildModerationUser(updated) });
  } catch (error) {
    if (error.code === 'ACCESS_DENIED') return res.status(403).json({ msg: 'Access denied' });
    if (error.code === 'USER_NOT_FOUND') return res.status(404).json({ msg: 'User not found' });
    if (error.code === 'TARGET_MODERATOR') return res.status(403).json({ msg: error.message });
    console.error('Error unsuspending user:', error);
    return res.status(500).json({ msg: 'Server error' });
  }
};
