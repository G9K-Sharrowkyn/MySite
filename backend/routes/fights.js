import express from 'express';
import { createFight, getFights, getFight, updateFight, deleteFight, endFight, getCategories } from '../controllers/fightController.js';
import auth from '../middleware/auth.js';
import { readDb, updateDb } from '../services/jsonDb.js';
import { v4 as uuidv4 } from 'uuid';

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
    const db = await readDb();
    const votes = (db.votes || []).filter((vote) => vote.fightId === req.params.id);
    const character1Votes = votes.filter((vote) => vote.team === 'A').length;
    const character2Votes = votes.filter((vote) => vote.team === 'B').length;
    const totalVotes = votes.length;

    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const hourlyVotes = votes.filter((vote) => {
      const timestamp = new Date(vote.createdAt || 0).getTime();
      return timestamp >= oneHourAgo;
    }).length;

    res.json({
      character1Votes,
      character2Votes,
      totalVotes,
      hourlyVotes,
      recentVoters: buildRecentVoters(db, req.params.id)
    });
  } catch (error) {
    console.error('Error fetching fight votes:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET api/fights/:id/user-vote/:userId
// @desc    Get user vote for fight (VotingSystem)
// @access  Public
router.get('/:id/user-vote/:userId', async (req, res) => {
  try {
    const db = await readDb();
    const vote = (db.votes || []).find(
      (entry) => entry.fightId === req.params.id && entry.userId === req.params.userId
    );

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
router.post('/:id/vote', async (req, res) => {
  try {
    const { userId, characterChoice } = req.body || {};
    const choice = mapVoteChoice(characterChoice);
    if (!userId || !choice) {
      return res.status(400).json({ message: 'Invalid vote data' });
    }

    let storedVote;

    await updateDb((db) => {
      const existing = (db.votes || []).find(
        (entry) => entry.fightId === req.params.id && entry.userId === userId
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

      db.votes = Array.isArray(db.votes) ? db.votes : [];
      db.votes.push(storedVote);
      return db;
    });

    res.json({ vote: storedVote });
  } catch (error) {
    if (error.code === 'ALREADY_VOTED') {
      return res.status(400).json({ message: 'You have already voted' });
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
    const db = await readDb();
    res.json(buildFightComments(db, req.params.id));
  } catch (error) {
    console.error('Error fetching fight comments:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST api/fights/:id/comments
// @desc    Add comment to fight (VotingSystem)
// @access  Public
router.post('/:id/comments', async (req, res) => {
  try {
    const { userId, content } = req.body || {};
    if (!userId || !content) {
      return res.status(400).json({ message: 'Invalid comment data' });
    }

    let created;
    await updateDb((db) => {
      const author = findUserById(db, userId);
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

      db.comments = Array.isArray(db.comments) ? db.comments : [];
      db.comments.push(created);
      return db;
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
