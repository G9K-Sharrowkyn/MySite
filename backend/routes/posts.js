const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const auth = require('../middleware/auth');

// @route   GET api/posts
// @desc    Get all posts (community feed)
// @access  Public
router.get('/', postController.getAllPosts);

// @route   GET api/posts/:id
// @desc    Get post by ID
// @access  Public
router.get('/:id', postController.getPostById);

// @route   POST api/posts
// @desc    Create new post
// @access  Private
router.post('/', auth, postController.createPost);

// @route   PUT api/posts/:id
// @desc    Update post
// @access  Private
router.put('/:id', auth, postController.updatePost);

// @route   DELETE api/posts/:id
// @desc    Delete post
// @access  Private
router.delete('/:id', auth, postController.deletePost);

// @route   POST api/posts/:id/like
// @desc    Like/unlike post
// @access  Private
router.post('/:id/like', auth, postController.toggleLike);

module.exports = router;