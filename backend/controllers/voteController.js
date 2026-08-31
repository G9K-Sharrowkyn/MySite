import { v4 as uuidv4 } from 'uuid';
import {
  fightsRepo,
  usersRepo,
  votesRepo,
  withRepositoryTransaction
} from '../repositories/index.js';
import { parsePagination } from '../utils/pagination.js';

const resolveUserId = (user) => user?.id || user?._id;

const resolveVoteTeam = (choice) => {
  if (['fighter1', 'teamA', 'A'].includes(choice)) return 'A';
  if (['fighter2', 'teamB', 'B'].includes(choice)) return 'B';
  if (choice === 'draw') return 'draw';
  return null;
};

const countFightVotes = (votes, fightId) => {
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

// @desc    Vote on a fight
// @route   POST /api/votes
// @access  Private
export const vote = async (req, res) => {
  try {
    const { fightId, choice } = req.body;

    const team = resolveVoteTeam(choice);
    if (!fightId || !team) {
      return res.status(400).json({ msg: 'Invalid vote payload.' });
    }

    let storedVote;

    await withRepositoryTransaction(async (context) => {
      const fight = await fightsRepo.findById(fightId, context);
      if (!fight) {
        const error = new Error('Fight not found');
        error.code = 'FIGHT_NOT_FOUND';
        throw error;
      }

      if (fight.status !== 'active') {
        const error = new Error('Fight is not active');
        error.code = 'FIGHT_INACTIVE';
        throw error;
      }

      const existing = await votesRepo.findOneBy(
        { fightId, userId: req.user.id },
        {},
        context
      );

      if (existing) {
        storedVote = await votesRepo.updateById(existing.id, (entry) => {
          entry.team = team;
          entry.updatedAt = new Date().toISOString();
          return entry;
        }, context);
      } else {
        const now = new Date().toISOString();
        storedVote = {
          id: uuidv4(),
          fightId,
          userId: req.user.id,
          team,
          ip: req.ip,
          userAgent: req.get('user-agent') || '',
          createdAt: now,
          updatedAt: now
        };
        const result = await votesRepo.insertIfAbsent(
          { fightId, userId: req.user.id },
          storedVote,
          context
        );
        storedVote = result.item;

        // Update user stats for new votes only
        if (result.inserted) {
          await usersRepo.updateById(req.user.id, (user) => {
              if (!user.stats) user.stats = {};
              user.stats.votes = (user.stats.votes || 0) + 1;
              return user;
            }, context);
        }
      }
    });

    res.json({ msg: 'Vote recorded', vote: storedVote });
  } catch (error) {
    if (error.code === 'FIGHT_NOT_FOUND') {
      return res.status(404).json({ msg: 'Fight not found' });
    }
    if (error.code === 'FIGHT_INACTIVE') {
      return res.status(400).json({ msg: 'Fight is not active' });
    }
    console.error('Error processing vote:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get user's vote for a fight
// @route   GET /api/votes/fight/:fightId/user
// @access  Private
export const getUserVote = async (req, res) => {
  try {
    const voteEntry = await votesRepo.findOneBy({
      fightId: req.params.fightId,
      userId: req.user.id
    });

    if (!voteEntry) {
      return res.status(404).json({ msg: 'Vote not found' });
    }

    res.json({
      ...voteEntry,
      choice:
        voteEntry.team === 'A'
          ? 'fighter1'
          : voteEntry.team === 'B'
          ? 'fighter2'
          : voteEntry.team
    });
  } catch (error) {
    console.error('Error fetching user vote:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get vote statistics for a fight
// @route   GET /api/votes/fight/:fightId/stats
// @access  Public
export const getFightVoteStats = async (req, res) => {
  try {
    const fightId = req.params.fightId;
    const [teamCounts, totalVotes] = await Promise.all([
      votesRepo.groupCountBy('team', { fightId }),
      votesRepo.countBy({ fightId })
    ]);
    const teamAVotes = ['A', 'teamA', 'fighter1']
      .reduce((sum, key) => sum + (teamCounts[key] || 0), 0);
    const teamBVotes = ['B', 'teamB', 'fighter2']
      .reduce((sum, key) => sum + (teamCounts[key] || 0), 0);

    const fighter1Percentage =
      totalVotes > 0 ? ((teamAVotes / totalVotes) * 100).toFixed(1) : 0;
    const fighter2Percentage =
      totalVotes > 0 ? ((teamBVotes / totalVotes) * 100).toFixed(1) : 0;

    res.json({
      fighter1Votes: teamAVotes,
      fighter2Votes: teamBVotes,
      teamAVotes,
      teamBVotes,
      totalVotes,
      fighter1Percentage: parseFloat(fighter1Percentage),
      fighter2Percentage: parseFloat(fighter2Percentage)
    });
  } catch (error) {
    console.error('Error fetching vote stats:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Remove vote
// @route   DELETE /api/votes/fight/:fightId
// @access  Private
export const removeVote = async (req, res) => {
  try {
    await withRepositoryTransaction(async (context) => {
      const fight = await fightsRepo.findById(req.params.fightId, context);
      if (fight && fight.status !== 'active') {
        const error = new Error('Fight is not active');
        error.code = 'FIGHT_INACTIVE';
        throw error;
      }

      const existing = await votesRepo.findOneBy(
        { fightId: req.params.fightId, userId: req.user.id },
        {},
        context
      );
      if (!existing) {
        const error = new Error('Vote not found');
        error.code = 'VOTE_NOT_FOUND';
        throw error;
      }
      await votesRepo.removeById(existing.id, context);
    });

    res.json({ msg: 'Vote removed' });
  } catch (error) {
    if (error.code === 'VOTE_NOT_FOUND') {
      return res.status(404).json({ msg: 'Vote not found' });
    }
    if (error.code === 'FIGHT_INACTIVE') {
      return res.status(400).json({ msg: 'Fight is not active' });
    }
    console.error('Error removing vote:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all votes by user
// @route   GET /api/votes/user/me
// @access  Private
export const getUserVotes = async (req, res) => {
  try {
    const { page, limit } = parsePagination(req.query, {
      defaultLimit: 50,
      maxLimit: 100
    });
    const userVotes = await votesRepo.findManyBy(
      { userId: req.user.id },
      { sort: { createdAt: -1 }, skip: (page - 1) * limit, limit }
    );
    const fightIds = [...new Set(userVotes.map((entry) => entry.fightId).filter(Boolean))];
    const fightsById = new Map(
      (fightIds.length
        ? await fightsRepo.findManyBy({ id: { $in: fightIds } }, { limit: fightIds.length })
        : []).map((fight) => [fight.id, fight])
    );

    const votesWithFights = userVotes.map((voteEntry) => {
      const fight = fightsById.get(voteEntry.fightId);
      return {
        ...voteEntry,
        fight: fight
          ? {
              id: fight.id,
              title: fight.title,
              fighter1: fight.fighter1 || fight.teamA?.[0]?.characterName || 'Fighter 1',
              fighter2: fight.fighter2 || fight.teamB?.[0]?.characterName || 'Fighter 2',
              status: fight.status,
              winner: fight.result?.winner || fight.winner
            }
          : null
      };
    });

    res.json(votesWithFights);
  } catch (error) {
    console.error('Error fetching user votes:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};
