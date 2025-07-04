const { v4: uuidv4 } = require('uuid');

// @desc    Get comments for a user profile
// @route   GET /api/comments/:userId
// @access  Public
exports.getComments = async (req, res) => {
  const db = req.db;
  await db.read();
  if (!db.data.comments) {
    db.data.comments = [];
  }
  const comments = db.data.comments.filter(c => c.profileId === req.params.userId);
  res.json(comments);
};

// @desc    Add a comment to a user profile
// @route   POST /api/comments/:userId
// @access  Private
exports.addComment = async (req, res) => {
  const { text } = req.body;
  const db = req.db;
  await db.read();

  const profileId = req.params.userId;
  const authorId = req.user.id;
  const author = db.data.users.find(u => u.id === authorId);

  if (!author) {
    return res.status(404).json({ msg: 'Autor komentarza nie znaleziony' });
  }

  const newComment = {
    id: uuidv4(),
    profileId,
    authorId,
    authorUsername: author.username,
    text,
    timestamp: new Date().toISOString(),
  };

  db.data.comments.push(newComment);
  await db.write();
  res.status(201).json(newComment);
};
