import { v4 as uuidv4 } from 'uuid';
import {
  commentsRepo,
  fightsRepo,
  postsRepo,
  usersRepo,
  withRepositoryTransaction
} from '../repositories/index.js';
import { createNotification } from './notificationController.js';
import { findProfanityMatches } from '../utils/profanity.js';
import { addRankPoints, RANK_POINT_VALUES, updateLeveledBadgeProgress } from '../utils/rankSystem.js';
import { getUserDisplayName } from '../utils/userDisplayName.js';
import { logModerationAction } from '../utils/moderationAudit.js';
import { applyDailyActivityBonusAtomic } from '../utils/coinBonus.js';
import { parsePagination } from '../utils/pagination.js';
import { getReaction } from '../config/reactionCatalog.js';
import { getIdempotencyKey } from '../utils/idempotency.js';

const resolveUserId = (user) => user?.id || user?._id;
const resolveCommentId = (comment) => comment?.id || comment?._id;
const resolveRole = (user) => user?.role || 'user';
const isPostSoftDeleted = (post) =>
  Boolean(post?.moderation?.deleted?.isDeleted);

const assertPostActive = (post) => {
  if (!post || isPostSoftDeleted(post)) {
    const error = new Error('Post not found');
    error.code = 'POST_NOT_FOUND';
    throw error;
  }
};

const normalizeRepoContext = (dbOrContext) =>
  dbOrContext?.mongoDb || dbOrContext?.db
    ? dbOrContext
    : dbOrContext
      ? { db: dbOrContext }
      : undefined;

const assertCommentTargetActive = async (comment, dbOrContext) => {
  const context = normalizeRepoContext(dbOrContext);
  if (comment?.type === 'user_profile') return;
  if (comment?.type === 'fight') {
    const fightId = comment?.fightId || comment?.targetId;
    const standaloneFight = await fightsRepo.findById(fightId, 'id', context);
    if (standaloneFight) return;
    const fightPost = await postsRepo.findOneBy({ id: fightId, type: 'fight' }, {}, context);
    assertPostActive(fightPost);
    return;
  }
  const postId = comment?.postId || comment?.targetId;
  if (!postId) return;
  const post = await postsRepo.findById(postId, 'id', context);
  assertPostActive(post);
};

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

  const context = normalizeRepoContext(db);
  const admins = await usersRepo.findManyBy(
    { role: 'admin' },
    { limit: 100 },
    context
  );
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

const recordCommentActivity = async (context, userId, now) => {
  await usersRepo.updateById(userId, (user) => {
    user.activity = user.activity || {
      postsCreated: 0,
      commentsPosted: 0,
      reactionsGiven: 0,
      likesReceived: 0,
      tournamentsWon: 0,
      tournamentsParticipated: 0
    };
    user.activity.commentsPosted += 1;
    user.stats = user.stats || {};
    user.stats.comments = (user.stats.comments || 0) + 1;
    addRankPoints(user, RANK_POINT_VALUES.comment);
    updateLeveledBadgeProgress(
      user,
      'badge_commentator',
      user.activity.commentsPosted,
      100,
      20
    );
    user.updatedAt = now;
    return user;
  }, 'id', context);
  await applyDailyActivityBonusAtomic(userId, 'comment', 50, context);
};

const normalizeComment = (comment, viewerUserId = null) => {
  const commentId = resolveCommentId(comment);
  const threadId = comment.threadId || comment.parentId || commentId;
  const viewerReaction = viewerUserId
    ? (comment.reactions || []).find((reaction) => reaction.userId === viewerUserId)
    : null;
  const normalized = { ...comment };
  delete normalized.idempotencyKey;
  return {
    ...normalized,
    id: commentId,
    authorDisplayName: comment.authorDisplayName || comment.authorUsername || 'User',
    parentId: comment.parentId || null,
    threadId,
    reactions: buildReactionSummary(comment.reactions || []),
    userReaction: viewerReaction
      ? {
          id: viewerReaction.reactionId,
          icon: viewerReaction.reactionIcon,
          name: viewerReaction.reactionName
        }
      : null,
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
    const idempotencyKey = getIdempotencyKey(req);
    let createdComment;
    let idempotencyReplay = false;

    await withRepositoryTransaction(async (context) => {
      const post = await postsRepo.findById(postId, 'id', context);
      if (!post) {
        const error = new Error('Post not found');
        error.code = 'POST_NOT_FOUND';
        throw error;
      }
      assertPostActive(post);

      const author = await usersRepo.findById(req.user.id, 'id', context);
      if (!author) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      if (idempotencyKey) {
        const existingComment = await commentsRepo.findOneBy({
          authorId: req.user.id,
          postId,
          idempotencyKey
        }, {}, context);
        if (existingComment) {
          createdComment = existingComment;
          idempotencyReplay = true;
          return;
        }
      }

      const parentComment = parentId
        ? await commentsRepo.findById(parentId, 'id', context)
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
        authorDisplayName: getUserDisplayName(author),
        authorAvatar: buildAuthorAvatar(author),
        text: commentText,
        createdAt: now,
        updatedAt: now,
        likes: 0,
        likedBy: [],
        reactions: [],
        ...(idempotencyKey ? { idempotencyKey } : {})
      };

      if (idempotencyKey) {
        const inserted = await commentsRepo.insertIfAbsent(
          { authorId: req.user.id, postId, idempotencyKey },
          createdComment,
          context
        );
        if (!inserted.inserted) {
          createdComment = inserted.item;
          idempotencyReplay = true;
          return;
        }
      } else {
        await commentsRepo.insert(createdComment, context);
      }

      const matches = findProfanityMatches(commentText);
      if (matches.length) {
        await notifyAdminsForProfanity(context, {
          author,
          matches,
          text: commentText,
          sourceType: 'post_comment',
          postId,
          commentId
        });
      }

      await recordCommentActivity(context, req.user.id, now);

      if (parentComment) {
        const parentAuthor = await usersRepo.findById(
          parentComment.authorId,
          'id',
          context
        );
        if (shouldNotifyReply(parentAuthor, req.user.id)) {
          await createNotification(
            context,
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

    });

    if (idempotencyReplay) {
      res.set('Idempotency-Replayed', 'true');
    }
    res.json(normalizeComment(createdComment, req.user.id));
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
    if (error.code === 'INVALID_IDEMPOTENCY_KEY') {
      return res.status(400).json({ msg: error.message });
    }
    console.error('Error adding post comment:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get comments for a post
// @route   GET /api/comments/:postId or /api/comments/post/:postId
// @access  Public
export const getPostComments = async (req, res) => {
  const postId = req.params.postId || req.params.id;
  try {
    const post = await postsRepo.findById(postId);
    assertPostActive(post);
    const { page: pageNumber, limit: limitNumber } = parsePagination(req.query, {
      defaultLimit: 50,
      maxLimit: 100
    });
    const paged = await commentsRepo.findManyBy(
      {
        postId,
        $or: [{ type: 'post' }, { type: { $exists: false } }]
      },
      {
        sort: { createdAt: 1 },
        skip: (pageNumber - 1) * limitNumber,
        limit: limitNumber
      }
    );
    res.json(
      paged.map((comment) => normalizeComment(comment, req.user?.id || null))
    );
  } catch (error) {
    if (error.code === 'POST_NOT_FOUND') {
      return res.status(404).json({ msg: 'Post not found' });
    }
    console.error('Error fetching comments:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update comment
// @route   PUT /api/comments/:id
// @access  Private
export const updateComment = async (req, res) => {
  const text = req.body?.text ?? req.body?.content;

  try {
    let updatedComment;

    await withRepositoryTransaction(async (context) => {
      const comment = await commentsRepo.findById(req.params.id, 'id', context);
      if (!comment) {
        const error = new Error('Comment not found');
        error.code = 'COMMENT_NOT_FOUND';
        throw error;
      }
      await assertCommentTargetActive(comment, context);

      if (comment.authorId !== req.user.id) {
        const error = new Error('Access denied');
        error.code = 'ACCESS_DENIED';
        throw error;
      }

      updatedComment = await commentsRepo.updateById(req.params.id, (entry) => ({
        ...entry,
        text,
        updatedAt: new Date().toISOString(),
        edited: true
      }), 'id', context);
    });

    res.json({
      msg: 'Comment updated',
      comment: normalizeComment(updatedComment, req.user.id)
    });
  } catch (error) {
    if (error.code === 'COMMENT_NOT_FOUND') {
      return res.status(404).json({ msg: 'Comment not found' });
    }
    if (error.code === 'ACCESS_DENIED') {
      return res.status(403).json({ msg: 'Access denied' });
    }
    if (error.code === 'POST_NOT_FOUND') {
      return res.status(404).json({ msg: 'Post not found' });
    }
    console.error('Error updating comment:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete comment
// @route   DELETE /api/comments/:id
// @access  Private
export const deleteComment = async (req, res) => {
  try {
    await withRepositoryTransaction(async (context) => {
      const comment = await commentsRepo.findById(req.params.id, 'id', context);
      if (!comment) {
        const error = new Error('Comment not found');
        error.code = 'COMMENT_NOT_FOUND';
        throw error;
      }

      const user = await usersRepo.findById(req.user.id, 'id', context);
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

      const threadId = comment.threadId || resolveCommentId(comment);
      const threadComments = await commentsRepo.findManyBy(
        { threadId },
        {},
        context
      );
      const idsToDelete = new Set();
      const queue = [resolveCommentId(comment)];
      while (queue.length > 0) {
        const currentId = queue.pop();
        if (!currentId || idsToDelete.has(currentId)) continue;
        idsToDelete.add(currentId);
        for (const entry of threadComments) {
          if (entry.parentId === currentId) queue.push(resolveCommentId(entry));
        }
      }
      const { deletedCount = 0 } = await commentsRepo.removeManyBy(
        { id: { $in: [...idsToDelete] } },
        context
      );
      await logModerationAction({
        db: context,
        actor: user,
        action: 'comment.delete',
        targetType: 'comment',
        targetId: req.params.id,
        details: {
          ownComment: comment.authorId === req.user.id,
          deletedCount
        }
      });
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
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Like/unlike comment
// @route   POST /api/comments/:id/like
// @access  Private
export const toggleCommentLike = async (req, res) => {
  try {
    let likes = 0;
    let liked = false;

    await withRepositoryTransaction(async (context) => {
      const comment = await commentsRepo.findById(req.params.id, 'id', context);
      if (!comment) {
        const error = new Error('Comment not found');
        error.code = 'COMMENT_NOT_FOUND';
        throw error;
      }
      await assertCommentTargetActive(comment, context);

      await commentsRepo.updateById(req.params.id, (entry) => {
        entry.likedBy = Array.isArray(entry.likedBy) ? entry.likedBy : [];
        const alreadyLiked = entry.likedBy.includes(req.user.id);
        entry.likedBy = alreadyLiked
          ? entry.likedBy.filter((id) => id !== req.user.id)
          : [...entry.likedBy, req.user.id];
        liked = !alreadyLiked;
        entry.likes = entry.likedBy.length;
        likes = entry.likes;
        entry.updatedAt = new Date().toISOString();
        return entry;
      }, 'id', context);
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
    if (error.code === 'POST_NOT_FOUND') {
      return res.status(404).json({ msg: 'Post not found' });
    }
    console.error('Error toggling comment like:', error.message);
    res.status(500).json({ message: 'Server error' });
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
    const idempotencyKey = getIdempotencyKey(req);
    let createdComment;
    let idempotencyReplay = false;

    await withRepositoryTransaction(async (context) => {
      const targetUser = await usersRepo.findById(userId, 'id', context);
      if (!targetUser) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      const author = await usersRepo.findById(req.user.id, 'id', context);
      if (!author) {
        const error = new Error('Author not found');
        error.code = 'AUTHOR_NOT_FOUND';
        throw error;
      }

      if (idempotencyKey) {
        const existingComment = await commentsRepo.findOneBy({
          authorId: req.user.id,
          type: 'user_profile',
          targetId: userId,
          idempotencyKey
        }, {}, context);
        if (existingComment) {
          createdComment = existingComment;
          idempotencyReplay = true;
          return;
        }
      }

      const parentComment = parentId
        ? await commentsRepo.findById(parentId, 'id', context)
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
        authorDisplayName: getUserDisplayName(author),
        authorAvatar: buildAuthorAvatar(author),
        text: text.trim(),
        createdAt: now,
        updatedAt: now,
        likes: 0,
        likedBy: [],
        reactions: [],
        ...(idempotencyKey ? { idempotencyKey } : {})
      };

      if (idempotencyKey) {
        const inserted = await commentsRepo.insertIfAbsent(
          { authorId: req.user.id, targetId: userId, idempotencyKey },
          createdComment,
          context
        );
        if (!inserted.inserted) {
          createdComment = inserted.item;
          idempotencyReplay = true;
          return;
        }
      } else {
        await commentsRepo.insert(createdComment, context);
      }
      const matches = findProfanityMatches(createdComment.text);
      if (matches.length) {
        await notifyAdminsForProfanity(context, {
          author,
          matches,
          text: createdComment.text,
          sourceType: 'profile_comment',
          userId,
          commentId
        });
      }
      await recordCommentActivity(context, req.user.id, now);
    });

    if (idempotencyReplay) {
      res.set('Idempotency-Replayed', 'true');
    }
    res.json(normalizeComment(createdComment, req.user.id));
  } catch (error) {
    if (error.code === 'USER_NOT_FOUND' || error.code === 'AUTHOR_NOT_FOUND') {
      return res.status(404).json({ msg: 'User not found' });
    }
    if (error.code === 'PARENT_NOT_FOUND') {
      return res.status(404).json({ msg: 'Parent comment not found' });
    }
    if (error.code === 'INVALID_IDEMPOTENCY_KEY') {
      return res.status(400).json({ msg: error.message });
    }
    console.error('Error adding user profile comment:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get comments for user profile
// @route   GET /api/comments/user/:userId
// @access  Public
export const getUserComments = async (req, res) => {
  const { userId } = req.params;

  try {
    const { page, limit } = parsePagination(req.query, {
      defaultLimit: 50,
      maxLimit: 100
    });
    const comments = await commentsRepo.findManyBy(
      { type: 'user_profile', targetId: userId },
      { sort: { createdAt: -1 }, skip: (page - 1) * limit, limit }
    );
    res.json(comments.map((comment) => normalizeComment(comment)));
  } catch (error) {
    console.error('Error fetching user comments:', error.message);
    res.status(500).json({ message: 'Server error' });
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
    const idempotencyKey = getIdempotencyKey(req);
    let createdComment;
    let idempotencyReplay = false;

    await withRepositoryTransaction(async (context) => {
      const fight = await fightsRepo.findById(fightId, 'id', context);
      const fightPost = !fight
        ? await postsRepo.findOneBy({ id: fightId, type: 'fight' }, {}, context)
        : null;
      if (!fight && !fightPost) {
        const error = new Error('Fight not found');
        error.code = 'FIGHT_NOT_FOUND';
        throw error;
      }
      if (fightPost) {
        assertPostActive(fightPost);
      }

      const author = await usersRepo.findById(req.user.id, 'id', context);
      if (!author) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      if (idempotencyKey) {
        const existingComment = await commentsRepo.findOneBy({
          authorId: req.user.id,
          type: 'fight',
          fightId,
          idempotencyKey
        }, {}, context);
        if (existingComment) {
          createdComment = existingComment;
          idempotencyReplay = true;
          return;
        }
      }

      const parentComment = parentId
        ? await commentsRepo.findById(parentId, 'id', context)
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
        authorDisplayName: getUserDisplayName(author),
        authorAvatar: buildAuthorAvatar(author),
        text: text.trim(),
        createdAt: now,
        updatedAt: now,
        likes: 0,
        likedBy: [],
        reactions: [],
        ...(idempotencyKey ? { idempotencyKey } : {})
      };

      if (idempotencyKey) {
        const inserted = await commentsRepo.insertIfAbsent(
          { authorId: req.user.id, fightId, idempotencyKey },
          createdComment,
          context
        );
        if (!inserted.inserted) {
          createdComment = inserted.item;
          idempotencyReplay = true;
          return;
        }
      } else {
        await commentsRepo.insert(createdComment, context);
      }
      const matches = findProfanityMatches(createdComment.text);
      if (matches.length) {
        await notifyAdminsForProfanity(context, {
          author,
          matches,
          text: createdComment.text,
          sourceType: 'fight_comment',
          fightId,
          commentId
        });
      }
      await recordCommentActivity(context, req.user.id, now);
    });

    if (idempotencyReplay) {
      res.set('Idempotency-Replayed', 'true');
    }
    res.json(normalizeComment(createdComment, req.user.id));
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
    if (error.code === 'POST_NOT_FOUND') {
      return res.status(404).json({ msg: 'Post not found' });
    }
    if (error.code === 'INVALID_IDEMPOTENCY_KEY') {
      return res.status(400).json({ msg: error.message });
    }
    console.error('Error adding fight comment:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get comments for fight
// @route   GET /api/comments/fight/:fightId
// @access  Public
export const getFightComments = async (req, res) => {
  const { fightId } = req.params;
  try {
    const [standaloneFight, fightPost] = await Promise.all([
      fightsRepo.findById(fightId),
      postsRepo.findOneBy({ id: fightId, type: 'fight' })
    ]);
    if (!standaloneFight) {
      assertPostActive(fightPost);
    }
    const { page: pageNumber, limit: limitNumber } = parsePagination(req.query, {
      defaultLimit: 50,
      maxLimit: 100
    });
    const query = { type: 'fight', fightId };
    const [paged, totalComments] = await Promise.all([
      commentsRepo.findManyBy(query, {
        sort: { createdAt: -1 },
        skip: (pageNumber - 1) * limitNumber,
        limit: limitNumber
      }),
      commentsRepo.countBy(query)
    ]);
    const formatted = paged.map((comment) => normalizeComment(comment));
    res.json({ comments: formatted, length: totalComments });
  } catch (error) {
    if (error.code === 'POST_NOT_FOUND') {
      return res.status(404).json({ msg: 'Fight not found' });
    }
    console.error('Error fetching fight comments:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Add or update a reaction on a comment
// @route   POST /api/comments/:id/reaction
// @access  Private
export const addCommentReaction = async (req, res) => {
  const reaction = getReaction(req.body?.reactionId);
  if (!reaction) {
    return res.status(400).json({ msg: 'Invalid reaction' });
  }
  const reactionId = reaction.id;
  const reactionIcon = reaction.icon;
  const reactionName = reaction.name;

  try {
    let reactionsSummary = [];
    let updatedComment;

    await withRepositoryTransaction(async (context) => {
      const comment = await commentsRepo.findById(req.params.id, 'id', context);
      if (!comment) {
        const error = new Error('Comment not found');
        error.code = 'COMMENT_NOT_FOUND';
        throw error;
      }
      await assertCommentTargetActive(comment, context);

      const currentReactions = Array.isArray(comment.reactions) ? comment.reactions : [];
      const existingReactionIndex = currentReactions.findIndex(
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

      updatedComment = await commentsRepo.updateById(req.params.id, (entry) => {
        entry.reactions = Array.isArray(entry.reactions) ? entry.reactions : [];
        const existingIndex = entry.reactions.findIndex(
          (storedReaction) => storedReaction.userId === req.user.id
        );
        if (existingIndex > -1) entry.reactions[existingIndex] = nextReaction;
        else entry.reactions.push(nextReaction);
        entry.updatedAt = now;
        reactionsSummary = buildReactionSummary(entry.reactions);
        return entry;
      }, 'id', context);

      if (isNewReaction) {
        await usersRepo.updateById(req.user.id, (reactingUser) => {
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
          return reactingUser;
        }, 'id', context);
      }
    });

    res.json({
      msg: 'Reaction added successfully',
      reactions: reactionsSummary,
      comment: normalizeComment(updatedComment, req.user.id)
    });
  } catch (error) {
    if (error.code === 'COMMENT_NOT_FOUND') {
      return res.status(404).json({ msg: 'Comment not found' });
    }
    if (error.code === 'POST_NOT_FOUND') {
      return res.status(404).json({ msg: 'Post not found' });
    }
    console.error('Error adding comment reaction:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Remove the current user's reaction from a comment
// @route   DELETE /api/comments/:id/reaction/:reactionId
// @access  Private
export const removeCommentReaction = async (req, res) => {
  try {
    let reactionsSummary = [];
    let removed = false;

    await withRepositoryTransaction(async (context) => {
      const comment = await commentsRepo.findById(req.params.id, 'id', context);
      if (!comment) {
        const error = new Error('Comment not found');
        error.code = 'COMMENT_NOT_FOUND';
        throw error;
      }
      await assertCommentTargetActive(comment, context);

      await commentsRepo.updateById(req.params.id, (entry) => {
        entry.reactions = Array.isArray(entry.reactions) ? entry.reactions : [];
        const beforeCount = entry.reactions.length;
        entry.reactions = entry.reactions.filter(
          (storedReaction) =>
            storedReaction.userId !== req.user.id ||
            storedReaction.reactionId !== req.params.reactionId
        );
        removed = entry.reactions.length !== beforeCount;
        reactionsSummary = buildReactionSummary(entry.reactions);
        if (removed) entry.updatedAt = new Date().toISOString();
        return entry;
      }, 'id', context);
    });

    if (!removed) {
      return res.status(404).json({ msg: 'Reaction not found' });
    }
    return res.json({
      msg: 'Reaction removed successfully',
      reactions: reactionsSummary
    });
  } catch (error) {
    if (error.code === 'COMMENT_NOT_FOUND') {
      return res.status(404).json({ msg: 'Comment not found' });
    }
    if (error.code === 'POST_NOT_FOUND') {
      return res.status(404).json({ msg: 'Post not found' });
    }
    console.error('Error removing comment reaction:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};
