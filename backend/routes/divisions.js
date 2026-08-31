import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import auth from '../middleware/auth.js';
import moderatorAuth from '../middleware/moderatorAuth.js';
import {
  charactersRepo,
  divisionFightsRepo,
  divisionSeasonsRepo,
  divisionTeamSlotsRepo,
  usersRepo,
  withRepositoryTransaction
} from '../repositories/index.js';
import { getRankInfo } from '../utils/rankSystem.js';
import { parsePagination } from '../utils/pagination.js';

const router = express.Router();

const DEFAULT_DIVISIONS = [
  { id: 'regular', name: 'Regular', tier: 1 },
  { id: 'metahuman', name: 'Metahuman', tier: 2 },
  { id: 'planetBusters', name: 'Planet Busters', tier: 3 },
  { id: 'godTier', name: 'God Tier', tier: 4 },
  { id: 'universalThreat', name: 'Universal Threat', tier: 5 }
];

const DEFAULT_SEASONS = [
  { id: 'regular', name: 'Regular People' },
  { id: 'metahuman', name: 'Metahumans' },
  { id: 'planetBusters', name: 'Planet Busters' },
  { id: 'godTier', name: 'God Tier' },
  { id: 'universalThreat', name: 'Universal Threat' },
  { id: 'star-wars', name: 'Star Wars' },
  { id: 'dragon-ball', name: 'Dragon Ball' },
  { id: 'dc', name: 'DC' },
  { id: 'marvel', name: 'Marvel' }
];

const getDefaultSeasonBanner = (season) => {
  const isRegular = season.id === 'regular';
  const isMetahuman = season.id === 'metahuman';
  const isPlanet = season.id === 'planetBusters';
  const isGod = season.id === 'godTier';
  const isUniversal = season.id === 'universalThreat';
  const isStarWars = season.id === 'star-wars';
  const isDragonBall = season.id === 'dragon-ball';
  const isDc = season.id === 'dc';
  const isMarvel = season.id === 'marvel';

  if (isRegular) return '/site/regularpeople.jpg';
  if (isMetahuman) return '/site/metahumans.jpg';
  if (isPlanet) return '/site/planetbusters.jpg';
  if (isGod) return '/site/gods.jpg';
  if (isUniversal) return '/site/universal.jpg';
  if (isStarWars) return '/site/starwarskoldvisions.jpg';
  if (isDragonBall) return '/site/dragonball.jpg';
  if (isDc) return '/site/dc.jpg';
  if (isMarvel) return '/site/marvel.jpg';
  return `/characters/${season.name}.jpg`;
};

const resolveUserId = (user) => user?.id || user?._id;

const getDivisionInfo = (divisionId) =>
  DEFAULT_DIVISIONS.find((division) => division.id === divisionId) || {
    id: divisionId,
    name: divisionId,
    tier: null
  };

const getCharacterId = (character) =>
  character?.id || character?._id || character?.characterId;

const buildDefaultSeasons = () =>
  DEFAULT_SEASONS.map((season) => {
    const now = new Date().toISOString();
    return {
      ...season,
      startAt: null,
      endAt: null,
      isLocked: true,
      bannerImage: getDefaultSeasonBanner(season),
      accentColor: '#6c757d',
      description: '',
      updatedAt: now
    };
  });

const ensureSeasons = (db) => {
  db.divisionSeasons = Array.isArray(db.divisionSeasons)
    ? db.divisionSeasons
    : [];

  // Drop deprecated divisions (e.g., omnipotent) to keep UI clean
  db.divisionSeasons = db.divisionSeasons.filter((season) => season.id !== 'omnipotent');

  if (db.divisionSeasons.length === 0) {
    db.divisionSeasons = buildDefaultSeasons();
    return;
  }

  // Normalize known defaults to uploaded banners
  db.divisionSeasons = db.divisionSeasons.map((season) => {
    if (season.id === 'regular') {
      const legacyBanner = `/characters/${season.name || 'Regular People'}.jpg`;
      const bannerImage =
        !season.bannerImage || season.bannerImage === legacyBanner
          ? '/site/regularpeople.jpg'
          : season.bannerImage;
      return { ...season, bannerImage };
    }

    if (season.id === 'metahuman') {
      const legacyBanner = `/characters/${season.name || 'Metahumans'}.jpg`;
      const bannerImage =
        !season.bannerImage || season.bannerImage === legacyBanner
          ? '/site/metahumans.jpg'
          : season.bannerImage;
      return { ...season, bannerImage };
    }

    if (season.id === 'planetBusters') {
      const legacyBanner = `/characters/${season.name || 'Planet Busters'}.jpg`;
      const bannerImage =
        !season.bannerImage || season.bannerImage === legacyBanner
          ? '/site/planetbusters.jpg'
          : season.bannerImage;
      return { ...season, bannerImage };
    }

    if (season.id === 'godTier') {
      const legacyBanner = `/characters/${season.name || 'God Tier'}.jpg`;
      const bannerImage =
        !season.bannerImage || season.bannerImage === legacyBanner
          ? '/site/gods.jpg'
          : season.bannerImage;
      return { ...season, bannerImage };
    }

    if (season.id === 'universalThreat') {
      const legacyBanner = `/characters/${season.name || 'Universal Threat'}.jpg`;
      const bannerImage =
        !season.bannerImage || season.bannerImage === legacyBanner
          ? '/site/universal.jpg'
          : season.bannerImage;
      return { ...season, bannerImage };
    }

    if (season.id === 'star-wars') {
      const legacyBanner = `/characters/${season.name || 'Star Wars'}.jpg`;
      const bannerImage =
        !season.bannerImage || season.bannerImage === legacyBanner
          ? '/site/starwarskoldvisions.jpg'
          : season.bannerImage;
      return { ...season, bannerImage };
    }

    if (season.id === 'dragon-ball') {
      const legacyBanner = `/characters/${season.name || 'Dragon Ball'}.jpg`;
      const bannerImage =
        !season.bannerImage || season.bannerImage === legacyBanner
          ? '/site/dragonball.jpg'
          : season.bannerImage;
      return { ...season, bannerImage };
    }

    if (season.id === 'dc') {
      const legacyBanner = `/characters/${season.name || 'DC'}.jpg`;
      const bannerImage =
        !season.bannerImage || season.bannerImage === legacyBanner
          ? '/site/dc.jpg'
          : season.bannerImage;
      return { ...season, bannerImage };
    }

    if (season.id === 'marvel') {
      const legacyBanner = `/characters/${season.name || 'Marvel'}.jpg`;
      const bannerImage =
        !season.bannerImage || season.bannerImage === legacyBanner
          ? '/site/marvel.jpg'
          : season.bannerImage;
      return { ...season, bannerImage };
    }

    return season;
  });

  const existingIds = new Set(db.divisionSeasons.map((season) => season.id));
  DEFAULT_SEASONS.forEach((season) => {
    if (!existingIds.has(season.id)) {
      db.divisionSeasons.push({
        ...season,
        startAt: null,
        endAt: null,
        isLocked: true,
        bannerImage: getDefaultSeasonBanner(season),
        accentColor: '#6c757d',
        description: '',
        updatedAt: new Date().toISOString()
      });
    }
  });
};

const ensureSeasonRecords = async (context) => {
  const existing = await divisionSeasonsRepo.getAll(context);
  const db = { divisionSeasons: existing };
  ensureSeasons(db);
  const normalizedIds = new Set(db.divisionSeasons.map((season) => season.id));
  for (const season of existing) {
    if (!normalizedIds.has(season.id)) {
      await divisionSeasonsRepo.removeById(season.id, context);
    }
  }
  for (const season of db.divisionSeasons) {
    const current = existing.find((entry) => entry.id === season.id);
    if (current) {
      if (JSON.stringify(current) !== JSON.stringify(season)) {
        await divisionSeasonsRepo.updateById(season.id, () => season, context);
      }
    } else {
      await divisionSeasonsRepo.insertIfAbsent({ id: season.id }, season, context);
    }
  }
  return db.divisionSeasons;
};

const loadSeasonDb = async (context) => ({
  divisionSeasons: await ensureSeasonRecords(context)
});

const getSeasonById = (db, seasonId) => {
  ensureSeasons(db);
  return db.divisionSeasons.find((season) => season.id === seasonId) || null;
};

const withSeasonStatus = (season, now = new Date()) => {
  if (!season) return null;
  return { ...season, status: getSeasonStatus(season, now) };
};

const cleanupDivisionTeams = async (context, divisionId) => {
  const now = new Date().toISOString();
  const query = { [`divisions.${divisionId}`]: { $exists: true } };
  const result = await usersRepo.patchManyBy(query, { updatedAt: now }, context);
  await usersRepo.unsetManyBy(query, [`divisions.${divisionId}`], context);
  await divisionTeamSlotsRepo.removeManyBy({ divisionId }, context);
  return result.matchedCount;
};

const getDivisionDefinitions = (db) => {
  ensureSeasons(db);
  const seasonMap = new Map(db.divisionSeasons.map((season) => [season.id, season]));
  const definitions = DEFAULT_DIVISIONS.map((division) => {
    const season = seasonMap.get(division.id);
    return {
      ...division,
      name: season?.name || division.name,
      seasonStatus: season ? getSeasonStatus(season) : 'locked',
      season
    };
  });

  seasonMap.forEach((season, seasonId) => {
    const exists = definitions.some((division) => division.id === seasonId);
    if (!exists) {
      definitions.push({
        id: season.id,
        name: season.name,
        tier: null,
        seasonStatus: getSeasonStatus(season),
        season
      });
    }
  });

  return definitions;
};

const isDivisionActive = (db, divisionId) => {
  const season = getSeasonById(db, divisionId);
  if (!season) return false;
  return getSeasonStatus(season) === 'active';
};

const runSeasonScheduler = async (now = new Date()) => {
  let activated = 0;
  let deactivated = 0;
  let cleanedTeams = 0;
  const nowIso = now.toISOString();

  await withRepositoryTransaction(async (context) => {
    const seasons = await ensureSeasonRecords(context);
    for (const season of seasons) {
      const startAt = season.startAt ? new Date(season.startAt) : null;
      const endAt = season.endAt ? new Date(season.endAt) : null;
      let changed = false;

      if (season.isLocked && startAt && now >= startAt && (!endAt || now < endAt)) {
        season.isLocked = false;
        season.updatedAt = nowIso;
        activated += 1;
        changed = true;
      }

      if (!season.isLocked && endAt && now >= endAt) {
        season.isLocked = true;
        season.updatedAt = nowIso;
        deactivated += 1;
        cleanedTeams += await cleanupDivisionTeams(context, season.id);
        changed = true;
      }
      if (changed) {
        await divisionSeasonsRepo.updateById(season.id, () => season, context);
      }
    }
  });

  return { activated, deactivated, cleanedTeams, timestamp: nowIso };
};

const parseDateValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return { value: null, error: null };
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { value: null, error: 'Invalid date format' };
  }
  return { value: parsed.toISOString(), error: null };
};

const getSeasonStatus = (season, now = new Date()) => {
  if (season.isLocked) {
    return 'locked';
  }
  if (!season.startAt && !season.endAt) {
    return 'unset';
  }
  const start = season.startAt ? new Date(season.startAt) : null;
  const end = season.endAt ? new Date(season.endAt) : null;

  if (start && now < start) {
    return 'scheduled';
  }
  if (end && now > end) {
    return 'ended';
  }
  return 'active';
};

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

const normalizeVoteTeam = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (['team1', 'team_a', 'teama', 'a', 'team-a', 'team a'].includes(normalized)) {
    return 'team1';
  }
  if (['team2', 'team_b', 'teamb', 'b', 'team-b', 'team b'].includes(normalized)) {
    return 'team2';
  }
  if (['draw', 'tie'].includes(normalized)) {
    return 'draw';
  }
  return null;
};

const ensureDivisionSlots = async (divisionId, context) => {
  const users = await usersRepo.findManyBy({
    [`divisions.${divisionId}.team`]: { $exists: true }
  }, {}, context);
  for (const user of users) {
    const team = normalizeTeam(user.divisions?.[divisionId]?.team);
    const characterIds = [...new Set([
      getCharacterId(team?.mainCharacter),
      getCharacterId(team?.secondaryCharacter)
    ].filter(Boolean))];
    for (const characterId of characterIds) {
      await divisionTeamSlotsRepo.insertIfAbsent(
        { divisionId, characterId },
        {
          id: uuidv4(),
          divisionId,
          characterId,
          userId: resolveUserId(user),
          createdAt: user.divisions?.[divisionId]?.joinedAt || new Date().toISOString()
        },
        context
      );
    }
  }
};

const reserveDivisionTeam = async (divisionId, userId, selectedIds, context) => {
  await ensureDivisionSlots(divisionId, context);
  await divisionTeamSlotsRepo.removeManyBy({ divisionId, userId }, context);
  for (const characterId of selectedIds) {
    const result = await divisionTeamSlotsRepo.insertIfAbsent(
      { divisionId, characterId },
      {
        id: uuidv4(),
        divisionId,
        characterId,
        userId,
        createdAt: new Date().toISOString()
      },
      context
    );
    if (!result.inserted && result.item?.userId !== userId) {
      const error = new Error('Selected characters are already taken.');
      error.code = 'CHARACTER_TAKEN';
      throw error;
    }
  }
};

const normalizeVoteVisibility = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'final' || raw === 'hidden') return 'final';
  return 'live';
};

const getDivisionFightVisibility = (fight) =>
  normalizeVoteVisibility(fight?.fight?.voteVisibility || fight?.voteVisibility);

const getDivisionFightLockTime = (fight) =>
  fight?.fight?.lockTime || fight?.endTime || null;

const shouldRevealDivisionVotes = (fight, now = new Date()) => {
  const visibility = getDivisionFightVisibility(fight);
  if (visibility !== 'final') return true;
  const lockTimeValue = getDivisionFightLockTime(fight);
  if (!lockTimeValue) return true;
  const lockTime = new Date(lockTimeValue);
  if (Number.isNaN(lockTime.getTime())) return true;
  if (fight?.status && fight.status !== 'active') return true;
  return now >= lockTime;
};

const applyDivisionVoteVisibility = (fight, now = new Date()) => {
  if (!fight) return fight;
  const visibility = getDivisionFightVisibility(fight);
  const revealVotes = shouldRevealDivisionVotes(fight, now);
  if (revealVotes) {
    if (fight.fight) {
      return {
        ...fight,
        votesHidden: false,
        fight: { ...fight.fight, voteVisibility: visibility, votesHidden: false }
      };
    }
    return { ...fight, votesHidden: false };
  }

  const masked = {
    ...fight,
    votesHidden: true
  };

  if (Array.isArray(masked.votes)) {
    masked.votes = [];
  }
  if (typeof masked.team1Votes === 'number') masked.team1Votes = 0;
  if (typeof masked.team2Votes === 'number') masked.team2Votes = 0;
  if (typeof masked.drawVotes === 'number') masked.drawVotes = 0;

  if (masked.fight) {
    masked.fight = {
      ...masked.fight,
      voteVisibility: visibility,
      votesHidden: true,
      votes: { teamA: 0, teamB: 0, draw: 0, voters: [] }
    };
  }

  return masked;
};

const buildTeamName = (team) =>
  [team?.mainCharacter?.name, team?.secondaryCharacter?.name]
    .filter(Boolean)
    .join(', ');

const buildAuthor = (user) => {
  if (!user) return null;
  const rankInfo = getRankInfo(user.stats?.points || 0);
  return {
    id: resolveUserId(user),
    username: user.username,
    profilePicture: user.profile?.profilePicture || user.profile?.avatar || '',
    rank: rankInfo.rank
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
  bettingPeriodHours,
  voteVisibility
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
      voteVisibility: String(voteVisibility || '').toLowerCase() === 'final' ? 'final' : 'live',
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
  const rankInfo = getRankInfo(championUser.stats?.points || 0);
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
      rank: divisionData.rank || rankInfo.rank
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

// Seasons: list
router.get('/seasons', async (_req, res) => {
  try {
    const db = await loadSeasonDb();
    const now = new Date();
    res.json(db.divisionSeasons.map((season) => withSeasonStatus(season, now)));
  } catch (error) {
    console.error('Error getting seasons:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Seasons: create
router.post('/seasons', [auth, moderatorAuth], async (req, res) => {
  try {
    const { id, name, startAt, endAt, bannerImage, accentColor, description } = req.body;
    if (!id || !name) {
      return res.status(400).json({ msg: 'Season id and name are required' });
    }

    const { value: parsedStart, error: startError } = parseDateValue(startAt);
    const { value: parsedEnd, error: endError } = parseDateValue(endAt);
    if (startError || endError) {
      return res.status(400).json({ msg: startError || endError });
    }

    let createdSeason;

    await withRepositoryTransaction(async (context) => {
      await ensureSeasonRecords(context);
      const nowIso = new Date().toISOString();
      const isRegular = id === 'regular' || name?.toLowerCase() === 'regular people';
      const defaultBanner = isRegular ? '/site/regularpeople.jpg' : `/characters/${name}.jpg`;
      createdSeason = {
        id,
        name,
        startAt: parsedStart,
        endAt: parsedEnd,
        isLocked: true,
        bannerImage: bannerImage || defaultBanner,
        accentColor: accentColor || '#6c757d',
        description: description || '',
        updatedAt: nowIso
      };

      const result = await divisionSeasonsRepo.insertIfAbsent(
        { id },
        createdSeason,
        context
      );
      if (!result.inserted) {
        const error = new Error('Season already exists');
        error.code = 'SEASON_EXISTS';
        throw error;
      }
    });

    res.status(201).json({ msg: 'Season created', season: createdSeason });
  } catch (error) {
    if (error.code === 'SEASON_EXISTS') {
      return res.status(400).json({ msg: error.message });
    }
    console.error('Error creating season:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Seasons: update
router.patch('/seasons/:seasonId', [auth, moderatorAuth], async (req, res) => {
  try {
    const { startAt, endAt, isLocked, name, bannerImage, accentColor, description } = req.body;
    const startParsed = startAt !== undefined ? parseDateValue(startAt) : null;
    const endParsed = endAt !== undefined ? parseDateValue(endAt) : null;
    if (startParsed?.error || endParsed?.error) {
      return res.status(400).json({ msg: startParsed?.error || endParsed?.error });
    }

    let updatedSeason;

    await withRepositoryTransaction(async (context) => {
      await ensureSeasonRecords(context);
      const season = await divisionSeasonsRepo.findById(req.params.seasonId, context);
      if (!season) {
        const error = new Error('Season not found');
        error.code = 'SEASON_NOT_FOUND';
        throw error;
      }

      const nowIso = new Date().toISOString();
      if (name) season.name = name;
      if (startParsed) season.startAt = startParsed.value;
      if (endParsed) season.endAt = endParsed.value;
      if (typeof isLocked === 'boolean') season.isLocked = isLocked;
      if (bannerImage !== undefined) season.bannerImage = bannerImage;
      if (accentColor !== undefined) season.accentColor = accentColor;
      if (description !== undefined) season.description = description;
      season.updatedAt = nowIso;
      updatedSeason = await divisionSeasonsRepo.updateById(
        season.id,
        () => season,
        context
      );
    });

    res.json({ msg: 'Season updated', season: withSeasonStatus(updatedSeason) });
  } catch (error) {
    if (error.code === 'SEASON_NOT_FOUND') {
      return res.status(404).json({ msg: error.message });
    }
    console.error('Error updating season:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Seasons: activate now
router.post('/seasons/:seasonId/activate', [auth, moderatorAuth], async (req, res) => {
  try {
    let season;
    await withRepositoryTransaction(async (context) => {
      await ensureSeasonRecords(context);
      season = await divisionSeasonsRepo.findById(req.params.seasonId, context);
      if (!season) {
        const error = new Error('Season not found');
        error.code = 'SEASON_NOT_FOUND';
        throw error;
      }
      const nowIso = new Date().toISOString();
      season.isLocked = false;
      season.startAt = nowIso;
      season.updatedAt = nowIso;
      season = await divisionSeasonsRepo.updateById(season.id, () => season, context);
    });

    res.json({ msg: 'Season activated', season: withSeasonStatus(season) });
  } catch (error) {
    if (error.code === 'SEASON_NOT_FOUND') {
      return res.status(404).json({ msg: error.message });
    }
    console.error('Error activating season:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Seasons: deactivate now
router.post('/seasons/:seasonId/deactivate', [auth, moderatorAuth], async (req, res) => {
  try {
    let season;
    let removedTeams = 0;
    await withRepositoryTransaction(async (context) => {
      await ensureSeasonRecords(context);
      season = await divisionSeasonsRepo.findById(req.params.seasonId, context);
      if (!season) {
        const error = new Error('Season not found');
        error.code = 'SEASON_NOT_FOUND';
        throw error;
      }
      const nowIso = new Date().toISOString();
      season.isLocked = true;
      season.startAt = null; // prevent scheduler from re-activating after manual lock
      season.updatedAt = nowIso;
      removedTeams = await cleanupDivisionTeams(context, season.id);
      season = await divisionSeasonsRepo.updateById(season.id, () => season, context);
    });

    res.json({
      msg: 'Season deactivated and teams cleared',
      season: withSeasonStatus(season),
      removedTeams
    });
  } catch (error) {
    if (error.code === 'SEASON_NOT_FOUND') {
      return res.status(404).json({ msg: error.message });
    }
    console.error('Error deactivating season:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Seasons: manual scheduler trigger
router.post('/seasons/run-scheduler', [auth, moderatorAuth], async (_req, res) => {
  try {
    const result = await runSeasonScheduler();
    res.json({ msg: 'Scheduler executed', ...result });
  } catch (error) {
    console.error('Error running scheduler:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Global division stats for moderator panel
router.get('/stats', async (_req, res) => {
  try {
    const db = await loadSeasonDb();
    const [activeFights, titleFights, contenderMatches] = await Promise.all([
      divisionFightsRepo.countBy({ status: 'active' }),
      divisionFightsRepo.countBy({ fightType: 'title' }),
      divisionFightsRepo.countBy({ fightType: 'contender' })
    ]);

    res.json({
      totalDivisions: getDivisionDefinitions(db).length,
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
    const db = await loadSeasonDb();
    const definitions = getDivisionDefinitions(db);

    const divisions = await Promise.all(definitions.map(async (division) => {
      const divisionQuery = { divisionId: division.id };
      const [activeTeams, totalOfficialFights, totalVotes, championUser, recentFights] =
        await Promise.all([
          usersRepo.countBy({ [`divisions.${division.id}`]: { $exists: true } }),
          divisionFightsRepo.countBy(divisionQuery),
          divisionFightsRepo.sumArrayLengthBy('votes', divisionQuery),
          usersRepo.findOneBy({ [`divisions.${division.id}.isChampion`]: true }),
          divisionFightsRepo.findManyBy(
            divisionQuery,
            { sort: { createdAt: -1 }, limit: 3 }
          )
        ]);
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

      const recentFightSummaries = recentFights.map((fight) => ({
          id: fight.id || fight._id,
          teamA: fight.teamA || fight.fight?.teamA || '',
          teamB: fight.teamB || fight.fight?.teamB || '',
          status: fight.status || fight.fight?.status || 'active'
        }));

      return {
        ...division,
        averageVotes: totalOfficialFights
          ? Math.round(totalVotes / totalOfficialFights)
          : 0,
        activeTeams,
        currentChampion,
        recentFights: recentFightSummaries,
        seasonStatus: division.seasonStatus || 'locked'
      };
    }));

    res.json(divisions);
  } catch (error) {
    console.error('Error fetching divisions:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// User divisions
router.get('/user', auth, async (req, res) => {
  try {
    const user = await usersRepo.findById(req.user.id);
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
    const user = await usersRepo.findById(req.params.userId);
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
router.get('/active-fights', async (req, res) => {
  try {
    const { page, limit } = parsePagination(req.query, { defaultLimit: 50, maxLimit: 100 });
    const now = new Date();
    const fights = await divisionFightsRepo.findManyBy(
      { status: 'active' },
      { sort: { createdAt: -1 }, skip: (page - 1) * limit, limit }
    );
    res.json(fights.map((fight) => applyDivisionVoteVisibility(fight, now)));
  } catch (error) {
    console.error('Error getting active fights:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Vote in an official division fight
router.post('/vote', auth, async (req, res) => {
  try {
    const { fightId, team } = req.body;
    const normalizedTeam = normalizeVoteTeam(team);

    if (!fightId || !normalizedTeam) {
      return res.status(400).json({ msg: 'Invalid vote data' });
    }

    let updatedFight;

    await withRepositoryTransaction(async (context) => {
      const fight = await divisionFightsRepo.findById(fightId, context);
      if (!fight) {
        const error = new Error('Fight not found');
        error.code = 'NOT_FOUND';
        throw error;
      }

      fight.votes = Array.isArray(fight.votes) ? fight.votes : [];
      const existingIndex = fight.votes.findIndex(
        (vote) => String(vote.userId) === String(req.user.id)
      );
      if (existingIndex >= 0) {
        fight.votes[existingIndex].team = normalizedTeam;
      } else {
        fight.votes.push({ userId: req.user.id, team: normalizedTeam });
      }

      const counts = { team1: 0, team2: 0, draw: 0 };
      fight.votes.forEach((vote) => {
        if (counts[vote.team] !== undefined) {
          counts[vote.team] += 1;
        }
      });

      fight.team1Votes = counts.team1;
      fight.team2Votes = counts.team2;
      fight.drawVotes = counts.draw;
      fight.fight = fight.fight || {};
      fight.fight.votes = fight.fight.votes || { teamA: 0, teamB: 0, draw: 0, voters: [] };
      fight.fight.votes.teamA = counts.team1;
      fight.fight.votes.teamB = counts.team2;
      fight.fight.votes.draw = counts.draw;
      fight.fight.votes.voters = fight.votes.map((vote) => ({
        userId: vote.userId,
        team: vote.team === 'team1' ? 'A' : vote.team === 'team2' ? 'B' : 'draw'
      }));

      updatedFight = await divisionFightsRepo.updateById(
        fight.id,
        () => fight,
        context
      );
    });

    const safeFight = applyDivisionVoteVisibility(updatedFight, new Date());
    const votesHidden = Boolean(safeFight?.votesHidden || safeFight?.fight?.votesHidden);

    res.json({
      msg: 'Vote recorded',
      fight: safeFight,
      votes: votesHidden
        ? { team1: 0, team2: 0, draw: 0 }
        : {
            team1: updatedFight.team1Votes || 0,
            team2: updatedFight.team2Votes || 0,
            draw: updatedFight.drawVotes || 0
          }
    });
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ msg: 'Fight not found' });
    }
    console.error('Error recording vote:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Betting fights placeholder
router.get('/betting-fights', async (req, res) => {
  try {
    const { page, limit } = parsePagination(req.query, { defaultLimit: 50, maxLimit: 100 });
    const now = new Date();
    const fights = await divisionFightsRepo.findManyBy(
      { bettingCloses: { $exists: true } },
      { sort: { createdAt: -1 }, skip: (page - 1) * limit, limit }
    );
    res.json(fights.map((fight) => applyDivisionVoteVisibility(fight, now)));
  } catch (error) {
    console.error('Error getting betting fights:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Leaderboards placeholder
router.get('/leaderboards', async (_req, res) => {
  try {
    const leaderboards = {};

    for (const division of DEFAULT_DIVISIONS) {
      const users = await usersRepo.findManyBy(
        { [`divisions.${division.id}.team`]: { $exists: true } },
        { sort: { [`divisions.${division.id}.wins`]: -1 }, limit: 100 }
      );
      const teams = users.map((user) => {
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
        });
      leaderboards[division.id] = teams;
    }

    res.json(leaderboards);
  } catch (error) {
    console.error('Error getting leaderboards:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Championship history placeholder
router.get('/championship-history', async (_req, res) => {
  try {
    const historyByDivision = {};

    for (const division of DEFAULT_DIVISIONS) {
      const users = await usersRepo.findManyBy(
        { [`divisions.${division.id}.championshipHistory`]: { $exists: true } },
        { limit: 100 }
      );
      historyByDivision[division.id] = buildChampionshipHistory(
        division.id,
        { users }
      );
    }

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

    await withRepositoryTransaction(async (context) => {
      const user = await usersRepo.findById(req.user.id, context);
      if (!user) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      const season = getSeasonById(await loadSeasonDb(context), divisionId);
      if (!season || getSeasonStatus(season) !== 'active') {
        const error = new Error('Division is locked');
        error.code = 'DIVISION_LOCKED';
        throw error;
      }

      const normalizedTeam = normalizeTeam(team);
      if (!normalizedTeam) {
        const error = new Error('Invalid team data');
        error.code = 'INVALID_TEAM';
        throw error;
      }

      await reserveDivisionTeam(
        divisionId,
        resolveUserId(user),
        selectedIds,
        context
      );

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
      await usersRepo.updateById(user.id, () => user, context);
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
    if (error.code === 'DIVISION_LOCKED') {
      return res.status(403).json({ msg: error.message });
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

    await withRepositoryTransaction(async (context) => {
      const user = await usersRepo.findById(req.user.id, context);
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
      await divisionTeamSlotsRepo.removeManyBy({
        divisionId,
        userId: resolveUserId(user)
      }, context);
      await usersRepo.updateById(user.id, () => user, context);
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
    let takenCharacters = [];
    await withRepositoryTransaction(async (context) => {
      await ensureDivisionSlots(divisionId, context);
      const slots = await divisionTeamSlotsRepo.findManyBy(
        { divisionId },
        { projection: { characterId: 1 } },
        context
      );
      takenCharacters = slots.map((slot) => slot.characterId).filter(Boolean);
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
    const divisionId = req.params.divisionId;
    const query = { divisionId };
    const [activeTeams, totalOfficialFights, totalVotes] = await Promise.all([
      usersRepo.countBy({ [`divisions.${divisionId}`]: { $exists: true } }),
      divisionFightsRepo.countBy(query),
      divisionFightsRepo.sumArrayLengthBy('votes', query)
    ]);
    const stats = {
      activeTeams,
      totalOfficialFights,
      averageVotes: totalOfficialFights
        ? Math.round(totalVotes / totalOfficialFights)
        : 0
    };
    res.json(stats);
  } catch (error) {
    console.error('Error getting division stats:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Division champion
router.get('/:divisionId/champion', async (req, res) => {
  try {
    const divisionId = req.params.divisionId;
    const championUser = await usersRepo.findOneBy({
      [`divisions.${divisionId}.isChampion`]: true
    });
    const champion = buildChampion(divisionId, { users: championUser ? [championUser] : [] });
    res.json({ champion });
  } catch (error) {
    console.error('Error getting division champion:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Championship history for division
router.get('/:divisionId/championship-history', async (req, res) => {
  try {
    const divisionId = req.params.divisionId;
    const users = await usersRepo.findManyBy(
      { [`divisions.${divisionId}.championshipHistory`]: { $exists: true } },
      { limit: 100 }
    );
    res.json(buildChampionshipHistory(divisionId, { users }));
  } catch (error) {
    console.error('Error getting championship history:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Overview data for all divisions
router.get('/overview', async (_req, res) => {
  try {
    const db = await loadSeasonDb();
    const now = new Date();
    const stats = {};
    const champions = {};
    const titleFights = {};
    const activeFights = {};
    const championshipHistory = {};

    const divisions = getDivisionDefinitions(db).filter(
      (division) => division.seasonStatus === 'active'
    );

    for (const division of divisions) {
      const divisionId = division.id;
      const divisionQuery = { divisionId };
      const [activeTeams, totalOfficialFights, totalVotes, championUser, titles, active, historyUsers] =
        await Promise.all([
          usersRepo.countBy({ [`divisions.${divisionId}`]: { $exists: true } }),
          divisionFightsRepo.countBy(divisionQuery),
          divisionFightsRepo.sumArrayLengthBy('votes', divisionQuery),
          usersRepo.findOneBy({ [`divisions.${divisionId}.isChampion`]: true }),
          divisionFightsRepo.findManyBy(
            { divisionId, fightType: 'title', status: 'active' },
            { sort: { createdAt: -1 }, limit: 100 }
          ),
          divisionFightsRepo.findManyBy(
            { divisionId, status: 'active' },
            { sort: { createdAt: -1 }, limit: 100 }
          ),
          usersRepo.findManyBy(
            { [`divisions.${divisionId}.championshipHistory`]: { $exists: true } },
            { limit: 100 }
          )
        ]);
      stats[divisionId] = {
        activeTeams,
        totalOfficialFights,
        averageVotes: totalOfficialFights
          ? Math.round(totalVotes / totalOfficialFights)
          : 0
      };
      champions[divisionId] = buildChampion(
        divisionId,
        { users: championUser ? [championUser] : [] }
      );
      titleFights[divisionId] = titles.map((fight) => applyDivisionVoteVisibility(fight, now));
      activeFights[divisionId] = active.map((fight) => applyDivisionVoteVisibility(fight, now));
      championshipHistory[divisionId] = buildChampionshipHistory(
        divisionId,
        { users: historyUsers }
      );
    }

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
    const { page, limit } = parsePagination(req.query, { defaultLimit: 50, maxLimit: 100 });
    const now = new Date();
    const fights = await divisionFightsRepo.findManyBy({
      divisionId: req.params.divisionId,
      fightType: 'title',
      status: 'active'
    }, { sort: { createdAt: -1 }, skip: (page - 1) * limit, limit });
    const titleFights = fights
      .map((fight) => applyDivisionVoteVisibility(fight, now));
    res.json({ titleFights });
  } catch (error) {
    console.error('Error getting title fights:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Active fights for division
router.get('/:divisionId/active-fights', async (req, res) => {
  try {
    const { page, limit } = parsePagination(req.query, { defaultLimit: 50, maxLimit: 100 });
    const now = new Date();
    const fights = await divisionFightsRepo.findManyBy({
      divisionId: req.params.divisionId,
      status: 'active'
    }, { sort: { createdAt: -1 }, skip: (page - 1) * limit, limit });
    const activeFights = fights
      .map((fight) => applyDivisionVoteVisibility(fight, now));
    res.json({ activeFights });
  } catch (error) {
    console.error('Error getting active fights:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Contender matches for division
router.get('/:divisionId/contender-matches', async (req, res) => {
  try {
    const { page, limit } = parsePagination(req.query, { defaultLimit: 50, maxLimit: 100 });
    const now = new Date();
    const fights = await divisionFightsRepo.findManyBy(
      { divisionId: req.params.divisionId, fightType: 'contender' },
      { sort: { createdAt: -1 }, skip: (page - 1) * limit, limit }
    );
    const userIds = [...new Set(fights.flatMap((fight) => [
      fight.team1?.userId,
      fight.team2?.userId
    ]).filter(Boolean))];
    const users = userIds.length
      ? await usersRepo.findManyBy({ id: { $in: userIds } })
      : [];
    const userMap = new Map(users.map((user) => [resolveUserId(user), user]));

    const withChallengers = fights.map((fight) => {
      const challenger1 = fight.team1?.userId
        ? userMap.get(fight.team1.userId)
        : null;
      const challenger2 = fight.team2?.userId
        ? userMap.get(fight.team2.userId)
        : null;
      return applyDivisionVoteVisibility({
        ...fight,
        challenger1: buildChallenger(challenger1, req.params.divisionId),
        challenger2: buildChallenger(challenger2, req.params.divisionId)
      }, now);
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
    const { page, limit } = parsePagination(req.query, { defaultLimit: 50, maxLimit: 100 });
    const users = await usersRepo.findManyBy(
      { [`divisions.${req.params.divisionId}`]: { $exists: true } },
      { sort: { username: 1 }, skip: (page - 1) * limit, limit }
    );
    const members = users.map((user) => ({
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

    await withRepositoryTransaction(async (context) => {
      const season = getSeasonById(await loadSeasonDb(context), req.params.divisionId);
      if (!season || getSeasonStatus(season) !== 'active') {
        const error = new Error('Division is locked');
        error.code = 'DIVISION_LOCKED';
        throw error;
      }

      const champion = await usersRepo.findOneBy({
        [`divisions.${req.params.divisionId}.isChampion`]: true
      }, {}, context);
      if (!champion) {
        const error = new Error('No champion found for this division');
        error.code = 'NO_CHAMPION';
        throw error;
      }

      const challenger = await usersRepo.findById(challengerId, context);
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

      const author = buildAuthor(await usersRepo.findById(req.user.id, context));
      createdFight = buildDivisionFight({
        divisionId: req.params.divisionId,
        fightType: 'title',
        team1,
        team2,
        description,
        createdBy: author,
        voteVisibility: req.body.voteVisibility
      });

      await divisionFightsRepo.insert(createdFight, context);
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
    if (error.code === 'DIVISION_LOCKED') {
      return res.status(403).json({ msg: error.message });
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

    await withRepositoryTransaction(async (context) => {
      const season = getSeasonById(await loadSeasonDb(context), req.params.divisionId);
      if (!season || getSeasonStatus(season) !== 'active') {
        const error = new Error('Division is locked');
        error.code = 'DIVISION_LOCKED';
        throw error;
      }

      const challenger1 = await usersRepo.findById(challenger1Id, context);
      const challenger2 = await usersRepo.findById(challenger2Id, context);
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

      const author = buildAuthor(await usersRepo.findById(req.user.id, context));
      createdFight = buildDivisionFight({
        divisionId: req.params.divisionId,
        fightType: 'contender',
        team1,
        team2,
        description,
        createdBy: author,
        voteVisibility: req.body.voteVisibility
      });

      await divisionFightsRepo.insert(createdFight, context);
    });

    res.json({ msg: 'Contender match created', fight: createdFight });
  } catch (error) {
    if (error.code === 'CHALLENGER_NOT_FOUND') {
      return res.status(404).json({ msg: error.message });
    }
    if (error.code === 'TEAM_NOT_FOUND') {
      return res.status(400).json({ msg: error.message });
    }
    if (error.code === 'DIVISION_LOCKED') {
      return res.status(403).json({ msg: error.message });
    }
    console.error('Error creating contender match:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Register team (DivisionSystem)
router.post('/register-team', auth, async (req, res) => {
  try {
    const { divisionId, fighters } = req.body;
    const userId = req.user.id;
    if (!divisionId || !Array.isArray(fighters) || fighters.length < 2) {
      return res.status(400).json({ msg: 'Invalid team data' });
    }

    await withRepositoryTransaction(async (context) => {
      const season = getSeasonById(await loadSeasonDb(context), divisionId);
      if (!season || getSeasonStatus(season) !== 'active') {
        const error = new Error('Division is locked');
        error.code = 'DIVISION_LOCKED';
        throw error;
      }

      const user = await usersRepo.findById(userId, context);
      if (!user) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      const team = normalizeTeam({ fighters });
      const selectedIds = [...new Set(fighters.map(getCharacterId).filter(Boolean))];
      await reserveDivisionTeam(divisionId, userId, selectedIds, context);
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
      await usersRepo.updateById(user.id, () => user, context);
    });

    res.json({ msg: 'Team registered' });
  } catch (error) {
    if (error.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ msg: 'User not found' });
    }
    if (error.code === 'DIVISION_LOCKED') {
      return res.status(403).json({ msg: error.message });
    }
    if (error.code === 'CHARACTER_TAKEN') {
      return res.status(400).json({ msg: error.message });
    }
    console.error('Error registering team:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Create fight (DivisionSystem)
router.post('/create-fight', [auth, moderatorAuth], async (req, res) => {
  try {
    const { team1, team2, divisionId, isTitle, duration } = req.body;
    if (!team1 || !team2 || !divisionId) {
      return res.status(400).json({ msg: 'Missing fight data' });
    }

    const fightType = isTitle ? 'title' : 'official';
    let createdFight;

    await withRepositoryTransaction(async (context) => {
      const season = getSeasonById(await loadSeasonDb(context), divisionId);
      if (!season || getSeasonStatus(season) !== 'active') {
        const error = new Error('Division is locked');
        error.code = 'DIVISION_LOCKED';
        throw error;
      }

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
        createdBy: req.user.id,
        durationHours: duration,
        voteVisibility: req.body.voteVisibility
      });

      await divisionFightsRepo.insert(createdFight, context);
    });

    res.json({ msg: 'Fight created', fight: createdFight });
  } catch (error) {
    if (error.code === 'INVALID_TEAM') {
      return res.status(400).json({ msg: error.message });
    }
    if (error.code === 'DIVISION_LOCKED') {
      return res.status(403).json({ msg: error.message });
    }
    console.error('Error creating fight:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Create official fight (PowerTierDivisions)
router.post('/create-official-fight', [auth, moderatorAuth], async (req, res) => {
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

    await withRepositoryTransaction(async (context) => {
      const season = getSeasonById(await loadSeasonDb(context), divisionId);
      if (!season || getSeasonStatus(season) !== 'active') {
        const error = new Error('Division is locked');
        error.code = 'DIVISION_LOCKED';
        throw error;
      }

      const user1 = await usersRepo.findById(team1Id, context);
      const user2 = await usersRepo.findById(team2Id, context);
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
        createdBy: req.user.id,
        durationHours: fightDuration,
        bettingPeriodHours: bettingPeriod,
        voteVisibility: req.body.voteVisibility
      });

      await divisionFightsRepo.insert(createdFight, context);
    });

    res.json({ msg: 'Official fight created', fight: createdFight });
  } catch (error) {
    if (error.code === 'TEAM_NOT_FOUND') {
      return res.status(400).json({ msg: error.message });
    }
    if (error.code === 'DIVISION_LOCKED') {
      return res.status(403).json({ msg: error.message });
    }
    console.error('Error creating official fight:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Lock expired fights (moderator panel helper)
router.post('/lock-expired-fights', [auth, moderatorAuth], async (_req, res) => {
  try {
    const now = new Date();
    let lockedCount = 0;

    const result = await divisionFightsRepo.patchManyBy(
      { status: 'active', endTime: { $lt: now.toISOString() } },
      { status: 'locked', 'fight.status': 'locked' }
    );
    lockedCount = result.matchedCount;

    res.json({ msg: 'Expired fights locked', lockedCount });
  } catch (error) {
    console.error('Error locking expired fights:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

export default router;
export { runSeasonScheduler as runDivisionSeasonScheduler };

