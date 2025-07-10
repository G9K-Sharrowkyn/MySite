const Conversation = require('../models/conversationModel');
const Message = require('../models/messageModel');

// GET /api/messages/conversations/:userId
const getUserConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({ participants: req.params.userId })
      .populate('participants', 'username avatar')
      .sort({ updatedAt: -1 });
    res.json(
      conversations.map(conv => ({
        id: conv._id,
        participants: conv.participants,
        lastMessage: conv.lastMessage,
        unreadCount: conv.unreadCounts.get(req.params.userId) || 0
      }))
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/messages/conversations
const startConversation = async (req, res) => {
  const { participants } = req.body; // array of userIds (size 2)
  try {
    let conversation = await Conversation.findOne({ participants: { $all: participants, $size: 2 } });
    if (!conversation) {
      conversation = await Conversation.create({ participants, unreadCounts: {} });
    }
    res.status(201).json({ id: conversation._id, participants: conversation.participants, lastMessage: conversation.lastMessage, unreadCount: 0 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/messages/conversation/:conversationId
const getConversationMessages = async (req, res) => {
  try {
    const messages = await Message.find({ conversation: req.params.conversationId }).sort({ createdAt: 1 });
    res.json(messages.map(m => ({ id: m._id, senderId: m.sender, content: m.content, timestamp: m.createdAt })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/messages/send
const sendMessage = async (req, res) => {
  const { conversationId, senderId, content, type = 'text' } = req.body;

  try {
    const message = await Message.create({ conversation: conversationId, sender: senderId, content, type, readBy: [senderId] });

    // update conversation lastMessage + unread counts
    const conversation = await Conversation.findById(conversationId);
    conversation.lastMessage = { content, timestamp: new Date() };

    conversation.participants.forEach(participantId => {
      const key = participantId.toString();
      const current = conversation.unreadCounts.get(key) || 0;
      if (participantId.toString() !== senderId) {
        conversation.unreadCounts.set(key, current + 1);
      }
    });

    await conversation.save();

    res.status(201).json({ id: message._id, conversationId, senderId, content, timestamp: message.createdAt });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/messages/read/:conversationId
const markConversationRead = async (req, res) => {
  const userId = req.user._id.toString();
  try {
    const conversation = await Conversation.findById(req.params.conversationId);
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

    conversation.unreadCounts.set(userId, 0);
    await conversation.save();
    res.json({ message: 'Marked as read' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/messages/unread/count
const getUnreadCount = async (req, res) => {
  try {
    const conversations = await Conversation.find({ participants: req.user._id });
    let total = 0;
    conversations.forEach(conv => {
      const c = conv.unreadCounts.get(req.user._id.toString()) || 0;
      total += c;
    });
    res.json({ count: total });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getUserConversations,
  startConversation,
  getConversationMessages,
  sendMessage,
  markConversationRead,
  getUnreadCount
};