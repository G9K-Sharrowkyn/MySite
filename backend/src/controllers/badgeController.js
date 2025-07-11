const { Badge, UserBadge } = require('../models/badgeModel');
const User = require('../models/userModel');
const Division = require('../models/divisionModel');

// GET /api/badges - Get all active badges
const getBadges = async (req, res) => {
  try {
    const badges = await Badge.getActiveBadges();
    res.json(badges);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/badges/:id - Get specific badge
const getBadgeById = async (req, res) => {
  try {
    const badge = await Badge.findById(req.params.id);
    if (!badge) {
      return res.status(404).json({ message: 'Badge not found' });
    }
    
    res.json(badge);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/badges/category/:category - Get badges by category
const getBadgesByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const badges = await Badge.getByCategory(category);
    res.json(badges);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/badges/rarity/:rarity - Get badges by rarity
const getBadgesByRarity = async (req, res) => {
  try {
    const { rarity } = req.params;
    const badges = await Badge.getByRarity(rarity);
    res.json(badges);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/badges/user/:userId - Get user's badges
const getUserBadges = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const userBadges = await UserBadge.getUserBadges(userId);
    res.json(userBadges);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/badges/:id/recipients - Get users who have this badge
const getBadgeRecipients = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if badge exists
    const badge = await Badge.findById(id);
    if (!badge) {
      return res.status(404).json({ message: 'Badge not found' });
    }
    
    const recipients = await UserBadge.getBadgeRecipients(id);
    res.json(recipients);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/badges/:id/award - Award badge to user (moderator only)
const awardBadge = async (req, res) => {
  try {
    if (req.user.role !== 'moderator') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    const { id } = req.params;
    const { userId, metadata = {} } = req.body;
    
    // Check if badge exists
    const badge = await Badge.findById(id);
    if (!badge || !badge.isActive) {
      return res.status(404).json({ message: 'Badge not found or inactive' });
    }
    
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Award the badge
    const userBadge = await UserBadge.awardBadge(userId, id, req.user._id, metadata);
    
    // Create notification for the user
    const Notification = require('../models/notificationModel');
    await Notification.create({
      user: userId,
      type: 'badge_earned',
      title: 'Badge Earned!',
      message: `You earned the "${badge.displayName}" badge!`,
      data: { 
        badgeId: badge._id, 
        badgeName: badge.displayName,
        badgeIcon: badge.icon 
      },
      isRead: false
    });
    
    res.json({ 
      message: 'Badge awarded successfully',
      userBadge
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/badges/:id/revoke/:userId - Revoke badge from user (moderator only)
const revokeBadge = async (req, res) => {
  try {
    if (req.user.role !== 'moderator') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    const { id, userId } = req.params;
    
    // Check if badge exists
    const badge = await Badge.findById(id);
    if (!badge) {
      return res.status(404).json({ message: 'Badge not found' });
    }
    
    // Remove the badge
    const result = await UserBadge.findOneAndDelete({ user: userId, badge: id });
    if (!result) {
      return res.status(404).json({ message: 'User does not have this badge' });
    }
    
    res.json({ message: 'Badge revoked successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/badges/check-eligibility - Check if user is eligible for badges
const checkEligibility = async (req, res) => {
  try {
    const { userId } = req.body;
    
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get all active badges
    const badges = await Badge.getActiveBadges();
    const eligibleBadges = [];
    
    // Check eligibility for each badge
    for (const badge of badges) {
      const isEligible = await badge.checkEligibility(userId);
      if (isEligible) {
        // Check if user already has this badge
        const hasBadge = await UserBadge.findOne({ user: userId, badge: badge._id });
        if (!hasBadge) {
          eligibleBadges.push(badge);
        }
      }
    }
    
    res.json({ eligibleBadges });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/badges/auto-award - Auto-award eligible badges
const autoAwardBadges = async (req, res) => {
  try {
    const { userId } = req.body;
    
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get all active badges
    const badges = await Badge.getActiveBadges();
    const awardedBadges = [];
    
    // Check and award eligible badges
    for (const badge of badges) {
      const isEligible = await badge.checkEligibility(userId);
      if (isEligible) {
        // Check if user already has this badge
        const hasBadge = await UserBadge.findOne({ user: userId, badge: badge._id });
        if (!hasBadge) {
          // Award the badge
          const userBadge = await UserBadge.awardBadge(userId, badge._id, null, {
            achievedValue: getAchievedValue(user, badge)
          });
          
          awardedBadges.push(userBadge);
          
          // Create notification
          const Notification = require('../models/notificationModel');
          await Notification.create({
            user: userId,
            type: 'badge_earned',
            title: 'Badge Earned!',
            message: `You earned the "${badge.displayName}" badge!`,
            data: { 
              badgeId: badge._id, 
              badgeName: badge.displayName,
              badgeIcon: badge.icon 
            },
            isRead: false
          });
        }
      }
    }
    
    res.json({ 
      message: 'Badge check completed',
      awardedBadges,
      count: awardedBadges.length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Helper function to get achieved value for badge
const getAchievedValue = (user, badge) => {
  switch (badge.criteria.type) {
    case 'posts':
      return user.stats.posts;
    case 'comments':
      return user.stats.comments;
    case 'votes':
      return user.stats.votes;
    case 'wins':
      if (badge.criteria.division) {
        const division = user.divisions.find(d => d.division.toString() === badge.criteria.division.toString());
        return division ? division.wins : 0;
      }
      return user.stats.wins;
    case 'streak':
      return user.stats.currentStreak;
    default:
      return 0;
  }
};

// POST /api/badges/create-champion-badge - Create champion badge (moderator only)
const createChampionBadge = async (req, res) => {
  try {
    if (req.user.role !== 'moderator') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    const { divisionId, userId } = req.body;
    
    // Check if division exists
    const division = await Division.findById(divisionId);
    if (!division) {
      return res.status(404).json({ message: 'Division not found' });
    }
    
    // Check if user is champion
    if (!division.currentChampion || division.currentChampion.user.toString() !== userId.toString()) {
      return res.status(400).json({ message: 'User is not the current champion' });
    }
    
    // Create champion badge
    const badgeName = `${division.name}_champion`;
    const existingBadge = await Badge.findOne({ name: badgeName });
    
    if (existingBadge) {
      return res.status(400).json({ message: 'Champion badge already exists for this division' });
    }
    
    const badge = await Badge.create({
      name: badgeName,
      displayName: `${division.name} Champion`,
      description: `Champion of the ${division.name} division`,
      icon: '👑',
      color: '#FFD700',
      category: 'champion',
      rarity: 'epic',
      criteria: {
        type: 'champion',
        value: 1,
        division: divisionId,
        timeFrame: 'lifetime'
      },
      isActive: true
    });
    
    // Award the badge to the champion
    const userBadge = await UserBadge.awardBadge(userId, badge._id, req.user._id, {
      division: divisionId,
      reignStart: division.currentChampion.crownedAt,
      titleDefenses: division.currentChampion.titleDefenses
    });
    
    res.status(201).json({ 
      message: 'Champion badge created and awarded',
      badge,
      userBadge
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
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
}; 