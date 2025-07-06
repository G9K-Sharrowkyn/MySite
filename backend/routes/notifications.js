const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const auth = require('../middleware/authMiddleware');

// @route   GET api/notifications
// @desc    Get user notifications
// @access  Private
router.get('/', auth, notificationController.getNotifications);

// @route   GET api/notifications/unread/count
// @desc    Get unread notification count
// @access  Private
router.get('/unread/count', auth, notificationController.getUnreadCount);

// @route   PUT api/notifications/read-all
// @desc    Mark all notifications as read
// @access  Private
router.put('/read-all', auth, notificationController.markAllAsRead);

// @route   PUT api/notifications/:id/read
// @desc    Mark notification as read
// @access  Private
router.put('/:id/read', auth, notificationController.markAsRead);

// @route   DELETE api/notifications/:id
// @desc    Delete notification
// @access  Private
router.delete('/:id', auth, notificationController.deleteNotification);

module.exports = router;