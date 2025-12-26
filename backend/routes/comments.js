import express from 'express';
import {
  getPostComments,
  addPostComment,
  updateComment,
  deleteComment,
  toggleCommentLike,
  addCommentReaction,
  addUserComment,
  getUserComments,
  addFightComment,
  getFightComments
} from '../controllers/commentController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// @route   GET api/comments/post/:postId
// @desc    Get comments for a post
// @access  Public
router.get('/post/:postId', getPostComments);

// @route   POST api/comments/post/:postId
// @desc    Create a new comment for a post
// @access  Private
router.post('/post/:postId', auth, addPostComment);

// @route   GET api/comments/user/:userId
// @desc    Get comments for a user profile
// @access  Public
router.get('/user/:userId', getUserComments);

// @route   POST api/comments/user/:userId
// @desc    Create a new comment for a user profile
// @access  Private
router.post('/user/:userId', auth, addUserComment);

// @route   GET api/comments/fight/:fightId
// @desc    Get comments for a fight
// @access  Public
router.get('/fight/:fightId', getFightComments);

// @route   POST api/comments/fight/:fightId
// @desc    Create a new comment for a fight
// @access  Private
router.post('/fight/:fightId', auth, addFightComment);

// @route   GET api/comments/:postId
// @desc    Get comments for a post (legacy)
// @access  Public
router.get('/:postId', getPostComments);

// @route   POST api/comments
// @desc    Create a new comment (legacy)
// @access  Private
router.post('/', auth, addPostComment);

// @route   PUT api/comments/:id
// @desc    Update a comment
// @access  Private
router.put('/:id', auth, updateComment);

// @route   DELETE api/comments/:id
// @desc    Delete a comment
// @access  Private
router.delete('/:id', auth, deleteComment);

// @route   POST api/comments/:id/like
// @desc    Like/unlike a comment
// @access  Private
router.post('/:id/like', auth, toggleCommentLike);

// @route   POST api/comments/:id/reaction
// @desc    Add or update reaction on a comment
// @access  Private
router.post('/:id/reaction', auth, addCommentReaction);

export default router;
