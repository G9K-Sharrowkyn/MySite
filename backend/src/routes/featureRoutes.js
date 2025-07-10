const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const featureCtrl = require('../controllers/featureController');

const router = express.Router();

// Recommendations
router.post('/recommendations/track', protect, featureCtrl.trackRecommendation);

// Fighter Proposals
router.get('/fighter-proposals', protect, featureCtrl.getFighterProposals);
router.post('/fighter-proposals', protect, featureCtrl.createFighterProposal);

// Store/Economy
router.post('/store/purchase', protect, featureCtrl.makePurchase);

// Chat
router.post('/chat/upload', protect, featureCtrl.uploadChatFile);
router.post('/chat/message', protect, featureCtrl.sendChatMessage);

// Betting
router.post('/betting/place-bet', protect, featureCtrl.placeBet);

// User rewards
router.post('/users/claim-daily-task', protect, featureCtrl.claimDailyTask);
router.post('/user/rewards', protect, featureCtrl.claimUserReward);

module.exports = router;