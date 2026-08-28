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
import { readDb, withDb } from '../repositories/index.js';
import { v4 as uuidv4 } from 'uuid';
import { getUserDisplayName } from '../utils/userDisplayName.js';
import { parsePagination } from '../utils/pagination.js';

const router = express.Router();

const resolveUserId = (user) => user?.id || user?._id;

const findUserById = (db, userId) =>
  (db.users || []).find((entry) => resolveUserId(entry) === userId);

const areUsersBlocked = (db, firstUserId, secondUserId) =>
  (db.blocks || []).some(
    (block) =>
      (block.blockerId === firstUserId && block.blockedId === secondUserId) ||
      (block.blockerId === secondUserId && block.blockedId === firstUserId)
  );

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

  const messages = conversation.messages || [];
  const lastMessage = messages[messages.length - 1] || null;
  const unreadCount = messages.filter((message) => {
    if (message.senderId === viewerId) {
      return false;
    }
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
    const db = await readDb();
    const currentUserId = req.user.id;
    const otherUserId = req.params.userId;
    const { page, limit } = parsePagination(req.query, {
      defaultLimit: 50,
      maxLimit: 100
    });

    // Find all messages between these two users
    const allMessages = (db.messages || []).filter(message =>
      !message.deleted &&
      (
        (message.senderId === currentUserId && message.recipientId === otherUserId) ||
        (message.senderId === otherUserId && message.recipientId === currentUserId)
      )
    ).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const messages = allMessages.slice((page - 1) * limit, page * limit);

    // Get other user info
    const otherUser = findUserById(db, otherUserId);

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
        totalPages: Math.ceil(allMessages.length / limit) || 1,
        totalMessages: allMessages.length,
        hasNext: page * limit < allMessages.length,
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

    await withDb(async (db) => {
      // Mark all messages from otherUserId to currentUserId as read
      (db.messages || []).forEach(message => {
        if (message.senderId === otherUserId && message.recipientId === currentUserId && !message.read) {
          message.read = true;
          message.readAt = new Date().toISOString();
        }
      });
      return db;
    });

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
    const db = await readDb();
    const conversations = (db.conversations || []).filter((conversation) =>
      (conversation.participants || []).includes(req.params.userId)
    );
    const payload = conversations
      .slice()
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
      .map((conversation) => buildConversationResponse(db, conversation, req.params.userId));
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

    let created;
    await withDb((db) => {
      db.conversations = Array.isArray(db.conversations) ? db.conversations : [];
      if (!findUserById(db, requestedRecipientId)) {
        const error = new Error('Recipient not found');
        error.code = 'RECIPIENT_NOT_FOUND';
        throw error;
      }
      if (areUsersBlocked(db, req.user.id, requestedRecipientId)) {
        const error = new Error('Messaging is blocked');
        error.code = 'BLOCKED';
        throw error;
      }
      const existing = db.conversations.find((conversation) => {
        const ids = conversation.participants || [];
        return (
          ids.length === trustedParticipants.length &&
          trustedParticipants.every((id) => ids.includes(id))
        );
      });
      if (existing) {
        created = existing;
        return db;
      }

      created = {
        id: uuidv4(),
        participants: trustedParticipants,
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.conversations.push(created);
      return db;
    });

    const db = await readDb();
    res.status(201).json(buildConversationResponse(db, created, req.user.id));
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
    await withDb((db) => {
      const conversation = (db.conversations || []).find(
        (entry) => entry.id === conversationId
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
      const otherParticipantIds = (conversation.participants || []).filter(
        (participantId) => participantId !== req.user.id
      );
      if (
        otherParticipantIds.some((participantId) =>
          areUsersBlocked(db, req.user.id, participantId)
        )
      ) {
        const error = new Error('Messaging is blocked');
        error.code = 'BLOCKED';
        throw error;
      }

      conversation.messages = Array.isArray(conversation.messages)
        ? conversation.messages
        : [];
      created = {
        id: uuidv4(),
        conversationId,
        senderId: req.user.id,
        content: normalizedContent,
        timestamp: new Date().toISOString(),
        type: 'text',
        readBy: [req.user.id]
      };
      conversation.messages.push(created);
      conversation.updatedAt = new Date().toISOString();
      return db;
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
    await withDb((db) => {
      const conversation = (db.conversations || []).find(
        (entry) => entry.id === req.params.conversationId
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

      conversation.messages = Array.isArray(conversation.messages)
        ? conversation.messages
        : [];
      conversation.messages.forEach((message) => {
        message.readBy = Array.isArray(message.readBy) ? message.readBy : [];
        if (!message.readBy.includes(req.user.id)) {
          message.readBy.push(req.user.id);
        }
      });
      return db;
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
    const db = await readDb();
    const conversation = (db.conversations || []).find(
      (entry) => entry.id === req.params.conversationId
    );

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    if (!(conversation.participants || []).includes(req.user.id)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    return res.json(conversation.messages || []);
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

    await withDb((db) => {
      const messages = db.messages || [];
      messages.forEach(message => {
        if (message.senderId === otherUserId && message.recipientId === currentUserId && !message.read) {
          message.read = true;
          message.readAt = new Date().toISOString();
        }
      });
      return db;
    });

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

