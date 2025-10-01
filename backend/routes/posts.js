import express from 'express';
import { getAllPosts, createPost, getPostById, updatePost, deletePost, toggleLike, addReaction } from '../controllers/postController.js';
import auth from '../middleware/auth.js';
import Post from '../models/Post.js';

const router = express.Router();

// @route   GET api/posts
// @desc    Get all posts
// @access  Public
router.get('/', getAllPosts);

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
    const sortOrder = {};
    sortOrder[sortBy] = -1; // descending order

    // Get total count for pagination
    const totalPosts = await Post.countDocuments({ isOfficial: true });

    // Fetch official posts with pagination
    const posts = await Post.find({ isOfficial: true })
      .populate('authorId', 'username profilePicture role')
      .sort(sortOrder)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    // Format response
    const formattedPosts = posts.map(post => ({
      ...post,
      id: post._id.toString(),
      author: post.authorId
    }));

    res.json({
      fights: formattedPosts,
      posts: formattedPosts,
      totalPosts,
      currentPage: Number(page),
      totalPages: Math.ceil(totalPosts / limit)
    });
  } catch (error) {
    console.error('Error fetching official posts:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET api/posts/:id
// @desc    Get post by ID
// @access  Public
router.get('/:id', getPostById);

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

// @route   DELETE api/posts/:id/react/:reactionId
// @desc    Remove reaction from post
// @access  Private
router.delete('/:id/react/:reactionId', auth, (req, res) => {
  res.status(501).json({ message: 'Remove reaction not implemented yet' });
});

export default router;
