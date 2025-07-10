const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const notifCtrl = require('../controllers/notificationController');

const router = express.Router();

router.get('/', protect, notifCtrl.getNotifications);
router.get('/unread/count', protect, notifCtrl.getUnreadCount);
router.post('/:id/read', protect, notifCtrl.markAsRead);

module.exports = router;