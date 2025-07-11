const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { 
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
} = require('../controllers/chatController');

const router = express.Router();

// GET /api/chat/rooms - Get all active chat rooms (public)
router.get('/rooms', getChatRooms);

// GET /api/chat/rooms/:roomName - Get specific chat room (public)
router.get('/rooms/:roomName', getChatRoom);

// GET /api/chat/rooms/:roomName/messages - Get messages for a room (public)
router.get('/rooms/:roomName/messages', getRoomMessages);

// GET /api/chat/rooms/:roomName/users - Get users in a room (public)
router.get('/rooms/:roomName/users', getRoomUsers);

// All routes below require authentication
router.use(protect);

// POST /api/chat/rooms/:roomName/join - Join a chat room
router.post('/rooms/:roomName/join', joinRoom);

// POST /api/chat/rooms/:roomName/leave - Leave a chat room
router.post('/rooms/:roomName/leave', leaveRoom);

// POST /api/chat/rooms/:roomName/messages - Send a message
router.post('/rooms/:roomName/messages', sendMessage);

// PUT /api/chat/messages/:messageId - Edit a message
router.put('/messages/:messageId', editMessage);

// DELETE /api/chat/messages/:messageId - Delete a message
router.delete('/messages/:messageId', deleteMessage);

// POST /api/chat/messages/:messageId/reactions - Add reaction to message
router.post('/messages/:messageId/reactions', addReaction);

// DELETE /api/chat/messages/:messageId/reactions - Remove reaction from message
router.delete('/messages/:messageId/reactions', removeReaction);

// GET /api/chat/user/rooms - Get user's active rooms
router.get('/user/rooms', getUserRooms);

// GET /api/chat/user/messages - Get user's recent messages
router.get('/user/messages', getUserMessages);

module.exports = router; 