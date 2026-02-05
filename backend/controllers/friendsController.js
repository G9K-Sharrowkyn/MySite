import { v4 as uuidv4 } from 'uuid';
import {
  blocksRepo,
  friendRequestsRepo,
  friendshipsRepo,
  readDb,
  usersRepo,
  withDb
} from '../repositories/index.js';
import { createNotification } from './notificationController.js';
import { getUserDisplayName } from '../utils/userDisplayName.js';

const resolveUserId = (user) => user?.id || user?._id;

const normalizeUserSummary = (user) => ({
  id: resolveUserId(user),
  username: user?.username || '',
  displayName: getUserDisplayName(user),
  profilePicture: user?.profile?.profilePicture || user?.profile?.avatar || ''
});

const sortPair = (a, b) => (String(a) < String(b) ? [String(a), String(b)] : [String(b), String(a)]);

const isBlockedEitherWay = async (db, a, b) => {
  const blocks = await blocksRepo.getAll({ db });
  return blocks.some(
    (entry) =>
      (entry.blockerId === a && entry.blockedId === b) ||
      (entry.blockerId === b && entry.blockedId === a)
  );
};

const areFriends = async (db, a, b) => {
  const [userId1, userId2] = sortPair(a, b);
  const friendships = await friendshipsRepo.getAll({ db });
  return friendships.some((entry) => entry.userId1 === userId1 && entry.userId2 === userId2);
};

// GET /api/friends/status/:userId
export const getFriendStatus = async (req, res) => {
  try {
    const targetId = String(req.params.userId || '').trim();
    if (!targetId) return res.status(400).json({ msg: 'User id required' });
    if (targetId === req.user.id) return res.json({ status: 'self' });

    const db = await readDb();
    const blocked = await isBlockedEitherWay(db, req.user.id, targetId);
    if (blocked) {
      // Detailed direction is available via /api/blocks/status but we treat as blocked here.
      return res.json({ status: 'blocked' });
    }

    if (await areFriends(db, req.user.id, targetId)) {
      return res.json({ status: 'friends' });
    }

    const requests = await friendRequestsRepo.getAll({ db });
    const incoming = requests.find(
      (r) => r.status === 'pending' && r.fromUserId === targetId && r.toUserId === req.user.id
    );
    if (incoming) {
      return res.json({ status: 'incoming', requestId: incoming.id || incoming._id });
    }

    const outgoing = requests.find(
      (r) => r.status === 'pending' && r.fromUserId === req.user.id && r.toUserId === targetId
    );
    if (outgoing) {
      return res.json({ status: 'outgoing', requestId: outgoing.id || outgoing._id });
    }

    return res.json({ status: 'none' });
  } catch (error) {
    console.error('Error getting friend status:', error?.message || error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// GET /api/friends
export const listFriends = async (req, res) => {
  try {
    const db = await readDb();
    const friendships = await friendshipsRepo.getAll({ db });
    const friendIds = new Set();

    friendships.forEach((entry) => {
      if (entry.userId1 === req.user.id) friendIds.add(entry.userId2);
      if (entry.userId2 === req.user.id) friendIds.add(entry.userId1);
    });

    const users = await usersRepo.getAll({ db });
    const friends = users
      .filter((u) => friendIds.has(resolveUserId(u)))
      .map(normalizeUserSummary);

    res.json({ friends });
  } catch (error) {
    console.error('Error listing friends:', error?.message || error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// GET /api/friends/user/:userId (public)
export const listFriendsForUser = async (req, res) => {
  try {
    const targetId = String(req.params.userId || '').trim().toLowerCase();
    if (!targetId) return res.status(400).json({ msg: 'User id required' });

    const db = await readDb();
    const users = await usersRepo.getAll({ db });
    const target =
      users.find((u) => resolveUserId(u) === req.params.userId) ||
      users.find((u) => (u.username || '').toLowerCase() === targetId);
    if (!target) return res.status(404).json({ msg: 'User not found' });

    const targetResolvedId = resolveUserId(target);
    const friendships = await friendshipsRepo.getAll({ db });
    const friendIds = new Set();
    friendships.forEach((entry) => {
      if (entry.userId1 === targetResolvedId) friendIds.add(entry.userId2);
      if (entry.userId2 === targetResolvedId) friendIds.add(entry.userId1);
    });

    const friends = users
      .filter((u) => friendIds.has(resolveUserId(u)))
      .map(normalizeUserSummary);

    res.json({ friends });
  } catch (error) {
    console.error('Error listing user friends:', error?.message || error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// GET /api/friends/requests
export const listFriendRequests = async (req, res) => {
  try {
    const db = await readDb();
    const requests = await friendRequestsRepo.getAll({ db });
    const users = await usersRepo.getAll({ db });

    const incoming = [];
    const outgoing = [];
    for (const entry of requests) {
      if (entry.status !== 'pending') continue;
      if (entry.toUserId === req.user.id) {
        const fromUser = users.find((u) => resolveUserId(u) === entry.fromUserId);
        incoming.push({
          id: entry.id || entry._id,
          from: fromUser ? normalizeUserSummary(fromUser) : { id: entry.fromUserId, username: '', displayName: '', profilePicture: '' },
          createdAt: entry.createdAt
        });
      } else if (entry.fromUserId === req.user.id) {
        const toUser = users.find((u) => resolveUserId(u) === entry.toUserId);
        outgoing.push({
          id: entry.id || entry._id,
          to: toUser ? normalizeUserSummary(toUser) : { id: entry.toUserId, username: '', displayName: '', profilePicture: '' },
          createdAt: entry.createdAt
        });
      }
    }

    res.json({ incoming, outgoing });
  } catch (error) {
    console.error('Error listing friend requests:', error?.message || error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// POST /api/friends/requests
export const sendFriendRequest = async (req, res) => {
  try {
    const toUserId = String(req.body?.toUserId || '').trim();
    const toUsername = String(req.body?.toUsername || '').trim().toLowerCase();
    if (!toUserId && !toUsername) {
      return res.status(400).json({ msg: 'toUserId or toUsername is required' });
    }

    const now = new Date().toISOString();
    let created;

    await withDb(async (db) => {
      const users = await usersRepo.getAll({ db });
      const target =
        (toUserId && users.find((u) => resolveUserId(u) === toUserId)) ||
        (toUsername && users.find((u) => (u.username || '').toLowerCase() === toUsername));

      if (!target) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }
      const targetId = resolveUserId(target);
      if (!targetId || targetId === req.user.id) {
        const error = new Error('Invalid friend request target');
        error.code = 'INVALID_TARGET';
        throw error;
      }

      const blocked = await isBlockedEitherWay(db, req.user.id, targetId);
      if (blocked) {
        const error = new Error('Cannot send request (blocked)');
        error.code = 'BLOCKED';
        throw error;
      }

      if (await areFriends(db, req.user.id, targetId)) {
        const error = new Error('Already friends');
        error.code = 'ALREADY_FRIENDS';
        throw error;
      }

      const requests = await friendRequestsRepo.getAll({ db });
      const existing = requests.find(
        (r) =>
          r.status === 'pending' &&
          ((r.fromUserId === req.user.id && r.toUserId === targetId) ||
            (r.fromUserId === targetId && r.toUserId === req.user.id))
      );
      if (existing) {
        const error = new Error('Request already pending');
        error.code = 'REQUEST_EXISTS';
        throw error;
      }

      const request = {
        id: uuidv4(),
        fromUserId: req.user.id,
        toUserId: targetId,
        status: 'pending',
        createdAt: now
      };
      await friendRequestsRepo.insert(request, { db });
      created = request;

      const fromUser = users.find((u) => resolveUserId(u) === req.user.id);
      await createNotification(
        db,
        targetId,
        'friend_request',
        'New friend request',
        `${getUserDisplayName(fromUser)} sent you a friend request.`,
        { fromUserId: req.user.id, requestId: request.id }
      );

      return db;
    });

    res.status(201).json({ request: created });
  } catch (error) {
    const code = error.code || '';
    if (code === 'USER_NOT_FOUND') return res.status(404).json({ msg: 'User not found' });
    if (code === 'INVALID_TARGET') return res.status(400).json({ msg: 'Invalid target user' });
    if (code === 'BLOCKED') return res.status(403).json({ msg: 'Cannot send friend request' });
    if (code === 'ALREADY_FRIENDS') return res.status(409).json({ msg: 'Already friends' });
    if (code === 'REQUEST_EXISTS') return res.status(409).json({ msg: 'Friend request already pending' });
    console.error('Error sending friend request:', error?.message || error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// POST /api/friends/requests/:id/accept
export const acceptFriendRequest = async (req, res) => {
  try {
    const requestId = String(req.params.id || '').trim();
    if (!requestId) return res.status(400).json({ msg: 'Request id required' });

    const now = new Date().toISOString();
    let friendUserId = null;

    await withDb(async (db) => {
      const requests = await friendRequestsRepo.getAll({ db });
      const request = requests.find((r) => (r.id || r._id) === requestId);
      if (!request || request.status !== 'pending' || request.toUserId !== req.user.id) {
        const error = new Error('Request not found');
        error.code = 'NOT_FOUND';
        throw error;
      }

      const blocked = await isBlockedEitherWay(db, request.fromUserId, request.toUserId);
      if (blocked) {
        const error = new Error('Blocked');
        error.code = 'BLOCKED';
        throw error;
      }

      request.status = 'accepted';
      request.respondedAt = now;
      friendUserId = request.fromUserId;

      const [userId1, userId2] = sortPair(request.fromUserId, request.toUserId);
      const friendships = await friendshipsRepo.getAll({ db });
      const exists = friendships.find((f) => f.userId1 === userId1 && f.userId2 === userId2);
      if (!exists) {
        await friendshipsRepo.insert(
          { id: uuidv4(), userId1, userId2, createdAt: now },
          { db }
        );
      }

      // Clean up any reverse pending request
      await friendRequestsRepo.updateAll((all) => {
        return all.map((entry) => {
          if (
            entry.status === 'pending' &&
            entry.fromUserId === request.toUserId &&
            entry.toUserId === request.fromUserId
          ) {
            return { ...entry, status: 'cancelled', respondedAt: now };
          }
          if ((entry.id || entry._id) === requestId) {
            return request;
          }
          return entry;
        });
      }, { db });

      const users = await usersRepo.getAll({ db });
      const acceptor = users.find((u) => resolveUserId(u) === req.user.id);
      await createNotification(
        db,
        request.fromUserId,
        'friend_accept',
        'Friend request accepted',
        `${getUserDisplayName(acceptor)} accepted your friend request.`,
        { userId: req.user.id }
      );

      return db;
    });

    res.json({ msg: 'Friend request accepted', friendUserId });
  } catch (error) {
    if (error.code === 'NOT_FOUND') return res.status(404).json({ msg: 'Friend request not found' });
    if (error.code === 'BLOCKED') return res.status(403).json({ msg: 'Cannot accept friend request' });
    console.error('Error accepting friend request:', error?.message || error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// POST /api/friends/requests/:id/decline
export const declineFriendRequest = async (req, res) => {
  try {
    const requestId = String(req.params.id || '').trim();
    if (!requestId) return res.status(400).json({ msg: 'Request id required' });
    const now = new Date().toISOString();

    await withDb(async (db) => {
      const requests = await friendRequestsRepo.getAll({ db });
      const request = requests.find((r) => (r.id || r._id) === requestId);
      if (!request || request.status !== 'pending' || request.toUserId !== req.user.id) {
        const error = new Error('Request not found');
        error.code = 'NOT_FOUND';
        throw error;
      }
      request.status = 'declined';
      request.respondedAt = now;
      await friendRequestsRepo.updateAll((all) => {
        return all.map((entry) => ((entry.id || entry._id) === requestId ? request : entry));
      }, { db });
      return db;
    });

    res.json({ msg: 'Friend request declined' });
  } catch (error) {
    if (error.code === 'NOT_FOUND') return res.status(404).json({ msg: 'Friend request not found' });
    console.error('Error declining friend request:', error?.message || error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// DELETE /api/friends/:userId (remove friendship)
export const removeFriend = async (req, res) => {
  try {
    const otherId = String(req.params.userId || '').trim();
    if (!otherId) return res.status(400).json({ msg: 'User id required' });

    const [userId1, userId2] = sortPair(req.user.id, otherId);
    await withDb(async (db) => {
      await friendshipsRepo.updateAll((friendships) => {
        return friendships.filter((entry) => !(entry.userId1 === userId1 && entry.userId2 === userId2));
      }, { db });
      return db;
    });

    res.json({ msg: 'Friend removed' });
  } catch (error) {
    console.error('Error removing friend:', error?.message || error);
    res.status(500).json({ msg: 'Server error' });
  }
};
