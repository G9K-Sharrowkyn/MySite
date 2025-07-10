const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const msgCtrl = require('../controllers/messageController');

const router = express.Router();

router.get('/conversations/:userId', protect, msgCtrl.getUserConversations);
router.post('/conversations', protect, msgCtrl.startConversation);
router.get('/conversation/:conversationId', protect, msgCtrl.getConversationMessages);
router.post('/send', protect, msgCtrl.sendMessage);
router.post('/read/:conversationId', protect, msgCtrl.markConversationRead);

module.exports = router;