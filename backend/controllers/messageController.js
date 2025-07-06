const { v4: uuidv4 } = require('uuid');

// @desc    Send a message
// @route   POST /api/messages
// @access  Private
exports.sendMessage = async (req, res) => {
  try {
    console.log('Send message request received:', {
      userId: req.user.id,
      body: req.body
    });

    const { recipientId, content, subject } = req.body;
    const db = req.db;
    await db.read();

    // Check if recipient exists
    const recipient = db.data.users.find(u => u.id === recipientId);
    if (!recipient) {
      console.error('Recipient not found:', recipientId);
      return res.status(404).json({ msg: 'Odbiorca nie znaleziony' });
    }

    // Get sender info
    const sender = db.data.users.find(u => u.id === req.user.id);

    const newMessage = {
      id: uuidv4(),
      senderId: req.user.id,
      senderUsername: sender.username,
      recipientId,
      recipientUsername: recipient.username,
      subject: subject || 'Brak tematu',
      content,
      createdAt: new Date().toISOString(),
      read: false,
      deleted: false
    };

    db.data.messages.push(newMessage);
    
    // Create notification for recipient
    const notification = {
      id: uuidv4(),
      userId: recipientId,
      type: 'message',
      title: 'Nowa wiadomość',
      content: `Otrzymałeś nową wiadomość od ${sender.username}`,
      data: {
        messageId: newMessage.id,
        senderId: req.user.id,
        senderUsername: sender.username
      },
      read: false,
      createdAt: new Date().toISOString()
    };

    db.data.notifications.push(notification);
    await db.write();

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
exports.getMessages = async (req, res) => {
  const { type = 'received', page = 1, limit = 20 } = req.query;
  const db = req.db;
  await db.read();

  let messages;
  
  if (type === 'sent') {
    messages = db.data.messages.filter(m => m.senderId === req.user.id && !m.deleted);
  } else {
    messages = db.data.messages.filter(m => m.recipientId === req.user.id && !m.deleted);
  }

  // Sort by creation date (newest first)
  messages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Pagination
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const paginatedMessages = messages.slice(startIndex, endIndex);

  res.json({
    messages: paginatedMessages,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(messages.length / limit),
      totalMessages: messages.length,
      hasNext: endIndex < messages.length,
      hasPrev: startIndex > 0
    },
    unreadCount: messages.filter(m => !m.read && m.recipientId === req.user.id).length
  });
};

// @desc    Get single message
// @route   GET /api/messages/:id
// @access  Private
exports.getMessage = async (req, res) => {
  const db = req.db;
  await db.read();

  const message = db.data.messages.find(m => m.id === req.params.id);
  
  if (!message) {
    return res.status(404).json({ msg: 'Wiadomość nie znaleziona' });
  }

  // Check if user is sender or recipient
  if (message.senderId !== req.user.id && message.recipientId !== req.user.id) {
    return res.status(403).json({ msg: 'Brak dostępu do tej wiadomości' });
  }

  // Mark as read if user is recipient
  if (message.recipientId === req.user.id && !message.read) {
    const messageIndex = db.data.messages.findIndex(m => m.id === req.params.id);
    db.data.messages[messageIndex].read = true;
    db.data.messages[messageIndex].readAt = new Date().toISOString();
    await db.write();
    message.read = true;
    message.readAt = db.data.messages[messageIndex].readAt;
  }

  res.json(message);
};

// @desc    Delete message
// @route   DELETE /api/messages/:id
// @access  Private
exports.deleteMessage = async (req, res) => {
  const db = req.db;
  await db.read();

  const messageIndex = db.data.messages.findIndex(m => m.id === req.params.id);
  
  if (messageIndex === -1) {
    return res.status(404).json({ msg: 'Wiadomość nie znaleziona' });
  }

  const message = db.data.messages[messageIndex];

  // Check if user is sender or recipient
  if (message.senderId !== req.user.id && message.recipientId !== req.user.id) {
    return res.status(403).json({ msg: 'Brak dostępu do tej wiadomości' });
  }

  // Mark as deleted instead of actually deleting
  db.data.messages[messageIndex].deleted = true;
  db.data.messages[messageIndex].deletedAt = new Date().toISOString();
  db.data.messages[messageIndex].deletedBy = req.user.id;

  await db.write();
  res.json({ msg: 'Wiadomość usunięta' });
};

// @desc    Mark message as read
// @route   PUT /api/messages/:id/read
// @access  Private
exports.markAsRead = async (req, res) => {
  const db = req.db;
  await db.read();

  const messageIndex = db.data.messages.findIndex(m => m.id === req.params.id);
  
  if (messageIndex === -1) {
    return res.status(404).json({ msg: 'Wiadomość nie znaleziona' });
  }

  const message = db.data.messages[messageIndex];

  // Check if user is recipient
  if (message.recipientId !== req.user.id) {
    return res.status(403).json({ msg: 'Brak dostępu do tej wiadomości' });
  }

  db.data.messages[messageIndex].read = true;
  db.data.messages[messageIndex].readAt = new Date().toISOString();

  await db.write();
  res.json({ msg: 'Wiadomość oznaczona jako przeczytana' });
};

// @desc    Get conversation between two users
// @route   GET /api/messages/conversation/:userId
// @access  Private
exports.getConversation = async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const db = req.db;
  await db.read();

  const otherUserId = req.params.userId;
  
  // Get all messages between the two users
  const messages = db.data.messages.filter(m => 
    !m.deleted && (
      (m.senderId === req.user.id && m.recipientId === otherUserId) ||
      (m.senderId === otherUserId && m.recipientId === req.user.id)
    )
  );

  // Sort by creation date (oldest first for conversation view)
  messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  // Pagination
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const paginatedMessages = messages.slice(startIndex, endIndex);

  // Mark received messages as read
  const unreadMessages = messages.filter(m => 
    m.recipientId === req.user.id && !m.read
  );

  if (unreadMessages.length > 0) {
    unreadMessages.forEach(message => {
      const messageIndex = db.data.messages.findIndex(m => m.id === message.id);
      if (messageIndex !== -1) {
        db.data.messages[messageIndex].read = true;
        db.data.messages[messageIndex].readAt = new Date().toISOString();
      }
    });
    await db.write();
  }

  // Get other user info
  const otherUser = db.data.users.find(u => u.id === otherUserId);

  res.json({
    messages: paginatedMessages,
    otherUser: otherUser ? {
      id: otherUser.id,
      username: otherUser.username,
      profilePicture: otherUser.profilePicture || otherUser.profile?.avatar || ''
    } : null,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(messages.length / limit),
      totalMessages: messages.length,
      hasNext: endIndex < messages.length,
      hasPrev: startIndex > 0
    }
  });
};

// @desc    Get unread message count
// @route   GET /api/messages/unread/count
// @access  Private
exports.getUnreadCount = async (req, res) => {
  const db = req.db;
  await db.read();

  const unreadCount = db.data.messages.filter(m => 
    m.recipientId === req.user.id && !m.read && !m.deleted
  ).length;

  res.json({ unreadCount });
};