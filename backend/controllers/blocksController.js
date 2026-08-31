import { v4 as uuidv4 } from 'uuid';
import {
  blocksRepo,
  friendRequestsRepo,
  friendshipsRepo,
  usersRepo,
  withRepositoryTransaction
} from '../repositories/index.js';
import { getUserDisplayName } from '../utils/userDisplayName.js';

const resolveUserId = (user) => user?.id || user?._id;
const sortPair = (a, b) => (String(a) < String(b) ? [String(a), String(b)] : [String(b), String(a)]);

const normalizeUserSummary = (user) => ({
  id: resolveUserId(user),
  username: user?.username || '',
  displayName: getUserDisplayName(user),
  profilePicture: user?.profile?.profilePicture || user?.profile?.avatar || ''
});

// GET /api/blocks
export const listBlockedUsers = async (req, res) => {
  try {
    const blocks = await blocksRepo.findManyBy({ blockerId: req.user.id });
    const blockedIds = blocks
      .filter((entry) => entry.blockerId === req.user.id)
      .map((entry) => entry.blockedId);

    const users = blockedIds.length
      ? await usersRepo.findManyBy({ id: { $in: blockedIds } }, { limit: blockedIds.length })
      : [];
    const blocked = users.map(normalizeUserSummary);
    res.json({ blocked });
  } catch (error) {
    console.error('Error listing blocks:', error?.message || error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// POST /api/blocks/:userId
export const blockUser = async (req, res) => {
  try {
    const targetId = String(req.params.userId || '').trim();
    if (!targetId || targetId === req.user.id) {
      return res.status(400).json({ msg: 'Invalid user' });
    }
    const now = new Date().toISOString();

    await withRepositoryTransaction(async (context) => {
      const target = await usersRepo.findById(targetId, 'id', context);
      if (!target) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      await blocksRepo.insertIfAbsent(
        { blockerId: req.user.id, blockedId: targetId },
        {
          id: uuidv4(),
          blockKey: `${req.user.id}:${targetId}`,
          blockerId: req.user.id,
          blockedId: targetId,
          createdAt: now
        },
        context
      );

      // Remove friendship
      const [userId1, userId2] = sortPair(req.user.id, targetId);
      await friendshipsRepo.removeManyBy({ userId1, userId2 }, context);

      // Cancel any pending friend requests both directions
      await friendRequestsRepo.patchManyBy({
        status: 'pending',
        $or: [
          { fromUserId: req.user.id, toUserId: targetId },
          { fromUserId: targetId, toUserId: req.user.id }
        ]
      }, { status: 'cancelled', respondedAt: now }, context);
    });

    res.json({ msg: 'User blocked' });
  } catch (error) {
    if (error.code === 'USER_NOT_FOUND') return res.status(404).json({ msg: 'User not found' });
    console.error('Error blocking user:', error?.message || error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// DELETE /api/blocks/:userId
export const unblockUser = async (req, res) => {
  try {
    const targetId = String(req.params.userId || '').trim();
    if (!targetId) return res.status(400).json({ msg: 'Invalid user' });

    await blocksRepo.removeManyBy({ blockerId: req.user.id, blockedId: targetId });

    res.json({ msg: 'User unblocked' });
  } catch (error) {
    console.error('Error unblocking user:', error?.message || error);
    res.status(500).json({ msg: 'Server error' });
  }
};

export const isBlocked = async (db, a, b) => {
  const context = db?.mongoDb || db?.db ? db : db ? { db } : undefined;
  return Boolean(await blocksRepo.findOneBy(
    { blockerId: a, blockedId: b },
    {},
    context
  ));
};

// GET /api/blocks/status/:userId
export const getBlockStatus = async (req, res) => {
  try {
    const targetId = String(req.params.userId || '').trim();
    if (!targetId) return res.status(400).json({ msg: 'User id required' });
    const [blocked, blockedBy] = await Promise.all([
      blocksRepo.findOneBy({ blockerId: req.user.id, blockedId: targetId }),
      blocksRepo.findOneBy({ blockerId: targetId, blockedId: req.user.id })
    ]);
    res.json({ blocked: Boolean(blocked), blockedBy: Boolean(blockedBy) });
  } catch (error) {
    console.error('Error getting block status:', error?.message || error);
    res.status(500).json({ msg: 'Server error' });
  }
};
