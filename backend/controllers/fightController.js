import { v4 as uuidv4 } from 'uuid';
import {
  commentsRepo,
  fightsRepo,
  usersRepo,
  votesRepo,
  withRepositoryTransaction
} from '../repositories/index.js';
import { syncRankFromPoints } from '../utils/rankSystem.js';
import { parsePagination } from '../utils/pagination.js';

const resolveUserId = (user) => user?.id || user?._id;

const findUserById = (users, userId) =>
  (users || []).find((entry) => resolveUserId(entry) === userId);

const getTeamDisplayName = (team) => {
  if (!team) return '';
  if (typeof team === 'string') return team;
  if (Array.isArray(team)) {
    return team
      .map((entry) => entry?.characterName || entry?.name || entry)
      .filter(Boolean)
      .join(', ');
  }
  return team.characterName || team.name || '';
};

const getTeamPrimary = (team) => {
  if (!team) return null;
  if (Array.isArray(team)) return team[0] || null;
  if (typeof team === 'object') return team;
  return null;
};

const countVotesForFight = (votes, fightId) => {
  const fightVotes = votes.filter((vote) => vote.fightId === fightId);
  const teamAVotes = fightVotes.filter((vote) =>
    ['A', 'teamA', 'fighter1'].includes(vote.team)
  ).length;
  const teamBVotes = fightVotes.filter((vote) =>
    ['B', 'teamB', 'fighter2'].includes(vote.team)
  ).length;

  return {
    teamAVotes,
    teamBVotes,
    totalVotes: fightVotes.length
  };
};

const normalizeFight = (fight, context = {}) => {
  const users = context.users || [];
  const votes = context.votes || [];
  const creator = findUserById(users, fight.createdBy);
  const teamAName = fight.fighter1 || getTeamDisplayName(fight.teamA);
  const teamBName = fight.fighter2 || getTeamDisplayName(fight.teamB);
  const teamAPrimary = getTeamPrimary(fight.teamA);
  const teamBPrimary = getTeamPrimary(fight.teamB);
  const fighter1Image =
    fight.fighter1Image ||
    teamAPrimary?.characterImage ||
    teamAPrimary?.image ||
    '';
  const fighter2Image =
    fight.fighter2Image ||
    teamBPrimary?.characterImage ||
    teamBPrimary?.image ||
    '';
  const endDate = fight.endDate || fight.timer?.endTime || null;

  const { teamAVotes, teamBVotes, totalVotes } = countVotesForFight(
    votes,
    fight.id
  );

  return {
    ...fight,
    id: fight.id,
    fighter1: teamAName,
    fighter2: teamBName,
    fighter1Image,
    fighter2Image,
    endDate,
    createdByUsername: creator ? creator.username : 'Nieznany',
    votes: {
      fighter1: teamAVotes,
      fighter2: teamBVotes,
      teamA: teamAVotes,
      teamB: teamBVotes,
      total: totalVotes
    },
    votesA: teamAVotes,
    votesB: teamBVotes
  };
};

// @desc    Create a new fight
// @route   POST /api/fights
// @access  Private (Moderator only for main fights, users for feed fights)
export const createFight = async (req, res) => {
  try {
    const {
      title,
      description,
      fighter1,
      fighter2,
      fighter1Image,
      fighter2Image,
      category,
      type = 'feed',
      endDate,
      teamA,
      teamB
    } = req.body;

    const teamAData =
      teamA && Array.isArray(teamA)
        ? teamA
        : [
            {
              characterId: fighter1,
              characterName: fighter1,
              characterImage: fighter1Image || 'https://via.placeholder.com/150'
            }
          ];

    const teamBData =
      teamB && Array.isArray(teamB)
        ? teamB
        : [
            {
              characterId: fighter2,
              characterName: fighter2,
              characterImage: fighter2Image || 'https://via.placeholder.com/150'
            }
          ];

    const now = new Date();
    let createdFight;
    let creator;

    await withRepositoryTransaction(async (context) => {
      const user = await usersRepo.findById(req.user.id, context);
      if (!user) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      if (type === 'main' && user.role !== 'moderator') {
        const error = new Error('Access denied');
        error.code = 'ACCESS_DENIED';
        throw error;
      }

      const fight = {
        id: uuidv4(),
        title,
        description,
        teamA: teamAData,
        teamB: teamBData,
        category,
        type,
        createdBy: req.user.id,
        status: 'active',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        endDate: endDate ? new Date(endDate).toISOString() : null,
        timer: {
          duration: 168,
          startTime: now.toISOString(),
          endTime: endDate
            ? new Date(endDate).toISOString()
            : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          autoLock: true
        },
        isOfficial: type === 'main',
        moderatorCreated: user.role === 'moderator',
        result: {
          winner: null,
          finishedAt: null,
          finalVotesA: 0,
          finalVotesB: 0,
          method: null
        }
      };

      await fightsRepo.insert(fight, context);
      createdFight = fight;
      creator = user;
    });

    res.json({
      msg: 'Fight created',
      fight: normalizeFight(createdFight, { users: creator ? [creator] : [] })
    });
  } catch (error) {
    if (error.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ msg: 'User not found' });
    }
    if (error.code === 'ACCESS_DENIED') {
      return res
        .status(403)
        .json({ msg: 'Only moderators can create main fights.' });
    }
    console.error('Error creating fight:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Get all fights
// @route   GET /api/fights
// @access  Public
export const getFights = async (req, res) => {
  try {
    const { type, category, status } = req.query;
    const { page: pageNumber, limit: limitNumber } = parsePagination(req.query, {
      defaultLimit: 10,
      maxLimit: 50
    });
    const query = {
      ...(type === 'main' ? { isOfficial: true } : {}),
      ...(type === 'feed' ? { isOfficial: { $ne: true } } : {}),
      ...(category ? { category } : {}),
      ...(status ? { status } : {})
    };
    const [fights, totalFights] = await Promise.all([
      fightsRepo.findManyBy(query, {
        sort: { createdAt: -1 },
        skip: (pageNumber - 1) * limitNumber,
        limit: limitNumber
      }),
      fightsRepo.countBy(query)
    ]);
    const fightIds = fights.map((fight) => fight.id);
    const creatorIds = [...new Set(fights.map((fight) => fight.createdBy).filter(Boolean))];
    const [users, votes] = await Promise.all([
      creatorIds.length
        ? usersRepo.findManyBy({ id: { $in: creatorIds } }, { limit: creatorIds.length })
        : [],
      fightIds.length
        ? votesRepo.findManyBy({ fightId: { $in: fightIds } })
        : []
    ]);

    res.json({
      fights: fights.map((fight) => normalizeFight(fight, { users, votes })),
      pagination: {
        currentPage: pageNumber,
        totalPages: Math.ceil(totalFights / limitNumber) || 1,
        totalFights,
        hasNext: pageNumber * limitNumber < totalFights,
        hasPrev: pageNumber > 1
      }
    });
  } catch (error) {
    console.error('Error getting fights:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Get single fight
// @route   GET /api/fights/:id
// @access  Public
export const getFight = async (req, res) => {
  try {
    const fight = await fightsRepo.findById(req.params.id);
    if (!fight) {
      return res.status(404).json({ msg: 'Fight not found' });
    }

    const [users, votes, comments] = await Promise.all([
      fight.createdBy ? usersRepo.findManyBy({ id: fight.createdBy }, { limit: 1 }) : [],
      votesRepo.findManyBy({ fightId: fight.id }),
      commentsRepo.findManyBy(
        { type: 'fight', fightId: fight.id },
        { sort: { createdAt: -1 }, limit: 200 }
      )
    ]);

    res.json({ ...normalizeFight(fight, { users, votes }), comments });
  } catch (error) {
    console.error('Error getting fight:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Update fight (moderator only)
// @route   PUT /api/fights/:id
// @access  Private (Moderator only)
export const updateFight = async (req, res) => {
  try {
    let updatedFight;

    await withRepositoryTransaction(async (context) => {
      const user = await usersRepo.findById(req.user.id, context);
      if (!user || user.role !== 'moderator') {
        const error = new Error('Access denied');
        error.code = 'ACCESS_DENIED';
        throw error;
      }

      const fight = await fightsRepo.findById(req.params.id, context);
      if (!fight) {
        const error = new Error('Fight not found');
        error.code = 'FIGHT_NOT_FOUND';
        throw error;
      }

      const { title, description, status, winner, endDate } = req.body;

      if (title !== undefined) fight.title = title;
      if (description !== undefined) fight.description = description;
      if (status !== undefined) fight.status = status;
      if (winner) {
        fight.result = fight.result || {};
        fight.result.winner = winner;
        fight.result.finishedAt = new Date().toISOString();
      }
      if (endDate) {
        fight.endDate = new Date(endDate).toISOString();
        fight.timer = fight.timer || {};
        fight.timer.endTime = fight.endDate;
      }

      fight.updatedAt = new Date().toISOString();
      updatedFight = await fightsRepo.updateById(req.params.id, () => fight, context);
    });

    res.json({ msg: 'Fight updated', fight: updatedFight });
  } catch (error) {
    if (error.code === 'ACCESS_DENIED') {
      return res.status(403).json({ msg: 'Access denied' });
    }
    if (error.code === 'FIGHT_NOT_FOUND') {
      return res.status(404).json({ msg: 'Fight not found' });
    }
    console.error('Error updating fight:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Delete fight (moderator only)
// @route   DELETE /api/fights/:id
// @access  Private (Moderator only)
export const deleteFight = async (req, res) => {
  try {
    await withRepositoryTransaction(async (context) => {
      const user = await usersRepo.findById(req.user.id, context);
      if (!user || user.role !== 'moderator') {
        const error = new Error('Access denied');
        error.code = 'ACCESS_DENIED';
        throw error;
      }

      const fight = await fightsRepo.findById(req.params.id, context);
      if (!fight) {
        const error = new Error('Fight not found');
        error.code = 'FIGHT_NOT_FOUND';
        throw error;
      }

      const fightId = fight.id;
      await fightsRepo.removeById(fightId, context);
      await votesRepo.removeManyBy({ fightId }, context);
      await commentsRepo.removeManyBy({ fightId }, context);
    });

    res.json({ msg: 'Fight deleted' });
  } catch (error) {
    if (error.code === 'ACCESS_DENIED') {
      return res.status(403).json({ msg: 'Access denied' });
    }
    if (error.code === 'FIGHT_NOT_FOUND') {
      return res.status(404).json({ msg: 'Fight not found' });
    }
    console.error('Error deleting fight:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Get fight categories
// @route   GET /api/fights/categories
// @access  Public
export const getCategories = async (_req, res) => {
  const categories = [
    'Anime',
    'Marvel',
    'DC',
    'Gaming',
    'Movies',
    'TV Shows',
    'Books',
    'Mythology',
    'History',
    'Mixed'
  ];

  res.json(categories);
};

// @desc    End fight and determine winner (moderator only)
// @route   POST /api/fights/:id/end
// @access  Private (Moderator only)
export const endFight = async (req, res) => {
  try {
    let updatedFight;

    await withRepositoryTransaction(async (context) => {
      const user = await usersRepo.findById(req.user.id, context);
      if (!user || user.role !== 'moderator') {
        const error = new Error('Access denied');
        error.code = 'ACCESS_DENIED';
        throw error;
      }

      const fight = await fightsRepo.findById(req.params.id, context);
      if (!fight) {
        const error = new Error('Fight not found');
        error.code = 'FIGHT_NOT_FOUND';
        throw error;
      }

      if (fight.status === 'ended') {
        const error = new Error('Fight already ended');
        error.code = 'FIGHT_ALREADY_ENDED';
        throw error;
      }
      const votes = await votesRepo.findManyBy({ fightId: fight.id }, {}, context);
      const { teamAVotes, teamBVotes } = countVotesForFight(votes, fight.id);

      let winner = 'draw';
      if (teamAVotes > teamBVotes) winner = 'A';
      if (teamBVotes > teamAVotes) winner = 'B';

      fight.status = 'ended';
      fight.result = fight.result || {};
      fight.result.winner = winner;
      fight.result.finishedAt = new Date().toISOString();
      fight.result.finalVotesA = teamAVotes;
      fight.result.finalVotesB = teamBVotes;
      fight.result.method = 'moderator';
      fight.updatedAt = new Date().toISOString();

      updatedFight = await fightsRepo.updateById(fight.id, () => fight, context);

      for (const participant of Array.isArray(fight.participants) ? fight.participants : []) {
        await usersRepo.updateById(participant.userId, (participantUser) => {
          participantUser.stats = participantUser.stats || {};
          participantUser.stats.fights = participantUser.stats.fights || {
            total: 0,
            wins: 0,
            losses: 0,
            winRate: 0
          };
          participantUser.stats.fights.total += 1;
          const participantTeam = participant.team || participant.side;
          const wonFight =
            (winner === 'A' && ['A', 'teamA', 'fighter1'].includes(participantTeam)) ||
            (winner === 'B' && ['B', 'teamB', 'fighter2'].includes(participantTeam));
          if (winner !== 'draw' && wonFight) participantUser.stats.fights.wins += 1;
          if (winner !== 'draw' && !wonFight) participantUser.stats.fights.losses += 1;
          participantUser.stats.fights.winRate = Math.round(
            (participantUser.stats.fights.wins / participantUser.stats.fights.total) * 100
          );
          return participantUser;
        }, context);
      }

      // Award points to users who voted correctly
      if (winner !== 'draw') {
        const correctVoterIds = [...new Set(
          votes
            .filter((vote) =>
              (winner === 'A' && ['A', 'teamA', 'fighter1'].includes(vote.team)) ||
              (winner === 'B' && ['B', 'teamB', 'fighter2'].includes(vote.team))
            )
            .map((vote) => vote.userId)
            .filter(Boolean)
        )];
        for (const voterId of correctVoterIds) {
          await usersRepo.updateById(voterId, (votedUser) => {
              votedUser.stats = votedUser.stats || {};
              votedUser.stats.points = (votedUser.stats.points || 0) + 10;
              syncRankFromPoints(votedUser);
              return votedUser;
          }, context);
        }
      }
    });

    res.json({ msg: 'Fight ended', fight: updatedFight });
  } catch (error) {
    if (error.code === 'ACCESS_DENIED') {
      return res.status(403).json({ msg: 'Access denied' });
    }
    if (error.code === 'FIGHT_NOT_FOUND') {
      return res.status(404).json({ msg: 'Fight not found' });
    }
    if (error.code === 'FIGHT_ALREADY_ENDED') {
      return res.status(409).json({ msg: 'Fight already ended' });
    }
    console.error('Error ending fight:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};
