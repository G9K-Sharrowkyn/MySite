const express = require('express');
const { protect, moderator } = require('../middleware/authMiddleware');
const {
  getBadges,
  getBadgeById,
  getBadgesByCategory,
  getBadgesByRarity,
  getUserBadges,
  getBadgeRecipients,
  awardBadge,
  revokeBadge,
  checkEligibility,
  autoAwardBadges,
  createChampionBadge
} = require('../controllers/badgeController');

const router = express.Router();

// Public routes
router.get('/', getBadges);
router.get('/category/:category', getBadgesByCategory);
router.get('/rarity/:rarity', getBadgesByRarity);
router.get('/:id', getBadgeById);
router.get('/:id/recipients', getBadgeRecipients);
router.get('/user/:userId', getUserBadges);

// Protected routes
router.use(protect);

router.post('/check-eligibility', checkEligibility);
router.post('/auto-award', autoAwardBadges);

// Moderator only routes
router.post('/:id/award', moderator, awardBadge);
router.delete('/:id/revoke/:userId', moderator, revokeBadge);
router.post('/create-champion-badge', moderator, createChampionBadge);

module.exports = router; 