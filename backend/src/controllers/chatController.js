const { ChatRoom, ChatMessage, ChatUserSession } = require('../models/chatModel');
const User = require('../models/userModel');

// GET /api/chat/rooms - Get all active chat rooms
const getChatRooms = async (req, res) => {
  try {
    const rooms = await ChatRoom.getActiveRooms();
    res.json(rooms);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/chat/rooms/:roomName - Get specific chat room
const getChatRoom = async (req, res) => {
  try {
    const { roomName } = req.params;
    const room = await ChatRoom.getRoomByName(roomName);
    
    if (!room) {
      return res.status(404).json({ message: 'Chat room not found' });
    }
    
    res.json(room);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/chat/rooms/:roomName/messages - Get messages for a room
const getRoomMessages = async (req, res) => {
  try {
    const { roomName } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    const room = await ChatRoom.getRoomByName(roomName);
    if (!room) {
      return res.status(404).json({ message: 'Chat room not found' });
    }
    
    const messages = await ChatMessage.getRoomMessages(roomName, parseInt(limit), parseInt(offset));
    res.json(messages.reverse()); // Return in chronological order
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/chat/rooms/:roomName/users - Get users in a room
const getRoomUsers = async (req, res) => {
  try {
    const { roomName } = req.params;
    
    const room = await ChatRoom.getRoomByName(roomName);
    if (!room) {
      return res.status(404).json({ message: 'Chat room not found' });
    }
    
    const users = await ChatUserSession.getRoomUsers(roomName);
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/chat/rooms/:roomName/join - Join a chat room
const joinRoom = async (req, res) => {
  try {
    const { roomName } = req.params;
    
    const room = await ChatRoom.getRoomByName(roomName);
    if (!room) {
      return res.status(404).json({ message: 'Chat room not found' });
    }
    
    // Check if user can join (room not full)
    if (room.currentUsers >= room.maxUsers) {
      return res.status(400).json({ message: 'Room is full' });
    }
    
    // Check if user is already in the room
    const existingSession = await ChatUserSession.findOne({
      user: req.user._id,
      room: roomName,
      isActive: true
    });
    
    if (existingSession) {
      return res.status(400).json({ message: 'Already in this room' });
    }
    
    // Create or update session
    await ChatUserSession.findOneAndUpdate(
      { user: req.user._id, room: roomName },
      { 
        user: req.user._id, 
        room: roomName, 
        isActive: true,
        lastActivity: new Date()
      },
      { upsert: true, new: true }
    );
    
    // Update room user count
    await room.addUser();
    
    // Create join message
    const joinMessage = await ChatMessage.create({
      room: roomName,
      user: req.user._id,
      content: `${req.user.username} joined the room`,
      messageType: 'join'
    });
    
    await joinMessage.populate('user', 'username profile.avatar profile.customTitle');
    
    res.json({ 
      message: 'Joined room successfully',
      session: { room: roomName, joinedAt: new Date() },
      joinMessage
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/chat/rooms/:roomName/leave - Leave a chat room
const leaveRoom = async (req, res) => {
  try {
    const { roomName } = req.params;
    
    const room = await ChatRoom.getRoomByName(roomName);
    if (!room) {
      return res.status(404).json({ message: 'Chat room not found' });
    }
    
    // Deactivate session
    await ChatUserSession.findOneAndUpdate(
      { user: req.user._id, room: roomName },
      { isActive: false }
    );
    
    // Update room user count
    await room.removeUser();
    
    // Create leave message
    const leaveMessage = await ChatMessage.create({
      room: roomName,
      user: req.user._id,
      content: `${req.user.username} left the room`,
      messageType: 'leave'
    });
    
    await leaveMessage.populate('user', 'username profile.avatar profile.customTitle');
    
    res.json({ 
      message: 'Left room successfully',
      leaveMessage
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/chat/rooms/:roomName/messages - Send a message
const sendMessage = async (req, res) => {
  try {
    const { roomName } = req.params;
    const { content } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: 'Message content is required' });
    }
    
    if (content.length > 1000) {
      return res.status(400).json({ message: 'Message too long (max 1000 characters)' });
    }
    
    const room = await ChatRoom.getRoomByName(roomName);
    if (!room) {
      return res.status(404).json({ message: 'Chat room not found' });
    }
    
    // Check if user is in the room
    const session = await ChatUserSession.findOne({
      user: req.user._id,
      room: roomName,
      isActive: true
    });
    
    if (!session) {
      return res.status(400).json({ message: 'You must join the room first' });
    }
    
    // Create message
    const message = await ChatMessage.create({
      room: roomName,
      user: req.user._id,
      content: content.trim(),
      messageType: 'text'
    });
    
    // Update session activity
    await ChatUserSession.findByIdAndUpdate(session._id, {
      lastActivity: new Date()
    });
    
    // Update room last message time
    await room.updateLastMessage();
    
    // Populate user info
    await message.populate('user', 'username profile.avatar profile.customTitle');
    
    res.status(201).json(message);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/chat/messages/:messageId - Edit a message
const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: 'Message content is required' });
    }
    
    if (content.length > 1000) {
      return res.status(400).json({ message: 'Message too long (max 1000 characters)' });
    }
    
    const message = await ChatMessage.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }
    
    // Check if user can edit this message
    if (message.user.toString() !== req.user._id.toString() && req.user.role !== 'moderator') {
      return res.status(403).json({ message: 'Not authorized to edit this message' });
    }
    
    // Check if message is too old to edit (5 minutes)
    const messageAge = Date.now() - message.createdAt;
    if (messageAge > 5 * 60 * 1000 && req.user.role !== 'moderator') {
      return res.status(400).json({ message: 'Message is too old to edit' });
    }
    
    await message.edit(content.trim(), req.user._id);
    await message.populate('user', 'username profile.avatar profile.customTitle');
    
    res.json(message);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/chat/messages/:messageId - Delete a message
const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    
    const message = await ChatMessage.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }
    
    // Check if user can delete this message
    if (message.user.toString() !== req.user._id.toString() && req.user.role !== 'moderator') {
      return res.status(403).json({ message: 'Not authorized to delete this message' });
    }
    
    await message.delete(req.user._id, req.user.role === 'moderator');
    
    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/chat/messages/:messageId/reactions - Add reaction to message
const addReaction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    
    if (!emoji) {
      return res.status(400).json({ message: 'Emoji is required' });
    }
    
    const message = await ChatMessage.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }
    
    await message.addReaction(req.user._id, emoji);
    await message.populate('user', 'username profile.avatar profile.customTitle');
    
    res.json(message);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/chat/messages/:messageId/reactions - Remove reaction from message
const removeReaction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    
    if (!emoji) {
      return res.status(400).json({ message: 'Emoji is required' });
    }
    
    const message = await ChatMessage.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }
    
    await message.removeReaction(req.user._id, emoji);
    await message.populate('user', 'username profile.avatar profile.customTitle');
    
    res.json(message);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/chat/user/rooms - Get user's active rooms
const getUserRooms = async (req, res) => {
  try {
    const rooms = await ChatUserSession.getUserRooms(req.user._id);
    res.json(rooms);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/chat/user/messages - Get user's recent messages
const getUserMessages = async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const messages = await ChatMessage.getUserMessages(req.user._id, parseInt(limit));
    res.json(messages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getChatRooms,
  getChatRoom,
  getRoomMessages,
  getRoomUsers,
  joinRoom,
  leaveRoom,
  sendMessage,
  editMessage,
  deleteMessage,
  addReaction,
  removeReaction,
  getUserRooms,
  getUserMessages
}; 