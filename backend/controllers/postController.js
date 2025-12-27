import { v4 as uuidv4 } from 'uuid';
import { readDb, updateDb } from '../services/jsonDb.js';
import { autoTagPost } from '../utils/tagging.js';
import { createNotification } from './notificationController.js';
import { findProfanityMatches } from '../utils/profanity.js';

const resolveUserId = (user) => user?.id || user?._id;
const resolveRole = (user) => user?.role || 'user';

const buildAuthor = (user) => {
  if (!user) return null;
  const profile = user.profile || {};
  return {
    id: resolveUserId(user),
    username: user.username,
    profilePicture: profile.profilePicture || profile.avatar || '',
    rank: user.stats?.rank || 'Rookie'
  };
};

const normalizeFightTeam = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === 'string' ? entry : entry?.name))
      .filter(Boolean)
      .join(', ');
  }
  if (typeof value === 'string') return value;
  return value ? String(value) : '';
};

const normalizePostForResponse = (post, users) => {
  const author = users.find((user) => resolveUserId(user) === post.authorId);
  const normalized = { ...post };
  const postId = normalized.id || normalized._id;

  if (normalized.fight) {
    normalized.fight = {
      ...normalized.fight,
      teamA: normalizeFightTeam(normalized.fight.teamA),
      teamB: normalizeFightTeam(normalized.fight.teamB),
      votes: {
        teamA: normalized.fight.votes?.teamA || 0,
        teamB: normalized.fight.votes?.teamB || 0,
        draw: normalized.fight.votes?.draw || 0,
        voters: normalized.fight.votes?.voters || []
      }
    };
  }

  return {
    ...normalized,
    id: postId,
    author: buildAuthor(author)
  };
};

const findPostById = (posts, id) =>
  posts.find((entry) => entry.id === id || entry._id === id);

const sortPosts = (posts, sortBy) => {
  if (sortBy === 'likes') {
    return [...posts].sort(
      (a, b) => (b.likes?.length || 0) - (a.likes?.length || 0)
    );
  }
  return [...posts].sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  );
};

const buildReactionSummary = (reactions = []) => {
  const reactionCounts = {};
  reactions.forEach((reaction) => {
    const icon = reaction?.reactionIcon || reaction?.icon;
    const name = reaction?.reactionName || reaction?.name || '';
    if (!icon) return;
    const key = `${icon}-${name}`;
    reactionCounts[key] = (reactionCounts[key] || 0) + 1;
  });

  return Object.entries(reactionCounts).map(([key, count]) => {
    const separatorIndex = key.indexOf('-');
    const icon = separatorIndex >= 0 ? key.slice(0, separatorIndex) : key;
    const name = separatorIndex >= 0 ? key.slice(separatorIndex + 1) : '';
    return { icon, name, count };
  });
};

const buildCommentCountByPostId = (comments = []) => {
  const counts = new Map();
  comments.forEach((comment) => {
    const isPostComment = comment?.type === 'post' || !comment?.type;
    if (!isPostComment) return;
    const postId = comment.postId;
    if (!postId) return;
    counts.set(postId, (counts.get(postId) || 0) + 1);
  });
  return counts;
};

const notifyAdminsForProfanity = async (db, payload) => {
  const { author, postId, text, matches } = payload || {};
  if (!matches || matches.length === 0) return;
  const admins = (db.users || []).filter((user) => resolveRole(user) === 'admin');
  if (!admins.length) return;

  const authorId = resolveUserId(author);
  const summary = matches.join(', ');
  const title = 'Profanity detected in post';
  const content = `${author?.username || 'User'} used flagged words: ${summary}`;

  await Promise.all(
    admins.map((admin) =>
      createNotification(db, resolveUserId(admin), 'moderation', title, content, {
        sourceType: 'post',
        postId,
        authorId,
        matches,
        text
      })
    )
  );
};

export const getAllPosts = async (req, res) => {
  const { page = 1, limit = 10, sortBy = 'createdAt', category } = req.query;
  try {
    const db = await readDb();
    const normalizedCategory = String(category || '').toLowerCase();
    let filteredPosts = db.posts || [];
    const commentCounts = buildCommentCountByPostId(db.comments || []);

    if (normalizedCategory && normalizedCategory !== 'all') {
      if (normalizedCategory === 'fight') {
        filteredPosts = filteredPosts.filter((post) => post.type === 'fight');
      } else {
        filteredPosts = filteredPosts.filter((post) => {
          if (post.type === 'fight') return false;
          const postCategory = String(
            post.category || (post.type !== 'fight' ? 'discussion' : '')
          ).toLowerCase();
          return postCategory === normalizedCategory;
        });
      }
    }

    const sortedPosts = sortPosts(filteredPosts, sortBy);
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const pagedPosts = sortedPosts.slice(
      (pageNumber - 1) * limitNumber,
      pageNumber * limitNumber
    );

    const postsWithUserInfo = pagedPosts.map((post) => {
      const normalized = normalizePostForResponse(post, db.users);
      const postId = normalized.id;
      return {
        ...normalized,
        commentCount: commentCounts.get(postId) || 0,
        reactionsSummary: buildReactionSummary(post.reactions || [])
      };
    });

    res.json({
      posts: postsWithUserInfo,
      totalPosts: filteredPosts.length,
      currentPage: pageNumber,
      totalPages: Math.ceil(filteredPosts.length / limitNumber)
    });
  } catch (err) {
    console.error('Error fetching all posts from JSON:', err.message);
    res.status(500).send('Server Error');
  }
};

export const getPostsByUser = async (req, res) => {
  const { userId } = req.params;

  try {
    const db = await readDb();
    const posts = db.posts.filter((post) => post.authorId === userId);
    const sorted = sortPosts(posts, 'createdAt');
    const commentCounts = buildCommentCountByPostId(db.comments || []);

    const postsWithUserInfo = sorted.map((post) => {
      const normalized = normalizePostForResponse(post, db.users);
      const postId = normalized.id;
      return {
        ...normalized,
        commentCount: commentCounts.get(postId) || 0,
        reactionsSummary: buildReactionSummary(post.reactions || [])
      };
    });

    res.json(postsWithUserInfo);
  } catch (err) {
    console.error('Error fetching user posts:', err.message);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

export const getPostById = async (req, res) => {
  const { id } = req.params;

  try {
    const db = await readDb();
    const post = findPostById(db.posts, id);

    if (!post) {
      return res.status(404).json({ msg: 'Post not found' });
    }

    const normalized = normalizePostForResponse(post, db.users);
    const commentCount = (db.comments || []).filter((comment) => {
      const isPostComment = comment?.type === 'post' || !comment?.type;
      return isPostComment && comment.postId === normalized.id;
    }).length;

    res.json({
      ...normalized,
      commentCount,
      reactionsSummary: buildReactionSummary(post.reactions || [])
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

export const createPost = async (req, res) => {
  const {
    title,
    content,
    type,
    teamA,
    teamB,
    photos,
    pollOptions,
    voteDuration,
    isOfficial,
    moderatorCreated,
    category
  } = req.body;

  if (!title || !content) {
    return res.status(400).json({ message: 'Title and content are required.' });
  }

  try {
    const now = new Date();
    const postType = type || 'discussion';
    const resolveLockTime = (duration) => {
      if (!duration) {
        return new Date(now.getTime() + 72 * 60 * 60 * 1000);
      }
      const normalized = String(duration).toLowerCase();
      if (normalized === 'none' || normalized === 'no-limit') return null;
      const daysMap = {
        '1d': 1,
        '2d': 2,
        '3d': 3,
        '7d': 7
      };
      const days = daysMap[normalized];
      if (!days) {
        return new Date(now.getTime() + 72 * 60 * 60 * 1000);
      }
      return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    };

    let createdPost;
    let author;
    const resolvedCategory = postType === 'fight' ? null : (category || 'discussion');

    await updateDb(async (db) => {
      author = db.users.find((user) => resolveUserId(user) === req.user.id);
      if (!author) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      if (isOfficial && author.role !== 'moderator' && author.role !== 'admin') {
        const error = new Error('Only moderators or admins can create official fights');
        error.code = 'FORBIDDEN_OFFICIAL';
        throw error;
      }

      const postData = {
        id: uuidv4(),
        title,
        content,
        type: postType,
        authorId: req.user.id,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        likes: [],
        comments: [],
        views: 0,
        photos: Array.isArray(photos) ? photos : [],
        poll: null,
        fight: null,
        reactions: [],
        isOfficial: Boolean(isOfficial),
        moderatorCreated: Boolean(moderatorCreated),
        category: resolvedCategory,
        featured: false,
        tags: [],
        autoTags: {
          universes: [],
          characters: [],
          powerTiers: [],
          categories: []
        }
      };

      if (postType === 'fight') {
        const lockTime = resolveLockTime(voteDuration);
        postData.fight = {
          teamA: teamA || '',
          teamB: teamB || '',
          votes: {
            teamA: 0,
            teamB: 0,
            draw: 0,
            voters: []
          },
          status: 'active',
          isOfficial: Boolean(isOfficial),
          lockTime: lockTime ? lockTime.toISOString() : null,
          winner: null,
          winnerTeam: null
        };
        postData.poll = {
          options: [teamA || '', teamB || ''],
          votes: { voters: [] }
        };
      } else if (
        postType === 'other' &&
        Array.isArray(pollOptions) &&
        pollOptions.some((opt) => opt.trim() !== '')
      ) {
        postData.poll = {
          options: pollOptions.filter((opt) => opt.trim() !== ''),
          votes: { voters: [] }
        };
      }

      const autoTagPayload = autoTagPost(db, {
        title,
        content,
        teamA: postData.fight?.teamA || teamA,
        teamB: postData.fight?.teamB || teamB,
        fight: postData.fight
      });
      postData.tags = autoTagPayload.tags;
      postData.autoTags = autoTagPayload.autoTags;

      db.posts.push(postData);

      const matches = findProfanityMatches(`${title} ${content}`);
      if (matches.length) {
        await notifyAdminsForProfanity(db, {
          author,
          postId: postData.id,
          text: content,
          matches
        });
      }

      if (!author.activity) {
        author.activity = {
          postsCreated: 0,
          commentsPosted: 0,
          likesReceived: 0,
          tournamentsWon: 0,
          tournamentsParticipated: 0
        };
      }
      author.activity.postsCreated += 1;
      author.updatedAt = now.toISOString();

      createdPost = postData;
      return db;
    });

    res.status(201).json({
      ...normalizePostForResponse(createdPost, [author]),
      commentCount: 0,
      reactionsSummary: buildReactionSummary(createdPost.reactions || []),
      author: buildAuthor(author)
    });
  } catch (err) {
    if (err.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: err.message });
    }
    if (err.code === 'FORBIDDEN_OFFICIAL') {
      return res.status(403).json({ message: err.message });
    }
    console.error('Error creating post:', err.message);
    res.status(500).send('Server Error');
  }
};

export const updatePost = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    let updatedPost;

    await updateDb((db) => {
      const post = findPostById(db.posts, id);
      if (!post) {
        const error = new Error('Post not found');
        error.code = 'POST_NOT_FOUND';
        throw error;
      }

      const user = db.users.find((entry) => resolveUserId(entry) === req.user.id);
      if (!user) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      if (
        post.authorId !== req.user.id &&
        user.role !== 'moderator' &&
        user.role !== 'admin'
      ) {
        const error = new Error('Access denied');
        error.code = 'ACCESS_DENIED';
        throw error;
      }

      Object.assign(post, updates);
      post.updatedAt = new Date().toISOString();
      updatedPost = post;
      return db;
    });

    res.json(updatedPost);
  } catch (err) {
    if (err.code === 'POST_NOT_FOUND') {
      return res.status(404).json({ msg: 'Post not found' });
    }
    if (err.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ msg: 'User not found' });
    }
    if (err.code === 'ACCESS_DENIED') {
      return res.status(403).json({ msg: 'Access denied' });
    }
    console.error('Error updating post:', err.message);
    res.status(500).send('Server Error');
  }
};

export const deletePost = async (req, res) => {
  const { id } = req.params;

  try {
    await updateDb((db) => {
      const post = findPostById(db.posts, id);
      if (!post) {
        const error = new Error('Post not found');
        error.code = 'POST_NOT_FOUND';
        throw error;
      }

      const user = db.users.find((entry) => resolveUserId(entry) === req.user.id);
      if (!user) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      if (
        post.authorId !== req.user.id &&
        user.role !== 'moderator' &&
        user.role !== 'admin'
      ) {
        const error = new Error('Access denied');
        error.code = 'ACCESS_DENIED';
        throw error;
      }

      db.posts = db.posts.filter((entry) => entry.id !== id);
      db.comments = db.comments.filter((comment) => comment.postId !== id);
      return db;
    });

    res.json({ msg: 'Post deleted successfully' });
  } catch (err) {
    if (err.code === 'POST_NOT_FOUND') {
      return res.status(404).json({ msg: 'Post not found' });
    }
    if (err.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ msg: 'User not found' });
    }
    if (err.code === 'ACCESS_DENIED') {
      return res.status(403).json({ msg: 'Access denied' });
    }
    console.error('Error deleting post:', err.message);
    res.status(500).send('Server Error');
  }
};

export const toggleLike = async (req, res) => {
  const { id } = req.params;

  try {
    let likesCount = 0;
    let isLiked = false;

    await updateDb((db) => {
      const post = findPostById(db.posts, id);
      if (!post) {
        const error = new Error('Post not found');
        error.code = 'POST_NOT_FOUND';
        throw error;
      }

      post.likes = Array.isArray(post.likes) ? post.likes : [];
      const index = post.likes.findIndex((like) => like.userId === req.user.id);
      const wasLiked = index > -1;

      if (wasLiked) {
        post.likes.splice(index, 1);
        isLiked = false;
      } else {
        post.likes.push({ userId: req.user.id, likedAt: new Date().toISOString() });
        isLiked = true;

        const author = db.users.find(
          (entry) => resolveUserId(entry) === post.authorId
        );
        if (author) {
          author.activity = author.activity || {
            postsCreated: 0,
            likesReceived: 0,
            commentsPosted: 0,
            tournamentsWon: 0,
            tournamentsParticipated: 0
          };
          author.activity.likesReceived += 1;
        }
      }

      likesCount = post.likes.length;
      post.updatedAt = new Date().toISOString();
      return db;
    });

    res.json({
      msg: isLiked ? 'Post liked' : 'Post unliked',
      likesCount,
      isLiked
    });
  } catch (err) {
    if (err.code === 'POST_NOT_FOUND') {
      return res.status(404).json({ msg: 'Post not found' });
    }
    console.error('Error toggling like:', err.message);
    res.status(500).send('Server Error');
  }
};

export const voteInPoll = async (req, res) => {
  const { id } = req.params;
  const { optionIndex } = req.body;

  try {
    let optionVotes = 0;
    let totalVotes = 0;

    await updateDb((db) => {
      const post = findPostById(db.posts, id);
      if (!post) {
        const error = new Error('Post not found');
        error.code = 'POST_NOT_FOUND';
        throw error;
      }

      if (!post.poll || !Array.isArray(post.poll.options)) {
        const error = new Error('Post does not have a poll');
        error.code = 'NO_POLL';
        throw error;
      }

      if (optionIndex < 0 || optionIndex >= post.poll.options.length) {
        const error = new Error('Invalid option index');
        error.code = 'INVALID_OPTION';
        throw error;
      }

      post.poll.votes = post.poll.votes || { voters: [] };
      const alreadyVoted = post.poll.votes.voters.find(
        (vote) => vote.userId === req.user.id
      );
      if (alreadyVoted) {
        const error = new Error('User already voted in this poll');
        error.code = 'ALREADY_VOTED';
        throw error;
      }

      post.poll.votes.voters.push({
        userId: req.user.id,
        optionIndex,
        votedAt: new Date().toISOString()
      });

      optionVotes = post.poll.votes.voters.filter(
        (vote) => vote.optionIndex === optionIndex
      ).length;
      totalVotes = post.poll.votes.voters.length;
      post.updatedAt = new Date().toISOString();
      return db;
    });

    res.json({
      msg: 'Vote recorded successfully',
      optionVotes,
      totalVotes,
      votedOption: optionIndex
    });
  } catch (err) {
    if (err.code === 'POST_NOT_FOUND') {
      return res.status(404).json({ msg: 'Post not found' });
    }
    if (err.code === 'NO_POLL') {
      return res.status(400).json({ msg: 'Post does not have a poll' });
    }
    if (err.code === 'INVALID_OPTION') {
      return res.status(400).json({ msg: 'Invalid option index' });
    }
    if (err.code === 'ALREADY_VOTED') {
      return res.status(400).json({ msg: 'User already voted in this poll' });
    }
    console.error('Error voting in poll:', err.message);
    res.status(500).send('Server Error');
  }
};

export const getOfficialFights = async (req, res) => {
  const { limit = 10 } = req.query;

  try {
    const db = await readDb();
    const fights = db.posts.filter(
      (post) => post.isOfficial && post.type === 'fight' && post.fight?.status === 'active'
    );
    const sorted = sortPosts(fights, 'createdAt').slice(0, Number(limit));
    const fightsWithUserInfo = sorted.map((post) =>
      normalizePostForResponse(post, db.users)
    );

    res.json({
      fights: fightsWithUserInfo,
      totalFights: fights.length
    });
  } catch (err) {
    console.error('Error fetching official fights:', err.message);
    res.status(500).send('Server Error');
  }
};

export const voteInFight = async (req, res) => {
  const { id } = req.params;
  const { team } = req.body;

  try {
    let updatedVotes;

    await updateDb((db) => {
      const post = findPostById(db.posts, id);
      if (!post) {
        const error = new Error('Post not found');
        error.code = 'POST_NOT_FOUND';
        throw error;
      }

      if (post.type !== 'fight' || !post.fight) {
        const error = new Error('Post is not a fight post');
        error.code = 'NOT_FIGHT';
        throw error;
      }

      if (post.fight.status === 'locked' || post.fight.status === 'completed') {
        const error = new Error('This fight has ended and is no longer accepting votes');
        error.code = 'FIGHT_ENDED';
        throw error;
      }

      if (post.fight.lockTime && new Date() > new Date(post.fight.lockTime)) {
        const error = new Error('This fight has exceeded the voting period and is now locked');
        error.code = 'FIGHT_LOCKED';
        throw error;
      }

      if (!['A', 'B', 'draw'].includes(team)) {
        const error = new Error('Invalid team choice');
        error.code = 'INVALID_TEAM';
        throw error;
      }

      post.fight.votes = post.fight.votes || { teamA: 0, teamB: 0, draw: 0, voters: [] };
      post.fight.votes.teamA = post.fight.votes.teamA || 0;
      post.fight.votes.teamB = post.fight.votes.teamB || 0;
      post.fight.votes.draw = post.fight.votes.draw || 0;
      post.fight.votes.voters = post.fight.votes.voters || [];

      const existingVoteIndex = post.fight.votes.voters.findIndex(
        (vote) => vote.userId === req.user.id
      );

      if (existingVoteIndex > -1) {
        const prevTeam = post.fight.votes.voters[existingVoteIndex].team;
        if (prevTeam === 'A') post.fight.votes.teamA = Math.max(0, post.fight.votes.teamA - 1);
        if (prevTeam === 'B') post.fight.votes.teamB = Math.max(0, post.fight.votes.teamB - 1);
        if (prevTeam === 'draw') post.fight.votes.draw = Math.max(0, post.fight.votes.draw - 1);
        post.fight.votes.voters[existingVoteIndex].team = team;
        post.fight.votes.voters[existingVoteIndex].votedAt = new Date().toISOString();
      } else {
        post.fight.votes.voters.push({
          userId: req.user.id,
          team,
          votedAt: new Date().toISOString()
        });
      }

      if (team === 'A') post.fight.votes.teamA += 1;
      if (team === 'B') post.fight.votes.teamB += 1;
      if (team === 'draw') post.fight.votes.draw += 1;

      updatedVotes = post.fight.votes;
      post.updatedAt = new Date().toISOString();
      return db;
    });

    res.json({
      msg: 'Vote recorded successfully',
      votes: updatedVotes
    });
  } catch (err) {
    if (err.code === 'POST_NOT_FOUND') {
      return res.status(404).json({ msg: 'Post not found' });
    }
    if (err.code === 'NOT_FIGHT') {
      return res.status(400).json({ msg: 'Post is not a fight post' });
    }
    if (err.code === 'FIGHT_ENDED' || err.code === 'FIGHT_LOCKED') {
      return res.status(400).json({ msg: err.message });
    }
    if (err.code === 'INVALID_TEAM') {
      return res.status(400).json({ msg: 'Invalid team choice' });
    }
    console.error('Error voting in fight:', err.message);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

export const addReaction = async (req, res) => {
  const { id } = req.params;
  const { reactionId, reactionIcon, reactionName } = req.body;

  try {
    let reactionsArray = [];

    await updateDb((db) => {
      const post = findPostById(db.posts, id);
      if (!post) {
        const error = new Error('Post not found');
        error.code = 'POST_NOT_FOUND';
        throw error;
      }

      post.reactions = Array.isArray(post.reactions) ? post.reactions : [];
      const existingReactionIndex = post.reactions.findIndex(
        (reaction) => reaction.userId === req.user.id
      );

      const nextReaction = {
        userId: req.user.id,
        reactionId,
        reactionIcon,
        reactionName,
        reactedAt: new Date().toISOString()
      };

      if (existingReactionIndex > -1) {
        post.reactions[existingReactionIndex] = nextReaction;
      } else {
        post.reactions.push(nextReaction);
      }

      reactionsArray = buildReactionSummary(post.reactions);

      post.updatedAt = new Date().toISOString();
      return db;
    });

    res.json({
      msg: 'Reaction added successfully',
      reactions: reactionsArray
    });
  } catch (err) {
    if (err.code === 'POST_NOT_FOUND') {
      return res.status(404).json({ msg: 'Post not found' });
    }
    console.error('Error adding reaction:', err.message);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

export const removeReaction = async (req, res) => {
  const { id, reactionId } = req.params;

  try {
    let reactionsArray = [];
    let removed = false;

    await updateDb((db) => {
      const post = findPostById(db.posts, id);
      if (!post) {
        const error = new Error('Post not found');
        error.code = 'POST_NOT_FOUND';
        throw error;
      }

      post.reactions = Array.isArray(post.reactions) ? post.reactions : [];
      const beforeCount = post.reactions.length;

      post.reactions = post.reactions.filter((reaction) => {
        if (reaction.userId !== req.user.id) {
          return true;
        }
        if (!reactionId) {
          return false;
        }
        return reaction.reactionId !== reactionId;
      });

      removed = post.reactions.length !== beforeCount;
      reactionsArray = buildReactionSummary(post.reactions);
      post.updatedAt = new Date().toISOString();
      return db;
    });

    if (!removed) {
      return res.status(404).json({ msg: 'Reaction not found' });
    }

    res.json({
      msg: 'Reaction removed successfully',
      reactions: reactionsArray
    });
  } catch (err) {
    if (err.code === 'POST_NOT_FOUND') {
      return res.status(404).json({ msg: 'Post not found' });
    }
    console.error('Error removing reaction:', err.message);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};
