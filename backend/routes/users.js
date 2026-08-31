import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  betsRepo,
  challengeProgressRepo,
  charactersRepo,
  coinTransactionsRepo,
  commentsRepo,
  divisionFightsRepo,
  fightsRepo,
  storePurchasesRepo,
  usersRepo,
  withRepositoryTransaction
} from '../repositories/index.js';
import { getUserDisplayName } from '../utils/userDisplayName.js';
import auth from '../middleware/auth.js';
import {
  commentValidation,
  profileUpdateValidation
} from '../middleware/validation.js';

const router = express.Router();

const resolveUserId = (user) => user?.id || user?._id;

const requireSelf = (req, res, next) => {
  if (req.params.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }
  return next();
};

const ensureCoinAccount = (user) => {
  if (!user) return;
  user.coins = user.coins || {
    balance: 0,
    totalEarned: 0,
    totalSpent: 0,
    lastBonusDate: new Date().toISOString()
  };
  if (!user.coins.dailyActivity || typeof user.coins.dailyActivity !== 'object') {
    user.coins.dailyActivity = {};
  }
  if (typeof user.virtualCoins !== 'number') {
    user.virtualCoins = user.coins.balance || 0;
  }
};

const applyCoinTransaction = (user, amount) => {
  ensureCoinAccount(user);
  user.coins.balance = (user.coins.balance || 0) + amount;
  user.virtualCoins = user.coins.balance;

  if (amount > 0) {
    user.coins.totalEarned = (user.coins.totalEarned || 0) + amount;
  } else if (amount < 0) {
    user.coins.totalSpent = (user.coins.totalSpent || 0) + Math.abs(amount);
  }

};

const DAILY_TASK_TEMPLATES = [
  {
    id: 'daily_vote',
    name: 'Vote in fights',
    description: 'Cast 3 votes today',
    target: 3,
    reward: 50,
    icon: '*'
  },
  {
    id: 'daily_comment',
    name: 'Comment on fights',
    description: 'Post 2 comments today',
    target: 2,
    reward: 30,
    icon: '#'
  },
  {
    id: 'daily_post',
    name: 'Create a post',
    description: 'Publish 1 post today',
    target: 1,
    reward: 40,
    icon: '+'
  }
];

const getTodayKey = () => new Date().toISOString().slice(0, 10);

const ensureDailyProgress = async (context, userId) => {
  let entry = await challengeProgressRepo.findOneBy({ userId }, {}, context);
  const todayKey = getTodayKey();

  if (!entry) {
    entry = {
      id: uuidv4(),
      userId,
      date: todayKey,
      streak: 0,
      tasks: DAILY_TASK_TEMPLATES.map((task) => ({
        ...task,
        progress: 0,
        completed: false,
        claimed: false
      }))
    };
    await challengeProgressRepo.insert(entry, context);
    return entry;
  }

  if (entry.date !== todayKey) {
    const allCompleted = Array.isArray(entry.tasks)
      ? entry.tasks.every((task) => task.completed)
      : false;
    entry.streak = allCompleted ? (entry.streak || 0) + 1 : 0;
    entry.date = todayKey;
    entry.tasks = DAILY_TASK_TEMPLATES.map((task) => ({
      ...task,
      progress: 0,
      completed: false,
      claimed: false
    }));
    entry = await challengeProgressRepo.updateById(entry.id, () => entry, context);
  }

  return entry;
};

const buildDivisionName = (divisionId) => {
  const names = {
    regular: 'Regular',
    metahuman: 'Metahuman',
    planetBusters: 'Planet Busters',
    godTier: 'God Tier',
    universalThreat: 'Universal Threat',
    omnipotent: 'Omnipotent'
  };
  return names[divisionId] || divisionId;
};

const buildDivisionIcon = (divisionId) => {
  const icons = {
    regular: '*',
    metahuman: '#',
    planetBusters: '^',
    godTier: '~',
    universalThreat: '!',
    omnipotent: '$'
  };
  return icons[divisionId] || '*';
};

const buildTeamFighters = (team) => {
  if (!team) return [];
  const fighters = [];

  const addFighter = (character) => {
    if (!character) return;
    fighters.push({
      id: character.id || character.characterId || character._id,
      name: character.name || character.characterName || '',
      image: character.image || character.characterImage || ''
    });
  };

  if (Array.isArray(team.fighters)) {
    team.fighters.forEach(addFighter);
  } else {
    addFighter(team.mainCharacter);
    addFighter(team.secondaryCharacter);
  }

  return fighters;
};

// GET /api/users/search
router.get('/search', auth, async (req, res) => {
  try {
    const q = (req.query.q || '').toLowerCase();
    if (!q) {
      return res.json([]);
    }

    const escaped = String(q).slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matchingUsers = await usersRepo.findManyBy(
      { username: { $regex: escaped, $options: 'i' } },
      { sort: { username: 1 }, limit: 20 }
    );
    const results = matchingUsers.map((user) => ({
        id: resolveUserId(user),
        username: user.username,
        displayName: getUserDisplayName(user),
        avatar: user.profile?.profilePicture || user.profile?.avatar || '',
        isModerator: user.role === 'moderator'
      }));

    res.json(results);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/users/claim-daily-task
router.post('/claim-daily-task', auth, async (req, res) => {
  try {
    const { taskId } = req.body;
    const userId = req.user.id;
    if (!taskId) {
      return res.status(400).json({ message: 'Missing task data' });
    }

    let updatedTask;
    let newBalance = 0;

    await withRepositoryTransaction(async (context) => {
      const user = await usersRepo.findById(userId, context);
      if (!user) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      const progress = await ensureDailyProgress(context, userId);
      const task = progress.tasks.find((item) => item.id === taskId);
      if (!task) {
        const error = new Error('Task not found');
        error.code = 'TASK_NOT_FOUND';
        throw error;
      }

      if (!task.completed) {
        task.completed = true;
        task.progress = task.target;
      }

      const shouldReward = !task.claimed;
      if (shouldReward) {
        task.claimed = true;
      }
      await challengeProgressRepo.updateById(progress.id, () => progress, context);
      let updatedUser = user;
      if (shouldReward) {
        updatedUser = await usersRepo.updateById(userId, (storedUser) => {
          applyCoinTransaction(storedUser, task.reward);
          return storedUser;
        }, context);
        await coinTransactionsRepo.insert({
          id: uuidv4(),
          userId,
          amount: task.reward,
          type: 'earned',
          description: 'Daily task reward',
          balance: updatedUser.coins.balance,
          createdAt: new Date().toISOString()
        }, context);
      }
      updatedTask = task;
      newBalance = updatedUser.coins?.balance || 0;
    });

    res.json({ task: updatedTask, balance: newBalance });
  } catch (error) {
    if (error.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: 'User not found' });
    }
    if (error.code === 'TASK_NOT_FOUND') {
      return res.status(404).json({ message: 'Task not found' });
    }
    console.error('Error claiming daily task:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/users/:userId/coins
router.get('/:userId/coins', auth, requireSelf, async (req, res) => {
  try {
    const user = await usersRepo.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ coins: user.coins?.balance || 0 });
  } catch (error) {
    if (error.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: 'User not found' });
    }
    console.error('Error fetching user coins:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/users/:userId/coin-history
router.get('/:userId/coin-history', auth, requireSelf, async (req, res) => {
  try {
    const history = await coinTransactionsRepo.findManyBy(
      { userId: req.params.userId },
      { sort: { createdAt: -1 }, limit: 200 }
    );
    res.json(history);
  } catch (error) {
    console.error('Error fetching coin history:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/users/:userId/inventory
router.get('/:userId/inventory', auth, requireSelf, async (req, res) => {
  try {
    const inventory = await storePurchasesRepo.findManyBy(
      { userId: req.params.userId },
      { sort: { purchasedAt: -1 }, limit: 200 }
    );
    res.json(inventory);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/users/:userId/daily-tasks
router.get('/:userId/daily-tasks', auth, requireSelf, async (req, res) => {
  try {
    const tasks = await withRepositoryTransaction(async (context) => {
      const progress = await ensureDailyProgress(context, req.params.userId);
      return progress.tasks || [];
    });
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching daily tasks:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/users/:userId/achievements
router.get('/:userId/achievements', async (req, res) => {
  try {
    const user = await usersRepo.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user.achievements || []);
  } catch (error) {
    console.error('Error fetching achievements:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/users/:userId/betting-history
router.get('/:userId/betting-history', auth, requireSelf, async (req, res) => {
  try {
    const bets = await betsRepo.findManyBy(
      { userId: req.params.userId },
      { sort: { createdAt: -1 }, limit: 200 }
    );
    const fightIds = [...new Set(bets.map((bet) => bet.fightId).filter(Boolean))];
    const fightsById = new Map((fightIds.length
      ? await fightsRepo.findManyBy({ id: { $in: fightIds } }, { limit: fightIds.length })
      : []).map((fight) => [fight.id, fight]));

    const history = bets.map((bet) => {
      const fight = fightsById.get(bet.fightId);
      const teamAName = fight?.fighter1 || fight?.teamA?.[0]?.characterName || 'Team A';
      const teamBName = fight?.fighter2 || fight?.teamB?.[0]?.characterName || 'Team B';
      return {
        ...bet,
        result: bet.status === 'pending' ? 'pending' : bet.status,
        winnings: bet.actualWinnings || 0,
        fight: {
          team1: { name: teamAName },
          team2: { name: teamBName }
        }
      };
    });

    res.json(history);
  } catch (error) {
    console.error('Error fetching betting history:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/users/:userId/current-bets
router.get('/:userId/current-bets', auth, requireSelf, async (req, res) => {
  try {
    const bets = await betsRepo.findManyBy(
      { userId: req.params.userId, status: 'pending' },
      { sort: { createdAt: -1 }, limit: 100 }
    );
    const fightIds = [...new Set(bets.map((bet) => bet.fightId).filter(Boolean))];
    const fightsById = new Map((fightIds.length
      ? await fightsRepo.findManyBy({ id: { $in: fightIds } }, { limit: fightIds.length })
      : []).map((fight) => [fight.id, fight]));

    const active = bets.map((bet) => {
      const fight = fightsById.get(bet.fightId);
      const teamAName = fight?.fighter1 || fight?.teamA?.[0]?.characterName || 'Team A';
      const teamBName = fight?.fighter2 || fight?.teamB?.[0]?.characterName || 'Team B';
      return {
        ...bet,
        fight: {
          team1: { name: teamAName },
          team2: { name: teamBName }
        }
      };
    });

    res.json(active);
  } catch (error) {
    console.error('Error fetching current bets:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/users/:userId/profile
router.get('/:userId/profile', async (req, res) => {
  try {
    const user = await usersRepo.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const profile = user.profile || {};
    const divisions = user.divisions || {};
    const isChampion = Object.values(divisions).some((division) => division?.isChampion);
    const totalFights = user.stats?.totalFights || 0;

    res.json({
      id: resolveUserId(user),
      username: user.username,
      displayName: getUserDisplayName(user),
      avatar: profile.profilePicture || profile.avatar || '',
      bio: profile.bio || profile.description || '',
      location: profile.location || '',
      favoriteUniverse: profile.favoriteUniverse || '',
      website: profile.website || '',
      interests: profile.interests || [],
      createdAt: user.createdAt || profile.joinDate || new Date().toISOString(),
      isModerator: user.role === 'moderator',
      isVerified: Boolean(user.isVerified),
      isChampion,
      totalFights
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/users/:userId/profile
router.put(
  '/:userId/profile',
  auth,
  requireSelf,
  profileUpdateValidation,
  async (req, res) => {
    try {
      const allowedProfileFields = new Set([
        'displayName',
        'bio',
        'description',
        'location',
        'favoriteUniverse',
        'website',
        'birthDate',
        'interests',
        'profilePicture',
        'avatar',
        'backgroundImage'
      ]);
      let updatedProfile;
      const user = await usersRepo.updateById(req.params.userId, (user) => {
        if (!user) {
          const error = new Error('User not found');
          error.code = 'USER_NOT_FOUND';
          throw error;
        }

        user.profile = user.profile || {};
        Object.entries(req.body || {}).forEach(([key, value]) => {
          if (allowedProfileFields.has(key) && value !== undefined) {
            user.profile[key] = value;
          }
        });
        user.updatedAt = new Date().toISOString();
        updatedProfile = user.profile;
        return user;
      });
      if (!user) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      res.json(updatedProfile);
    } catch (error) {
      if (error.code === 'USER_NOT_FOUND') {
        return res.status(404).json({ message: 'User not found' });
      }
      console.error('Error updating profile:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// GET /api/users/:userId/profile-comments
router.get('/:userId/profile-comments', async (req, res) => {
  try {
    const storedComments = await commentsRepo.findManyBy(
      {
        type: { $in: ['user_profile', 'profile'] },
        targetId: req.params.userId
      },
      { sort: { createdAt: -1 }, limit: 200 }
    );
    const authorIds = [...new Set(storedComments.map((comment) => comment.authorId).filter(Boolean))];
    const authors = authorIds.length
      ? await usersRepo.findManyBy({ id: { $in: authorIds } }, { limit: authorIds.length })
      : [];
    const authorsById = new Map(authors.map((user) => [resolveUserId(user), user]));
    const comments = storedComments.map((comment) => {
        const author = authorsById.get(comment.authorId);
        return {
          id: comment.id || comment._id,
          content: comment.text || comment.content || '',
          createdAt: comment.createdAt,
          likes: comment.likes || 0,
          author: {
            id: comment.authorId,
            username: comment.authorUsername || author?.username || '',
            displayName:
              comment.authorDisplayName ||
              getUserDisplayName(author) ||
              comment.authorUsername ||
              '',
            avatar: comment.authorAvatar || author?.profile?.profilePicture || author?.profile?.avatar || '',
            isModerator: author?.role === 'moderator'
          }
        };
      });
    res.json(comments);
  } catch (error) {
    console.error('Error fetching profile comments:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/users/:userId/profile-comments
router.post('/:userId/profile-comments', auth, commentValidation, async (req, res) => {
  try {
    const { content } = req.body;
    const authorId = req.user.id;
    if (!content) {
      return res.status(400).json({ message: 'Missing comment data' });
    }

    let created;
    await withRepositoryTransaction(async (context) => {
      const author = await usersRepo.findById(authorId, context);
      if (!author) {
        const error = new Error('Author not found');
        error.code = 'AUTHOR_NOT_FOUND';
        throw error;
      }
      if (!await usersRepo.findById(req.params.userId, context)) {
        const error = new Error('Profile not found');
        error.code = 'PROFILE_NOT_FOUND';
        throw error;
      }

      const now = new Date().toISOString();
      const comment = {
        id: uuidv4(),
        type: 'profile',
        targetId: req.params.userId,
        authorId,
        authorUsername: author.username,
        authorDisplayName: getUserDisplayName(author),
        authorAvatar: author.profile?.profilePicture || author.profile?.avatar || '',
        content: content.trim(),
        text: content.trim(),
        createdAt: now,
        updatedAt: now,
        likes: 0,
        likedBy: []
      };

      await commentsRepo.insert(comment, context);
      created = comment;
    });

    res.status(201).json({
      id: created.id,
      content: created.content,
      createdAt: created.createdAt,
      likes: created.likes,
      author: {
        id: created.authorId,
        username: created.authorUsername,
        displayName: created.authorDisplayName || created.authorUsername,
        avatar: created.authorAvatar,
        isModerator: false
      }
    });
  } catch (error) {
    if (error.code === 'AUTHOR_NOT_FOUND') {
      return res.status(404).json({ message: 'Author not found' });
    }
    if (error.code === 'PROFILE_NOT_FOUND') {
      return res.status(404).json({ message: 'Profile not found' });
    }
    console.error('Error creating profile comment:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/users/:userId/division-records
router.get('/:userId/division-records', async (req, res) => {
  try {
    const user = await usersRepo.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const divisions = user.divisions || {};
    const records = Object.entries(divisions).map(([divisionId, data]) => ({
      id: divisionId,
      name: buildDivisionName(divisionId),
      icon: buildDivisionIcon(divisionId),
      wins: data.wins || 0,
      losses: data.losses || 0,
      isChampion: Boolean(data.isChampion),
      titleWonDate: data.championSince || data.joinedAt || null,
      titleDefenses: data.championshipHistory?.titleDefenses || 0,
      team: {
        fighters: buildTeamFighters(data.team)
      }
    }));

    res.json(records);
  } catch (error) {
    console.error('Error fetching division records:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/users/:userId/fight-history
router.get('/:userId/fight-history', async (req, res) => {
  try {
    const fights = await divisionFightsRepo.findManyBy(
      {
        $or: [
          { 'team1.userId': req.params.userId },
          { 'team2.userId': req.params.userId }
        ]
      },
      { sort: { createdAt: -1 }, limit: 200 }
    );

    const history = fights.map((fight) => {
      const isUserTeam1 = fight.team1?.userId === req.params.userId;
      const opponentTeam = isUserTeam1 ? fight.team2 : fight.team1;
      const result = fight.status === 'ended' || fight.status === 'locked'
        ? fight.result?.winner === (isUserTeam1 ? 'A' : 'B')
          ? 'win'
          : fight.result?.winner === 'draw'
          ? 'draw'
          : 'loss'
        : 'pending';

      return {
        id: fight.id || fight._id,
        date: fight.createdAt,
        result,
        isTitle: fight.fightType === 'title',
        division: {
          id: fight.divisionId,
          name: buildDivisionName(fight.divisionId)
        },
        userVotes: fight.votes?.length || 0,
        opponentVotes: fight.votes?.length || 0,
        opponent: {
          username: opponentTeam?.username || 'Opponent',
          avatar: opponentTeam?.owner?.profilePicture || ''
        }
      };
    });

    res.json(history);
  } catch (error) {
    console.error('Error fetching fight history:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/users/:userId/profile-analysis
router.get('/:userId/profile-analysis', auth, requireSelf, async (req, res) => {
  try {
    const user = await usersRepo.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const favorites = user.profile?.favoriteCharacters || [];
    const favoriteCharacters = Array.isArray(favorites) ? favorites : [];
    const favoriteCharacterRows = favoriteCharacters.length
      ? await charactersRepo.findManyBy(
          { id: { $in: favoriteCharacters } },
          { limit: favoriteCharacters.length }
        )
      : [];
    const favoriteUniverses = favoriteCharacterRows
      .map((character) => character.universe)
      .filter(Boolean);

    res.json({
      mostUsedUniverses: favoriteUniverses.slice(0, 3),
      preferredPowerRanges: ['medium'],
      fightingPatterns: 'balanced',
      activityScore: 'moderate',
      characterTypes: [],
      winPercentage: user.stats?.winRate || 50,
      universeDiversity: 0.5,
      commentVoteRatio: 0.3,
      peakHours: [],
      recentPreferences: {}
    });
  } catch (error) {
    console.error('Error fetching profile analysis:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/users/:userId/behavior
router.get('/:userId/behavior', auth, requireSelf, async (req, res) => {
  try {
    const user = await usersRepo.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const favoriteCharacters = Array.isArray(user.profile?.favoriteCharacters)
      ? user.profile.favoriteCharacters
      : [];
    const characterUsage = {};
    favoriteCharacters.forEach((characterId) => {
      characterUsage[characterId] = (characterUsage[characterId] || 0) + 1;
    });

    const characterRows = favoriteCharacters.length
      ? await charactersRepo.findManyBy(
          { id: { $in: favoriteCharacters } },
          { limit: favoriteCharacters.length }
        )
      : [];
    const mostUsedCharacters = characterRows
      .map((character) => ({
        id: character.id,
        universe: character.universe
      }));

    res.json({
      characterUsage,
      mostUsedCharacters,
      fightResults: []
    });
  } catch (error) {
    console.error('Error fetching behavior:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/users/:userId/champion-status
router.get('/:userId/champion-status', async (req, res) => {
  try {
    const user = await usersRepo.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const divisions = user.divisions || {};
    const championDivisions = Object.entries(divisions)
      .filter(([, data]) => data?.isChampion)
      .map(([divisionId]) => divisionId);

    res.json({
      isChampion: championDivisions.length > 0,
      divisions: championDivisions
    });
  } catch (error) {
    console.error('Error fetching champion status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

