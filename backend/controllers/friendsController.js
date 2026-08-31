import { v4 as uuidv4 } from 'uuid';
import {
  blocksRepo,
  friendRequestsRepo,
  friendshipsRepo,
  usersRepo,
  withRepositoryTransaction
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

const isBlockedEitherWay = async (context, a, b) => {
  return Boolean(await blocksRepo.findOneBy({
    $or: [
      { blockerId: a, blockedId: b },
      { blockerId: b, blockedId: a }
    ]
  }, {}, context));
};

const areFriends = async (context, a, b) => {
  const [userId1, userId2] = sortPair(a, b);
  return Boolean(await friendshipsRepo.findOneBy({ userId1, userId2 }, {}, context));
};

// GET /api/friends/status/:userId
export const getFriendStatus = async (req, res) => {
  try {
    const targetId = String(req.params.userId || '').trim();
    if (!targetId) return res.status(400).json({ msg: 'User id required' });
    if (targetId === req.user.id) return res.json({ status: 'self' });

    const blocked = await isBlockedEitherWay(undefined, req.user.id, targetId);
    if (blocked) {
      // Detailed direction is available via /api/blocks/status but we treat as blocked here.
      return res.json({ status: 'blocked' });
    }

    if (await areFriends(undefined, req.user.id, targetId)) {
      return res.json({ status: 'friends' });
    }

    const incoming = await friendRequestsRepo.findOneBy({
      status: 'pending', fromUserId: targetId, toUserId: req.user.id
    });
    if (incoming) {
      return res.json({ status: 'incoming', requestId: incoming.id || incoming._id });
    }

    const outgoing = await friendRequestsRepo.findOneBy({
      status: 'pending', fromUserId: req.user.id, toUserId: targetId
    });
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
    const friendships = await friendshipsRepo.findManyBy({
      $or: [{ userId1: req.user.id }, { userId2: req.user.id }]
    });
    const friendIds = new Set();

    friendships.forEach((entry) => {
      if (entry.userId1 === req.user.id) friendIds.add(entry.userId2);
      if (entry.userId2 === req.user.id) friendIds.add(entry.userId1);
    });

    const ids = [...friendIds];
    const users = ids.length
      ? await usersRepo.findManyBy({ id: { $in: ids } }, { limit: ids.length })
      : [];
    const friends = users.map(normalizeUserSummary);

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

    const target =
      (await usersRepo.findById(req.params.userId)) ||
      (await usersRepo.findOneBy(
        { username: targetId },
        { collation: { locale: 'en', strength: 2 } }
      ));
    if (!target) return res.status(404).json({ msg: 'User not found' });

    const targetResolvedId = resolveUserId(target);
    const friendships = await friendshipsRepo.findManyBy({
      $or: [{ userId1: targetResolvedId }, { userId2: targetResolvedId }]
    });
    const friendIds = new Set();
    friendships.forEach((entry) => {
      if (entry.userId1 === targetResolvedId) friendIds.add(entry.userId2);
      if (entry.userId2 === targetResolvedId) friendIds.add(entry.userId1);
    });

    const ids = [...friendIds];
    const users = ids.length
      ? await usersRepo.findManyBy({ id: { $in: ids } }, { limit: ids.length })
      : [];
    const friends = users.map(normalizeUserSummary);

    res.json({ friends });
  } catch (error) {
    console.error('Error listing user friends:', error?.message || error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// GET /api/friends/requests
export const listFriendRequests = async (req, res) => {
  try {
    const requests = await friendRequestsRepo.findManyBy({
      status: 'pending',
      $or: [{ toUserId: req.user.id }, { fromUserId: req.user.id }]
    }, { sort: { createdAt: -1 }, limit: 200 });
    const relatedIds = [...new Set(requests.flatMap((entry) => [entry.fromUserId, entry.toUserId]))];
    const users = relatedIds.length
      ? await usersRepo.findManyBy({ id: { $in: relatedIds } }, { limit: relatedIds.length })
      : [];
    const usersById = new Map(users.map((user) => [resolveUserId(user), user]));

    const incoming = [];
    const outgoing = [];
    for (const entry of requests) {
      if (entry.status !== 'pending') continue;
      if (entry.toUserId === req.user.id) {
        const fromUser = usersById.get(entry.fromUserId);
        incoming.push({
          id: entry.id || entry._id,
          from: fromUser ? normalizeUserSummary(fromUser) : { id: entry.fromUserId, username: '', displayName: '', profilePicture: '' },
          createdAt: entry.createdAt
        });
      } else if (entry.fromUserId === req.user.id) {
        const toUser = usersById.get(entry.toUserId);
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
    let targetIdForNotification;
    let senderDisplayName = req.user.username || 'User';

    await withRepositoryTransaction(async (context) => {
      const target =
        (toUserId && await usersRepo.findById(toUserId, 'id', context)) ||
        (toUsername && await usersRepo.findOneBy(
          { username: toUsername },
          { collation: { locale: 'en', strength: 2 } },
          context
        ));

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

      const blocked = await isBlockedEitherWay(context, req.user.id, targetId);
      if (blocked) {
        const error = new Error('Cannot send request (blocked)');
        error.code = 'BLOCKED';
        throw error;
      }

      if (await areFriends(context, req.user.id, targetId)) {
        const error = new Error('Already friends');
        error.code = 'ALREADY_FRIENDS';
        throw error;
      }

      const existing = await friendRequestsRepo.findOneBy({
        status: 'pending',
        $or: [
          { fromUserId: req.user.id, toUserId: targetId },
          { fromUserId: targetId, toUserId: req.user.id }
        ]
      }, {}, context);
      if (existing) {
        const error = new Error('Request already pending');
        error.code = 'REQUEST_EXISTS';
        throw error;
      }

      const request = {
        id: uuidv4(),
        requestKey: sortPair(req.user.id, targetId).join(':'),
        fromUserId: req.user.id,
        toUserId: targetId,
        status: 'pending',
        createdAt: now
      };
      const inserted = await friendRequestsRepo.insertIfAbsent(
        { requestKey: request.requestKey, status: 'pending' },
        request,
        context
      );
      if (!inserted.inserted) {
        const error = new Error('Request already pending');
        error.code = 'REQUEST_EXISTS';
        throw error;
      }
      created = inserted.item;
      targetIdForNotification = targetId;
      const fromUser = await usersRepo.findById(req.user.id, 'id', context);
      senderDisplayName = getUserDisplayName(fromUser) || senderDisplayName;
    });

    await createNotification(
      null,
      targetIdForNotification,
      'friend_request',
      'New friend request',
      `${senderDisplayName} sent you a friend request.`,
      { fromUserId: req.user.id, requestId: created.id }
    );

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
    let acceptorDisplayName = req.user.username || 'User';

    await withRepositoryTransaction(async (context) => {
      const request = await friendRequestsRepo.findOneBy({ id: requestId }, {}, context);
      if (!request || request.status !== 'pending' || request.toUserId !== req.user.id) {
        const error = new Error('Request not found');
        error.code = 'NOT_FOUND';
        throw error;
      }

      const blocked = await isBlockedEitherWay(context, request.fromUserId, request.toUserId);
      if (blocked) {
        const error = new Error('Blocked');
        error.code = 'BLOCKED';
        throw error;
      }

      friendUserId = request.fromUserId;
      await friendRequestsRepo.updateById(requestId, (entry) => ({
        ...entry,
        status: 'accepted',
        respondedAt: now
      }), 'id', context);

      const [userId1, userId2] = sortPair(request.fromUserId, request.toUserId);
      await friendshipsRepo.insertIfAbsent(
        { userId1, userId2 },
        {
          id: uuidv4(),
          friendshipKey: `${userId1}:${userId2}`,
          userId1,
          userId2,
          createdAt: now
        },
        context
      );

      // Clean up any reverse pending request
      await friendRequestsRepo.patchManyBy({
        status: 'pending',
        fromUserId: request.toUserId,
        toUserId: request.fromUserId
      }, { status: 'cancelled', respondedAt: now }, context);

      const acceptor = await usersRepo.findById(req.user.id, 'id', context);
      acceptorDisplayName = getUserDisplayName(acceptor) || acceptorDisplayName;
    });

    await createNotification(
      null,
      friendUserId,
      'friend_accept',
      'Friend request accepted',
      `${acceptorDisplayName} accepted your friend request.`,
      { userId: req.user.id }
    );

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

    await withRepositoryTransaction(async (context) => {
      const request = await friendRequestsRepo.findOneBy({ id: requestId }, {}, context);
      if (!request || request.status !== 'pending' || request.toUserId !== req.user.id) {
        const error = new Error('Request not found');
        error.code = 'NOT_FOUND';
        throw error;
      }
      await friendRequestsRepo.updateById(requestId, (entry) => ({
        ...entry,
        status: 'declined',
        respondedAt: now
      }), 'id', context);
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
    await friendshipsRepo.removeManyBy({ userId1, userId2 });

    res.json({ msg: 'Friend removed' });
  } catch (error) {
    console.error('Error removing friend:', error?.message || error);
    res.status(500).json({ msg: 'Server error' });
  }
};
