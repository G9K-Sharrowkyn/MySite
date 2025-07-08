const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const auth = require('../middleware/auth');

// @route   GET api/posts
// @desc    Get all posts (community feed)
// @access  Public
router.get('/', postController.getAllPosts);

// @route   GET api/posts/official
// @desc    Get official fights only
// @access  Public
router.get('/official', postController.getOfficialFights);

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

// @route   POST api/posts/:id/poll-vote
// @desc    Vote in a post poll
// @access  Private
router.post('/:id/poll-vote', auth, postController.voteInPoll);

// @route   POST api/posts/:id/fight-vote
// @desc    Vote in a fight post
// @access  Private
router.post('/:id/fight-vote', auth, postController.voteInFight);

// @route   POST api/posts/:id/reaction
// @desc    Add reaction to post
// @access  Private
router.post('/:id/reaction', auth, postController.addReaction);

// @route   GET api/posts/user/:userId
// @desc    Get posts by user ID
// @access  Public
router.get('/user/:userId', postController.getPostsByUser);

module.exports = router;
