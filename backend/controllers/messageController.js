import { v4 as uuidv4 } from 'uuid';
import {
  blocksRepo,
  messagesRepo,
  readDb,
  usersRepo,
  withDb
} from '../repositories/index.js';
import { getUserDisplayName } from '../utils/userDisplayName.js';

const resolveUserId = (user) => user?.id || user?._id;

const findUserById = (users, userId) =>
  (users || []).find((entry) => resolveUserId(entry) === userId);

const normalizeMessage = (message, users = []) => {
  const sender =
    message.senderUsername || users.length === 0
      ? null
      : findUserById(users, message.senderId);
  const recipient =
    message.recipientUsername || users.length === 0
      ? null
      : findUserById(users, message.recipientId);

  return {
    id: message.id || message._id,
    senderId: message.senderId,
    senderUsername: message.senderUsername || sender?.username || '',
    senderDisplayName:
      message.senderDisplayName || getUserDisplayName(sender) || message.senderUsername || '',
    senderProfilePicture: sender?.profile?.profilePicture || sender?.profile?.avatar || message.senderProfilePicture || '',
    recipientId: message.recipientId,
    recipientUsername: message.recipientUsername || recipient?.username || '',
    recipientDisplayName:
      message.recipientDisplayName ||
      getUserDisplayName(recipient) ||
      message.recipientUsername ||
      '',
    recipientProfilePicture: recipient?.profile?.profilePicture || recipient?.profile?.avatar || message.recipientProfilePicture || '',
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

    await withDb(async (db) => {
      const blocks = await blocksRepo.getAll({ db });
      const isBlocked =
        blocks.some((b) => b.blockerId === req.user.id && b.blockedId === recipientId) ||
        blocks.some((b) => b.blockerId === recipientId && b.blockedId === req.user.id);
      if (isBlocked) {
        const error = new Error('Messaging is blocked');
        error.code = 'BLOCKED';
        throw error;
      }

      const sender = await usersRepo.findOne(
        (entry) => resolveUserId(entry) === req.user.id,
        { db }
      );
      if (!sender) {
        const error = new Error('Sender not found');
        error.code = 'SENDER_NOT_FOUND';
        throw error;
      }

      const recipient = await usersRepo.findOne(
        (entry) => resolveUserId(entry) === recipientId,
        { db }
      );
      if (!recipient) {
        const error = new Error('Recipient not found');
        error.code = 'RECIPIENT_NOT_FOUND';
        throw error;
      }

      const message = {
        id: uuidv4(),
        senderId: resolveUserId(sender),
        senderUsername: sender.username,
        senderDisplayName: getUserDisplayName(sender),
        recipientId: resolveUserId(recipient),
        recipientUsername: recipient.username,
        recipientDisplayName: getUserDisplayName(recipient),
        subject: subject || '',
        content,
        read: false,
        deleted: false,
        createdAt: now
      };

      await messagesRepo.insert(message, { db });
      createdMessage = message;

      // Don't create bell notifications for messages - only chat icon counter
      // Messages have their own notification system (unread count on chat icon)

      return db;
    });

    // Emit Socket.IO event if available
    if (req.io && req.userSocketMap) {
      const recipientSocketId = req.userSocketMap.get(recipientId);
      
      if (recipientSocketId) {
        req.io.to(recipientSocketId).emit('new-private-message', {
          ...normalizeMessage(createdMessage),
          recipientId: recipientId
        });
        console.log(`Emitted private message to user ${recipientId} at socket ${recipientSocketId}`);
      } else {
        console.log(`User ${recipientId} is not connected, message will be delivered later`);
      }
    }

    res.json({ msg: 'Message sent', message: normalizeMessage(createdMessage) });
  } catch (error) {
    if (error.code === 'RECIPIENT_NOT_FOUND' || error.code === 'SENDER_NOT_FOUND') {
      return res.status(404).json({ msg: error.message });
    }
    if (error.code === 'BLOCKED') {
      return res.status(403).json({ msg: 'Cannot message this user.' });
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
    const messages = await messagesRepo.getAll({ db });
    const users = await usersRepo.getAll({ db });

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
      messages: paged.map((message) => normalizeMessage(message, users)),
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
    const message = await messagesRepo.findOne(
      (entry) => entry.id === req.params.id || entry._id === req.params.id,
      { db }
    );
    const users = await usersRepo.getAll({ db });

    if (!message) {
      return res.status(404).json({ msg: 'Message not found' });
    }

    if (message.senderId !== req.user.id && message.recipientId !== req.user.id) {
      return res.status(403).json({ msg: 'Access denied' });
    }

    let updatedMessage = message;
    if (message.recipientId === req.user.id && !message.read) {
      const now = new Date().toISOString();
      await withDb(async (updateDb) => {
        const target = await messagesRepo.findOne(
          (entry) => entry.id === message.id || entry._id === message._id,
          { db: updateDb }
        );
        if (target) {
          target.read = true;
          target.readAt = now;
          updatedMessage = target;
        }
        return updateDb;
      });
    }

    res.json(normalizeMessage(updatedMessage, users));
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

    await messagesRepo.updateAll((messages) => {
      const message = messages.find(
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
      return messages;
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
    await messagesRepo.updateAll((messages) => {
      const message = messages.find(
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
      return messages;
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
    const messages = await messagesRepo.getAll({ db });
    const users = await usersRepo.getAll({ db });

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

    await withDb(async (updateDb) => {
      await messagesRepo.updateAll((allMessages) => {
        allMessages.forEach((message) => {
          if (
            message.senderId === otherUserId &&
            message.recipientId === req.user.id &&
            !message.read
          ) {
            message.read = true;
            message.readAt = new Date().toISOString();
          }
        });
        return allMessages;
      }, { db: updateDb });
      return updateDb;
    });

    const otherUser = await usersRepo.findOne(
      (entry) => resolveUserId(entry) === otherUserId,
      { db }
    );

    res.json({
      messages: paged.map((message) => normalizeMessage(message, users)),
      otherUser: otherUser
        ? {
            id: resolveUserId(otherUser),
            username: otherUser.username,
            displayName: getUserDisplayName(otherUser),
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
    const messages = await messagesRepo.getAll();
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
