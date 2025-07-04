const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const auth = require('../middleware/authMiddleware');

// @route   GET api/messages
// @desc    Get messages for authenticated user
// @access  Private
router.get('/', auth, messageController.getMessages);

// @route   POST api/messages
// @desc    Send a message
// @access  Private
router.post('/', auth, messageController.sendMessage);

module.exports = router;
