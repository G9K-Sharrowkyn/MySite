import express from 'express';
import badgeService from '../services/badgeService.js';
import Badge from '../models/Badge.js';
import UserBadge from '../models/UserBadge.js';
import User from '../models/User.js';
import auth from '../middleware/auth.js';
import moderatorAuth from '../middleware/moderatorAuth.js';

const router = express.Router();

// Get all available badges
router.get('/available', async (req, res) => {
  try {
    const { category, rarity } = req.query;
    const filter = { isActive: true };
    
    if (category) filter.category = category;
    if (rarity) filter.rarity = rarity;

    const badges = await Badge.find(filter).sort({ category: 1, rarity: 1 });
    res.json(badges);
  } catch (error) {
    console.error('Error fetching available badges:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's badges
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { displayed } = req.query;
    
    const options = {};
    if (displayed === 'true') options.displayed = true;

    const userBadges = await badgeService.getUserBadges(userId, options);
    res.json(userBadges);
  } catch (error) {
    console.error('Error fetching user badges:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current user's badges
router.get('/my-badges', auth, async (req, res) => {
  try {
    const { displayed } = req.query;
    const options = {};
    if (displayed === 'true') options.displayed = true;

    const userBadges = await badgeService.getUserBadges(req.user.id, options);
    res.json(userBadges);
  } catch (error) {
    console.error('Error fetching user badges:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update badge display settings
router.put('/display/:badgeId', auth, async (req, res) => {
  try {
    const { badgeId } = req.params;
    const { isDisplayed } = req.body;

    const result = await badgeService.updateBadgeDisplay(req.user.id, badgeId, isDisplayed);
    
    if (result.success) {
      res.json({ message: 'Badge display updated successfully' });
    } else {
      res.status(400).json({ message: 'Failed to update badge display' });
    }
  } catch (error) {
    console.error('Error updating badge display:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get badge leaderboard
router.get('/leaderboard/:badgeId', async (req, res) => {
  try {
    const { badgeId } = req.params;
    const { limit = 10 } = req.query;

    const leaderboard = await badgeService.getBadgeLeaderboard(badgeId, parseInt(limit));
    res.json(leaderboard);
  } catch (error) {
    console.error('Error fetching badge leaderboard:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get badge statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await badgeService.getBadgeStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching badge stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Check and award badges for user (manual trigger)
router.post('/check-awards', auth, async (req, res) => {
  try {
    await badgeService.checkAndAwardBadges(req.user.id);
    res.json({ message: 'Badge check completed' });
  } catch (error) {
    console.error('Error checking badges:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// MODERATOR ROUTES

// Award badge to user (moderator only)
router.post('/award', moderatorAuth, async (req, res) => {
  try {
    const { userId, badgeId, metadata } = req.body;

    if (!userId || !badgeId) {
      return res.status(400).json({ message: 'User ID and Badge ID are required' });
    }

    const result = await badgeService.awardBadge(userId, badgeId, metadata);
    
    if (result.success) {
      res.json({ 
        message: 'Badge awarded successfully',
        badge: result.badge
      });
    } else {
      res.status(400).json({ message: result.message });
    }
  } catch (error) {
    console.error('Error awarding badge:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new badge (moderator only)
router.post('/create', moderatorAuth, async (req, res) => {
  try {
    const badgeData = req.body;

    // Validate required fields
    const requiredFields = ['id', 'name', 'description', 'icon', 'category', 'rarity', 'color', 'requirements'];
    for (const field of requiredFields) {
      if (!badgeData[field]) {
        return res.status(400).json({ message: `${field} is required` });
      }
    }

    const badge = new Badge(badgeData);
    await badge.save();

    res.status(201).json({
      message: 'Badge created successfully',
      badge
    });
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ message: 'Badge ID already exists' });
    } else {
      console.error('Error creating badge:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
});

// Update badge (moderator only)
router.put('/:badgeId', moderatorAuth, async (req, res) => {
  try {
    const { badgeId } = req.params;
    const updateData = req.body;

    const badge = await Badge.findOneAndUpdate(
      { id: badgeId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!badge) {
      return res.status(404).json({ message: 'Badge not found' });
    }

    res.json({
      message: 'Badge updated successfully',
      badge
    });
  } catch (error) {
    console.error('Error updating badge:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete badge (moderator only)
router.delete('/:badgeId', moderatorAuth, async (req, res) => {
  try {
    const { badgeId } = req.params;

    // Soft delete - set isActive to false
    const badge = await Badge.findOneAndUpdate(
      { id: badgeId },
      { isActive: false },
      { new: true }
    );

    if (!badge) {
      return res.status(404).json({ message: 'Badge not found' });
    }

    // Also deactivate all user badges with this ID
    await UserBadge.updateMany(
      { badgeId },
      { isActive: false }
    );

    res.json({ message: 'Badge deleted successfully' });
  } catch (error) {
    console.error('Error deleting badge:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all badges for management (moderator only)
router.get('/manage/all', moderatorAuth, async (req, res) => {
  try {
    const badges = await Badge.find().sort({ category: 1, createdAt: -1 });
    res.json(badges);
  } catch (error) {
    console.error('Error fetching all badges:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user badge history (moderator only)
router.get('/manage/user/:userId/history', moderatorAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const userBadges = await UserBadge.find({ userId })
      .populate('badge')
      .sort({ earnedAt: -1 });

    res.json(userBadges);
  } catch (error) {
    console.error('Error fetching user badge history:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Revoke badge from user (moderator only)
router.delete('/revoke/:userId/:badgeId', moderatorAuth, async (req, res) => {
  try {
    const { userId, badgeId } = req.params;

    const userBadge = await UserBadge.findOneAndUpdate(
      { userId, badgeId },
      { isActive: false },
      { new: true }
    );

    if (!userBadge) {
      return res.status(404).json({ message: 'User badge not found' });
    }

    // Remove from user's achievements array
    await User.findByIdAndUpdate(userId, {
      $pull: { achievements: badgeId }
    });

    res.json({ message: 'Badge revoked successfully' });
  } catch (error) {
    console.error('Error revoking badge:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;