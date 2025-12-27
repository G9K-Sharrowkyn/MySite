import { v4 as uuidv4 } from 'uuid';
import { readDb, updateDb } from '../services/jsonDb.js';
import { createNotification } from './notificationController.js';
import { findProfanityMatches } from '../utils/profanity.js';
import { addRankPoints, RANK_POINT_VALUES, updateLeveledBadgeProgress } from '../utils/rankSystem.js';

const resolveUserId = (user) => user?.id || user?._id;
const resolveCommentId = (comment) => comment?.id || comment?._id;
const resolveRole = (user) => user?.role || 'user';

const buildAuthorAvatar = (user) => {
  const profile = user.profile || {};
  return profile.profilePicture || profile.avatar || '';
};

const buildReactionSummary = (reactions = []) => {
  const reactionCounts = {};
  reactions.forEach((reaction) => {
    if (!reaction?.reactionIcon || !reaction?.reactionName) return;
    const key = `${reaction.reactionIcon}-${reaction.reactionName}`;
    reactionCounts[key] = (reactionCounts[key] || 0) + 1;
  });

  return Object.entries(reactionCounts).map(([key, count]) => {
    const separatorIndex = key.indexOf('-');
    const icon = separatorIndex >= 0 ? key.slice(0, separatorIndex) : key;
    const name = separatorIndex >= 0 ? key.slice(separatorIndex + 1) : '';
    return { icon, name, count };
  });
};

const notifyAdminsForProfanity = async (db, payload) => {
  const {
    author,
    matches,
    text,
    sourceType,
    postId,
    fightId,
    userId,
    commentId
  } = payload || {};
  if (!matches || matches.length === 0) return;

  const admins = (db.users || []).filter((user) => resolveRole(user) === 'admin');
  if (!admins.length) return;

  const authorId = resolveUserId(author);
  const summary = matches.join(', ');
  const title = 'Profanity detected in comment';
  const content = `${author?.username || 'User'} used flagged words: ${summary}`;

  await Promise.all(
    admins.map((admin) =>
      createNotification(db, resolveUserId(admin), 'moderation', title, content, {
        sourceType,
        postId,
        fightId,
        userId,
        commentId,
        authorId,
        matches,
        text
      })
    )
  );
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildReplyText = (text, parentComment) => {
  const trimmed = text.trim();
  if (!parentComment?.authorUsername) return trimmed;
  const mention = `@${parentComment.authorUsername}`;
  const mentionPattern = new RegExp(`^${escapeRegExp(mention)}\\b`, 'i');
  if (mentionPattern.test(trimmed)) return trimmed;
  return `${mention} ${trimmed}`;
};

const shouldNotifyReply = (recipient, senderId) => {
  if (!recipient) return false;
  const recipientId = resolveUserId(recipient);
  if (!recipientId || recipientId === senderId) return false;
  const settings = recipient.notificationSettings;
  if (settings && settings.comments === false) return false;
  return true;
};

const normalizeComment = (comment) => {
  const commentId = resolveCommentId(comment);
  const threadId = comment.threadId || comment.parentId || commentId;
  return {
    ...comment,
    id: commentId,
    parentId: comment.parentId || null,
    threadId,
    reactions: buildReactionSummary(comment.reactions || []),
    timestamp: comment.timestamp || comment.createdAt
  };
};

const resolvePostId = (req) => req.params.postId || req.body.postId;

// @desc    Add comment to post
// @route   POST /api/comments or /api/comments/post/:postId
// @access  Private
export const addPostComment = async (req, res) => {
  const postId = resolvePostId(req);
  const { text, parentId } = req.body;

  if (!postId) {
    return res.status(400).json({ msg: 'Post ID is required' });
  }

  if (!text || !text.trim()) {
    return res.status(400).json({ msg: 'Text is required' });
  }

  try {
    let createdComment;

    await updateDb(async (db) => {
      const postExists = db.posts.some(
        (post) => (post.id || post._id) === postId
      );
      if (!postExists) {
        const error = new Error('Post not found');
        error.code = 'POST_NOT_FOUND';
        throw error;
      }

      const author = db.users.find((user) => resolveUserId(user) === req.user.id);
      if (!author) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      const parentComment = parentId
        ? db.comments.find((entry) => resolveCommentId(entry) === parentId)
        : null;

      if (parentId) {
        if (!parentComment || parentComment.type !== 'post' || parentComment.postId !== postId) {
          const error = new Error('Parent comment not found');
          error.code = 'PARENT_NOT_FOUND';
          throw error;
        }
      }

      const now = new Date().toISOString();
      const commentId = uuidv4();
      const threadId = parentComment
        ? parentComment.threadId || resolveCommentId(parentComment)
        : commentId;
      const commentText = parentComment ? buildReplyText(text, parentComment) : text.trim();
      createdComment = {
        id: commentId,
        type: 'post',
        targetId: postId,
        postId,
        parentId: parentComment ? resolveCommentId(parentComment) : null,
        threadId,
        authorId: req.user.id,
        authorUsername: author.username,
        authorAvatar: buildAuthorAvatar(author),
        text: commentText,
        createdAt: now,
        updatedAt: now,
        likes: 0,
        likedBy: [],
        reactions: []
      };

      db.comments.push(createdComment);

      const matches = findProfanityMatches(commentText);
      if (matches.length) {
        await notifyAdminsForProfanity(db, {
          author,
          matches,
          text: commentText,
          sourceType: 'post_comment',
          postId,
          commentId
        });
      }

      author.activity = author.activity || {
        postsCreated: 0,
        commentsPosted: 0,
        reactionsGiven: 0,
        likesReceived: 0,
        tournamentsWon: 0,
        tournamentsParticipated: 0
      };
      author.activity.commentsPosted += 1;
      addRankPoints(author, RANK_POINT_VALUES.comment);
      updateLeveledBadgeProgress(
        author,
        'badge_commentator',
        author.activity.commentsPosted,
        100,
        20
      );
      author.updatedAt = now;

      if (parentComment) {
        const parentAuthor = db.users.find(
          (user) => resolveUserId(user) === parentComment.authorId
        );
        if (shouldNotifyReply(parentAuthor, req.user.id)) {
          await createNotification(
            db,
            resolveUserId(parentAuthor),
            'comment',
            'New reply',
            `${author.username} replied to your comment`,
            {
              postId,
              commentId,
              parentCommentId: resolveCommentId(parentComment),
              replyAuthorId: req.user.id,
              replyAuthorUsername: author.username
            }
          );
        }
      }

      return db;
    });

    res.json(normalizeComment(createdComment));
  } catch (error) {
    if (error.code === 'POST_NOT_FOUND') {
      return res.status(404).json({ msg: 'Post not found' });
    }
    if (error.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ msg: 'User not found' });
    }
    if (error.code === 'PARENT_NOT_FOUND') {
      return res.status(404).json({ msg: 'Parent comment not found' });
    }
    console.error('Error adding post comment:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get comments for a post
// @route   GET /api/comments/:postId or /api/comments/post/:postId
// @access  Public
export const getPostComments = async (req, res) => {
  const postId = req.params.postId || req.params.id;
  const { page = 1, limit = 50 } = req.query;

  try {
    const db = await readDb();
    const filtered = db.comments.filter((comment) => {
      const isPostComment = comment?.type === 'post' || !comment?.type;
      return isPostComment && comment.postId === postId;
    });
    const sorted = filtered.sort(
      (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
    );
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const paged = sorted.slice(
      (pageNumber - 1) * limitNumber,
      pageNumber * limitNumber
    );
    res.json(paged.map(normalizeComment));
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
    let updatedComment;

    await updateDb(async (db) => {
      const comment = db.comments.find(
        (entry) => resolveCommentId(entry) === req.params.id
      );
      if (!comment) {
        const error = new Error('Comment not found');
        error.code = 'COMMENT_NOT_FOUND';
        throw error;
      }

      if (comment.authorId !== req.user.id) {
        const error = new Error('Access denied');
        error.code = 'ACCESS_DENIED';
        throw error;
      }

      comment.text = text;
      comment.updatedAt = new Date().toISOString();
      comment.edited = true;
      updatedComment = comment;
      return db;
    });

    res.json({ msg: 'Comment updated', comment: normalizeComment(updatedComment) });
  } catch (error) {
    if (error.code === 'COMMENT_NOT_FOUND') {
      return res.status(404).json({ msg: 'Comment not found' });
    }
    if (error.code === 'ACCESS_DENIED') {
      return res.status(403).json({ msg: 'Access denied' });
    }
    console.error('Error updating comment:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Delete comment
// @route   DELETE /api/comments/:id
// @access  Private
export const deleteComment = async (req, res) => {
  try {
    await updateDb((db) => {
      const comment = db.comments.find(
        (entry) => resolveCommentId(entry) === req.params.id
      );
      if (!comment) {
        const error = new Error('Comment not found');
        error.code = 'COMMENT_NOT_FOUND';
        throw error;
      }

      const user = db.users.find((entry) => resolveUserId(entry) === req.user.id);
      if (!user) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      if (
        comment.authorId !== req.user.id &&
        user.role !== 'moderator' &&
        user.role !== 'admin'
      ) {
        const error = new Error('Access denied');
        error.code = 'ACCESS_DENIED';
        throw error;
      }

      const idsToDelete = new Set();
      const queue = [resolveCommentId(comment)];

      while (queue.length > 0) {
        const currentId = queue.pop();
        if (!currentId || idsToDelete.has(currentId)) continue;
        idsToDelete.add(currentId);
        db.comments.forEach((entry) => {
          if (entry.parentId === currentId) {
            queue.push(resolveCommentId(entry));
          }
        });
      }

      db.comments = db.comments.filter(
        (entry) => !idsToDelete.has(resolveCommentId(entry))
      );
      return db;
    });

    res.json({ msg: 'Comment deleted' });
  } catch (error) {
    if (error.code === 'COMMENT_NOT_FOUND') {
      return res.status(404).json({ msg: 'Comment not found' });
    }
    if (error.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ msg: 'User not found' });
    }
    if (error.code === 'ACCESS_DENIED') {
      return res.status(403).json({ msg: 'Access denied' });
    }
    console.error('Error deleting comment:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Like/unlike comment
// @route   POST /api/comments/:id/like
// @access  Private
export const toggleCommentLike = async (req, res) => {
  try {
    let likes = 0;
    let liked = false;

    await updateDb((db) => {
      const comment = db.comments.find(
        (entry) => resolveCommentId(entry) === req.params.id
      );
      if (!comment) {
        const error = new Error('Comment not found');
        error.code = 'COMMENT_NOT_FOUND';
        throw error;
      }

      comment.likedBy = Array.isArray(comment.likedBy) ? comment.likedBy : [];
      comment.likes = comment.likes || 0;
      const alreadyLiked = comment.likedBy.includes(req.user.id);

      if (alreadyLiked) {
        comment.likedBy = comment.likedBy.filter((id) => id !== req.user.id);
        comment.likes = Math.max(0, comment.likes - 1);
        liked = false;
      } else {
        comment.likedBy.push(req.user.id);
        comment.likes += 1;
        liked = true;
      }

      likes = comment.likes;
      comment.updatedAt = new Date().toISOString();
      return db;
    });

    res.json({
      msg: liked ? 'Comment liked' : 'Like removed',
      likes,
      liked
    });
  } catch (error) {
    if (error.code === 'COMMENT_NOT_FOUND') {
      return res.status(404).json({ msg: 'Comment not found' });
    }
    console.error('Error toggling comment like:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Add comment to user profile
// @route   POST /api/comments/user/:userId
// @access  Private
export const addUserComment = async (req, res) => {
  const { text, parentId } = req.body;
  const { userId } = req.params;

  if (!text || !text.trim()) {
    return res.status(400).json({ msg: 'Text is required' });
  }

  try {
    let createdComment;

    await updateDb(async (db) => {
      const targetUser = db.users.find((user) => resolveUserId(user) === userId);
      if (!targetUser) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      const author = db.users.find((user) => resolveUserId(user) === req.user.id);
      if (!author) {
        const error = new Error('Author not found');
        error.code = 'AUTHOR_NOT_FOUND';
        throw error;
      }

      const parentComment = parentId
        ? db.comments.find((entry) => resolveCommentId(entry) === parentId)
        : null;
      if (parentId) {
        if (
          !parentComment ||
          parentComment.type !== 'user_profile' ||
          parentComment.targetId !== userId
        ) {
          const error = new Error('Parent comment not found');
          error.code = 'PARENT_NOT_FOUND';
          throw error;
        }
      }

      const now = new Date().toISOString();
      const commentId = uuidv4();
      const threadId = parentComment
        ? parentComment.threadId || resolveCommentId(parentComment)
        : commentId;
      createdComment = {
        id: commentId,
        type: 'user_profile',
        targetId: userId,
        parentId: parentComment ? resolveCommentId(parentComment) : null,
        threadId,
        authorId: req.user.id,
        authorUsername: author.username,
        authorAvatar: buildAuthorAvatar(author),
        text: text.trim(),
        createdAt: now,
        updatedAt: now,
        likes: 0,
        likedBy: [],
        reactions: []
      };

      db.comments.push(createdComment);
      const matches = findProfanityMatches(createdComment.text);
      if (matches.length) {
        await notifyAdminsForProfanity(db, {
          author,
          matches,
          text: createdComment.text,
          sourceType: 'profile_comment',
          userId,
          commentId
        });
      }
      author.activity = author.activity || {
        postsCreated: 0,
        commentsPosted: 0,
        reactionsGiven: 0,
        likesReceived: 0,
        tournamentsWon: 0,
        tournamentsParticipated: 0
      };
      author.activity.commentsPosted += 1;
      addRankPoints(author, RANK_POINT_VALUES.comment);
      updateLeveledBadgeProgress(
        author,
        'badge_commentator',
        author.activity.commentsPosted,
        100,
        20
      );
      author.updatedAt = now;
      return db;
    });

    res.json(normalizeComment(createdComment));
  } catch (error) {
    if (error.code === 'USER_NOT_FOUND' || error.code === 'AUTHOR_NOT_FOUND') {
      return res.status(404).json({ msg: 'User not found' });
    }
    if (error.code === 'PARENT_NOT_FOUND') {
      return res.status(404).json({ msg: 'Parent comment not found' });
    }
    console.error('Error adding user profile comment:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get comments for user profile
// @route   GET /api/comments/user/:userId
// @access  Public
export const getUserComments = async (req, res) => {
  const { userId } = req.params;

  try {
    const db = await readDb();
    const comments = db.comments
      .filter((comment) => comment.type === 'user_profile' && comment.targetId === userId)
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    res.json(comments.map(normalizeComment));
  } catch (error) {
    console.error('Error fetching user comments:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Add comment to fight
// @route   POST /api/comments/fight/:fightId
// @access  Private
export const addFightComment = async (req, res) => {
  const { fightId } = req.params;
  const { text, parentId } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ msg: 'Text is required' });
  }

  try {
    let createdComment;

    await updateDb(async (db) => {
      const fightExists =
        db.fights?.some((fight) => fight.id === fightId) ||
        db.posts.some(
          (post) => (post.id || post._id) === fightId && post.type === 'fight'
        );
      if (!fightExists) {
        const error = new Error('Fight not found');
        error.code = 'FIGHT_NOT_FOUND';
        throw error;
      }

      const author = db.users.find((user) => resolveUserId(user) === req.user.id);
      if (!author) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      const parentComment = parentId
        ? db.comments.find((entry) => resolveCommentId(entry) === parentId)
        : null;

      if (parentId) {
        if (
          !parentComment ||
          parentComment.type !== 'fight' ||
          parentComment.fightId !== fightId
        ) {
          const error = new Error('Parent comment not found');
          error.code = 'PARENT_NOT_FOUND';
          throw error;
        }
      }

      const now = new Date().toISOString();
      const commentId = uuidv4();
      const threadId = parentComment
        ? parentComment.threadId || resolveCommentId(parentComment)
        : commentId;
      createdComment = {
        id: commentId,
        type: 'fight',
        targetId: fightId,
        fightId,
        parentId: parentComment ? resolveCommentId(parentComment) : null,
        threadId,
        authorId: req.user.id,
        authorUsername: author.username,
        authorAvatar: buildAuthorAvatar(author),
        text: text.trim(),
        createdAt: now,
        updatedAt: now,
        likes: 0,
        likedBy: [],
        reactions: []
      };

      db.comments.push(createdComment);
      const matches = findProfanityMatches(createdComment.text);
      if (matches.length) {
        await notifyAdminsForProfanity(db, {
          author,
          matches,
          text: createdComment.text,
          sourceType: 'fight_comment',
          fightId,
          commentId
        });
      }
      author.activity = author.activity || {
        postsCreated: 0,
        commentsPosted: 0,
        reactionsGiven: 0,
        likesReceived: 0,
        tournamentsWon: 0,
        tournamentsParticipated: 0
      };
      author.activity.commentsPosted += 1;
      addRankPoints(author, RANK_POINT_VALUES.comment);
      updateLeveledBadgeProgress(
        author,
        'badge_commentator',
        author.activity.commentsPosted,
        100,
        20
      );
      author.updatedAt = now;
      return db;
    });

    res.json(normalizeComment(createdComment));
  } catch (error) {
    if (error.code === 'FIGHT_NOT_FOUND') {
      return res.status(404).json({ msg: 'Fight not found' });
    }
    if (error.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ msg: 'User not found' });
    }
    if (error.code === 'PARENT_NOT_FOUND') {
      return res.status(404).json({ msg: 'Parent comment not found' });
    }
    console.error('Error adding fight comment:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get comments for fight
// @route   GET /api/comments/fight/:fightId
// @access  Public
export const getFightComments = async (req, res) => {
  const { fightId } = req.params;
  const { page = 1, limit = 50 } = req.query;

  try {
    const db = await readDb();
    const filtered = db.comments.filter(
      (comment) => comment.type === 'fight' && comment.fightId === fightId
    );
    const sorted = filtered.sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const paged = sorted.slice(
      (pageNumber - 1) * limitNumber,
      pageNumber * limitNumber
    );
    const formatted = paged.map(normalizeComment);
    res.json({ comments: formatted, length: filtered.length });
  } catch (error) {
    console.error('Error fetching fight comments:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Add or update a reaction on a comment
// @route   POST /api/comments/:id/reaction
// @access  Private
export const addCommentReaction = async (req, res) => {
  const { reactionId, reactionIcon, reactionName } = req.body;

  try {
    let reactionsSummary = [];
    let updatedComment;

    await updateDb((db) => {
      const comment = db.comments.find(
        (entry) => resolveCommentId(entry) === req.params.id
      );
      if (!comment) {
        const error = new Error('Comment not found');
        error.code = 'COMMENT_NOT_FOUND';
        throw error;
      }

      comment.reactions = Array.isArray(comment.reactions) ? comment.reactions : [];
      const existingReactionIndex = comment.reactions.findIndex(
        (reaction) => reaction.userId === req.user.id
      );
      const isNewReaction = existingReactionIndex === -1;

      const now = new Date().toISOString();
      const nextReaction = {
        userId: req.user.id,
        reactionId,
        reactionIcon,
        reactionName,
        reactedAt: now
      };

      if (existingReactionIndex > -1) {
        comment.reactions[existingReactionIndex] = nextReaction;
      } else {
        comment.reactions.push(nextReaction);
      }

      reactionsSummary = buildReactionSummary(comment.reactions);
      comment.updatedAt = new Date().toISOString();
      updatedComment = comment;

      if (isNewReaction) {
        const reactingUser = db.users.find((user) => resolveUserId(user) === req.user.id);
        if (reactingUser) {
          reactingUser.activity = reactingUser.activity || {
            postsCreated: 0,
            commentsPosted: 0,
            reactionsGiven: 0,
            likesReceived: 0,
            tournamentsWon: 0,
            tournamentsParticipated: 0
          };
          reactingUser.activity.reactionsGiven += 1;
          addRankPoints(reactingUser, RANK_POINT_VALUES.reaction);
          updateLeveledBadgeProgress(
            reactingUser,
            'badge_reactive',
            reactingUser.activity.reactionsGiven,
            100,
            20
          );
          reactingUser.updatedAt = now;
        }
      }
      return db;
    });

    res.json({
      msg: 'Reaction added successfully',
      reactions: reactionsSummary,
      comment: normalizeComment(updatedComment)
    });
  } catch (error) {
    if (error.code === 'COMMENT_NOT_FOUND') {
      return res.status(404).json({ msg: 'Comment not found' });
    }
    console.error('Error adding comment reaction:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
