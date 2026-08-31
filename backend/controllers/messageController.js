import { v4 as uuidv4 } from 'uuid';
import {
  blocksRepo,
  messagesRepo,
  usersRepo,
  withRepositoryTransaction
} from '../repositories/index.js';
import { getUserDisplayName } from '../utils/userDisplayName.js';
import { applyDailyActivityBonusAtomic } from '../utils/coinBonus.js';
import { parsePagination } from '../utils/pagination.js';

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
  const normalizedRecipientId =
    typeof recipientId === 'string' ? recipientId.trim() : '';
  const normalizedContent = typeof content === 'string' ? content.trim() : '';
  const normalizedSubject = typeof subject === 'string' ? subject.trim() : '';

  if (!normalizedRecipientId || !normalizedContent) {
    return res.status(400).json({ msg: 'Recipient and content are required.' });
  }
  if (normalizedContent.length > 5000 || normalizedSubject.length > 200) {
    return res.status(400).json({ msg: 'Message or subject is too long.' });
  }

  try {
    const now = new Date().toISOString();
    let createdMessage;

    await withRepositoryTransaction(async (context) => {
      const isBlocked = Boolean(await blocksRepo.findOneBy({
        $or: [
          { blockerId: req.user.id, blockedId: normalizedRecipientId },
          { blockerId: normalizedRecipientId, blockedId: req.user.id }
        ]
      }, {}, context));
      if (isBlocked) {
        const error = new Error('Messaging is blocked');
        error.code = 'BLOCKED';
        throw error;
      }

      const sender = await usersRepo.findById(req.user.id, 'id', context);
      if (!sender) {
        const error = new Error('Sender not found');
        error.code = 'SENDER_NOT_FOUND';
        throw error;
      }

      const recipient = await usersRepo.findById(normalizedRecipientId, 'id', context);
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
        subject: normalizedSubject,
        content: normalizedContent,
        read: false,
        deleted: false,
        createdAt: now
      };

      await messagesRepo.insert(message, context);
      createdMessage = message;
      await applyDailyActivityBonusAtomic(resolveUserId(sender), 'message', 50, context);

      // Don't create bell notifications for messages - only chat icon counter
      // Messages have their own notification system (unread count on chat icon)

    });

    // Emit Socket.IO event if available
    if (req.io) {
      req.io.to(`user:${normalizedRecipientId}`).emit('new-private-message', {
        ...normalizeMessage(createdMessage),
        recipientId: normalizedRecipientId
      });
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
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get user's messages
// @route   GET /api/messages
// @access  Private
export const getMessages = async (req, res) => {
  try {
    const { type = 'all' } = req.query;
    const { page: pageNumber, limit: limitNumber } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 100
    });

    const participantQuery = type === 'sent'
      ? { senderId: req.user.id }
      : type === 'received'
        ? { recipientId: req.user.id }
        : { $or: [{ senderId: req.user.id }, { recipientId: req.user.id }] };
    const query = { ...participantQuery, deleted: { $ne: true } };
    const [paged, totalMessages, unreadCount] = await Promise.all([
      messagesRepo.findManyBy(query, {
        sort: { createdAt: -1 },
        skip: (pageNumber - 1) * limitNumber,
        limit: limitNumber
      }),
      messagesRepo.countBy(query),
      messagesRepo.countBy({
        recipientId: req.user.id,
        read: { $ne: true },
        deleted: { $ne: true }
      })
    ]);
    const userIds = [...new Set(paged.flatMap((message) => [message.senderId, message.recipientId]).filter(Boolean))];
    const users = userIds.length
      ? await usersRepo.findManyBy({ id: { $in: userIds } }, { limit: userIds.length })
      : [];

    res.json({
      messages: paged.map((message) => normalizeMessage(message, users)),
      pagination: {
        currentPage: pageNumber,
        totalPages: Math.ceil(totalMessages / limitNumber) || 1,
        totalMessages,
        hasNext: pageNumber * limitNumber < totalMessages,
        hasPrev: pageNumber > 1
      },
      unreadCount
    });
  } catch (error) {
    console.error('Error fetching messages:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get single message
// @route   GET /api/messages/:id
// @access  Private
export const getMessage = async (req, res) => {
  try {
    const message = await messagesRepo.findById(req.params.id);

    if (!message) {
      return res.status(404).json({ msg: 'Message not found' });
    }

    if (message.senderId !== req.user.id && message.recipientId !== req.user.id) {
      return res.status(403).json({ msg: 'Access denied' });
    }

    let updatedMessage = message;
    if (message.recipientId === req.user.id && !message.read) {
      const now = new Date().toISOString();
      updatedMessage = await messagesRepo.updateById(req.params.id, (target) => ({
        ...target,
        read: true,
        readAt: now
      }));
    }

    const userIds = [message.senderId, message.recipientId].filter(Boolean);
    const users = await usersRepo.findManyBy({ id: { $in: userIds } }, { limit: userIds.length });

    res.json(normalizeMessage(updatedMessage, users));
  } catch (error) {
    console.error('Error fetching message:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete message
// @route   DELETE /api/messages/:id
// @access  Private
export const deleteMessage = async (req, res) => {
  try {
    const existing = await messagesRepo.findById(req.params.id);
    if (!existing) {
        const error = new Error('Message not found');
        error.code = 'MESSAGE_NOT_FOUND';
        throw error;
    }
    if (existing.senderId !== req.user.id && existing.recipientId !== req.user.id) {
        const error = new Error('Access denied');
        error.code = 'ACCESS_DENIED';
        throw error;
    }
    const found = await messagesRepo.updateById(req.params.id, (message) => ({
      ...message,
      deleted: true,
      deletedAt: new Date().toISOString()
    }));

    res.json({ msg: 'Message deleted', message: normalizeMessage(found) });
  } catch (error) {
    if (error.code === 'MESSAGE_NOT_FOUND') {
      return res.status(404).json({ msg: 'Message not found' });
    }
    if (error.code === 'ACCESS_DENIED') {
      return res.status(403).json({ msg: 'Access denied' });
    }
    console.error('Error deleting message:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Mark message as read
// @route   PUT /api/messages/:id/read
// @access  Private
export const markAsRead = async (req, res) => {
  try {
    const message = await messagesRepo.findById(req.params.id);
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
    await messagesRepo.updateById(req.params.id, (entry) => ({
      ...entry,
      read: true,
      readAt: new Date().toISOString()
    }));

    res.json({ msg: 'Message marked as read' });
  } catch (error) {
    if (error.code === 'MESSAGE_NOT_FOUND') {
      return res.status(404).json({ msg: 'Message not found' });
    }
    if (error.code === 'ACCESS_DENIED') {
      return res.status(403).json({ msg: 'Access denied' });
    }
    console.error('Error marking message as read:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get conversation between two users
// @route   GET /api/messages/conversation/:userId
// @access  Private
export const getConversation = async (req, res) => {
  try {
    const { page: pageNumber, limit: limitNumber } = parsePagination(req.query, {
      defaultLimit: 50,
      maxLimit: 100
    });
    const otherUserId = req.params.userId;

    const conversationQuery = {
      deleted: { $ne: true },
      $or: [
        { senderId: req.user.id, recipientId: otherUserId },
        { senderId: otherUserId, recipientId: req.user.id }
      ]
    };
    const [paged, totalMessages, otherUser, currentUser] = await Promise.all([
      messagesRepo.findManyBy(conversationQuery, {
        sort: { createdAt: 1 },
        skip: (pageNumber - 1) * limitNumber,
        limit: limitNumber
      }),
      messagesRepo.countBy(conversationQuery),
      usersRepo.findById(otherUserId),
      usersRepo.findById(req.user.id)
    ]);

    await messagesRepo.patchManyBy({
      senderId: otherUserId,
      recipientId: req.user.id,
      read: { $ne: true },
      deleted: { $ne: true }
    }, { read: true, readAt: new Date().toISOString() });

    const users = [otherUser, currentUser].filter(Boolean);

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
        totalPages: Math.ceil(totalMessages / limitNumber) || 1,
        totalMessages,
        hasNext: pageNumber * limitNumber < totalMessages,
        hasPrev: pageNumber > 1
      }
    });
  } catch (error) {
    console.error('Error fetching conversation:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get unread message count
// @route   GET /api/messages/unread/count
// @access  Private
export const getUnreadCount = async (req, res) => {
  try {
    const unreadCount = await messagesRepo.countBy({
      recipientId: req.user.id,
      read: { $ne: true },
      deleted: { $ne: true }
    });

    res.json({ unreadCount });
  } catch (error) {
    console.error('Error fetching unread count:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};
