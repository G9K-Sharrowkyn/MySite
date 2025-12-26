import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import auth from '../middleware/auth.js';
import moderatorAuth from '../middleware/moderatorAuth.js';
import { readDb, updateDb } from '../services/jsonDb.js';

const router = express.Router();

const DEFAULT_DIVISIONS = [
  { id: 'regular', name: 'Regular', tier: 1 },
  { id: 'metahuman', name: 'Metahuman', tier: 2 },
  { id: 'planetBusters', name: 'Planet Busters', tier: 3 },
  { id: 'godTier', name: 'God Tier', tier: 4 },
  { id: 'universalThreat', name: 'Universal Threat', tier: 5 },
  { id: 'omnipotent', name: 'Omnipotent', tier: 6 }
];

const resolveUserId = (user) => user?.id || user?._id;

const findUserById = (db, userId) =>
  db.users.find((entry) => resolveUserId(entry) === userId);

const getDivisionInfo = (divisionId) =>
  DEFAULT_DIVISIONS.find((division) => division.id === divisionId) || {
    id: divisionId,
    name: divisionId,
    tier: null
  };

const getCharacterId = (character) =>
  character?.id || character?._id || character?.characterId;

const normalizeTeam = (team) => {
  if (!team) return null;
  const mainCharacter = team.mainCharacter || team.fighters?.[0] || null;
  const secondaryCharacter = team.secondaryCharacter || team.fighters?.[1] || null;
  const fighters = Array.isArray(team.fighters)
    ? team.fighters
    : [mainCharacter, secondaryCharacter].filter(Boolean);

  return {
    mainCharacter,
    secondaryCharacter,
    fighters
  };
};

const buildTeamName = (team) =>
  [team?.mainCharacter?.name, team?.secondaryCharacter?.name]
    .filter(Boolean)
    .join(', ');

const buildAuthor = (user) => {
  if (!user) return null;
  return {
    id: resolveUserId(user),
    username: user.username,
    profilePicture: user.profile?.profilePicture || user.profile?.avatar || '',
    rank: user.stats?.rank || 'Rookie'
  };
};

const buildTeamFromUser = (user, divisionId) => {
  if (!user) return null;
  const division = user.divisions?.[divisionId];
  const team = normalizeTeam(division?.team);
  if (!team) return null;

  return {
    userId: resolveUserId(user),
    username: user.username,
    owner: { id: resolveUserId(user), username: user.username },
    ...team
  };
};

const buildTeamFromPayload = (team) => {
  const normalized = normalizeTeam(team);
  if (!normalized) return null;

  const owner =
    team.owner ||
    (team.userId
      ? { id: team.userId, username: team.username || '' }
      : null);

  return {
    userId: team.userId || owner?.id || null,
    username: team.username || owner?.username || '',
    owner,
    ...normalized
  };
};

const buildDivisionFight = ({
  divisionId,
  fightType,
  team1,
  team2,
  description,
  createdBy,
  durationHours = 72,
  bettingPeriodHours
}) => {
  const id = uuidv4();
  const now = new Date();
  const endTime = new Date(
    now.getTime() + Number(durationHours || 72) * 60 * 60 * 1000
  ).toISOString();
  const bettingCloses = bettingPeriodHours
    ? new Date(now.getTime() + Number(bettingPeriodHours) * 60 * 60 * 1000).toISOString()
    : null;

  const division = getDivisionInfo(divisionId);
  const teamAName =
    buildTeamName(team1) ||
    (Array.isArray(team1?.fighters)
      ? team1.fighters.map((fighter) => fighter?.name).filter(Boolean).join(', ')
      : '');
  const teamBName =
    buildTeamName(team2) ||
    (Array.isArray(team2?.fighters)
      ? team2.fighters.map((fighter) => fighter?.name).filter(Boolean).join(', ')
      : '');
  const character1 = team1?.mainCharacter || team1?.fighters?.[0] || null;
  const character2 = team2?.mainCharacter || team2?.fighters?.[0] || null;

  return {
    id,
    _id: id,
    divisionId,
    division,
    fightType,
    status: 'active',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    endTime,
    bettingCloses,
    votes: [],
    team1,
    team2,
    character1,
    character2,
    teamA: teamAName,
    teamB: teamBName,
    type: 'fight',
    title: description?.trim()
      ? description
      : `${division.name} ${fightType} fight`,
    content: description || '',
    author: createdBy || null,
    likes: [],
    comments: [],
    reactions: [],
    fight: {
      teamA: teamAName,
      teamB: teamBName,
      votes: { teamA: 0, teamB: 0, draw: 0, voters: [] },
      status: 'active',
      lockTime: endTime,
      isOfficial: true,
      winner: null,
      winnerTeam: null
    }
  };
};

const buildDivisionStats = (divisionId, db) => {
  const users = db.users || [];
  const fights = (db.divisionFights || []).filter(
    (fight) => fight.divisionId === divisionId
  );
  const activeTeams = users.filter(
    (user) => user.divisions && user.divisions[divisionId]
  ).length;
  const totalOfficialFights = fights.length;
  const totalVotes = fights.reduce(
    (sum, fight) => sum + (fight.votes?.length || 0),
    0
  );

  return {
    activeTeams,
    totalOfficialFights,
    averageVotes: totalOfficialFights
      ? Math.round(totalVotes / totalOfficialFights)
      : 0
  };
};

const buildChampion = (divisionId, db) => {
  const championUser = (db.users || []).find(
    (user) => user.divisions?.[divisionId]?.isChampion
  );
  if (!championUser) return null;

  const divisionData = championUser.divisions?.[divisionId] || {};
  return {
    id: resolveUserId(championUser),
    username: championUser.username,
    profilePicture:
      championUser.profile?.profilePicture || championUser.profile?.avatar || '',
    title: divisionData.title || 'Champion',
    stats: {
      wins: divisionData.wins || 0,
      losses: divisionData.losses || 0,
      points: divisionData.points || 0,
      rank: divisionData.rank || 'Rookie'
    },
    team: divisionData.team || null
  };
};

const buildChampionshipHistory = (divisionId, db) => {
  const history = [];
  (db.users || []).forEach((user) => {
    const entry = user.divisions?.[divisionId]?.championshipHistory;
    if (Array.isArray(entry)) {
      entry.forEach((record) => history.push(record));
    } else if (entry) {
      history.push(entry);
    }
  });
  return history;
};

const buildChallenger = (user, divisionId) => {
  if (!user) return null;
  return {
    id: resolveUserId(user),
    username: user.username,
    profilePicture: user.profile?.profilePicture || user.profile?.avatar || '',
    divisionStats: user.divisions?.[divisionId] || {}
  };
};

const buildUserTeamMap = (user) => {
  const map = {};
  const divisions = user?.divisions || {};
  Object.entries(divisions).forEach(([divisionId, divisionData]) => {
    const team = normalizeTeam(divisionData.team) || { fighters: [] };
    map[divisionId] = {
      fighters: team.fighters || [],
      wins: divisionData.wins || 0,
      losses: divisionData.losses || 0,
      record: {
        wins: divisionData.wins || 0,
        losses: divisionData.losses || 0
      },
      isChampion: Boolean(divisionData.isChampion)
    };
  });
  return map;
};

// Global division stats for moderator panel
router.get('/stats', async (_req, res) => {
  try {
    const db = await readDb();
    const fights = Array.isArray(db.divisionFights) ? db.divisionFights : [];
    const activeFights = fights.filter((fight) => fight.status === 'active').length;
    const titleFights = fights.filter((fight) => fight.fightType === 'title').length;
    const contenderMatches = fights.filter(
      (fight) => fight.fightType === 'contender'
    ).length;

    res.json({
      totalDivisions: DEFAULT_DIVISIONS.length,
      activeFights,
      titleFights,
      contenderMatches
    });
  } catch (error) {
    console.error('Error getting division stats:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Power tier division listing (placeholder)
router.get('/power-tiers', async (_req, res) => {
  res.json(DEFAULT_DIVISIONS);
});

// Basic divisions list
router.get('/', async (_req, res) => {
  try {
    const db = await readDb();
    const fights = Array.isArray(db.divisionFights) ? db.divisionFights : [];

    const divisions = DEFAULT_DIVISIONS.map((division) => {
      const stats = buildDivisionStats(division.id, db);
      const championUser = (db.users || []).find(
        (user) => user.divisions?.[division.id]?.isChampion
      );
      const currentChampion = championUser
        ? {
            name: championUser.username,
            since:
              championUser.divisions?.[division.id]?.championSince ||
              championUser.divisions?.[division.id]?.joinedAt ||
              championUser.updatedAt ||
              new Date().toISOString()
          }
        : null;

      const recentFights = fights
        .filter((fight) => fight.divisionId === division.id)
        .sort(
          (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        )
        .slice(0, 3)
        .map((fight) => ({
          id: fight.id || fight._id,
          teamA: fight.teamA || fight.fight?.teamA || '',
          teamB: fight.teamB || fight.fight?.teamB || '',
          status: fight.status || fight.fight?.status || 'active'
        }));

      return {
        ...division,
        averageVotes: stats.averageVotes,
        activeTeams: stats.activeTeams,
        currentChampion,
        recentFights
      };
    });

    res.json(divisions);
  } catch (error) {
    console.error('Error fetching divisions:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// User divisions
router.get('/user', auth, async (req, res) => {
  try {
    const db = await readDb();
    const user = findUserById(db, req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    res.json(user.divisions || {});
  } catch (error) {
    console.error('Error getting user divisions:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// User teams map
router.get('/user-teams/:userId', async (req, res) => {
  try {
    const db = await readDb();
    const user = findUserById(db, req.params.userId);
    if (!user) {
      return res.json({});
    }

    res.json(buildUserTeamMap(user));
  } catch (error) {
    console.error('Error getting user teams:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Active fights across divisions
router.get('/active-fights', async (_req, res) => {
  try {
    const db = await readDb();
    const fights = (db.divisionFights || []).filter(
      (fight) => fight.status === 'active'
    );
    res.json(fights);
  } catch (error) {
    console.error('Error getting active fights:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Betting fights placeholder
router.get('/betting-fights', async (_req, res) => {
  try {
    const db = await readDb();
    const fights = (db.divisionFights || []).filter(
      (fight) => fight.bettingCloses
    );
    res.json(fights);
  } catch (error) {
    console.error('Error getting betting fights:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Leaderboards placeholder
router.get('/leaderboards', async (_req, res) => {
  try {
    const db = await readDb();
    const leaderboards = {};

    DEFAULT_DIVISIONS.forEach((division) => {
      const teams = (db.users || [])
        .filter((user) => user.divisions?.[division.id]?.team)
        .map((user) => {
          const divisionData = user.divisions?.[division.id] || {};
          const team = normalizeTeam(divisionData.team) || { fighters: [] };
          return {
            id: `${division.id}-${resolveUserId(user)}`,
            owner: { id: resolveUserId(user), username: user.username },
            fighters: team.fighters || [],
            wins: divisionData.wins || 0,
            losses: divisionData.losses || 0,
            averageVotes: 0,
            isChampion: Boolean(divisionData.isChampion)
          };
        })
        .sort((a, b) => b.wins - a.wins);
      leaderboards[division.id] = teams;
    });

    res.json(leaderboards);
  } catch (error) {
    console.error('Error getting leaderboards:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Championship history placeholder
router.get('/championship-history', async (_req, res) => {
  try {
    const db = await readDb();
    const historyByDivision = {};

    DEFAULT_DIVISIONS.forEach((division) => {
      historyByDivision[division.id] = buildChampionshipHistory(division.id, db);
    });

    res.json(historyByDivision);
  } catch (error) {
    console.error('Error getting championship history:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Join division
router.post('/join', auth, async (req, res) => {
  try {
    const { divisionId, team } = req.body;

    if (!divisionId || !team || !team.mainCharacter) {
      return res
        .status(400)
        .json({ msg: 'Division and team are required.' });
    }

    const selectedIds = [
      getCharacterId(team.mainCharacter),
      getCharacterId(team.secondaryCharacter)
    ].filter(Boolean);

    await updateDb((db) => {
      const user = findUserById(db, req.user.id);
      if (!user) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      const takenByOthers = (db.users || []).some((entry) => {
        if (resolveUserId(entry) === resolveUserId(user)) {
          return false;
        }
        const division = entry.divisions?.[divisionId];
        if (!division?.team) return false;
        const otherTeam = normalizeTeam(division.team);
        const ids = [
          getCharacterId(otherTeam?.mainCharacter),
          getCharacterId(otherTeam?.secondaryCharacter)
        ].filter(Boolean);
        return selectedIds.some((id) => ids.includes(id));
      });

      if (takenByOthers) {
        const error = new Error('Selected characters are already taken.');
        error.code = 'CHARACTER_TAKEN';
        throw error;
      }

      const normalizedTeam = normalizeTeam(team);
      if (!normalizedTeam) {
        const error = new Error('Invalid team data');
        error.code = 'INVALID_TEAM';
        throw error;
      }

      user.divisions = user.divisions || {};
      user.divisions[divisionId] = {
        team: {
          ...normalizedTeam,
          fighters: normalizedTeam.fighters || []
        },
        joinedAt: new Date().toISOString(),
        wins: 0,
        losses: 0,
        draws: 0,
        points: 0,
        isChampion: false,
        contenderStatus: { isNumberOneContender: false }
      };
      user.updatedAt = new Date().toISOString();

      return db;
    });

    res.json({ msg: 'Successfully joined division' });
  } catch (error) {
    if (error.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ msg: 'User not found' });
    }
    if (error.code === 'CHARACTER_TAKEN') {
      return res.status(400).json({ msg: error.message });
    }
    if (error.code === 'INVALID_TEAM') {
      return res.status(400).json({ msg: error.message });
    }
    console.error('Error joining division:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Leave division
router.post('/leave', auth, async (req, res) => {
  try {
    const { divisionId } = req.body;
    if (!divisionId) {
      return res.status(400).json({ msg: 'Division ID is required' });
    }

    await updateDb((db) => {
      const user = findUserById(db, req.user.id);
      if (!user) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      if (user.divisions?.[divisionId]?.isChampion) {
        const error = new Error('Champion cannot leave their division.');
        error.code = 'IS_CHAMPION';
        throw error;
      }

      if (user.divisions) {
        delete user.divisions[divisionId];
      }
      user.updatedAt = new Date().toISOString();
      return db;
    });

    res.json({ msg: 'Successfully left division' });
  } catch (error) {
    if (error.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ msg: 'User not found' });
    }
    if (error.code === 'IS_CHAMPION') {
      return res.status(400).json({ msg: error.message });
    }
    console.error('Error leaving division:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Taken characters
router.get('/:divisionId/taken-characters', async (req, res) => {
  try {
    const { divisionId } = req.params;
    const db = await readDb();
    const takenCharacters = [];

    (db.users || []).forEach((user) => {
      const division = user.divisions?.[divisionId];
      const team = normalizeTeam(division?.team);
      if (!team) return;
      const ids = [
        getCharacterId(team.mainCharacter),
        getCharacterId(team.secondaryCharacter)
      ].filter(Boolean);
      ids.forEach((id) => takenCharacters.push(id));
    });

    res.json({ takenCharacters });
  } catch (error) {
    console.error('Error getting taken characters:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Division stats
router.get('/:divisionId/stats', async (req, res) => {
  try {
    const db = await readDb();
    const stats = buildDivisionStats(req.params.divisionId, db);
    res.json(stats);
  } catch (error) {
    console.error('Error getting division stats:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Division champion
router.get('/:divisionId/champion', async (req, res) => {
  try {
    const db = await readDb();
    const champion = buildChampion(req.params.divisionId, db);
    res.json({ champion });
  } catch (error) {
    console.error('Error getting division champion:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Championship history for division
router.get('/:divisionId/championship-history', async (req, res) => {
  try {
    const db = await readDb();
    res.json(buildChampionshipHistory(req.params.divisionId, db));
  } catch (error) {
    console.error('Error getting championship history:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Overview data for all divisions
router.get('/overview', async (_req, res) => {
  try {
    const db = await readDb();
    const stats = {};
    const champions = {};
    const titleFights = {};
    const activeFights = {};
    const championshipHistory = {};

    const fights = Array.isArray(db.divisionFights) ? db.divisionFights : [];

    DEFAULT_DIVISIONS.forEach((division) => {
      stats[division.id] = buildDivisionStats(division.id, db);
      champions[division.id] = buildChampion(division.id, db);
      titleFights[division.id] = fights.filter(
        (fight) =>
          fight.divisionId === division.id &&
          fight.fightType === 'title' &&
          fight.status === 'active'
      );
      activeFights[division.id] = fights.filter(
        (fight) =>
          fight.divisionId === division.id && fight.status === 'active'
      );
      championshipHistory[division.id] = buildChampionshipHistory(division.id, db);
    });

    res.json({
      stats,
      champions,
      titleFights,
      activeFights,
      championshipHistory
    });
  } catch (error) {
    console.error('Error getting divisions overview:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Title fights for division
router.get('/:divisionId/title-fights', async (req, res) => {
  try {
    const fights = (await readDb()).divisionFights || [];
    const titleFights = fights.filter(
      (fight) =>
        fight.divisionId === req.params.divisionId &&
        fight.fightType === 'title' &&
        fight.status === 'active'
    );
    res.json({ titleFights });
  } catch (error) {
    console.error('Error getting title fights:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Active fights for division
router.get('/:divisionId/active-fights', async (req, res) => {
  try {
    const fights = (await readDb()).divisionFights || [];
    const activeFights = fights.filter(
      (fight) =>
        fight.divisionId === req.params.divisionId && fight.status === 'active'
    );
    res.json({ activeFights });
  } catch (error) {
    console.error('Error getting active fights:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Contender matches for division
router.get('/:divisionId/contender-matches', async (req, res) => {
  try {
    const db = await readDb();
    const fights = (db.divisionFights || []).filter(
      (fight) =>
        fight.divisionId === req.params.divisionId &&
        fight.fightType === 'contender'
    );

    const withChallengers = fights.map((fight) => {
      const challenger1 = fight.team1?.userId
        ? findUserById(db, fight.team1.userId)
        : null;
      const challenger2 = fight.team2?.userId
        ? findUserById(db, fight.team2.userId)
        : null;
      return {
        ...fight,
        challenger1: buildChallenger(challenger1, req.params.divisionId),
        challenger2: buildChallenger(challenger2, req.params.divisionId)
      };
    });

    res.json(withChallengers);
  } catch (error) {
    console.error('Error getting contender matches:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Division members (public for local mode)
router.get('/:divisionId/members', async (req, res) => {
  try {
    const db = await readDb();
    const members = (db.users || [])
      .filter((user) => user.divisions?.[req.params.divisionId])
      .map((user) => ({
        id: resolveUserId(user),
        username: user.username,
        profilePicture:
          user.profile?.profilePicture || user.profile?.avatar || '',
        divisions: user.divisions || {}
      }));
    res.json(members);
  } catch (error) {
    console.error('Error getting division members:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Create title fight (moderator)
router.post('/:divisionId/title-fight', [auth, moderatorAuth], async (req, res) => {
  try {
    const { challengerId, description } = req.body;
    if (!challengerId) {
      return res.status(400).json({ msg: 'Challenger ID is required' });
    }

    let createdFight;

    await updateDb((db) => {
      const champion = (db.users || []).find(
        (user) => user.divisions?.[req.params.divisionId]?.isChampion
      );
      if (!champion) {
        const error = new Error('No champion found for this division');
        error.code = 'NO_CHAMPION';
        throw error;
      }

      const challenger = findUserById(db, challengerId);
      if (!challenger) {
        const error = new Error('Challenger not found');
        error.code = 'CHALLENGER_NOT_FOUND';
        throw error;
      }

      const team1 = buildTeamFromUser(champion, req.params.divisionId);
      const team2 = buildTeamFromUser(challenger, req.params.divisionId);
      if (!team1 || !team2) {
        const error = new Error('Both teams must be registered in the division');
        error.code = 'TEAM_NOT_FOUND';
        throw error;
      }

      const author = buildAuthor(findUserById(db, req.user.id));
      createdFight = buildDivisionFight({
        divisionId: req.params.divisionId,
        fightType: 'title',
        team1,
        team2,
        description,
        createdBy: author
      });

      db.divisionFights = Array.isArray(db.divisionFights) ? db.divisionFights : [];
      db.divisionFights.push(createdFight);
      return db;
    });

    res.json({ msg: 'Title fight created', fight: createdFight });
  } catch (error) {
    if (error.code === 'NO_CHAMPION') {
      return res.status(400).json({ msg: error.message });
    }
    if (error.code === 'CHALLENGER_NOT_FOUND') {
      return res.status(404).json({ msg: error.message });
    }
    if (error.code === 'TEAM_NOT_FOUND') {
      return res.status(400).json({ msg: error.message });
    }
    console.error('Error creating title fight:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Create contender match (moderator)
router.post('/:divisionId/contender-match', [auth, moderatorAuth], async (req, res) => {
  try {
    const challenger1Id = req.body.challenger1Id || req.body.fighter1Id;
    const challenger2Id = req.body.challenger2Id || req.body.fighter2Id;
    const { description } = req.body;

    if (!challenger1Id || !challenger2Id) {
      return res.status(400).json({ msg: 'Both challenger IDs are required' });
    }
    if (challenger1Id === challenger2Id) {
      return res.status(400).json({ msg: 'Challengers must be different' });
    }

    let createdFight;

    await updateDb((db) => {
      const challenger1 = findUserById(db, challenger1Id);
      const challenger2 = findUserById(db, challenger2Id);
      if (!challenger1 || !challenger2) {
        const error = new Error('Challenger not found');
        error.code = 'CHALLENGER_NOT_FOUND';
        throw error;
      }

      const team1 = buildTeamFromUser(challenger1, req.params.divisionId);
      const team2 = buildTeamFromUser(challenger2, req.params.divisionId);
      if (!team1 || !team2) {
        const error = new Error('Both teams must be registered in the division');
        error.code = 'TEAM_NOT_FOUND';
        throw error;
      }

      const author = buildAuthor(findUserById(db, req.user.id));
      createdFight = buildDivisionFight({
        divisionId: req.params.divisionId,
        fightType: 'contender',
        team1,
        team2,
        description,
        createdBy: author
      });

      db.divisionFights = Array.isArray(db.divisionFights) ? db.divisionFights : [];
      db.divisionFights.push(createdFight);
      return db;
    });

    res.json({ msg: 'Contender match created', fight: createdFight });
  } catch (error) {
    if (error.code === 'CHALLENGER_NOT_FOUND') {
      return res.status(404).json({ msg: error.message });
    }
    if (error.code === 'TEAM_NOT_FOUND') {
      return res.status(400).json({ msg: error.message });
    }
    console.error('Error creating contender match:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Register team (DivisionSystem)
router.post('/register-team', async (req, res) => {
  try {
    const { userId, divisionId, fighters } = req.body;
    if (!userId || !divisionId || !Array.isArray(fighters) || fighters.length < 2) {
      return res.status(400).json({ msg: 'Invalid team data' });
    }

    await updateDb((db) => {
      const user = findUserById(db, userId);
      if (!user) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      const team = normalizeTeam({ fighters });
      user.divisions = user.divisions || {};
      user.divisions[divisionId] = {
        team,
        joinedAt: new Date().toISOString(),
        wins: 0,
        losses: 0,
        draws: 0,
        points: 0,
        isChampion: false
      };
      user.updatedAt = new Date().toISOString();
      return db;
    });

    res.json({ msg: 'Team registered' });
  } catch (error) {
    if (error.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ msg: 'User not found' });
    }
    console.error('Error registering team:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Create fight (DivisionSystem)
router.post('/create-fight', async (req, res) => {
  try {
    const { team1, team2, divisionId, isTitle, duration } = req.body;
    if (!team1 || !team2 || !divisionId) {
      return res.status(400).json({ msg: 'Missing fight data' });
    }

    const fightType = isTitle ? 'title' : 'official';
    let createdFight;

    await updateDb((db) => {
      const normalizedTeam1 = buildTeamFromPayload(team1);
      const normalizedTeam2 = buildTeamFromPayload(team2);
      if (!normalizedTeam1 || !normalizedTeam2) {
        const error = new Error('Invalid team data');
        error.code = 'INVALID_TEAM';
        throw error;
      }

      createdFight = buildDivisionFight({
        divisionId,
        fightType,
        team1: normalizedTeam1,
        team2: normalizedTeam2,
        description: req.body.description,
        createdBy: null,
        durationHours: duration
      });

      db.divisionFights = Array.isArray(db.divisionFights) ? db.divisionFights : [];
      db.divisionFights.push(createdFight);
      return db;
    });

    res.json({ msg: 'Fight created', fight: createdFight });
  } catch (error) {
    if (error.code === 'INVALID_TEAM') {
      return res.status(400).json({ msg: error.message });
    }
    console.error('Error creating fight:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Create official fight (PowerTierDivisions)
router.post('/create-official-fight', async (req, res) => {
  try {
    const {
      team1Id,
      team2Id,
      divisionId,
      isTitle,
      isContender,
      bettingPeriod,
      fightDuration
    } = req.body;

    if (!team1Id || !team2Id || !divisionId) {
      return res.status(400).json({ msg: 'Missing fight data' });
    }

    const fightType = isTitle ? 'title' : isContender ? 'contender' : 'official';
    let createdFight;

    await updateDb((db) => {
      const user1 = findUserById(db, team1Id);
      const user2 = findUserById(db, team2Id);
      const team1 = buildTeamFromUser(user1, divisionId);
      const team2 = buildTeamFromUser(user2, divisionId);
      if (!team1 || !team2) {
        const error = new Error('Teams not found for division');
        error.code = 'TEAM_NOT_FOUND';
        throw error;
      }

      createdFight = buildDivisionFight({
        divisionId,
        fightType,
        team1,
        team2,
        description: req.body.description,
        createdBy: null,
        durationHours: fightDuration,
        bettingPeriodHours: bettingPeriod
      });

      db.divisionFights = Array.isArray(db.divisionFights) ? db.divisionFights : [];
      db.divisionFights.push(createdFight);
      return db;
    });

    res.json({ msg: 'Official fight created', fight: createdFight });
  } catch (error) {
    if (error.code === 'TEAM_NOT_FOUND') {
      return res.status(400).json({ msg: error.message });
    }
    console.error('Error creating official fight:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Lock expired fights (moderator panel helper)
router.post('/lock-expired-fights', async (_req, res) => {
  try {
    const now = new Date();
    let lockedCount = 0;

    await updateDb((db) => {
      db.divisionFights = Array.isArray(db.divisionFights) ? db.divisionFights : [];
      db.divisionFights.forEach((fight) => {
        if (fight.status === 'active' && fight.endTime && new Date(fight.endTime) < now) {
          fight.status = 'locked';
          if (fight.fight) {
            fight.fight.status = 'locked';
          }
          lockedCount += 1;
        }
      });
      return db;
    });

    res.json({ msg: 'Expired fights locked', lockedCount });
  } catch (error) {
    console.error('Error locking expired fights:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

export default router;
