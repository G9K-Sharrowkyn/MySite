import express from 'express';
import { getMessages, sendMessage, getMessage, markAsRead, deleteMessage } from '../controllers/messageController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// @route   GET api/messages
// @desc    Get user's messages
// @access  Private
router.get('/', auth, getMessages);

// @route   POST api/messages
// @desc    Send a message
// @access  Private
router.post('/', auth, sendMessage);

// @route   GET api/messages/:id
// @desc    Get message by ID
// @access  Private
router.get('/:id', auth, getMessage);

// @route   PUT api/messages/:id/read
// @desc    Mark message as read
// @access  Private
router.put('/:id/read', auth, markAsRead);

// @route   DELETE api/messages/:id
// @desc    Delete message
// @access  Private
router.delete('/:id', auth, deleteMessage);

export default router;