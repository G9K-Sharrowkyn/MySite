import { v4 as uuidv4 } from 'uuid';
import { moderatorActionLogsRepo } from '../repositories/index.js';

const resolveUserId = (user) => user?.id || user?._id || null;

export const logModerationAction = async ({
  db,
  actor,
  action,
  targetType,
  targetId,
  details = {}
}) => {
  if (!db || !actor || !action || !targetType) return;
  const role = actor.role || 'user';
  if (role !== 'admin' && role !== 'moderator') return;

  await moderatorActionLogsRepo.insert(
    {
      id: uuidv4(),
      actorId: resolveUserId(actor),
      actorUsername: actor.username || '',
      actorRole: role,
      action,
      targetType,
      targetId: targetId || '',
      details,
      createdAt: new Date().toISOString()
    },
    { db }
  );
};

