const Post = require('../models/postModel');
const Fight = require('../models/fightModel');

// GET /api/posts
const getAllPosts = async (req, res) => {
  try {
    const posts = await Post.find().populate('author', 'username avatar').sort({ createdAt: -1 });
    res.json(posts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/posts/:id
const getPostById = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate('author', 'username avatar');
    if (!post) return res.status(404).json({ message: 'Post not found' });
    res.json(post);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/posts
const createPost = async (req, res) => {
  try {
    const { content, fightId } = req.body;
    const postData = {
      author: req.user._id,
      content
    };
    if (fightId) postData.fight = fightId;

    const post = await Post.create(postData);
    res.status(201).json(post);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/posts/:id/like
const toggleLike = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const index = post.likes.findIndex(id => id.toString() === req.user._id.toString());
    if (index >= 0) {
      post.likes.splice(index, 1);
    } else {
      post.likes.push(req.user._id);
    }
    await post.save();
    res.json({ likes: post.likes.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/posts/:id/fight-vote
const voteInFight = async (req, res) => {
  const { team } = req.body;
  try {
    const post = await Post.findById(req.params.id);
    if (!post || !post.fight) return res.status(404).json({ message: 'Fight post not found' });
    // delegate to voteFight endpoint
    req.params.id = post.fight;
    req.body.team = team;
    return require('./fightController').voteFight(req, res);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getOfficialFights = async (req, res) => {
  try {
    const posts = await Post.find({ fight: { $ne: null } })
      .populate('fight')
      .populate('author', 'username avatar');
    const official = posts.filter(p => p.fight && p.fight.isOfficial);
    res.json(official);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getAllPosts,
  getPostById,
  createPost,
  toggleLike,
  voteInFight,
  getOfficialFights
};