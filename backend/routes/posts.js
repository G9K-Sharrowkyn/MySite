import express from 'express';
import { getAllPosts, createPost, getPostById, updatePost, deletePost, toggleLike, addReaction } from '../controllers/postController.js';
import auth from '../middleware/auth.js';

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
    await req.db.read();
    const { limit = 20, page = 1, sortBy = 'createdAt' } = req.query;
    let posts = req.db.data.posts || [];
    posts = posts.filter(post => post.isOfficial);
    // Sort and paginate
    posts = posts.sort((a, b) => new Date(b[sortBy]) - new Date(a[sortBy]));
    const start = (page - 1) * limit;
    const end = start + parseInt(limit);
    const paginated = posts.slice(start, end);
    res.json({ fights: paginated, posts: paginated, totalPosts: posts.length, currentPage: Number(page), totalPages: Math.ceil(posts.length / limit) });
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
