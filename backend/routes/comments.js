const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController');
const auth = require('../middleware/authMiddleware');

// @route   POST api/comments/user/:userId
// @desc    Add comment to user profile
// @access  Private
router.post('/user/:userId', auth, commentController.addUserComment);

// @route   POST api/comments/fight/:fightId
// @desc    Add comment to fight
// @access  Private
router.post('/fight/:fightId', auth, commentController.addFightComment);

// @route   GET api/comments/user/:userId
// @desc    Get comments for user profile
// @access  Public
router.get('/user/:userId', commentController.getUserComments);

// @route   GET api/comments/fight/:fightId
// @desc    Get comments for fight
// @access  Public
router.get('/fight/:fightId', commentController.getFightComments);

// @route   POST api/comments/:id/like
// @desc    Like/unlike comment
// @access  Private
router.post('/:id/like', auth, commentController.toggleCommentLike);

// @route   PUT api/comments/:id
// @desc    Update comment
// @access  Private
router.put('/:id', auth, commentController.updateComment);

// @route   POST api/comments/post/:postId
// @desc    Add comment to post
// @access  Private
router.post('/post/:postId', auth, commentController.addPostComment);

// @route   GET api/comments/post/:postId
// @desc    Get comments for post
// @access  Public
router.get('/post/:postId', commentController.getPostComments);

// @route   DELETE api/comments/:id
// @desc    Delete comment
// @access  Private
router.delete('/:id', auth, commentController.deleteComment);

module.exports = router;
