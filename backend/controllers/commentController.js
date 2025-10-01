import Comment from '../models/Comment.js';
import User from '../models/User.js';
import Post from '../models/Post.js';
import Fight from '../models/Fight.js';
import Notification from '../models/Notification.js';

// @desc    Add comment to post
// @route   POST /api/comments
// @access  Private
export const addPostComment = async (req, res) => {
  const { postId, text } = req.body;

  try {
    // Check if post exists
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ msg: 'Post nie znaleziony' });
    }

    const author = await User.findById(req.user.id);

    const newComment = await Comment.create({
      type: 'post',
      targetId: postId,
      postId,
      authorId: req.user.id,
      authorUsername: author.username,
      authorAvatar: author.profile?.profilePicture,
      text
    });

    // Create notification for post author (if not commenting on own post)
    if (post.authorId.toString() !== req.user.id) {
      await Notification.create({
        userId: post.authorId.toString(),
        type: 'comment',
        title: 'Nowy komentarz pod postem',
        message: `${author.username} skomentował Twój post`,
        data: {
          commentId: newComment._id.toString(),
          postId: post._id.toString(),
          authorId: req.user.id,
          authorUsername: author.username
        },
        read: false
      });
    }

    res.json(newComment.toObject());
  } catch (error) {
    console.error('Error adding post comment:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get comments for a post
// @route   GET /api/comments/:postId
// @access  Public
export const getPostComments = async (req, res) => {
  const { page = 1, limit = 50 } = req.query;

  try {
    const comments = await Comment.find({
      type: 'post',
      postId: req.params.postId
    })
      .sort({ createdAt: 1 }) // Oldest first for posts
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json(comments);
  } catch (error) {
    console.error('Error fetching comments:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update comment
// @route   PUT /api/comments/:id
// @access  Private
export const updateComment = async (req, res) => {
  const { text } = req.body;

  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ msg: 'Komentarz nie znaleziony' });
    }

    // Check if user is comment author
    if (comment.authorId !== req.user.id) {
      return res.status(403).json({ msg: 'Możesz edytować tylko swoje komentarze' });
    }

    comment.text = text;
    comment.updatedAt = new Date();
    comment.edited = true;
    await comment.save();

    res.json({ msg: 'Komentarz zaktualizowany', comment: comment.toObject() });
  } catch (error) {
    console.error('Error updating comment:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Delete comment
// @route   DELETE /api/comments/:id
// @access  Private
export const deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ msg: 'Komentarz nie znaleziony' });
    }

    const user = await User.findById(req.user.id);

    // Check if user is comment author or moderator
    if (comment.authorId !== req.user.id && user.role !== 'moderator') {
      return res.status(403).json({ msg: 'Brak uprawnień do usunięcia komentarza' });
    }

    await Comment.findByIdAndDelete(req.params.id);

    res.json({ msg: 'Komentarz usunięty' });
  } catch (error) {
    console.error('Error deleting comment:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Like/unlike comment
// @route   POST /api/comments/:id/like
// @access  Private
export const toggleCommentLike = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ msg: 'Komentarz nie znaleziony' });
    }

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
        const liker = await User.findById(userId);
        await Notification.create({
          userId: comment.authorId,
          type: 'like',
          title: 'Polubienie komentarza',
          message: `${liker.username} polubił Twój komentarz`,
          data: {
            commentId: comment._id.toString(),
            likerId: userId,
            likerUsername: liker.username
          },
          read: false
        });
      }
    }

    await comment.save();

    res.json({
      msg: alreadyLiked ? 'Polubienie usunięte' : 'Komentarz polubiony',
      likes: comment.likes,
      liked: !alreadyLiked
    });
  } catch (error) {
    console.error('Error toggling comment like:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Add comment to user profile
// @route   POST /api/comments/user/:userId
// @access  Private
export const addUserComment = async (req, res) => {
  try {
    const { text } = req.body;

    const targetUser = await User.findById(req.params.userId);
    if (!targetUser) {
      return res.status(404).json({ msg: 'Użytkownik nie znaleziony' });
    }

    const author = await User.findById(req.user.id);

    const newComment = await Comment.create({
      type: 'user_profile',
      targetId: req.params.userId,
      authorId: req.user.id,
      authorUsername: author.username,
      text
    });

    // Create notification for profile owner (if not commenting on own profile)
    if (req.params.userId !== req.user.id) {
      await Notification.create({
        userId: req.params.userId,
        type: 'comment',
        title: 'Nowy komentarz na profilu',
        message: `${author.username} dodał komentarz na Twoim profilu`,
        data: {
          commentId: newComment._id.toString(),
          authorId: req.user.id,
          authorUsername: author.username
        },
        read: false
      });
    }

    res.json({ msg: 'Komentarz dodany', comment: newComment.toObject() });
  } catch (error) {
    console.error('Error adding user profile comment:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get comments for user profile
// @route   GET /api/comments/user/:userId
// @access  Public
export const getUserComments = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  try {
    const comments = await Comment.find({
      type: 'user_profile',
      targetId: req.params.userId
    })
      .sort({ createdAt: -1 }) // Newest first
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const totalComments = await Comment.countDocuments({
      type: 'user_profile',
      targetId: req.params.userId
    });

    res.json({
      comments,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalComments / limit),
        totalComments,
        hasNext: page * limit < totalComments,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching user comments:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Add comment to fight
// @route   POST /api/comments/fight/:fightId
// @access  Private
export const addFightComment = async (req, res) => {
  try {
    const { text } = req.body;

    const fight = await Fight.findById(req.params.fightId);
    if (!fight) {
      return res.status(404).json({ msg: 'Walka nie znaleziona' });
    }

    const author = await User.findById(req.user.id);

    const newComment = await Comment.create({
      type: 'fight',
      targetId: req.params.fightId,
      fightId: req.params.fightId,
      authorId: req.user.id,
      authorUsername: author.username,
      text
    });

    // Create notification for fight creator (if not commenting on own fight)
    if (fight.createdBy && fight.createdBy !== req.user.id) {
      await Notification.create({
        userId: fight.createdBy,
        type: 'comment',
        title: 'Nowy komentarz pod walką',
        message: `${author.username} skomentował Twoją walkę: ${fight.title}`,
        data: {
          commentId: newComment._id.toString(),
          fightId: fight._id.toString(),
          authorId: req.user.id,
          authorUsername: author.username
        },
        read: false
      });
    }

    res.json({ msg: 'Komentarz dodany', comment: newComment.toObject() });
  } catch (error) {
    console.error('Error adding fight comment:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get comments for fight
// @route   GET /api/comments/fight/:fightId
// @access  Public
export const getFightComments = async (req, res) => {
  const { page = 1, limit = 50 } = req.query;

  try {
    const comments = await Comment.find({
      type: 'fight',
      fightId: req.params.fightId
    })
      .sort({ createdAt: -1 }) // Newest first
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const totalComments = await Comment.countDocuments({
      type: 'fight',
      fightId: req.params.fightId
    });

    res.json({
      comments,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalComments / limit),
        totalComments,
        hasNext: page * limit < totalComments,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching fight comments:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
