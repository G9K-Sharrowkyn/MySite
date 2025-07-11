const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const auth = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// Helper function to generate tags from characters
const generateTagsFromPost = (post) => {
  const tags = new Set();
  
  // Add character names as tags
  if (post.type === 'fight' && post.fight) {
    // Extract character names from teamA and teamB
    const extractCharacterNames = (teamString) => {
      if (!teamString) return [];
      // Split by common separators and clean up
      return teamString.split(/[,&]/).map(name => name.trim()).filter(name => name);
    };
    
    const teamACharacters = extractCharacterNames(post.fight.teamA);
    const teamBCharacters = extractCharacterNames(post.fight.teamB);
    
    [...teamACharacters, ...teamBCharacters].forEach(character => {
      tags.add(character.toLowerCase());
      
      // Add universe-specific tags based on character names
      if (['goku', 'vegeta', 'broly', 'cell'].some(name => character.toLowerCase().includes(name))) {
        tags.add('dragon-ball');
        tags.add('anime');
      }
      if (['superman', 'batman', 'joker'].some(name => character.toLowerCase().includes(name))) {
        tags.add('dc');
        tags.add('comics');
      }
      if (['spider-man', 'iron man', 'thor', 'hulk'].some(name => character.toLowerCase().includes(name))) {
        tags.add('marvel');
        tags.add('comics');
      }
      if (['naruto', 'sasuke'].some(name => character.toLowerCase().includes(name))) {
        tags.add('naruto');
        tags.add('anime');
      }
    });
  }
  
  // Add category as tag if present
  if (post.category) {
    tags.add(post.category.toLowerCase());
  }
  
  return Array.from(tags);
};

// Get all posts with optional tag filtering
router.get('/', async (req, res) => {
  const db = req.db;
  const { page = 1, limit = 10, sortBy = 'createdAt', tags } = req.query;
  
  try {
    console.log('Fetching all posts with params:', { page, limit, sortBy, tags });
    await db.read();
    let posts = db.data.posts || [];
    
    // Filter by tags if provided
    if (tags) {
      const requestedTags = Array.isArray(tags) ? tags : tags.split(',');
      posts = posts.filter(post => {
        const postTags = post.tags || generateTagsFromPost(post);
        return requestedTags.some(tag => 
          postTags.some(postTag => postTag.toLowerCase().includes(tag.toLowerCase()))
        );
      });
    }
    
    // Sort posts
    posts.sort((a, b) => {
      if (sortBy === 'likes') {
        return b.likes.length - a.likes.length;
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedPosts = posts.slice(startIndex, endIndex);
    
    // Add user info to posts
    const postsWithUserInfo = paginatedPosts.map(post => {
      const author = db.data.users.find(u => u.id === post.authorId);
      // Ensure tags are populated
      if (!post.tags) {
        post.tags = generateTagsFromPost(post);
      }
      return {
        ...post,
        author: author ? {
          id: author.id,
          username: author.username,
          profilePicture: author.profile?.profilePicture || '',
          rank: author.stats?.rank || 'Rookie',
          divisions: author.divisions || {}
        } : null
      };
    });
    
    console.log(`Returning ${postsWithUserInfo.length} posts out of ${posts.length}`);
    res.json({
      posts: postsWithUserInfo,
      totalPosts: posts.length,
      currentPage: parseInt(page),
      totalPages: Math.ceil(posts.length / limit)
    });
  } catch (err) {
    console.error('Error fetching all posts:', err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/posts/official
// @desc    Get official fights only
// @access  Public
router.get('/official', postController.getOfficialFights);

// @route   GET api/posts/:id
// @desc    Get post by ID
// @access  Public
router.get('/:id', postController.getPostById);

// Create a new post - enhanced with tag generation
router.post('/', auth, async (req, res, next) => {
  // Add tag generation middleware
  req.generateTagsFromPost = generateTagsFromPost;
  next();
}, postController.createPost);

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

// Get popular tags
router.get('/tags/popular', async (req, res) => {
  const db = req.db;
  const { limit = 20 } = req.query;
  
  try {
    await db.read();
    const posts = db.data.posts || [];
    
    // Count tag occurrences
    const tagCounts = {};
    posts.forEach(post => {
      const postTags = post.tags || generateTagsFromPost(post);
      postTags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    
    // Sort by count and limit
    const popularTags = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, parseInt(limit))
      .map(([tag, count]) => ({ tag, count }));
    
    res.json(popularTags);
  } catch (error) {
    console.error('Error fetching popular tags:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all unique tags
router.get('/tags/all', async (req, res) => {
  const db = req.db;
  
  try {
    await db.read();
    const posts = db.data.posts || [];
    
    // Collect all unique tags
    const allTags = new Set();
    posts.forEach(post => {
      const postTags = post.tags || generateTagsFromPost(post);
      postTags.forEach(tag => allTags.add(tag));
    });
    
    res.json(Array.from(allTags).sort());
  } catch (error) {
    console.error('Error fetching all tags:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
