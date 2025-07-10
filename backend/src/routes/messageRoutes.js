const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const msgCtrl = require('../controllers/messageController');

const router = express.Router();

router.get('/', protect, (req, res) => msgCtrl.getUserConversations({ ...req, params: { userId: req.user._id } }, res));
router.get('/conversations/:userId', protect, msgCtrl.getUserConversations);
router.post('/conversations', protect, msgCtrl.startConversation);
router.get('/conversation/:conversationId', protect, msgCtrl.getConversationMessages);
router.post('/send', protect, msgCtrl.sendMessage);
router.post('/read/:conversationId', protect, msgCtrl.markConversationRead);
router.get('/unread/count', protect, msgCtrl.getUnreadCount);

module.exports = router;