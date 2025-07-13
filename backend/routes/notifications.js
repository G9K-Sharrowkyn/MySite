import express from 'express';
import { getNotifications, markAsRead, deleteNotification } from '../controllers/notificationController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// @route   GET api/notifications
// @desc    Get user's notifications
// @access  Private
router.get('/', auth, getNotifications);

// @route   PUT api/notifications/:id/read
// @desc    Mark notification as read
// @access  Private
router.put('/:id/read', auth, markAsRead);

// @route   DELETE api/notifications/:id
// @desc    Delete notification
// @access  Private
router.delete('/:id', auth, deleteNotification);

export default router;