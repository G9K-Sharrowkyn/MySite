import express from 'express';
import jwt from 'jsonwebtoken';
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
import { readDb, updateDb } from '../services/jsonDb.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

const resolveUserId = (user) => user?.id || user?._id;

const findUserById = (db, userId) =>
  (db.users || []).find((entry) => resolveUserId(entry) === userId);

const decodeUserFromRequest = (req) => {
  const authHeader = req.header('authorization') || req.header('Authorization');
  const bearerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null;
  const token = bearerToken || req.header('x-auth-token');
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET).user;
  } catch (error) {
    return null;
  }
};

const buildConversationResponse = (db, conversation, viewerId) => {
  const participants = (conversation.participants || []).map((participantId) => {
    const user = findUserById(db, participantId);
    return {
      id: participantId,
      username: user?.username || 'User',
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

    // Find all messages between these two users
    const messages = (db.messages || []).filter(message => 
      (message.senderId === currentUserId && message.recipientId === otherUserId) ||
      (message.senderId === otherUserId && message.recipientId === currentUserId)
    ).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    // Get other user info
    const otherUser = findUserById(db, otherUserId);

    res.json({
      messages,
      otherUser: {
        id: otherUserId,
        username: otherUser?.username || 'User',
        profilePicture: otherUser?.profile?.profilePicture || '',
        isModerator: otherUser?.role === 'moderator'
      }
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET api/messages/conversations/:userId
// @desc    List chat conversations (MessagingSystem)
// @access  Public
router.get('/conversations/:userId', async (req, res) => {
  try {
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
// @access  Public
router.post('/conversations', async (req, res) => {
  try {
    const { participants } = req.body || {};
    if (!Array.isArray(participants) || participants.length < 2) {
      return res.status(400).json({ message: 'Participants required' });
    }

    let created;
    await updateDb((db) => {
      db.conversations = Array.isArray(db.conversations) ? db.conversations : [];
      const existing = db.conversations.find((conversation) => {
        const ids = conversation.participants || [];
        return (
          ids.length === participants.length &&
          participants.every((id) => ids.includes(id))
        );
      });
      if (existing) {
        created = existing;
        return db;
      }

      created = {
        id: uuidv4(),
        participants,
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.conversations.push(created);
      return db;
    });

    const db = await readDb();
    res.status(201).json(buildConversationResponse(db, created, participants[0]));
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST api/messages/send
// @desc    Send chat message (MessagingSystem)
// @access  Public
router.post('/send', async (req, res) => {
  try {
    const { conversationId, senderId, content, timestamp, type } = req.body || {};
    if (!conversationId || !senderId || !content) {
      return res.status(400).json({ message: 'Missing message data' });
    }

    let created;
    await updateDb((db) => {
      const conversation = (db.conversations || []).find(
        (entry) => entry.id === conversationId
      );
      if (!conversation) {
        const error = new Error('Conversation not found');
        error.code = 'NOT_FOUND';
        throw error;
      }

      conversation.messages = Array.isArray(conversation.messages)
        ? conversation.messages
        : [];
      created = {
        id: uuidv4(),
        conversationId,
        senderId,
        content: content.trim(),
        timestamp: timestamp || new Date().toISOString(),
        type: type || 'text',
        readBy: [senderId]
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
    console.error('Error sending chat message:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST api/messages/read/:conversationId
// @desc    Mark chat messages as read (MessagingSystem)
// @access  Public
router.post('/read/:conversationId', async (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId) {
      return res.status(400).json({ message: 'User ID required' });
    }

    await updateDb((db) => {
      const conversation = (db.conversations || []).find(
        (entry) => entry.id === req.params.conversationId
      );
      if (!conversation) {
        const error = new Error('Conversation not found');
        error.code = 'NOT_FOUND';
        throw error;
      }

      conversation.messages = Array.isArray(conversation.messages)
        ? conversation.messages
        : [];
      conversation.messages.forEach((message) => {
        message.readBy = Array.isArray(message.readBy) ? message.readBy : [];
        if (!message.readBy.includes(userId)) {
          message.readBy.push(userId);
        }
      });
      return db;
    });

    res.json({ message: 'Marked as read' });
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    console.error('Error marking read:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET api/messages/conversation/:id
// @desc    Get conversation messages (chat or mailbox fallback)
// @access  Public
router.get('/conversation/:id', async (req, res) => {
  try {
    const db = await readDb();
    const conversation = (db.conversations || []).find(
      (entry) => entry.id === req.params.id
    );

    if (conversation) {
      return res.json(conversation.messages || []);
    }

    const user = decodeUserFromRequest(req);
    if (!user) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    req.user = user;
    req.params.userId = req.params.id;
    return getConversation(req, res);
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST api/messages
// @desc    Send a message
// @access  Private
router.post('/', auth, sendMessage);

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
