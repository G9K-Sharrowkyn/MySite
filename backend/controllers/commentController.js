
import { v4 as uuidv4 } from 'uuid';
import { createNotification } from './notificationController.js';

// @desc    Add comment to user profile
// @route   POST /api/comments/user/:userId
// @access  Private
export const addUserComment = async (req, res) => {
  try {
    console.log('Add user profile comment request received:', {
      userId: req.user.id,
      body: req.body,
      targetUserId: req.params.userId
    });

    const { text } = req.body;
    const db = req.db;
    await db.read();

    const targetUser = db.data.users.find(u => u.id === req.params.userId);
    if (!targetUser) {
      console.error('Target user not found:', req.params.userId);
      return res.status(404).json({ msg: 'Użytkownik nie znaleziony' });
    }

    const author = db.data.users.find(u => u.id === req.user.id);

    const newComment = {
      id: uuidv4(),
      type: 'user_profile',
      targetId: req.params.userId,
      authorId: req.user.id,
      authorUsername: author.username,
      text,
      createdAt: new Date().toISOString(),
      likes: 0,
      likedBy: []
    };

    db.data.comments.push(newComment);

    // Create notification for profile owner (if not commenting on own profile)
    if (req.params.userId !== req.user.id) {
      await createNotification(
        db,
        req.params.userId,
        'comment',
        'Nowy komentarz na profilu',
        `${author.username} dodał komentarz na Twoim profilu`,
        {
          commentId: newComment.id,
          authorId: req.user.id,
          authorUsername: author.username
        }
      );
    }

    await db.write();
    console.log('User profile comment added successfully:', newComment);
    res.json({ msg: 'Komentarz dodany', comment: newComment });
  } catch (error) {
    console.error('Error adding user profile comment:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const addFightComment = async (req, res) => {
  try {
    console.log('Add fight comment request received:', {
      userId: req.user.id,
      body: req.body,
      fightId: req.params.fightId
    });

    const { text } = req.body;
    const db = req.db;
    await db.read();

    const fight = db.data.fights.find(f => f.id === req.params.fightId);
    if (!fight) {
      console.error('Fight not found:', req.params.fightId);
      return res.status(404).json({ msg: 'Walka nie znaleziona' });
    }

    const author = db.data.users.find(u => u.id === req.user.id);

    const newComment = {
      id: uuidv4(),
      type: 'fight',
      targetId: req.params.fightId,
      fightId: req.params.fightId,
      authorId: req.user.id,
      authorUsername: author.username,
      text,
      createdAt: new Date().toISOString(),
      likes: 0,
      likedBy: []
    };

    db.data.comments.push(newComment);

    // Create notification for fight creator (if not commenting on own fight)
    if (fight.createdBy !== req.user.id) {
      await createNotification(
        db,
        fight.createdBy,
        'comment',
        'Nowy komentarz pod walką',
        `${author.username} skomentował Twoją walkę: ${fight.title}`,
        {
          commentId: newComment.id,
          fightId: fight.id,
          authorId: req.user.id,
          authorUsername: author.username
        }
      );
    }

    await db.write();
    console.log('Fight comment added successfully:', newComment);
    res.json({ msg: 'Komentarz dodany', comment: newComment });
  } catch (error) {
    console.error('Error adding fight comment:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get comments for user profile
// @route   GET /api/comments/user/:userId
// @access  Public
export const getUserComments = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const db = req.db;
  await db.read();

  let comments = db.data.comments.filter(c => 
    c.type === 'user_profile' && c.targetId === req.params.userId
  );

  // Sort by creation date (newest first)
  comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Pagination
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const paginatedComments = comments.slice(startIndex, endIndex);

  res.json({
    comments: paginatedComments,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(comments.length / limit),
      totalComments: comments.length,
      hasNext: endIndex < comments.length,
      hasPrev: startIndex > 0
    }
  });
};

// @desc    Get comments for fight
// @route   GET /api/comments/fight/:fightId
// @access  Public
export const getFightComments = async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const db = req.db;
  await db.read();

  let comments = db.data.comments.filter(c => 
    c.type === 'fight' && c.fightId === req.params.fightId
  );

  // Sort by creation date (newest first)
  comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Pagination
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const paginatedComments = comments.slice(startIndex, endIndex);

  res.json({
    comments: paginatedComments,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(comments.length / limit),
      totalComments: comments.length,
      hasNext: endIndex < comments.length,
      hasPrev: startIndex > 0
    }
  });
};

// @desc    Like/unlike comment
// @route   POST /api/comments/:id/like
// @access  Private
export const toggleCommentLike = async (req, res) => {
  const db = req.db;
  await db.read();

  const commentIndex = db.data.comments.findIndex(c => c.id === req.params.id);
  if (commentIndex === -1) {
    return res.status(404).json({ msg: 'Komentarz nie znaleziony' });
  }

  const comment = db.data.comments[commentIndex];
  const userId = req.user.id;

  if (!comment.likedBy) {
    comment.likedBy = [];
  }

  const alreadyLiked = comment.likedBy.includes(userId);

  if (alreadyLiked) {
    // Unlike
    comment.likedBy = comment.likedBy.filter(id => id !== userId);
    comment.likes = Math.max(0, comment.likes - 1);
  } else {
    // Like
    comment.likedBy.push(userId);
    comment.likes = (comment.likes || 0) + 1;

    // Create notification for comment author (if not liking own comment)
    if (comment.authorId !== userId) {
      const liker = db.data.users.find(u => u.id === userId);
      await createNotification(
        db,
        comment.authorId,
        'like',
        'Polubienie komentarza',
        `${liker.username} polubił Twój komentarz`,
        {
          commentId: comment.id,
          likerId: userId,
          likerUsername: liker.username
        }
      );
    }
  }

  db.data.comments[commentIndex] = comment;
  await db.write();

  res.json({ 
    msg: alreadyLiked ? 'Polubienie usunięte' : 'Komentarz polubiony',
    likes: comment.likes,
    liked: !alreadyLiked
  });
};

// @desc    Delete comment
// @route   DELETE /api/comments/:id
// @access  Private
export const deleteComment = async (req, res) => {
  const db = req.db;
  await db.read();

  const commentIndex = db.data.comments.findIndex(c => c.id === req.params.id);
  if (commentIndex === -1) {
    return res.status(404).json({ msg: 'Komentarz nie znaleziony' });
  }

  const comment = db.data.comments[commentIndex];
  const user = db.data.users.find(u => u.id === req.user.id);

  // Check if user is comment author or moderator
  if (comment.authorId !== req.user.id && user.role !== 'moderator') {
    return res.status(403).json({ msg: 'Brak uprawnień do usunięcia komentarza' });
  }

  db.data.comments.splice(commentIndex, 1);
  await db.write();

  res.json({ msg: 'Komentarz usunięty' });
};

// @desc    Update comment
// @route   PUT /api/comments/:id
// @access  Private
export const updateComment = async (req, res) => {
  const { text } = req.body;
  const db = req.db;
  await db.read();

  const commentIndex = db.data.comments.findIndex(c => c.id === req.params.id);
  if (commentIndex === -1) {
    return res.status(404).json({ msg: 'Komentarz nie znaleziony' });
  }

  const comment = db.data.comments[commentIndex];

  // Check if user is comment author
  if (comment.authorId !== req.user.id) {
    return res.status(403).json({ msg: 'Możesz edytować tylko swoje komentarze' });
  }

  db.data.comments[commentIndex].text = text;
  db.data.comments[commentIndex].updatedAt = new Date().toISOString();
  db.data.comments[commentIndex].edited = true;

  await db.write();
  res.json({ msg: 'Komentarz zaktualizowany', comment: db.data.comments[commentIndex] });
};

// @desc    Add comment to post
// @route   POST /api/comments/post/:postId
// @access  Private
export const addPostComment = async (req, res) => {
  const { text } = req.body;
  const db = req.db;
  await db.read();

  // Check if post exists
  const post = db.data.posts?.find(p => p.id === req.params.postId);
  if (!post) {
    return res.status(404).json({ msg: 'Post nie znaleziony' });
  }

  const author = db.data.users.find(u => u.id === req.user.id);

  const newComment = {
    id: uuidv4(),
    type: 'post',
    targetId: req.params.postId,
    postId: req.params.postId,
    authorId: req.user.id,
    authorUsername: author.username,
    authorAvatar: author.profilePicture,
    text,
    createdAt: new Date().toISOString(),
    likes: 0,
    likedBy: []
  };

  if (!db.data.comments) {
    db.data.comments = [];
  }
  
  db.data.comments.push(newComment);

  // Create notification for post author (if not commenting on own post)
  if (post.authorId !== req.user.id) {
    await createNotification(
      db,
      post.authorId,
      'comment',
      'Nowy komentarz pod postem',
      `${author.username} skomentował Twój post: ${post.title}`,
      {
        commentId: newComment.id,
        postId: post.id,
        authorId: req.user.id,
        authorUsername: author.username
      }
    );
  }

  await db.write();
  res.json(newComment);
};

// @desc    Get comments for post
// @route   GET /api/comments/post/:postId
// @access  Public
export const getPostComments = async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const db = req.db;
  await db.read();

  if (!db.data.comments) {
    return res.json([]);
  }

  let comments = db.data.comments.filter(c => 
    c.type === 'post' && c.postId === req.params.postId
  );

  // Sort by creation date (oldest first for posts)
  comments.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  // Pagination
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const paginatedComments = comments.slice(startIndex, endIndex);

  res.json(paginatedComments);
};
