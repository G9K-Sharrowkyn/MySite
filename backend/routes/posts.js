import express from 'express';
import {
  getAllPosts,
  createPost,
  getPostById,
  getPostsByUser,
  updatePost,
  deletePost,
  toggleLike,
  voteInFight,
  voteInPoll,
  addReaction,
  removeReaction,
  createUserChallenge,
  respondToChallenge,
  approveChallenge,
  getPendingChallenges,
  searchUsersForChallenge
} from '../controllers/postController.js';
import auth from '../middleware/auth.js';
import { readDb } from '../services/jsonDb.js';

const router = express.Router();

const normalizeFightTeam = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === 'string' ? entry : entry?.name))
      .filter(Boolean)
      .join(', ');
  }
  if (typeof value === 'string') return value;
  return value ? String(value) : '';
};

const collectTags = (posts) => {
  const counts = new Map();
  posts.forEach((post) => {
    const tags = new Set();
    (post.tags || []).forEach((tag) => tags.add(String(tag).trim()));
    const autoTags = post.autoTags || {};
    (autoTags.universes || []).forEach((tag) => tags.add(String(tag).trim()));
    (autoTags.characters || []).forEach((tag) => tags.add(String(tag).trim()));
    (autoTags.powerTiers || []).forEach((tag) => tags.add(String(tag).trim()));
    (autoTags.categories || []).forEach((tag) => tags.add(String(tag).trim()));

    tags.forEach((tag) => {
      if (!tag) return;
      const key = tag.toLowerCase();
      counts.set(key, { tag, count: (counts.get(key)?.count || 0) + 1 });
    });
  });

  return [...counts.values()].sort((a, b) => b.count - a.count);
};

// @route   GET api/posts
// @desc    Get all posts
// @access  Public
router.get('/', getAllPosts);

// @route   GET api/posts/user/:userId
// @desc    Get posts by user
// @access  Public
router.get('/user/:userId', getPostsByUser);

// @route   POST api/posts
// @desc    Create a new post
// @access  Private
router.post('/', auth, createPost);

// @route   GET api/posts/official
// @desc    Get all official posts
// @access  Public
router.get('/official', async (req, res) => {
  try {
    const { limit = 20, page = 1, sortBy = 'createdAt' } = req.query;

    // Build sort object
    const db = await readDb();
    const sortKey = sortBy === 'likes' ? 'likes' : 'createdAt';
    const officialPosts = db.posts.filter((post) => post.isOfficial);

    const sorted = [...officialPosts].sort((a, b) => {
      if (sortKey === 'likes') {
        return (b.likes?.length || 0) - (a.likes?.length || 0);
      }
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    const limitNumber = Number(limit);
    const pageNumber = Number(page);
    const paged = sorted.slice(
      (pageNumber - 1) * limitNumber,
      pageNumber * limitNumber
    );

    const formattedPosts = paged.map((post) => {
      const author = db.users.find(
        (user) => (user.id || user._id) === post.authorId
      );
      const fight = post.fight
        ? {
            ...post.fight,
            teamA: normalizeFightTeam(post.fight.teamA),
            teamB: normalizeFightTeam(post.fight.teamB),
            votes: {
              teamA: post.fight.votes?.teamA || 0,
              teamB: post.fight.votes?.teamB || 0,
              draw: post.fight.votes?.draw || 0,
              voters: post.fight.votes?.voters || []
            }
          }
        : null;
      return {
        ...post,
        id: post.id || post._id,
        fight,
        author: author
          ? {
              id: author.id || author._id,
              username: author.username,
              profilePicture: author.profile?.profilePicture || author.profile?.avatar || '',
              role: author.role || 'user'
            }
          : null
      };
    });

    res.json({
      fights: formattedPosts,
      posts: formattedPosts,
      totalPosts: officialPosts.length,
      currentPage: pageNumber,
      totalPages: Math.ceil(officialPosts.length / limitNumber)
    });
  } catch (error) {
    console.error('Error fetching official posts:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET api/posts/tags/popular
// @desc    Get popular tags for posts
// @access  Public
router.get('/tags/popular', async (req, res) => {
  try {
    const limit = Number(req.query.limit || 10);
    const db = await readDb();
    const tags = collectTags(db.posts || []).slice(0, limit);
    res.json(tags);
  } catch (error) {
    console.error('Error fetching popular tags:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET api/posts/tags/all
// @desc    Get all tags for posts
// @access  Public
router.get('/tags/all', async (_req, res) => {
  try {
    const db = await readDb();
    const tags = collectTags(db.posts || []).map((entry) => entry.tag);
    res.json(tags);
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================
// USER-VS-USER CHALLENGE ROUTES
// ============================================

// @route   GET api/posts/pending-challenges
// @desc    Get pending challenges for current user
// @access  Private
router.get('/pending-challenges', auth, getPendingChallenges);

// @route   GET api/posts/search-users
// @desc    Search users to challenge
// @access  Private
router.get('/search-users', auth, searchUsersForChallenge);

// @route   POST api/posts/user-challenge
// @desc    Create a user-vs-user challenge
// @access  Private
router.post('/user-challenge', auth, createUserChallenge);

// @route   GET api/posts/:id
// @desc    Get post by ID
// @access  Public
router.get('/:id', getPostById);

// @route   POST api/posts/:id/fight-vote
// @desc    Vote in fight post
// @access  Private
router.post('/:id/fight-vote', auth, voteInFight);

// @route   POST api/posts/:id/respond
// @desc    Respond to a user-vs-user challenge (opponent)
// @access  Private
router.post('/:id/respond', auth, respondToChallenge);

// @route   POST api/posts/:id/approve
// @desc    Approve a user-vs-user challenge (challenger)
// @access  Private
router.post('/:id/approve', auth, approveChallenge);

// @route   POST api/posts/:id/poll-vote
// @desc    Vote in poll
// @access  Private
router.post('/:id/poll-vote', auth, voteInPoll);

// @route   PUT api/posts/:id
// @desc    Update post
// @access  Private
router.put('/:id', auth, updatePost);

// @route   DELETE api/posts/:id
// @desc    Delete post
// @access  Private
router.delete('/:id', auth, deletePost);

// @route   POST api/posts/:id/like
// @desc    Like/unlike a post
// @access  Private
router.post('/:id/like', auth, toggleLike);

// @route   POST api/posts/:id/react
// @desc    Add reaction to post
// @access  Private
router.post('/:id/react', auth, addReaction);

// @route   POST api/posts/:id/reaction
// @desc    Add reaction to post (frontend alias)
// @access  Private
router.post('/:id/reaction', auth, addReaction);

// @route   DELETE api/posts/:id/react/:reactionId
// @desc    Remove reaction from post
// @access  Private
router.delete('/:id/react/:reactionId', auth, (req, res) => {
  return removeReaction(req, res);
});

export default router;
