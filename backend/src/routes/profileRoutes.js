const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const profileCtrl = require('../controllers/profileController');

const router = express.Router();

router.get('/me', protect, profileCtrl.getMyProfile);
router.put('/me', protect, profileCtrl.updateMyProfile);
router.get('/all', protect, profileCtrl.getAllProfiles);
router.get('/leaderboard', profileCtrl.getLeaderboard);

module.exports = router;