import express from 'express';
import { createFight, getFights, getFight, updateFight, deleteFight, endFight, getCategories } from '../controllers/fightController.js';
import auth from '../middleware/auth.js';
import {
  commentsRepo,
  fightsRepo,
  usersRepo,
  votesRepo,
  withRepositoryTransaction
} from '../repositories/index.js';
import { v4 as uuidv4 } from 'uuid';
import { applyDailyActivityBonusAtomic } from '../utils/coinBonus.js';
import { commentValidation } from '../middleware/validation.js';

const router = express.Router();

const resolveUserId = (user) => user?.id || user?._id;

const findUserById = (db, userId) =>
  (db.users || []).find((entry) => resolveUserId(entry) === userId);

const mapVoteChoice = (choice) => {
  if (['character1', 'fighter1', 'A', 'teamA'].includes(choice)) return 'A';
  if (['character2', 'fighter2', 'B', 'teamB'].includes(choice)) return 'B';
  return null;
};

const buildRecentVoters = (db, fightId, limit = 10) => {
  const votes = (db.votes || [])
    .filter((vote) => vote.fightId === fightId)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, limit);

  return votes.map((vote) => {
    const user = findUserById(db, vote.userId);
    return {
      id: vote.userId,
      username: user?.username || 'User',
      avatar: user?.profile?.profilePicture || user?.profile?.avatar || '',
      choice: vote.team === 'A' ? 'character1' : 'character2',
      timestamp: vote.createdAt
    };
  });
};

const buildFightComments = (db, fightId) => {
  const comments = (db.comments || [])
    .filter((comment) => comment.type === 'fight' && comment.fightId === fightId)
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

  return comments.map((comment) => {
    const author = findUserById(db, comment.authorId || comment.userId);
    return {
      id: comment.id || comment._id,
      content: comment.content || comment.text || '',
      createdAt: comment.createdAt,
      likes: comment.likes || 0,
      user: {
        id: author ? resolveUserId(author) : comment.authorId || comment.userId,
        username: comment.authorUsername || author?.username || 'User',
        avatar: comment.authorAvatar || author?.profile?.profilePicture || author?.profile?.avatar || '',
        isModerator: author?.role === 'moderator'
      }
    };
  });
};

// @route   GET api/fights
// @desc    Get all fights
// @access  Public
router.get('/', getFights);

// @route   GET api/fights/categories
// @desc    Get fight categories
// @access  Public
router.get('/categories', getCategories);

// @route   POST api/fights
// @desc    Create a new fight
// @access  Private
router.post('/', auth, createFight);

// @route   GET api/fights/:id
// @desc    Get fight by ID
// @access  Public
router.get('/:id', getFight);

// @route   PUT api/fights/:id
// @desc    Update fight
// @access  Private
router.put('/:id', auth, updateFight);

// @route   DELETE api/fights/:id
// @desc    Delete fight
// @access  Private
router.delete('/:id', auth, deleteFight);

// @route   POST api/fights/:id/vote
// @desc    Vote on a fight
// @access  Private
// @route   GET api/fights/:id/votes
// @desc    Get vote stats for fight (VotingSystem)
// @access  Public
router.get('/:id/votes', async (req, res) => {
  try {
    const fightId = req.params.id;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const [teamCounts, totalVotes, hourlyVotes, recentVotes] = await Promise.all([
      votesRepo.groupCountBy('team', { fightId }),
      votesRepo.countBy({ fightId }),
      votesRepo.countBy({ fightId, createdAt: { $gte: oneHourAgo } }),
      votesRepo.findManyBy({ fightId }, { sort: { createdAt: -1 }, limit: 10 })
    ]);
    const character1Votes = teamCounts.A || 0;
    const character2Votes = teamCounts.B || 0;
    const voterIds = [...new Set(recentVotes.map((vote) => vote.userId).filter(Boolean))];
    const users = voterIds.length
      ? await usersRepo.findManyBy({ id: { $in: voterIds } }, { limit: voterIds.length })
      : [];

    res.json({
      character1Votes,
      character2Votes,
      totalVotes,
      hourlyVotes,
      recentVoters: buildRecentVoters({ votes: recentVotes, users }, fightId)
    });
  } catch (error) {
    console.error('Error fetching fight votes:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET api/fights/:id/user-vote/:userId
// @desc    Get user vote for fight (VotingSystem)
// @access  Public
router.get('/:id/user-vote/:userId', auth, async (req, res) => {
  try {
    if (req.params.userId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const vote = await votesRepo.findOneBy({
      fightId: req.params.id,
      userId: req.params.userId
    });

    if (!vote) {
      return res.json({ vote: null });
    }

    res.json({ vote: vote.team === 'A' ? 'character1' : 'character2' });
  } catch (error) {
    console.error('Error fetching user vote:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST api/fights/:id/vote
// @desc    Vote on fight (VotingSystem)
// @access  Public
router.post('/:id/vote', auth, async (req, res) => {
  try {
    const { characterChoice } = req.body || {};
    const userId = req.user.id;
    const choice = mapVoteChoice(characterChoice);
    if (!userId || !choice) {
      return res.status(400).json({ message: 'Invalid vote data' });
    }

    let storedVote;

    await withRepositoryTransaction(async (context) => {
      const fight = await fightsRepo.findById(req.params.id, context);
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
        { fightId: req.params.id, userId },
        {},
        context
      );
      if (existing) {
        const error = new Error('Already voted');
        error.code = 'ALREADY_VOTED';
        throw error;
      }

      storedVote = {
        id: uuidv4(),
        fightId: req.params.id,
        userId,
        team: choice,
        createdAt: new Date().toISOString()
      };

      const result = await votesRepo.insertIfAbsent(
        { fightId: req.params.id, userId },
        storedVote,
        context
      );
      if (!result.inserted) {
        const error = new Error('Already voted');
        error.code = 'ALREADY_VOTED';
        throw error;
      }
      storedVote = result.item;
    });

    res.json({ vote: storedVote });
  } catch (error) {
    if (error.code === 'ALREADY_VOTED') {
      return res.status(400).json({ message: 'You have already voted' });
    }
    if (error.code === 'FIGHT_NOT_FOUND') {
      return res.status(404).json({ message: 'Fight not found' });
    }
    if (error.code === 'FIGHT_INACTIVE') {
      return res.status(400).json({ message: 'Fight is not active' });
    }
    console.error('Error voting on fight:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET api/fights/:id/comments
// @desc    Get comments for fight (VotingSystem)
// @access  Public
router.get('/:id/comments', async (req, res) => {
  try {
    const comments = await commentsRepo.findManyBy(
      { type: 'fight', fightId: req.params.id },
      { sort: { createdAt: 1 }, limit: 200 }
    );
    const authorIds = [...new Set(comments.map((comment) =>
      comment.authorId || comment.userId
    ).filter(Boolean))];
    const users = authorIds.length
      ? await usersRepo.findManyBy({ id: { $in: authorIds } }, { limit: authorIds.length })
      : [];
    res.json(buildFightComments({ comments, users }, req.params.id));
  } catch (error) {
    console.error('Error fetching fight comments:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST api/fights/:id/comments
// @desc    Add comment to fight (VotingSystem)
// @access  Public
router.post('/:id/comments', auth, commentValidation, async (req, res) => {
  try {
    const { content } = req.body || {};
    const userId = req.user.id;
    if (!content) {
      return res.status(400).json({ message: 'Invalid comment data' });
    }

    let created;
    await withRepositoryTransaction(async (context) => {
      const author = await usersRepo.findById(userId, context);
      const now = new Date().toISOString();
      created = {
        id: uuidv4(),
        type: 'fight',
        fightId: req.params.id,
        authorId: userId,
        authorUsername: author?.username || 'User',
        authorAvatar: author?.profile?.profilePicture || author?.profile?.avatar || '',
        content: content.trim(),
        text: content.trim(),
        createdAt: now,
        updatedAt: now,
        likes: 0,
        likedBy: []
      };

      await commentsRepo.insert(created, context);
      if (author) {
        await applyDailyActivityBonusAtomic(userId, 'comment', 50, context);
      }
    });

    res.status(201).json({
      id: created.id,
      content: created.content,
      createdAt: created.createdAt,
      likes: created.likes,
      user: {
        id: created.authorId,
        username: created.authorUsername,
        avatar: created.authorAvatar,
        isModerator: false
      }
    });
  } catch (error) {
    console.error('Error adding fight comment:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST api/fights/:id/result
// @desc    Set fight result
// @access  Private
router.post('/:id/result', auth, endFight);

export default router;

