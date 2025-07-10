const Comment = require('../models/commentModel');
const Post = require('../models/postModel');
const Fight = require('../models/fightModel');

// Helper to fetch comments
const getComments = async (targetType, targetId) => {
  return Comment.find({ targetType, targetId }).populate('author', 'username avatar').sort({ createdAt: -1 });
};

// POST /api/comments/post/:postId
const addPostComment = async (req, res) => {
  try {
    const { text } = req.body;
    const comment = await Comment.create({
      author: req.user._id,
      targetType: 'post',
      targetId: req.params.postId,
      text
    });
    // increment post commentsCount
    await Post.findByIdAndUpdate(req.params.postId, { $inc: { commentsCount: 1 } });
    res.status(201).json(comment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/comments/fight/:fightId
const addFightComment = async (req, res) => {
  try {
    const { text } = req.body;
    const comment = await Comment.create({
      author: req.user._id,
      targetType: 'fight',
      targetId: req.params.fightId,
      text
    });
    res.status(201).json(comment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/comments/user/:userId
const addUserComment = async (req, res) => {
  try {
    const { text } = req.body;
    const comment = await Comment.create({
      author: req.user._id,
      targetType: 'user',
      targetId: req.params.userId,
      text
    });
    res.status(201).json(comment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET comments functions
const getPostComments = async (req, res) => {
  res.json(await getComments('post', req.params.postId));
};
const getFightComments = async (req, res) => {
  res.json(await getComments('fight', req.params.fightId));
};
const getUserComments = async (req, res) => {
  res.json(await getComments('user', req.params.userId));
};

// POST /api/comments/:id/like
const toggleCommentLike = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });

    const index = comment.likes.findIndex(id => id.toString() === req.user._id.toString());
    if (index >= 0) {
      comment.likes.splice(index, 1);
    } else {
      comment.likes.push(req.user._id);
    }
    await comment.save();

    res.json({ likes: comment.likes.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/comments/:id
const updateComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });
    if (comment.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    comment.text = req.body.text || comment.text;
    await comment.save();
    res.json(comment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/comments/:id
const deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });
    if (comment.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    await comment.deleteOne();
    // decrement commentsCount if post
    if (comment.targetType === 'post') {
      await Post.findByIdAndUpdate(comment.targetId, { $inc: { commentsCount: -1 } });
    }
    res.json({ message: 'Comment deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  addPostComment,
  addFightComment,
  addUserComment,
  getPostComments,
  getFightComments,
  getUserComments,
  toggleCommentLike,
  updateComment,
  deleteComment
};