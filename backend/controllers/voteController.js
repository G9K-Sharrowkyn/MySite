import { v4 as uuidv4 } from 'uuid';
import { readDb, updateDb } from '../services/jsonDb.js';

const resolveUserId = (user) => user?.id || user?._id;

const resolveVoteTeam = (choice) => {
  if (['fighter1', 'teamA', 'A'].includes(choice)) return 'A';
  if (['fighter2', 'teamB', 'B'].includes(choice)) return 'B';
  if (choice === 'draw') return 'draw';
  return null;
};

const findFightById = (db, fightId) =>
  (db.fights || []).find((entry) => entry.id === fightId);

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

    await updateDb((db) => {
      const fight = findFightById(db, fightId);
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

      db.votes = Array.isArray(db.votes) ? db.votes : [];
      const existing = db.votes.find(
        (voteEntry) =>
          voteEntry.fightId === fightId && voteEntry.userId === req.user.id
      );

      if (existing) {
        existing.team = team;
        existing.updatedAt = new Date().toISOString();
        storedVote = existing;
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
        db.votes.push(storedVote);
      }

      return db;
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
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get user's vote for a fight
// @route   GET /api/votes/fight/:fightId/user
// @access  Private
export const getUserVote = async (req, res) => {
  try {
    const db = await readDb();
    const voteEntry = (db.votes || []).find(
      (vote) => vote.fightId === req.params.fightId && vote.userId === req.user.id
    );

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
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get vote statistics for a fight
// @route   GET /api/votes/fight/:fightId/stats
// @access  Public
export const getFightVoteStats = async (req, res) => {
  try {
    const db = await readDb();
    const { teamAVotes, teamBVotes, totalVotes } = countFightVotes(
      db.votes || [],
      req.params.fightId
    );

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
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Remove vote
// @route   DELETE /api/votes/fight/:fightId
// @access  Private
export const removeVote = async (req, res) => {
  try {
    await updateDb((db) => {
      const fight = findFightById(db, req.params.fightId);
      if (fight && fight.status !== 'active') {
        const error = new Error('Fight is not active');
        error.code = 'FIGHT_INACTIVE';
        throw error;
      }

      const before = (db.votes || []).length;
      db.votes = (db.votes || []).filter(
        (voteEntry) =>
          !(voteEntry.fightId === req.params.fightId && voteEntry.userId === req.user.id)
      );

      if (before === db.votes.length) {
        const error = new Error('Vote not found');
        error.code = 'VOTE_NOT_FOUND';
        throw error;
      }

      return db;
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
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get all votes by user
// @route   GET /api/votes/user/me
// @access  Private
export const getUserVotes = async (req, res) => {
  try {
    const db = await readDb();
    const userVotes = (db.votes || []).filter(
      (voteEntry) => voteEntry.userId === req.user.id
    );

    const fightsById = new Map((db.fights || []).map((fight) => [fight.id, fight]));

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
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
