import Message from '../models/Message.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';

// @desc    Send a message
// @route   POST /api/messages
// @access  Private
export const sendMessage = async (req, res) => {
  try {
    console.log('Send message request received:', {
      userId: req.user.id,
      body: req.body
    });

    const { recipientId, content, subject } = req.body;

    // Check if recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      console.error('Recipient not found:', recipientId);
      return res.status(404).json({ msg: 'Odbiorca nie znaleziony' });
    }

    // Get sender info
    const sender = await User.findById(req.user.id);

    const newMessage = await Message.create({
      from: req.user.id,
      to: recipientId,
      content: `${subject ? `[${subject}] ` : ''}${content}`,
      read: false,
      deleted: false
    });

    // Create notification for recipient
    await Notification.create({
      userId: recipientId,
      type: 'message',
      title: 'Nowa wiadomość',
      message: `Otrzymałeś nową wiadomość od ${sender.username}`,
      data: {
        messageId: newMessage._id.toString(),
        senderId: req.user.id,
        senderUsername: sender.username
      },
      read: false
    });

    console.log('Message sent successfully:', newMessage);
    res.json({ msg: 'Wiadomość wysłana', message: newMessage });
  } catch (error) {
    console.error('Error sending message:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get user's messages
// @route   GET /api/messages
// @access  Private
export const getMessages = async (req, res) => {
  try {
    const { type = 'received', page = 1, limit = 20 } = req.query;

    let query;
    if (type === 'sent') {
      query = { from: req.user.id, deleted: false };
    } else {
      query = { to: req.user.id, deleted: false };
    }

    const totalMessages = await Message.countDocuments(query);
    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('from', 'username')
      .populate('to', 'username');

    const unreadCount = await Message.countDocuments({ to: req.user.id, read: false, deleted: false });

    res.json({
      messages,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalMessages / limit),
        totalMessages,
        hasNext: page * limit < totalMessages,
        hasPrev: page > 1
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
    const message = await Message.findById(req.params.id)
      .populate('from', 'username')
      .populate('to', 'username');

    if (!message) {
      return res.status(404).json({ msg: 'Wiadomość nie znaleziona' });
    }

    // Check if user is sender or recipient
    if (message.from._id.toString() !== req.user.id && message.to._id.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Brak dostępu do tej wiadomości' });
    }

    // Mark as read if user is recipient
    if (message.to._id.toString() === req.user.id && !message.read) {
      message.read = true;
      message.readAt = new Date();
      await message.save();
    }

    res.json(message);
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
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({ msg: 'Wiadomość nie znaleziona' });
    }

    // Check if user is sender or recipient
    if (message.from.toString() !== req.user.id && message.to.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Brak dostępu do tej wiadomości' });
    }

    // Mark as deleted instead of actually deleting
    message.deleted = true;
    await message.save();

    res.json({ msg: 'Wiadomość usunięta' });
  } catch (error) {
    console.error('Error deleting message:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Mark message as read
// @route   PUT /api/messages/:id/read
// @access  Private
export const markAsRead = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({ msg: 'Wiadomość nie znaleziona' });
    }

    // Check if user is recipient
    if (message.to.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Brak dostępu do tej wiadomości' });
    }

    message.read = true;
    message.readAt = new Date();
    await message.save();

    res.json({ msg: 'Wiadomość oznaczona jako przeczytana' });
  } catch (error) {
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
    const otherUserId = req.params.userId;

    // Get all messages between the two users
    const query = {
      deleted: false,
      $or: [
        { from: req.user.id, to: otherUserId },
        { from: otherUserId, to: req.user.id }
      ]
    };

    const totalMessages = await Message.countDocuments(query);
    const messages = await Message.find(query)
      .sort({ createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    // Mark received messages as read
    await Message.updateMany(
      { from: otherUserId, to: req.user.id, read: false },
      { read: true, readAt: new Date() }
    );

    // Get other user info
    const otherUser = await User.findById(otherUserId);

    res.json({
      messages,
      otherUser: otherUser ? {
        id: otherUser._id,
        username: otherUser.username,
        profilePicture: otherUser.profile?.profilePicture || otherUser.profile?.avatar || ''
      } : null,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalMessages / limit),
        totalMessages,
        hasNext: page * limit < totalMessages,
        hasPrev: page > 1
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
    const unreadCount = await Message.countDocuments({
      to: req.user.id,
      read: false,
      deleted: false
    });

    res.json({ unreadCount });
  } catch (error) {
    console.error('Error fetching unread count:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
