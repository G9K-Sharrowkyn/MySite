import express from 'express';
import {
  getMessages,
  sendMessage,
  getMessage,
  markAsRead,
  deleteMessage,
  getConversation,
  getUnreadCount
} from '../controllers/messageController.js';
import auth from '../middleware/auth.js';
import {
  blocksRepo,
  conversationsRepo,
  messagesRepo,
  usersRepo,
  withRepositoryTransaction
} from '../repositories/index.js';
import { v4 as uuidv4 } from 'uuid';
import { getUserDisplayName } from '../utils/userDisplayName.js';
import { parsePagination } from '../utils/pagination.js';

const router = express.Router();

const resolveUserId = (user) => user?.id || user?._id;

const findUserById = (db, userId) =>
  (db.users || []).find((entry) => resolveUserId(entry) === userId);

const buildConversationResponse = (db, conversation, viewerId) => {
  const participants = (conversation.participants || []).map((participantId) => {
    const user = findUserById(db, participantId);
    return {
      id: participantId,
      username: user?.username || 'User',
      displayName: getUserDisplayName(user),
      avatar: user?.profile?.profilePicture || user?.profile?.avatar || '',
      isModerator: user?.role === 'moderator'
    };
  });

  const legacyMessages = conversation.messages || [];
  const lastMessage = conversation.lastMessage || legacyMessages[legacyMessages.length - 1] || null;
  const unreadCount = Number.isFinite(conversation.unreadCounts?.[viewerId])
    ? conversation.unreadCounts[viewerId]
    : legacyMessages.filter((message) => {
        if (message.senderId === viewerId) return false;
        const readBy = Array.isArray(message.readBy) ? message.readBy : [];
        return !readBy.includes(viewerId);
      }).length;

  return {
    id: conversation.id,
    participants,
    lastMessage,
    unreadCount
  };
};

// @route   GET api/messages
// @desc    Get user's messages
// @access  Private
router.get('/', auth, getMessages);

// @route   GET api/messages/unread/count
// @desc    Get unread message count
// @access  Private
router.get('/unread/count', auth, getUnreadCount);

// @route   GET api/messages/conversation/:userId
// @desc    Get conversation with specific user
// @access  Private
router.get('/conversation/:userId', auth, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const otherUserId = req.params.userId;
    const { page, limit } = parsePagination(req.query, {
      defaultLimit: 50,
      maxLimit: 100
    });

    // Find all messages between these two users
    const query = {
      deleted: { $ne: true },
      $or: [
        { senderId: currentUserId, recipientId: otherUserId },
        { senderId: otherUserId, recipientId: currentUserId }
      ]
    };
    const [messages, totalMessages, otherUser] = await Promise.all([
      messagesRepo.findManyBy(query, {
        sort: { createdAt: 1 },
        skip: (page - 1) * limit,
        limit
      }),
      messagesRepo.countBy(query),
      usersRepo.findById(otherUserId)
    ]);

    res.json({
      messages,
      otherUser: {
        id: otherUserId,
        username: otherUser?.username || 'User',
        displayName: getUserDisplayName(otherUser),
        profilePicture: otherUser?.profile?.profilePicture || '',
        isModerator: otherUser?.role === 'moderator'
      },
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalMessages / limit) || 1,
        totalMessages,
        hasNext: page * limit < totalMessages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT api/messages/conversation/:userId/read-all
// @desc    Mark all messages from a user as read
// @access  Private
router.put('/conversation/:userId/read-all', auth, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const otherUserId = req.params.userId;

    await messagesRepo.patchManyBy(
      { senderId: otherUserId, recipientId: currentUserId, read: { $ne: true } },
      { read: true, readAt: new Date().toISOString() }
    );

    res.json({ msg: 'Messages marked as read' });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET api/messages/conversations/:userId
// @desc    List chat conversations (MessagingSystem)
// @access  Private
router.get('/conversations/:userId', auth, async (req, res) => {
  try {
    if (req.params.userId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const conversations = await conversationsRepo.findManyBy(
      { participants: req.params.userId },
      { sort: { updatedAt: -1 }, limit: 100 }
    );
    const participantIds = [...new Set(
      conversations.flatMap((conversation) => conversation.participants || [])
    )];
    const users = participantIds.length
      ? await usersRepo.findManyBy({ id: { $in: participantIds } })
      : [];
    const payload = conversations.map((conversation) =>
      buildConversationResponse({ users }, conversation, req.params.userId)
    );
    res.json(payload);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST api/messages/conversations
// @desc    Start chat conversation (MessagingSystem)
// @access  Private
router.post('/conversations', auth, async (req, res) => {
  try {
    const { participants } = req.body || {};
    if (!Array.isArray(participants)) {
      return res.status(400).json({ message: 'Participants required' });
    }
    const requestedRecipientId = participants.find((id) => id && id !== req.user.id);
    if (!requestedRecipientId) {
      return res.status(400).json({ message: 'Recipient required' });
    }
    const trustedParticipants = [req.user.id, requestedRecipientId];
    const participantKey = [...trustedParticipants].sort().join(':');

    const [recipient, currentUser, blockingRelationship] = await Promise.all([
      usersRepo.findById(requestedRecipientId),
      usersRepo.findById(req.user.id),
      blocksRepo.findOneBy({
        $or: [
          { blockerId: req.user.id, blockedId: requestedRecipientId },
          { blockerId: requestedRecipientId, blockedId: req.user.id }
        ]
      })
    ]);
    if (!recipient) {
      const error = new Error('Recipient not found');
      error.code = 'RECIPIENT_NOT_FOUND';
      throw error;
    }
    if (blockingRelationship) {
      const error = new Error('Messaging is blocked');
      error.code = 'BLOCKED';
      throw error;
    }

    let created = await conversationsRepo.findOneBy({ participantKey });
    if (!created) {
      const legacyCandidates = await conversationsRepo.findManyBy({
        participants: req.user.id
      }, { sort: { updatedAt: -1 }, limit: 200 });
      created = legacyCandidates.find((conversation) => {
        const ids = conversation.participants || [];
        return ids.length === 2 && trustedParticipants.every((id) => ids.includes(id));
      });
      if (created && !created.participantKey) {
        created = await conversationsRepo.updateById(created.id, (conversation) => {
          conversation.participantKey = participantKey;
          return conversation;
        });
      }
    }
    if (!created) {
      const candidate = {
        id: uuidv4(),
        participants: trustedParticipants,
        participantKey,
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      try {
        created = await conversationsRepo.insert(candidate);
      } catch (error) {
        if (error?.code !== 11000) throw error;
        created = await conversationsRepo.findOneBy({ participantKey });
      }
    }

    res.status(201).json(
      buildConversationResponse(
        { users: [currentUser, recipient].filter(Boolean) },
        created,
        req.user.id
      )
    );
  } catch (error) {
    if (error.code === 'RECIPIENT_NOT_FOUND') {
      return res.status(404).json({ message: 'Recipient not found' });
    }
    if (error.code === 'BLOCKED') {
      return res.status(403).json({ message: 'Cannot message this user' });
    }
    console.error('Error creating conversation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST api/messages/send
// @desc    Send chat message (MessagingSystem)
// @access  Private
router.post('/send', auth, async (req, res) => {
  try {
    const { conversationId, content } = req.body || {};
    const normalizedContent = typeof content === 'string' ? content.trim() : '';
    if (!conversationId || !normalizedContent) {
      return res.status(400).json({ message: 'Missing message data' });
    }
    if (normalizedContent.length > 5000) {
      return res.status(400).json({ message: 'Message is too long' });
    }

    let created;
    await withRepositoryTransaction(async (context) => {
      const existingConversation = await conversationsRepo.findById(
        conversationId,
        'id',
        context
      );
      if (!existingConversation) {
        const error = new Error('Conversation not found');
        error.code = 'NOT_FOUND';
        throw error;
      }
      if (!(existingConversation.participants || []).includes(req.user.id)) {
        const error = new Error('Access denied');
        error.code = 'ACCESS_DENIED';
        throw error;
      }
      const otherParticipantIds = (existingConversation.participants || []).filter(
        (participantId) => participantId !== req.user.id
      );
      const blockingRelationship = otherParticipantIds.length
        ? await blocksRepo.findOneBy({
          $or: otherParticipantIds.flatMap((participantId) => [
            { blockerId: req.user.id, blockedId: participantId },
            { blockerId: participantId, blockedId: req.user.id }
          ])
        }, {}, context)
        : null;
      if (blockingRelationship) {
        const error = new Error('Messaging is blocked');
        error.code = 'BLOCKED';
        throw error;
      }

      const recipientId = otherParticipantIds[0] || null;
      created = {
        id: uuidv4(),
        conversationId,
        senderId: req.user.id,
        recipientId,
        content: normalizedContent,
        subject: '',
        read: false,
        deleted: false,
        createdAt: new Date().toISOString(),
        timestamp: new Date().toISOString(),
        type: 'text',
        readBy: [req.user.id]
      };
      await messagesRepo.insert(created, context);
      await conversationsRepo.updateById(conversationId, (conversation) => {
        conversation.lastMessage = created;
        conversation.updatedAt = created.createdAt;
        conversation.unreadCounts = conversation.unreadCounts || {};
        if (recipientId) {
          conversation.unreadCounts[recipientId] =
            Number(conversation.unreadCounts[recipientId] || 0) + 1;
        }
        return conversation;
      }, 'id', context);
    });

    res.status(201).json(created);
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    if (error.code === 'ACCESS_DENIED') {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (error.code === 'BLOCKED') {
      return res.status(403).json({ message: 'Cannot message this user' });
    }
    console.error('Error sending chat message:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST api/messages/read/:conversationId
// @desc    Mark chat messages as read (MessagingSystem)
// @access  Private
router.post('/read/:conversationId', auth, async (req, res) => {
  try {
    await withRepositoryTransaction(async (context) => {
      const conversation = await conversationsRepo.findById(
        req.params.conversationId,
        'id',
        context
      );
      if (!conversation) {
        const error = new Error('Conversation not found');
        error.code = 'NOT_FOUND';
        throw error;
      }
      if (!(conversation.participants || []).includes(req.user.id)) {
        const error = new Error('Access denied');
        error.code = 'ACCESS_DENIED';
        throw error;
      }
      await messagesRepo.patchManyBy({
        conversationId: req.params.conversationId,
        recipientId: req.user.id,
        read: { $ne: true }
      }, { read: true, readAt: new Date().toISOString() }, context);
      await conversationsRepo.updateById(req.params.conversationId, (stored) => {
        stored.unreadCounts = stored.unreadCounts || {};
        stored.unreadCounts[req.user.id] = 0;
        stored.messages = Array.isArray(stored.messages) ? stored.messages : [];
        stored.messages.forEach((message) => {
        message.readBy = Array.isArray(message.readBy) ? message.readBy : [];
        if (!message.readBy.includes(req.user.id)) {
          message.readBy.push(req.user.id);
        }
        });
        return stored;
      }, 'id', context);
    });

    res.json({ message: 'Marked as read' });
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    if (error.code === 'ACCESS_DENIED') {
      return res.status(403).json({ message: 'Access denied' });
    }
    console.error('Error marking read:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET api/messages/conversations/:conversationId/messages
// @desc    Get legacy conversation messages
// @access  Private
router.get('/conversations/:conversationId/messages', auth, async (req, res) => {
  try {
    const conversation = await conversationsRepo.findById(req.params.conversationId);

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    if (!(conversation.participants || []).includes(req.user.id)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const { page, limit } = parsePagination(req.query, {
      defaultLimit: 50,
      maxLimit: 100
    });
    const query = {
      conversationId: req.params.conversationId,
      deleted: { $ne: true }
    };
    const [storedMessages, totalMessages] = await Promise.all([
      messagesRepo.findManyBy(query, {
        sort: { createdAt: 1 },
        skip: (page - 1) * limit,
        limit
      }),
      messagesRepo.countBy(query)
    ]);
    if (totalMessages > 0) {
      return res.json(storedMessages);
    }
    const legacyMessages = conversation.messages || [];
    return res.json(legacyMessages.slice((page - 1) * limit, page * limit));
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST api/messages
// @desc    Send a message
// @access  Private
router.post('/', auth, sendMessage);

// @route   POST api/messages/mark-read/:userId
// @desc    Mark all messages from a user as read
// @access  Private
router.post('/mark-read/:userId', auth, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const otherUserId = req.params.userId;

    await messagesRepo.patchManyBy(
      { senderId: otherUserId, recipientId: currentUserId, read: { $ne: true } },
      { read: true, readAt: new Date().toISOString() }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET api/messages/:id
// @desc    Get message by ID
// @access  Private
router.get('/:id', auth, getMessage);

// @route   PUT api/messages/:id/read
// @desc    Mark message as read
// @access  Private
router.put('/:id/read', auth, markAsRead);

// @route   DELETE api/messages/:id
// @desc    Delete message
// @access  Private
router.delete('/:id', auth, deleteMessage);

export default router;

