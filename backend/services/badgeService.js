import Badge from '../models/Badge.js';
import UserBadge from '../models/UserBadge.js';
import User from '../models/User.js';
import { createNotification } from './notificationService.js';

class BadgeService {
  constructor() {
    this.initializeDefaultBadges();
  }

  // Initialize default badges in the database
  async initializeDefaultBadges() {
    try {
      const existingBadges = await Badge.countDocuments();
      if (existingBadges === 0) {
        await this.createDefaultBadges();
      }
    } catch (error) {
      console.error('Error initializing default badges:', error);
    }
  }

  // Create all default badges
  async createDefaultBadges() {
    const defaultBadges = [
      // Fighting Badges
      {
        id: 'first_win',
        name: 'First Victory',
        description: 'Win your first fight',
        icon: '🥇',
        category: 'fighting',
        rarity: 'common',
        color: '#28a745',
        requirements: { fightsWon: 1 }
      },
      {
        id: 'win_streak_5',
        name: 'Hot Streak',
        description: 'Win 5 fights in a row',
        icon: '🔥',
        category: 'fighting',
        rarity: 'uncommon',
        color: '#fd7e14',
        requirements: { winStreak: 5 }
      },
      {
        id: 'win_streak_10',
        name: 'Unstoppable',
        description: 'Win 10 fights in a row',
        icon: '⚡',
        category: 'fighting',
        rarity: 'rare',
        color: '#6f42c1',
        requirements: { winStreak: 10 }
      },
      {
        id: 'fights_won_10',
        name: 'Veteran Fighter',
        description: 'Win 10 total fights',
        icon: '🛡️',
        category: 'fighting',
        rarity: 'common',
        color: '#17a2b8',
        requirements: { fightsWon: 10 }
      },
      {
        id: 'fights_won_50',
        name: 'Champion',
        description: 'Win 50 total fights',
        icon: '👑',
        category: 'fighting',
        rarity: 'epic',
        color: '#ffd700',
        requirements: { fightsWon: 50 }
      },
      {
        id: 'fights_won_100',
        name: 'Legend',
        description: 'Win 100 total fights',
        icon: '🏆',
        category: 'fighting',
        rarity: 'legendary',
        color: '#ff6b6b',
        requirements: { fightsWon: 100 }
      },

      // Division Championship Badges
      {
        id: 'champion_regular',
        name: 'Regular Division Champion',
        description: 'Become champion of the Regular Division',
        icon: '🥉',
        category: 'championship',
        rarity: 'rare',
        color: '#6c757d',
        requirements: { divisionChampion: 'regular' },
        divisionId: 'regular'
      },
      {
        id: 'champion_metahuman',
        name: 'Metahuman Division Champion',
        description: 'Become champion of the Metahuman Division',
        icon: '🥈',
        category: 'championship',
        rarity: 'epic',
        color: '#28a745',
        requirements: { divisionChampion: 'metahuman' },
        divisionId: 'metahuman'
      },
      {
        id: 'champion_planetbusters',
        name: 'Planet Busters Champion',
        description: 'Become champion of the Planet Busters Division',
        icon: '🥇',
        category: 'championship',
        rarity: 'epic',
        color: '#fd7e14',
        requirements: { divisionChampion: 'planetBusters' },
        divisionId: 'planetBusters'
      },
      {
        id: 'champion_godtier',
        name: 'God Tier Champion',
        description: 'Become champion of the God Tier Division',
        icon: '👑',
        category: 'championship',
        rarity: 'legendary',
        color: '#6f42c1',
        requirements: { divisionChampion: 'godTier' },
        divisionId: 'godTier'
      },
      {
        id: 'champion_universal',
        name: 'Universal Threat Champion',
        description: 'Become champion of the Universal Threat Division',
        icon: '🌌',
        category: 'championship',
        rarity: 'legendary',
        color: '#dc3545',
        requirements: { divisionChampion: 'universalThreat' },
        divisionId: 'universalThreat'
      },
      {
        id: 'champion_omnipotent',
        name: 'Omnipotent Champion',
        description: 'Become champion of the Omnipotent Division',
        icon: '✨',
        category: 'championship',
        rarity: 'mythic',
        color: '#ffd700',
        requirements: { divisionChampion: 'omnipotent' },
        divisionId: 'omnipotent'
      },

      // Social Badges
      {
        id: 'first_post',
        name: 'First Post',
        description: 'Create your first post',
        icon: '📝',
        category: 'social',
        rarity: 'common',
        color: '#007bff',
        requirements: { postsCreated: 1 }
      },
      {
        id: 'social_butterfly',
        name: 'Social Butterfly',
        description: 'Receive 100 likes on your posts',
        icon: '🦋',
        category: 'social',
        rarity: 'uncommon',
        color: '#e83e8c',
        requirements: { likesReceived: 100 }
      },
      {
        id: 'popular',
        name: 'Popular',
        description: 'Receive 500 likes on your posts',
        icon: '⭐',
        category: 'social',
        rarity: 'rare',
        color: '#ffc107',
        requirements: { likesReceived: 500 }
      },

      // Betting Badges
      {
        id: 'first_bet',
        name: 'First Bet',
        description: 'Place your first bet',
        icon: '🎲',
        category: 'betting',
        rarity: 'common',
        color: '#20c997',
        requirements: { betsPlaced: 1 }
      },
      {
        id: 'lucky_streak',
        name: 'Lucky Streak',
        description: 'Win 5 bets in a row',
        icon: '🍀',
        category: 'betting',
        rarity: 'uncommon',
        color: '#28a745',
        requirements: { betWinStreak: 5 }
      },
      {
        id: 'high_roller',
        name: 'High Roller',
        description: 'Win 10,000 coins from betting',
        icon: '💰',
        category: 'betting',
        rarity: 'epic',
        color: '#ffd700',
        requirements: { coinsWonFromBetting: 10000 }
      },

      // Milestone Badges
      {
        id: 'early_adopter',
        name: 'Early Adopter',
        description: 'One of the first 100 users to join',
        icon: '🚀',
        category: 'milestone',
        rarity: 'rare',
        color: '#6f42c1',
        requirements: { userNumber: 100 }
      },
      {
        id: 'one_year',
        name: 'One Year Strong',
        description: 'Active for one full year',
        icon: '🎂',
        category: 'milestone',
        rarity: 'uncommon',
        color: '#fd7e14',
        requirements: { daysActive: 365 }
      },

      // Special Badges
      {
        id: 'beta_tester',
        name: 'Beta Tester',
        description: 'Participated in beta testing',
        icon: '🧪',
        category: 'special',
        rarity: 'epic',
        color: '#17a2b8',
        requirements: { special: 'beta_tester' }
      },
      {
        id: 'moderator',
        name: 'Moderator',
        description: 'Platform moderator',
        icon: '🛡️',
        category: 'special',
        rarity: 'legendary',
        color: '#dc3545',
        requirements: { role: 'moderator' }
      }
    ];

    for (const badgeData of defaultBadges) {
      try {
        await Badge.create(badgeData);
      } catch (error) {
        if (error.code !== 11000) { // Ignore duplicate key errors
          console.error(`Error creating badge ${badgeData.id}:`, error);
        }
      }
    }

    console.log('Default badges initialized successfully');
  }

  // Award a badge to a user
  async awardBadge(userId, badgeId, metadata = {}) {
    try {
      // Check if user already has this badge
      const existingBadge = await UserBadge.findOne({ userId, badgeId });
      if (existingBadge) {
        return { success: false, message: 'User already has this badge' };
      }

      // Get badge details
      const badge = await Badge.findOne({ id: badgeId, isActive: true });
      if (!badge) {
        return { success: false, message: 'Badge not found' };
      }

      // Create user badge
      const userBadge = new UserBadge({
        userId,
        badgeId,
        progress: {
          current: metadata.progress?.current || badge.requirements.target || 1,
          target: badge.requirements.target || 1,
          completed: true
        },
        tier: metadata.tier || 1,
        metadata,
        championshipDate: metadata.championshipDate,
        divisionId: badge.divisionId,
        divisionName: metadata.divisionName
      });

      await userBadge.save();

      // Update user's achievements array (for backward compatibility)
      await User.findByIdAndUpdate(userId, {
        $addToSet: { achievements: badgeId }
      });

      // Create notification
      await createNotification(userId, {
        type: 'badge_earned',
        title: 'New Badge Earned!',
        message: `You've earned the "${badge.name}" badge!`,
        data: {
          badgeId,
          badgeName: badge.name,
          badgeIcon: badge.icon,
          badgeRarity: badge.rarity
        }
      });

      return { 
        success: true, 
        message: 'Badge awarded successfully',
        badge: userBadge
      };
    } catch (error) {
      console.error('Error awarding badge:', error);
      return { success: false, message: 'Error awarding badge' };
    }
  }

  // Check and award badges based on user stats
  async checkAndAwardBadges(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      const userBadges = await UserBadge.find({ userId }).select('badgeId');
      const earnedBadgeIds = userBadges.map(ub => ub.badgeId);

      // Get all available badges
      const availableBadges = await Badge.find({ 
        isActive: true,
        id: { $nin: earnedBadgeIds }
      });

      for (const badge of availableBadges) {
        if (await this.checkBadgeRequirements(user, badge)) {
          await this.awardBadge(userId, badge.id);
        }
      }
    } catch (error) {
      console.error('Error checking and awarding badges:', error);
    }
  }

  // Check if user meets badge requirements
  async checkBadgeRequirements(user, badge) {
    const req = badge.requirements;

    // Fighting requirements
    if (req.fightsWon && user.stats.fightsWon >= req.fightsWon) return true;
    if (req.winStreak && user.stats.currentWinStreak >= req.winStreak) return true;

    // Social requirements
    if (req.postsCreated && user.activity.postsCreated >= req.postsCreated) return true;
    if (req.likesReceived && user.activity.likesReceived >= req.likesReceived) return true;

    // Special requirements
    if (req.role && user.role === req.role) return true;

    return false;
  }

  // Award division championship badge
  async awardChampionshipBadge(userId, divisionId, divisionName) {
    const badgeId = `champion_${divisionId}`;
    return await this.awardBadge(userId, badgeId, {
      championshipDate: new Date(),
      divisionId,
      divisionName
    });
  }

  // Get user's badges
  async getUserBadges(userId, options = {}) {
    try {
      const query = { userId, isActive: true };
      if (options.displayed) query.isDisplayed = true;

      const userBadges = await UserBadge.find(query)
        .populate('badge')
        .sort({ earnedAt: -1 });

      return userBadges;
    } catch (error) {
      console.error('Error getting user badges:', error);
      return [];
    }
  }

  // Get badge statistics
  async getBadgeStats() {
    try {
      const totalBadges = await Badge.countDocuments({ isActive: true });
      const totalAwarded = await UserBadge.countDocuments({ isActive: true });
      
      const rarityStats = await UserBadge.aggregate([
        { $lookup: { from: 'badges', localField: 'badgeId', foreignField: 'id', as: 'badge' } },
        { $unwind: '$badge' },
        { $group: { _id: '$badge.rarity', count: { $sum: 1 } } }
      ]);

      const categoryStats = await UserBadge.aggregate([
        { $lookup: { from: 'badges', localField: 'badgeId', foreignField: 'id', as: 'badge' } },
        { $unwind: '$badge' },
        { $group: { _id: '$badge.category', count: { $sum: 1 } } }
      ]);

      return {
        totalBadges,
        totalAwarded,
        rarityStats,
        categoryStats
      };
    } catch (error) {
      console.error('Error getting badge stats:', error);
      return null;
    }
  }

  // Update badge display settings
  async updateBadgeDisplay(userId, badgeId, isDisplayed) {
    try {
      await UserBadge.findOneAndUpdate(
        { userId, badgeId },
        { isDisplayed },
        { new: true }
      );
      return { success: true };
    } catch (error) {
      console.error('Error updating badge display:', error);
      return { success: false };
    }
  }

  // Get leaderboard for specific badge
  async getBadgeLeaderboard(badgeId, limit = 10) {
    try {
      const leaderboard = await UserBadge.find({ badgeId, isActive: true })
        .populate('userId', 'username profile.profilePicture')
        .sort({ earnedAt: 1 })
        .limit(limit);

      return leaderboard;
    } catch (error) {
      console.error('Error getting badge leaderboard:', error);
      return [];
    }
  }
}

export default new BadgeService();