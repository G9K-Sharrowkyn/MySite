const { v4: uuidv4 } = require('uuid');

// Get comments for a user profile
exports.getProfileComments = async (req, res) => {
  const db = req.db;
  await db.read();
  if (!db.data.comments) {
    db.data.comments = [];
  }
  const comments = db.data.comments.filter(c => c.profileId === req.params.userId);
  res.json(comments);
};

// Add a comment to a user profile
exports.addProfileComment = async (req, res) => {
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

// Get comments for a post
exports.getPostComments = async (req, res) => {
  const db = req.db;
  await db.read();
  if (!db.data.comments) {
    db.data.comments = [];
  }
  const comments = db.data.comments.filter(c => c.postId === req.params.postId);
  res.json(comments);
};

// Add a comment to a post
exports.addPostComment = async (req, res) => {
  const { text } = req.body;
  const db = req.db;
  await db.read();

  const postId = req.params.postId;
  const authorId = req.user.id;
  const author = db.data.users.find(u => u.id === authorId);

  if (!author) {
    return res.status(404).json({ msg: 'Autor komentarza nie znaleziony' });
  }

  const newComment = {
    id: uuidv4(),
    postId,
    authorId,
    authorUsername: author.username,
    text,
    timestamp: new Date().toISOString(),
  };

  db.data.comments.push(newComment);
  await db.write();
  res.status(201).json(newComment);
};

// Get comments for a fight
exports.getFightComments = async (req, res) => {
  const db = req.db;
  await db.read();
  if (!db.data.comments) {
    db.data.comments = [];
  }
  const comments = db.data.comments.filter(c => c.fightId === req.params.fightId);
  res.json(comments);
};

// Add a comment to a fight
exports.addFightComment = async (req, res) => {
  const { text } = req.body;
  const db = req.db;
  await db.read();

  const fightId = req.params.fightId;
  const authorId = req.user.id;
  const author = db.data.users.find(u => u.id === authorId);

  if (!author) {
    return res.status(404).json({ msg: 'Autor komentarza nie znaleziony' });
  }

  const newComment = {
    id: uuidv4(),
    fightId,
    authorId,
    authorUsername: author.username,
    text,
    timestamp: new Date().toISOString(),
  };

  db.data.comments.push(newComment);
  await db.write();
  res.status(201).json(newComment);
};
