const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController');
const auth = require('../middleware/authMiddleware');

// @route   GET api/comments/:userId
// @desc    Get comments for a user profile
// @access  Public
router.get('/:userId', commentController.getComments);

// @route   POST api/comments/:userId
// @desc    Add a comment to a user profile
// @access  Private
router.post('/:userId', auth, commentController.addComment);

module.exports = router;
