import { v4 as uuidv4 } from 'uuid';
import { readDb, updateDb } from '../services/jsonDb.js';

const resolveUserId = (user) => user?.id || user?._id;

const findUserById = (db, userId) =>
  db.users.find((entry) => resolveUserId(entry) === userId);

const normalizeMessage = (message, db) => {
  const sender =
    message.senderUsername || !db ? null : findUserById(db, message.senderId);
  const recipient =
    message.recipientUsername || !db ? null : findUserById(db, message.recipientId);

  return {
    id: message.id || message._id,
    senderId: message.senderId,
    senderUsername: message.senderUsername || sender?.username || '',
    recipientId: message.recipientId,
    recipientUsername: message.recipientUsername || recipient?.username || '',
    subject: message.subject || '',
    content: message.content || '',
    read: Boolean(message.read),
    deleted: Boolean(message.deleted),
    createdAt: message.createdAt,
    readAt: message.readAt || null
  };
};

// @desc    Send a message
// @route   POST /api/messages
// @access  Private
export const sendMessage = async (req, res) => {
  const { recipientId, content, subject } = req.body;

  if (!recipientId || !content) {
    return res.status(400).json({ msg: 'Recipient and content are required.' });
  }

  try {
    const now = new Date().toISOString();
    let createdMessage;

    await updateDb((db) => {
      const sender = findUserById(db, req.user.id);
      if (!sender) {
        const error = new Error('Sender not found');
        error.code = 'SENDER_NOT_FOUND';
        throw error;
      }

      const recipient = findUserById(db, recipientId);
      if (!recipient) {
        const error = new Error('Recipient not found');
        error.code = 'RECIPIENT_NOT_FOUND';
        throw error;
      }

      const message = {
        id: uuidv4(),
        senderId: resolveUserId(sender),
        senderUsername: sender.username,
        recipientId: resolveUserId(recipient),
        recipientUsername: recipient.username,
        subject: subject || '',
        content,
        read: false,
        deleted: false,
        createdAt: now
      };

      db.messages = Array.isArray(db.messages) ? db.messages : [];
      db.messages.push(message);
      createdMessage = message;

      db.notifications = Array.isArray(db.notifications) ? db.notifications : [];
      db.notifications.push({
        id: uuidv4(),
        userId: resolveUserId(recipient),
        type: 'message',
        title: 'New message',
        content: `You received a message from ${sender.username}`,
        message: `You received a message from ${sender.username}`,
        data: {
          messageId: message.id,
          senderId: resolveUserId(sender),
          senderUsername: sender.username
        },
        read: false,
        createdAt: now
      });

      return db;
    });

    res.json({ msg: 'Message sent', message: normalizeMessage(createdMessage) });
  } catch (error) {
    if (error.code === 'RECIPIENT_NOT_FOUND' || error.code === 'SENDER_NOT_FOUND') {
      return res.status(404).json({ msg: error.message });
    }
    console.error('Error sending message:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get user's messages
// @route   GET /api/messages
// @access  Private
export const getMessages = async (req, res) => {
  try {
    const { type = 'all', page = 1, limit = 20 } = req.query;
    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 20;

    const db = await readDb();
    const messages = Array.isArray(db.messages) ? db.messages : [];

    const filtered = messages.filter((message) => {
      if (message.deleted) return false;
      if (type === 'sent') {
        return message.senderId === req.user.id;
      }
      if (type === 'received') {
        return message.recipientId === req.user.id;
      }
      return (
        message.senderId === req.user.id || message.recipientId === req.user.id
      );
    });

    const sorted = [...filtered].sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );
    const paged = sorted.slice(
      (pageNumber - 1) * limitNumber,
      pageNumber * limitNumber
    );

    const unreadCount = messages.filter(
      (message) =>
        message.recipientId === req.user.id && !message.read && !message.deleted
    ).length;

    res.json({
      messages: paged.map((message) => normalizeMessage(message, db)),
      pagination: {
        currentPage: pageNumber,
        totalPages: Math.ceil(filtered.length / limitNumber) || 1,
        totalMessages: filtered.length,
        hasNext: pageNumber * limitNumber < filtered.length,
        hasPrev: pageNumber > 1
      },
      unreadCount
    });
  } catch (error) {
    console.error('Error fetching messages:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get single message
// @route   GET /api/messages/:id
// @access  Private
export const getMessage = async (req, res) => {
  try {
    const db = await readDb();
    const message = db.messages.find(
      (entry) => entry.id === req.params.id || entry._id === req.params.id
    );

    if (!message) {
      return res.status(404).json({ msg: 'Message not found' });
    }

    if (message.senderId !== req.user.id && message.recipientId !== req.user.id) {
      return res.status(403).json({ msg: 'Access denied' });
    }

    let updatedMessage = message;
    if (message.recipientId === req.user.id && !message.read) {
      const now = new Date().toISOString();
      await updateDb((data) => {
        const target = data.messages.find(
          (entry) => entry.id === message.id || entry._id === message._id
        );
        if (target) {
          target.read = true;
          target.readAt = now;
          updatedMessage = target;
        }
        return data;
      });
    }

    res.json(normalizeMessage(updatedMessage, db));
  } catch (error) {
    console.error('Error fetching message:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Delete message
// @route   DELETE /api/messages/:id
// @access  Private
export const deleteMessage = async (req, res) => {
  try {
    let found;

    await updateDb((db) => {
      const message = db.messages.find(
        (entry) => entry.id === req.params.id || entry._id === req.params.id
      );
      if (!message) {
        const error = new Error('Message not found');
        error.code = 'MESSAGE_NOT_FOUND';
        throw error;
      }

      if (
        message.senderId !== req.user.id &&
        message.recipientId !== req.user.id
      ) {
        const error = new Error('Access denied');
        error.code = 'ACCESS_DENIED';
        throw error;
      }

      message.deleted = true;
      message.deletedAt = new Date().toISOString();
      found = message;
      return db;
    });

    res.json({ msg: 'Message deleted', message: normalizeMessage(found) });
  } catch (error) {
    if (error.code === 'MESSAGE_NOT_FOUND') {
      return res.status(404).json({ msg: 'Message not found' });
    }
    if (error.code === 'ACCESS_DENIED') {
      return res.status(403).json({ msg: 'Access denied' });
    }
    console.error('Error deleting message:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Mark message as read
// @route   PUT /api/messages/:id/read
// @access  Private
export const markAsRead = async (req, res) => {
  try {
    await updateDb((db) => {
      const message = db.messages.find(
        (entry) => entry.id === req.params.id || entry._id === req.params.id
      );
      if (!message) {
        const error = new Error('Message not found');
        error.code = 'MESSAGE_NOT_FOUND';
        throw error;
      }

      if (message.recipientId !== req.user.id) {
        const error = new Error('Access denied');
        error.code = 'ACCESS_DENIED';
        throw error;
      }

      message.read = true;
      message.readAt = new Date().toISOString();
      return db;
    });

    res.json({ msg: 'Message marked as read' });
  } catch (error) {
    if (error.code === 'MESSAGE_NOT_FOUND') {
      return res.status(404).json({ msg: 'Message not found' });
    }
    if (error.code === 'ACCESS_DENIED') {
      return res.status(403).json({ msg: 'Access denied' });
    }
    console.error('Error marking message as read:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get conversation between two users
// @route   GET /api/messages/conversation/:userId
// @access  Private
export const getConversation = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 50;
    const otherUserId = req.params.userId;

    const db = await readDb();
    const messages = Array.isArray(db.messages) ? db.messages : [];

    const filtered = messages.filter(
      (message) =>
        !message.deleted &&
        ((message.senderId === req.user.id &&
          message.recipientId === otherUserId) ||
          (message.senderId === otherUserId &&
            message.recipientId === req.user.id))
    );

    const sorted = [...filtered].sort(
      (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
    );
    const paged = sorted.slice(
      (pageNumber - 1) * limitNumber,
      pageNumber * limitNumber
    );

    await updateDb((data) => {
      data.messages = Array.isArray(data.messages) ? data.messages : [];
      data.messages.forEach((message) => {
        if (
          message.senderId === otherUserId &&
          message.recipientId === req.user.id &&
          !message.read
        ) {
          message.read = true;
          message.readAt = new Date().toISOString();
        }
      });
      return data;
    });

    const otherUser = findUserById(db, otherUserId);

    res.json({
      messages: paged.map((message) => normalizeMessage(message, db)),
      otherUser: otherUser
        ? {
            id: resolveUserId(otherUser),
            username: otherUser.username,
            profilePicture:
              otherUser.profile?.profilePicture || otherUser.profile?.avatar || ''
          }
        : null,
      pagination: {
        currentPage: pageNumber,
        totalPages: Math.ceil(filtered.length / limitNumber) || 1,
        totalMessages: filtered.length,
        hasNext: pageNumber * limitNumber < filtered.length,
        hasPrev: pageNumber > 1
      }
    });
  } catch (error) {
    console.error('Error fetching conversation:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get unread message count
// @route   GET /api/messages/unread/count
// @access  Private
export const getUnreadCount = async (req, res) => {
  try {
    const db = await readDb();
    const messages = Array.isArray(db.messages) ? db.messages : [];
    const unreadCount = messages.filter(
      (message) =>
        message.recipientId === req.user.id && !message.read && !message.deleted
    ).length;

    res.json({ unreadCount });
  } catch (error) {
    console.error('Error fetching unread count:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
