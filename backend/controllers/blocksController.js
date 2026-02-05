import { v4 as uuidv4 } from 'uuid';
import {
  blocksRepo,
  friendRequestsRepo,
  friendshipsRepo,
  readDb,
  usersRepo,
  withDb
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
    const db = await readDb();
    const blocks = await blocksRepo.getAll({ db });
    const blockedIds = blocks
      .filter((entry) => entry.blockerId === req.user.id)
      .map((entry) => entry.blockedId);

    const users = await usersRepo.getAll({ db });
    const blocked = users
      .filter((u) => blockedIds.includes(resolveUserId(u)))
      .map(normalizeUserSummary);
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

    await withDb(async (db) => {
      const users = await usersRepo.getAll({ db });
      const target = users.find((u) => resolveUserId(u) === targetId);
      if (!target) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      const blocks = await blocksRepo.getAll({ db });
      const exists = blocks.find((b) => b.blockerId === req.user.id && b.blockedId === targetId);
      if (!exists) {
        await blocksRepo.insert(
          { id: uuidv4(), blockerId: req.user.id, blockedId: targetId, createdAt: now },
          { db }
        );
      }

      // Remove friendship
      const [userId1, userId2] = sortPair(req.user.id, targetId);
      await friendshipsRepo.updateAll((friendships) => {
        return friendships.filter((entry) => !(entry.userId1 === userId1 && entry.userId2 === userId2));
      }, { db });

      // Cancel any pending friend requests both directions
      await friendRequestsRepo.updateAll((requests) => {
        return requests.map((entry) => {
          if (
            entry.status === 'pending' &&
            ((entry.fromUserId === req.user.id && entry.toUserId === targetId) ||
              (entry.fromUserId === targetId && entry.toUserId === req.user.id))
          ) {
            return { ...entry, status: 'cancelled', respondedAt: now };
          }
          return entry;
        });
      }, { db });

      return db;
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

    await withDb(async (db) => {
      await blocksRepo.updateAll((blocks) => {
        return blocks.filter((entry) => !(entry.blockerId === req.user.id && entry.blockedId === targetId));
      }, { db });
      return db;
    });

    res.json({ msg: 'User unblocked' });
  } catch (error) {
    console.error('Error unblocking user:', error?.message || error);
    res.status(500).json({ msg: 'Server error' });
  }
};

export const isBlocked = async (db, a, b) => {
  const blocks = await blocksRepo.getAll({ db });
  return blocks.some((entry) => entry.blockerId === a && entry.blockedId === b);
};

// GET /api/blocks/status/:userId
export const getBlockStatus = async (req, res) => {
  try {
    const targetId = String(req.params.userId || '').trim();
    if (!targetId) return res.status(400).json({ msg: 'User id required' });
    const db = await readDb();
    const blocks = await blocksRepo.getAll({ db });
    const blocked = blocks.some((b) => b.blockerId === req.user.id && b.blockedId === targetId);
    const blockedBy = blocks.some((b) => b.blockerId === targetId && b.blockedId === req.user.id);
    res.json({ blocked, blockedBy });
  } catch (error) {
    console.error('Error getting block status:', error?.message || error);
    res.status(500).json({ msg: 'Server error' });
  }
};
