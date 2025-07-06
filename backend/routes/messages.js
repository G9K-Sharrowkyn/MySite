const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const auth = require('../middleware/authMiddleware');

// @route   POST api/messages
// @desc    Send a message
// @access  Private
router.post('/', auth, messageController.sendMessage);

// @route   GET api/messages
// @desc    Get user's messages
// @access  Private
router.get('/', auth, messageController.getMessages);

// @route   GET api/messages/unread/count
// @desc    Get unread message count
// @access  Private
router.get('/unread/count', auth, messageController.getUnreadCount);

// @route   GET api/messages/conversation/:userId
// @desc    Get conversation between two users
// @access  Private
router.get('/conversation/:userId', auth, messageController.getConversation);

// @route   GET api/messages/:id
// @desc    Get single message
// @access  Private
router.get('/:id', auth, messageController.getMessage);

// @route   PUT api/messages/:id/read
// @desc    Mark message as read
// @access  Private
router.put('/:id/read', auth, messageController.markAsRead);

// @route   DELETE api/messages/:id
// @desc    Delete message
// @access  Private
router.delete('/:id', auth, messageController.deleteMessage);

module.exports = router;