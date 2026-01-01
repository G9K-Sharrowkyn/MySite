import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import auth from '../middleware/auth.js';
import moderatorAuth from '../middleware/moderatorAuth.js';
import { readDb, updateDb } from '../services/jsonDb.js';

const router = express.Router();

// Leveled badges - odznaki z poziomami (1-20)
const LEVELED_BADGES = [
  {
    id: 'badge_daily',
    name: 'Daily',
    description: 'Loguj się regularnie',
    icon: '📅',
    category: 'activity',
    isLeveled: true,
    maxLevel: 20,
    requirement: { type: 'loginDays', perLevel: 30 }
  },
  {
    id: 'badge_commentator',
    name: 'Commentator',
    description: 'Pisz komentarze',
    icon: '💬',
    category: 'social',
    isLeveled: true,
    maxLevel: 20,
    requirement: { type: 'comments', perLevel: 100 }
  },
  {
    id: 'badge_reactive',
    name: 'Reactive',
    description: 'Dawaj reakcje',
    icon: '👍',
    category: 'social',
    isLeveled: true,
    maxLevel: 20,
    requirement: { type: 'reactions', perLevel: 100 }
  },
  {
    id: 'badge_manager',
    name: 'Manager',
    description: 'Twórz walki',
    icon: '🎬',
    category: 'fighting',
    isLeveled: true,
    maxLevel: 20,
    requirement: { type: 'fightsCreated', perLevel: 20 }
  },
  {
    id: 'badge_gambler',
    name: 'Gambler',
    description: 'Wygrywaj zakłady',
    icon: '🎰',
    category: 'betting',
    isLeveled: true,
    maxLevel: 20,
    requirement: { type: 'bettingWins', perLevel: 20 }
  },
  {
    id: 'badge_fighter',
    name: 'Fighter',
    description: 'Wygrywaj walki oficjalne w dywizjach',
    icon: '🏆',
    category: 'fighting',
    isLeveled: true,
    maxLevel: 20,
    requirement: { type: 'officialWins', perLevel: 10 }
  }
];

const DEFAULT_BADGES = [
  {
    id: 'first_win',
    name: 'First Victory',
    description: 'Win your first fight',
    icon: '🏆',
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
    id: 'fights_won_10',
    name: 'Veteran Fighter',
    description: 'Win 10 total fights',
    icon: '⚔️',
    category: 'fighting',
    rarity: 'common',
    color: '#17a2b8',
    requirements: { fightsWon: 10 }
  },
  {
    id: 'champion_regular',
    name: 'Regular Division Champion',
    description: 'Become champion of the Regular Division',
    icon: '🥇',
    category: 'championship',
    rarity: 'rare',
    color: '#6c757d',
    requirements: { divisionChampion: 'regular' },
    divisionId: 'regular'
  },
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

const normalizeBadge = (badge) => ({
  ...badge,
  _id: badge._id || badge.id,
  id: badge.id || badge._id,
  isActive: badge.isActive !== false
});

const ensureBadges = async () => {
  const db = await readDb();
  if ((db.badges || []).length > 0) {
    return db;
  }

  await updateDb((data) => {
    data.badges = DEFAULT_BADGES.map((badge) => ({
      ...badge,
      _id: badge.id,
      isActive: true,
      createdAt: new Date().toISOString()
    }));
    return data;
  });

  return readDb();
};

const buildUserBadgeEntry = (entry, badge) => ({
  ...entry,
  badgeId: entry.badgeId,
  earnedAt: entry.earnedAt || entry.createdAt,
  isDisplayed: entry.isDisplayed || false,
  isActive: entry.isActive !== false,
  badge: badge ? normalizeBadge(badge) : null
});

// Calculate leveled badge progress for a user
const calculateLeveledBadgeProgress = (user, badge) => {
  const req = badge.requirement;
  let currentValue = 0;

  const stats = user.stats || {};
  const activity = user.activity || {};

  switch (req.type) {
    case 'loginDays':
      currentValue = activity.loginDays || 0;
      break;
    case 'comments':
      currentValue = activity.commentsPosted || 0;
      break;
    case 'reactions':
      currentValue = activity.reactionsGiven || 0;
      break;
    case 'fightsCreated':
      currentValue = activity.fightsCreated || activity.postsCreated || 0;
      break;
    case 'bettingWins':
      currentValue = stats.bettingWins || 0;
      break;
    case 'officialWins':
      currentValue = stats.officialStats?.fightsWon || 0;
      break;
    default:
      currentValue = 0;
  }

  const level = Math.min(Math.floor(currentValue / req.perLevel), badge.maxLevel);
  const progressToNext = currentValue % req.perLevel;

  return {
    badgeId: badge.id,
    badge: badge,
    level: level,
    progress: progressToNext,
    maxProgress: req.perLevel,
    totalValue: currentValue,
    nextLevelAt: (level + 1) * req.perLevel
  };
};

// GET /api/badges/all
router.get('/all', async (_req, res) => {
  try {
    const db = await ensureBadges();
    const badges = (db.badges || []).map(normalizeBadge);
    res.json({ badges });
  } catch (error) {
    console.error('Error fetching badges:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/badges/available
router.get('/available', async (req, res) => {
  try {
    const db = await ensureBadges();
    const { category, rarity } = req.query;
    const badges = (db.badges || [])
      .filter((badge) => badge.isActive !== false)
      .filter((badge) => (category ? badge.category === category : true))
      .filter((badge) => (rarity ? badge.rarity === rarity : true))
      .map(normalizeBadge);

    res.json(badges);
  } catch (error) {
    console.error('Error fetching available badges:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/badges/user (current user)
router.get('/user', auth, async (req, res) => {
  try {
    const db = await ensureBadges();
    const badges = (db.userBadges || []).filter(
      (entry) => entry.userId === req.user.id && entry.isActive !== false
    );
    const badgeMap = new Map((db.badges || []).map((badge) => [badge.id, badge]));
    const userBadges = badges.map((entry) =>
      buildUserBadgeEntry(entry, badgeMap.get(entry.badgeId))
    );

    res.json({ badges: userBadges });
  } catch (error) {
    console.error('Error fetching user badges:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/badges/user/:userId
router.get('/user/:userId', async (req, res) => {
  try {
    const db = await ensureBadges();
    const badges = (db.userBadges || []).filter(
      (entry) => entry.userId === req.params.userId && entry.isActive !== false
    );
    const badgeMap = new Map((db.badges || []).map((badge) => [badge.id, badge]));
    const userBadges = badges.map((entry) =>
      buildUserBadgeEntry(entry, badgeMap.get(entry.badgeId))
    );

    res.json(userBadges);
  } catch (error) {
    console.error('Error fetching user badges:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/badges/leveled/:userId - Get leveled badges with progress for a user
router.get('/leveled/:userId', async (req, res) => {
  try {
    const db = await readDb();
    const user = db.users.find((u) => u.id === req.params.userId || u._id === req.params.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const leveledBadges = LEVELED_BADGES.map((badge) =>
      calculateLeveledBadgeProgress(user, badge)
    );

    res.json({ badges: leveledBadges });
  } catch (error) {
    console.error('Error fetching leveled badges:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/badges/leveled-all - Get all leveled badge definitions
router.get('/leveled-all', async (_req, res) => {
  try {
    res.json({ badges: LEVELED_BADGES });
  } catch (error) {
    console.error('Error fetching leveled badge definitions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/badges/my-badges (alias)
router.get('/my-badges', auth, async (req, res) => {
  try {
    const db = await ensureBadges();
    const badges = (db.userBadges || []).filter(
      (entry) => entry.userId === req.user.id && entry.isActive !== false
    );
    const badgeMap = new Map((db.badges || []).map((badge) => [badge.id, badge]));
    const userBadges = badges.map((entry) =>
      buildUserBadgeEntry(entry, badgeMap.get(entry.badgeId))
    );

    res.json(userBadges);
  } catch (error) {
    console.error('Error fetching user badges:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/badges/display/:badgeId
router.put('/display/:badgeId', auth, async (req, res) => {
  try {
    const { isDisplayed } = req.body;
    await updateDb((db) => {
      db.userBadges = Array.isArray(db.userBadges) ? db.userBadges : [];
      const entry = db.userBadges.find(
        (badge) => badge.userId === req.user.id && badge.badgeId === req.params.badgeId
      );
      if (entry) {
        entry.isDisplayed = Boolean(isDisplayed);
      }
      return db;
    });

    res.json({ message: 'Badge display updated successfully' });
  } catch (error) {
    console.error('Error updating badge display:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/badges/leaderboard/:badgeId
router.get('/leaderboard/:badgeId', async (req, res) => {
  try {
    const db = await ensureBadges();
    const limit = Number(req.query.limit || 10);
    const entries = (db.userBadges || [])
      .filter((entry) => entry.badgeId === req.params.badgeId && entry.isActive !== false)
      .sort((a, b) => new Date(a.earnedAt || 0) - new Date(b.earnedAt || 0))
      .slice(0, limit);

    const leaderboard = entries.map((entry) => {
      const user = (db.users || []).find((u) => u.id === entry.userId);
      return {
        ...entry,
        user: user
          ? {
              id: user.id,
              username: user.username,
              profilePicture: user.profile?.profilePicture || user.profile?.avatar || ''
            }
          : null
      };
    });

    res.json(leaderboard);
  } catch (error) {
    console.error('Error fetching badge leaderboard:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/badges/stats
router.get('/stats', async (_req, res) => {
  try {
    const db = await ensureBadges();
    const totalBadges = (db.badges || []).filter((badge) => badge.isActive !== false).length;
    const totalAwarded = (db.userBadges || []).filter((entry) => entry.isActive !== false).length;

    const rarityStats = {};
    const categoryStats = {};
    (db.userBadges || [])
      .filter((entry) => entry.isActive !== false)
      .forEach((entry) => {
        const badge = (db.badges || []).find((b) => b.id === entry.badgeId);
        if (!badge) return;
        rarityStats[badge.rarity] = (rarityStats[badge.rarity] || 0) + 1;
        categoryStats[badge.category] = (categoryStats[badge.category] || 0) + 1;
      });

    res.json({ totalBadges, totalAwarded, rarityStats, categoryStats });
  } catch (error) {
    console.error('Error fetching badge stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/badges/check-awards
router.post('/check-awards', auth, async (_req, res) => {
  res.json({ message: 'Badge check completed' });
});

// Moderator: award badge
router.post('/award', moderatorAuth, async (req, res) => {
  try {
    const { userId, badgeId, metadata } = req.body;
    if (!userId || !badgeId) {
      return res.status(400).json({ message: 'User ID and Badge ID are required' });
    }

    let created;

    await updateDb((db) => {
      db.userBadges = Array.isArray(db.userBadges) ? db.userBadges : [];
      const existing = db.userBadges.find(
        (entry) => entry.userId === userId && entry.badgeId === badgeId
      );
      if (existing) {
        const error = new Error('User already has this badge');
        error.code = 'ALREADY_HAS';
        throw error;
      }

      created = {
        id: uuidv4(),
        userId,
        badgeId,
        metadata: metadata || {},
        earnedAt: new Date().toISOString(),
        isDisplayed: false,
        isActive: true
      };
      db.userBadges.push(created);
      return db;
    });

    res.json({ message: 'Badge awarded successfully', badge: created });
  } catch (error) {
    if (error.code === 'ALREADY_HAS') {
      return res.status(400).json({ message: error.message });
    }
    console.error('Error awarding badge:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Moderator: create badge
router.post('/create', moderatorAuth, async (req, res) => {
  try {
    const badgeData = req.body;
    if (!badgeData.id || !badgeData.name) {
      return res.status(400).json({ message: 'Badge id and name are required' });
    }

    let created;
    await updateDb((db) => {
      db.badges = Array.isArray(db.badges) ? db.badges : [];
      const exists = db.badges.some((badge) => badge.id === badgeData.id);
      if (exists) {
        const error = new Error('Badge ID already exists');
        error.code = 'DUPLICATE';
        throw error;
      }
      created = {
        ...badgeData,
        _id: badgeData.id,
        isActive: true,
        createdAt: new Date().toISOString()
      };
      db.badges.push(created);
      return db;
    });

    res.status(201).json({ message: 'Badge created successfully', badge: created });
  } catch (error) {
    if (error.code === 'DUPLICATE') {
      return res.status(400).json({ message: error.message });
    }
    console.error('Error creating badge:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Moderator: update badge
router.put('/:badgeId', moderatorAuth, async (req, res) => {
  try {
    let updated;
    await updateDb((db) => {
      const badge = (db.badges || []).find((entry) => entry.id === req.params.badgeId);
      if (!badge) {
        const error = new Error('Badge not found');
        error.code = 'NOT_FOUND';
        throw error;
      }
      Object.assign(badge, req.body);
      updated = badge;
      return db;
    });

    res.json({ message: 'Badge updated successfully', badge: updated });
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ message: 'Badge not found' });
    }
    console.error('Error updating badge:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Moderator: delete badge (soft delete)
router.delete('/:badgeId', moderatorAuth, async (req, res) => {
  try {
    await updateDb((db) => {
      const badge = (db.badges || []).find((entry) => entry.id === req.params.badgeId);
      if (!badge) {
        const error = new Error('Badge not found');
        error.code = 'NOT_FOUND';
        throw error;
      }
      badge.isActive = false;
      return db;
    });

    res.json({ message: 'Badge deleted successfully' });
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ message: 'Badge not found' });
    }
    console.error('Error deleting badge:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Moderator: list all badges
router.get('/manage/all', moderatorAuth, async (_req, res) => {
  try {
    const db = await ensureBadges();
    res.json((db.badges || []).map(normalizeBadge));
  } catch (error) {
    console.error('Error fetching all badges:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Moderator: user badge history
router.get('/manage/user/:userId/history', moderatorAuth, async (req, res) => {
  try {
    const db = await ensureBadges();
    const entries = (db.userBadges || []).filter(
      (entry) => entry.userId === req.params.userId
    );
    const badgeMap = new Map((db.badges || []).map((badge) => [badge.id, badge]));
    const history = entries.map((entry) =>
      buildUserBadgeEntry(entry, badgeMap.get(entry.badgeId))
    );
    res.json(history);
  } catch (error) {
    console.error('Error fetching user badge history:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Moderator: revoke badge
router.delete('/revoke/:userId/:badgeId', moderatorAuth, async (req, res) => {
  try {
    await updateDb((db) => {
      const entry = (db.userBadges || []).find(
        (badge) =>
          badge.userId === req.params.userId && badge.badgeId === req.params.badgeId
      );
      if (!entry) {
        const error = new Error('User badge not found');
        error.code = 'NOT_FOUND';
        throw error;
      }
      entry.isActive = false;
      return db;
    });

    res.json({ message: 'Badge revoked successfully' });
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ message: 'User badge not found' });
    }
    console.error('Error revoking badge:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/badges/tournament/:userId
// @desc    Get tournament winner badges for a user
// @access  Public
router.get('/tournament/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const db = await readDb();
    
    const userBadges = (db.userBadges || []).filter(
      badge => badge.userId === userId && badge.type === 'tournament_winner' && badge.displayOnProfile
    );
    
    // Sort by date won (newest first)
    const sortedBadges = userBadges.sort((a, b) => 
      new Date(b.wonAt) - new Date(a.wonAt)
    );
    
    res.json({
      success: true,
      badges: sortedBadges
    });
  } catch (error) {
    console.error('Error fetching tournament badges:', error);
    res.status(500).json({
      success: false,
      msg: 'Server error while fetching tournament badges'
    });
  }
});

export default router;
