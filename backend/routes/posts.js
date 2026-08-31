import express from 'express';
import {
  getAllPosts,
  createPost,
  getPostById,
  getPostsByUser,
  normalizePostForResponse,
  updatePost,
  deletePost,
  restorePost,
  getDeletedPosts,
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
import { optionalAuth } from '../middleware/optionalAuth.js';
import { postsRepo, usersRepo } from '../repositories/index.js';
import { postUpdateValidation, postValidation } from '../middleware/validation.js';
import { parseLimit, parsePagination } from '../utils/pagination.js';

const router = express.Router();

// @route   GET api/posts
// @desc    Get all posts
// @access  Public
router.get('/', optionalAuth, getAllPosts);

// @route   GET api/posts/user/:userId
// @desc    Get posts by user
// @access  Public
router.get('/user/:userId', optionalAuth, getPostsByUser);

// @route   POST api/posts
// @desc    Create a new post
// @access  Private
router.post('/', auth, postValidation, createPost);

// @route   GET api/posts/official
// @desc    Get all official posts
// @access  Public
router.get('/official', optionalAuth, async (req, res) => {
  try {
    const { sortBy = 'createdAt' } = req.query;
    const viewerUserId = req.user?.id || null;

    const { page: pageNumber, limit: limitNumber } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 50
    });
    const query = {
      isOfficial: true,
      'moderation.deleted.isDeleted': { $ne: true }
    };
    const skip = (pageNumber - 1) * limitNumber;
    const [paged, totalPosts] = await Promise.all([
      sortBy === 'likes'
        ? postsRepo.findTopByArrayLength('likes', { skip, limit: limitNumber }, query)
        : postsRepo.findManyBy(query, {
            sort: { createdAt: -1 },
            skip,
            limit: limitNumber
          }),
      postsRepo.countBy(query)
    ]);
    const authorIds = [...new Set(paged.map((post) => post.authorId).filter(Boolean))];
    const authors = authorIds.length
      ? await usersRepo.findManyBy({ id: { $in: authorIds } }, { limit: authorIds.length })
      : [];

    const formattedPosts = paged.map((post) =>
      normalizePostForResponse(post, authors, { viewerUserId })
    );

    res.json({
      fights: formattedPosts,
      posts: formattedPosts,
      totalPosts,
      currentPage: pageNumber,
      totalPages: Math.ceil(totalPosts / limitNumber)
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
    const limit = parseLimit(req.query.limit, { fallback: 10, max: 50 });
    const tags = (await postsRepo.groupArrayValues(
      [
        'tags',
        'autoTags.universes',
        'autoTags.characters',
        'autoTags.powerTiers',
        'autoTags.categories'
      ],
      { 'moderation.deleted.isDeleted': { $ne: true } }
    )).slice(0, limit);
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
    const tags = (await postsRepo.groupArrayValues(
      [
        'tags',
        'autoTags.universes',
        'autoTags.characters',
        'autoTags.powerTiers',
        'autoTags.categories'
      ],
      { 'moderation.deleted.isDeleted': { $ne: true } }
    )).slice(0, 1000).map((entry) => entry.tag);
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
router.post('/user-challenge', auth, postValidation, createUserChallenge);

// @route   GET api/posts/deleted
// @desc    Get soft-deleted posts (staff only)
// @access  Private
router.get('/deleted', auth, getDeletedPosts);

// @route   GET api/posts/:id
// @desc    Get post by ID
// @access  Public
router.get('/:id', optionalAuth, getPostById);

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
router.put('/:id', auth, postUpdateValidation, updatePost);

// @route   DELETE api/posts/:id
// @desc    Delete post
// @access  Private
router.delete('/:id', auth, deletePost);

// @route   POST api/posts/:id/restore
// @desc    Restore soft-deleted post
// @access  Private (staff)
router.post('/:id/restore', auth, restorePost);

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
