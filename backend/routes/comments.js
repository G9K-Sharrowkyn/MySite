import express from 'express';
import { getPostComments, addPostComment, updateComment, deleteComment, toggleCommentLike } from '../controllers/commentController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// @route   GET api/comments/:postId
// @desc    Get comments for a post
// @access  Public
router.get('/:postId', getPostComments);

// @route   POST api/comments
// @desc    Create a new comment
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

export default router;
