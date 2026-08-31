import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import auth from '../middleware/auth.js';
import moderatorAuth from '../middleware/moderatorAuth.js';
import {
  badgesRepo,
  userBadgesRepo,
  usersRepo,
  withRepositoryTransaction
} from '../repositories/index.js';

const router = express.Router();

const BADGE_ICON_BY_ID = {
  badge_daily: '\u{1F4C5}',
  badge_commentator: '\u{1F4AC}',
  badge_reactive: '\u{1F44D}',
  badge_manager: '\u{1F3AC}',
  badge_gambler: '\u{1F3B0}',
  badge_fighter: '\u{1F3C6}',
  first_win: '\u{1F3C6}',
  win_streak_5: '\u{1F525}',
  fights_won_10: '\u2694\uFE0F',
  champion_regular: '\u{1F947}',
  first_post: '\u{1F4DD}',
  social_butterfly: '\u{1F98B}',
  first_bet: '\u{1F3B2}',
  early_adopter: '\u{1F680}',
  moderator: '\u{1F6E1}\uFE0F'
};

const withBadgeIcon = (badge) => {
  if (!badge) return badge;
  const id = badge.id || badge._id;
  const icon = id ? BADGE_ICON_BY_ID[id] : null;
  return icon ? { ...badge, icon } : badge;
};

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
  ...withBadgeIcon(badge),
  _id: badge._id || badge.id,
  id: badge.id || badge._id,
  isActive: badge.isActive !== false
});

const ensureBadges = async () => {
  const now = new Date().toISOString();
  await withRepositoryTransaction(async (context) => {
    for (const badge of DEFAULT_BADGES) {
      await badgesRepo.insertIfAbsent({ id: badge.id }, {
        ...badge,
        _id: badge.id,
        isActive: true,
        createdAt: now
      }, context);
    }
  });
  return badgesRepo.getAll();
};

const updateStoredRecord = (repo, record, updater, context) => {
  const id = record?.id ?? record?._id;
  if (id === undefined || id === null) return Promise.resolve(undefined);
  return repo.updateById(id, updater, record?.id !== undefined ? 'id' : '_id', context);
};

const hydrateUserBadges = async (entries) => {
  const badgeIds = [...new Set(entries.map((entry) => entry.badgeId).filter(Boolean))];
  const badges = badgeIds.length
    ? await badgesRepo.findManyBy({ id: { $in: badgeIds } })
    : [];
  const badgeMap = new Map(badges.map((badge) => [badge.id, badge]));
  return entries.map((entry) => buildUserBadgeEntry(entry, badgeMap.get(entry.badgeId)));
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
    const badges = (await ensureBadges()).map(normalizeBadge);
    res.json({ badges });
  } catch (error) {
    console.error('Error fetching badges:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/badges/available
router.get('/available', async (req, res) => {
  try {
    await ensureBadges();
    const { category, rarity } = req.query;
    const query = { isActive: { $ne: false } };
    if (category) query.category = category;
    if (rarity) query.rarity = rarity;
    const badges = (await badgesRepo.findManyBy(query)).map(normalizeBadge);

    res.json(badges);
  } catch (error) {
    console.error('Error fetching available badges:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/badges/user (current user)
router.get('/user', auth, async (req, res) => {
  try {
    await ensureBadges();
    const badges = await userBadgesRepo.findManyBy({
      userId: req.user.id,
      isActive: { $ne: false }
    });
    const userBadges = await hydrateUserBadges(badges);

    res.json({ badges: userBadges });
  } catch (error) {
    console.error('Error fetching user badges:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/badges/user/:userId
router.get('/user/:userId', async (req, res) => {
  try {
    await ensureBadges();
    const badges = await userBadgesRepo.findManyBy({
      userId: req.params.userId,
      isActive: { $ne: false }
    });
    const userBadges = await hydrateUserBadges(badges);

    res.json(userBadges);
  } catch (error) {
    console.error('Error fetching user badges:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/badges/leveled/:userId - Get leveled badges with progress for a user
router.get('/leveled/:userId', async (req, res) => {
  try {
    const user = await usersRepo.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const leveledBadges = LEVELED_BADGES.map((badge) =>
      calculateLeveledBadgeProgress(user, withBadgeIcon(badge))
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
    res.json({ badges: LEVELED_BADGES.map(withBadgeIcon) });
  } catch (error) {
    console.error('Error fetching leveled badge definitions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/badges/my-badges (alias)
router.get('/my-badges', auth, async (req, res) => {
  try {
    await ensureBadges();
    const badges = await userBadgesRepo.findManyBy({
      userId: req.user.id,
      isActive: { $ne: false }
    });
    const userBadges = await hydrateUserBadges(badges);

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
    await withRepositoryTransaction(async (context) => {
      const entry = await userBadgesRepo.findOneBy({
        userId: req.user.id,
        badgeId: req.params.badgeId
      }, {}, context);
      if (entry) {
        await updateStoredRecord(userBadgesRepo, entry, (draft) => ({
          ...draft,
          isDisplayed: Boolean(isDisplayed)
        }), context);
      }
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
    await ensureBadges();
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const entries = await userBadgesRepo.findManyBy({
      badgeId: req.params.badgeId,
      isActive: { $ne: false }
    }, { sort: { earnedAt: 1 }, limit });
    const userIds = [...new Set(entries.map((entry) => entry.userId).filter(Boolean))];
    const users = userIds.length
      ? await usersRepo.findManyBy({ id: { $in: userIds } })
      : [];
    const userMap = new Map(users.map((user) => [user.id, user]));

    const leaderboard = entries.map((entry) => {
      const user = userMap.get(entry.userId);
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
    await ensureBadges();
    const activeQuery = { isActive: { $ne: false } };
    const [totalBadges, totalAwarded, countsByBadge, badges] = await Promise.all([
      badgesRepo.countBy(activeQuery),
      userBadgesRepo.countBy(activeQuery),
      userBadgesRepo.groupCountBy('badgeId', activeQuery),
      badgesRepo.findManyBy(activeQuery)
    ]);
    const rarityStats = {};
    const categoryStats = {};
    badges.forEach((badge) => {
      const count = Number(countsByBadge[badge.id] || 0);
      if (!count) return;
      rarityStats[badge.rarity] = (rarityStats[badge.rarity] || 0) + count;
      categoryStats[badge.category] = (categoryStats[badge.category] || 0) + count;
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

    await withRepositoryTransaction(async (context) => {
      created = {
        id: uuidv4(),
        userId,
        badgeId,
        metadata: metadata || {},
        earnedAt: new Date().toISOString(),
        isDisplayed: false,
        isActive: true
      };
      const result = await userBadgesRepo.insertIfAbsent(
        { userId, badgeId },
        created,
        context
      );
      if (!result.inserted) {
        const error = new Error('User already has this badge');
        error.code = 'ALREADY_HAS';
        throw error;
      }
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
    await withRepositoryTransaction(async (context) => {
      created = {
        ...badgeData,
        _id: badgeData.id,
        isActive: true,
        createdAt: new Date().toISOString()
      };
      const result = await badgesRepo.insertIfAbsent(
        { id: badgeData.id },
        created,
        context
      );
      if (!result.inserted) {
        const error = new Error('Badge ID already exists');
        error.code = 'DUPLICATE';
        throw error;
      }
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
    await withRepositoryTransaction(async (context) => {
      const badge = await badgesRepo.findById(req.params.badgeId, context);
      if (!badge) {
        const error = new Error('Badge not found');
        error.code = 'NOT_FOUND';
        throw error;
      }
      updated = await badgesRepo.updateById(
        badge.id,
        (draft) => ({ ...draft, ...req.body, id: badge.id }),
        context
      );
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
    await withRepositoryTransaction(async (context) => {
      const badge = await badgesRepo.findById(req.params.badgeId, context);
      if (!badge) {
        const error = new Error('Badge not found');
        error.code = 'NOT_FOUND';
        throw error;
      }
      await badgesRepo.updateById(
        badge.id,
        (draft) => ({ ...draft, isActive: false }),
        context
      );
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
    res.json((await ensureBadges()).map(normalizeBadge));
  } catch (error) {
    console.error('Error fetching all badges:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Moderator: user badge history
router.get('/manage/user/:userId/history', moderatorAuth, async (req, res) => {
  try {
    await ensureBadges();
    const entries = await userBadgesRepo.findManyBy({ userId: req.params.userId });
    const history = await hydrateUserBadges(entries);
    res.json(history);
  } catch (error) {
    console.error('Error fetching user badge history:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Moderator: revoke badge
router.delete('/revoke/:userId/:badgeId', moderatorAuth, async (req, res) => {
  try {
    await withRepositoryTransaction(async (context) => {
      const entry = await userBadgesRepo.findOneBy({
        userId: req.params.userId,
        badgeId: req.params.badgeId
      }, {}, context);
      if (!entry) {
        const error = new Error('User badge not found');
        error.code = 'NOT_FOUND';
        throw error;
      }
      await updateStoredRecord(
        userBadgesRepo,
        entry,
        (draft) => ({ ...draft, isActive: false }),
        context
      );
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
    const sortedBadges = await userBadgesRepo.findManyBy({
      userId,
      type: 'tournament_winner',
      displayOnProfile: true
    }, { sort: { wonAt: -1 }, limit: 100 });
    
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

