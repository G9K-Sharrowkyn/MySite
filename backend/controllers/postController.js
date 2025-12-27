import { v4 as uuidv4 } from 'uuid';
import { readDb, updateDb } from '../services/jsonDb.js';
import { autoTagPost } from '../utils/tagging.js';
import { createNotification } from './notificationController.js';
import { findProfanityMatches } from '../utils/profanity.js';
import { addRankPoints, getRankInfo, RANK_POINT_VALUES, updateLeveledBadgeProgress } from '../utils/rankSystem.js';

const resolveUserId = (user) => user?.id || user?._id;
const resolveRole = (user) => user?.role || 'user';

const buildAuthor = (user) => {
  if (!user) return null;
  const profile = user.profile || {};
  const rankInfo = getRankInfo(user.stats?.points || 0);
  return {
    id: resolveUserId(user),
    username: user.username,
    profilePicture: profile.profilePicture || profile.avatar || '',
    rank: rankInfo.rank
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
  const { category } = req.query; // Filter by category: 'all', 'fight', 'discussion', 'article', 'question'

  try {
    const db = await readDb();
    let posts = db.posts.filter((post) => post.authorId === userId);

    // Apply category filter if specified
    if (category && category !== 'all') {
      if (category === 'fight') {
        // Fights have type='fight'
        posts = posts.filter((post) => post.type === 'fight');
      } else {
        // Other categories (discussion, article, question) are stored in post.category
        posts = posts.filter((post) => post.category === category || post.type === category);
      }
    }

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
            reactionsGiven: 0,
            likesReceived: 0,
            tournamentsWon: 0,
            tournamentsParticipated: 0
          };
        }
        author.activity.postsCreated += 1;
        if (postType === 'fight') {
          author.activity.fightsCreated = (author.activity.fightsCreated || 0) + 1;
          updateLeveledBadgeProgress(
            author,
            'badge_manager',
            author.activity.fightsCreated,
            20,
            20
          );
        }
        addRankPoints(author, RANK_POINT_VALUES.post);
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
      const isNewReaction = existingReactionIndex === -1;

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
          reactingUser.updatedAt = new Date().toISOString();
        }
      }
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

// ============================================
// USER-VS-USER CHALLENGE SYSTEM
// ============================================

// @desc    Create a user-vs-user challenge
// @route   POST /api/posts/user-challenge
// @access  Private
export const createUserChallenge = async (req, res) => {
  const {
    title,
    content,
    opponentId,
    challengerTeam,
    voteDuration,
    photos
  } = req.body;

  if (!title || !content) {
    return res.status(400).json({ message: 'Title and content are required.' });
  }

  if (!opponentId) {
    return res.status(400).json({ message: 'Opponent ID is required.' });
  }

  if (!challengerTeam) {
    return res.status(400).json({ message: 'Challenger team is required.' });
  }

  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days to respond
    let createdPost;
    let challenger;
    let opponent;

    await updateDb(async (db) => {
      challenger = db.users.find((user) => resolveUserId(user) === req.user.id);
      if (!challenger) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      opponent = db.users.find((user) => resolveUserId(user) === opponentId);
      if (!opponent) {
        const error = new Error('Opponent not found');
        error.code = 'OPPONENT_NOT_FOUND';
        throw error;
      }

      if (resolveUserId(challenger) === resolveUserId(opponent)) {
        const error = new Error('Cannot challenge yourself');
        error.code = 'SELF_CHALLENGE';
        throw error;
      }

      const postData = {
        id: uuidv4(),
        title,
        content,
        type: 'fight',
        authorId: req.user.id,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        likes: [],
        comments: [],
        views: 0,
        photos: Array.isArray(photos) ? photos : [],
        poll: null,
        reactions: [],
        isOfficial: false,
        moderatorCreated: false,
        category: null,
        featured: false,
        tags: [],
        autoTags: {
          universes: [],
          characters: [],
          powerTiers: [],
          categories: []
        },
        fight: {
          teamA: challengerTeam,
          teamB: '', // Will be set by opponent
          votes: {
            teamA: 0,
            teamB: 0,
            draw: 0,
            voters: []
          },
          status: 'pending_opponent', // pending_opponent -> pending_approval -> active
          isOfficial: false,
          lockTime: null, // Will be set when approved
          winner: null,
          winnerTeam: null,
          // User-vs-user specific fields
          fightMode: 'user_vs_user',
          challengerId: resolveUserId(challenger),
          challengerUsername: challenger.username,
          opponentId: resolveUserId(opponent),
          opponentUsername: opponent.username,
          challengerTeam: challengerTeam,
          opponentTeam: null,
          voteDuration: voteDuration || '3d',
          expiresAt: expiresAt.toISOString(),
          respondedAt: null,
          approvedAt: null
        }
      };

      const autoTagPayload = autoTagPost(db, {
        title,
        content,
        teamA: challengerTeam,
        teamB: '',
        fight: postData.fight
      });
      postData.tags = autoTagPayload.tags;
      postData.autoTags = autoTagPayload.autoTags;

      db.posts.push(postData);

      // Create notification for opponent
      await createNotification(
        db,
        resolveUserId(opponent),
        'fight_challenge',
        'Nowe wyzwanie na walkę!',
        `${challenger.username} wyzwał Cię na walkę: "${title}"`,
        {
          sourceType: 'challenge',
          postId: postData.id,
          challengerId: resolveUserId(challenger),
          challengerUsername: challenger.username
        }
      );

      // Send private message with link
      db.messages = Array.isArray(db.messages) ? db.messages : [];
      db.messages.push({
        id: uuidv4(),
        senderId: resolveUserId(challenger),
        senderUsername: challenger.username,
        recipientId: resolveUserId(opponent),
        recipientUsername: opponent.username,
        subject: `Wyzwanie na walkę: ${title}`,
        content: `Hej ${opponent.username}!\n\n` +
          `Wyzywam Cię na walkę!\n\n` +
          `Moja drużyna: ${challengerTeam}\n\n` +
          `Kliknij tutaj, aby odpowiedzieć: /post/${postData.id}\n\n` +
          `Masz 7 dni na odpowiedź. Po tym czasie wyzwanie wygaśnie.`,
        read: false,
        deleted: false,
        createdAt: now.toISOString()
      });

      // Update challenger activity
        if (!challenger.activity) {
          challenger.activity = {
            postsCreated: 0,
            commentsPosted: 0,
            reactionsGiven: 0,
            likesReceived: 0,
            tournamentsWon: 0,
            tournamentsParticipated: 0
          };
        }
        challenger.activity.postsCreated += 1;
        challenger.activity.fightsCreated = (challenger.activity.fightsCreated || 0) + 1;
        updateLeveledBadgeProgress(
          challenger,
          'badge_manager',
          challenger.activity.fightsCreated,
          20,
          20
        );
        addRankPoints(challenger, RANK_POINT_VALUES.post);
        challenger.updatedAt = now.toISOString();

      createdPost = postData;
      return db;
    });

    res.status(201).json({
      ...normalizePostForResponse(createdPost, [challenger]),
      commentCount: 0,
      reactionsSummary: [],
      author: buildAuthor(challenger),
      opponent: {
        id: resolveUserId(opponent),
        username: opponent.username,
        profilePicture: opponent.profile?.profilePicture || opponent.profile?.avatar || ''
      }
    });
  } catch (err) {
    if (err.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: 'User not found' });
    }
    if (err.code === 'OPPONENT_NOT_FOUND') {
      return res.status(404).json({ message: 'Opponent not found' });
    }
    if (err.code === 'SELF_CHALLENGE') {
      return res.status(400).json({ message: 'Cannot challenge yourself' });
    }
    console.error('Error creating user challenge:', err.message);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

// @desc    Respond to a challenge (opponent sets their team)
// @route   POST /api/posts/:id/respond
// @access  Private
export const respondToChallenge = async (req, res) => {
  const { id } = req.params;
  const { opponentTeam, accept } = req.body;

  if (accept && !opponentTeam) {
    return res.status(400).json({ message: 'Team is required when accepting.' });
  }

  try {
    let updatedPost;
    let challenger;

    await updateDb(async (db) => {
      const post = findPostById(db.posts, id);
      if (!post) {
        const error = new Error('Post not found');
        error.code = 'POST_NOT_FOUND';
        throw error;
      }

      if (!post.fight || post.fight.fightMode !== 'user_vs_user') {
        const error = new Error('This is not a user-vs-user challenge');
        error.code = 'NOT_CHALLENGE';
        throw error;
      }

      if (post.fight.opponentId !== req.user.id) {
        const error = new Error('You are not the opponent of this challenge');
        error.code = 'NOT_OPPONENT';
        throw error;
      }

      if (post.fight.status !== 'pending_opponent') {
        const error = new Error('This challenge is not awaiting your response');
        error.code = 'INVALID_STATUS';
        throw error;
      }

      // Check if challenge has expired
      if (new Date() > new Date(post.fight.expiresAt)) {
        post.fight.status = 'expired';
        const error = new Error('This challenge has expired');
        error.code = 'CHALLENGE_EXPIRED';
        throw error;
      }

      const now = new Date().toISOString();

      if (!accept) {
        // Opponent rejected the challenge
        post.fight.status = 'rejected';
        post.fight.respondedAt = now;
        post.updatedAt = now;

        // Notify challenger
        challenger = db.users.find(
          (user) => resolveUserId(user) === post.fight.challengerId
        );
        if (challenger) {
          await createNotification(
            db,
            resolveUserId(challenger),
            'fight_rejected',
            'Wyzwanie odrzucone',
            `${post.fight.opponentUsername} odrzucił Twoje wyzwanie: "${post.title}"`,
            {
              sourceType: 'challenge',
              postId: post.id
            }
          );
        }

        updatedPost = post;
        return db;
      }

      // Opponent accepted - set their team
      post.fight.opponentTeam = opponentTeam;
      post.fight.teamB = opponentTeam;
      post.fight.status = 'pending_approval';
      post.fight.respondedAt = now;
      post.updatedAt = now;

      // Notify challenger that opponent responded
      challenger = db.users.find(
        (user) => resolveUserId(user) === post.fight.challengerId
      );
      if (challenger) {
        await createNotification(
          db,
          resolveUserId(challenger),
          'fight_response',
          'Odpowiedź na wyzwanie!',
          `${post.fight.opponentUsername} zaakceptował Twoje wyzwanie i wybrał drużynę!`,
          {
            sourceType: 'challenge',
            postId: post.id,
            opponentTeam: opponentTeam
          }
        );

        // Send private message
        const opponent = db.users.find(
          (user) => resolveUserId(user) === req.user.id
        );
        if (opponent) {
          db.messages = Array.isArray(db.messages) ? db.messages : [];
          db.messages.push({
            id: uuidv4(),
            senderId: resolveUserId(opponent),
            senderUsername: opponent.username,
            recipientId: resolveUserId(challenger),
            recipientUsername: challenger.username,
            subject: `Odpowiedź na wyzwanie: ${post.title}`,
            content: `Przyjmuję Twoje wyzwanie!\n\n` +
              `Twoja drużyna: ${post.fight.challengerTeam}\n` +
              `Moja drużyna: ${opponentTeam}\n\n` +
              `Kliknij tutaj, aby zatwierdzić walkę: /post/${post.id}`,
            read: false,
            deleted: false,
            createdAt: now
          });
        }
      }

      updatedPost = post;
      return db;
    });

    res.json({
      msg: accept ? 'Challenge accepted' : 'Challenge rejected',
      post: normalizePostForResponse(updatedPost, [])
    });
  } catch (err) {
    if (err.code === 'POST_NOT_FOUND') {
      return res.status(404).json({ msg: 'Post not found' });
    }
    if (err.code === 'NOT_CHALLENGE') {
      return res.status(400).json({ msg: 'This is not a user-vs-user challenge' });
    }
    if (err.code === 'NOT_OPPONENT') {
      return res.status(403).json({ msg: 'You are not the opponent of this challenge' });
    }
    if (err.code === 'INVALID_STATUS') {
      return res.status(400).json({ msg: 'This challenge is not awaiting your response' });
    }
    if (err.code === 'CHALLENGE_EXPIRED') {
      return res.status(400).json({ msg: 'This challenge has expired' });
    }
    console.error('Error responding to challenge:', err.message);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

// @desc    Approve a challenge (challenger confirms the fight)
// @route   POST /api/posts/:id/approve
// @access  Private
export const approveChallenge = async (req, res) => {
  const { id } = req.params;
  const { approve } = req.body;

  try {
    let updatedPost;

    await updateDb(async (db) => {
      const post = findPostById(db.posts, id);
      if (!post) {
        const error = new Error('Post not found');
        error.code = 'POST_NOT_FOUND';
        throw error;
      }

      if (!post.fight || post.fight.fightMode !== 'user_vs_user') {
        const error = new Error('This is not a user-vs-user challenge');
        error.code = 'NOT_CHALLENGE';
        throw error;
      }

      if (post.fight.challengerId !== req.user.id) {
        const error = new Error('Only the challenger can approve this fight');
        error.code = 'NOT_CHALLENGER';
        throw error;
      }

      if (post.fight.status !== 'pending_approval') {
        const error = new Error('This challenge is not awaiting approval');
        error.code = 'INVALID_STATUS';
        throw error;
      }

      const now = new Date();

      if (!approve) {
        // Challenger cancelled the fight
        post.fight.status = 'cancelled';
        post.updatedAt = now.toISOString();

        // Notify opponent
        const opponent = db.users.find(
          (user) => resolveUserId(user) === post.fight.opponentId
        );
        if (opponent) {
          await createNotification(
            db,
            resolveUserId(opponent),
            'fight_cancelled',
            'Walka anulowana',
            `${post.fight.challengerUsername} anulował walkę: "${post.title}"`,
            {
              sourceType: 'challenge',
              postId: post.id
            }
          );
        }

        updatedPost = post;
        return db;
      }

      // Calculate lock time based on vote duration
      const daysMap = {
        '1d': 1,
        '2d': 2,
        '3d': 3,
        '7d': 7
      };
      const voteDays = daysMap[post.fight.voteDuration] || 3;
      const lockTime = new Date(now.getTime() + voteDays * 24 * 60 * 60 * 1000);

      // Approve the fight - make it active
      post.fight.status = 'active';
      post.fight.approvedAt = now.toISOString();
      post.fight.lockTime = lockTime.toISOString();
      post.updatedAt = now.toISOString();

      // Update poll for voting
      post.poll = {
        options: [post.fight.teamA, post.fight.teamB],
        votes: { voters: [] }
      };

      // Notify opponent that fight is live
      const opponent = db.users.find(
        (user) => resolveUserId(user) === post.fight.opponentId
      );
      if (opponent) {
        await createNotification(
          db,
          resolveUserId(opponent),
          'fight_approved',
          'Walka zatwierdzona!',
          `Walka "${post.title}" została zatwierdzona i jest teraz aktywna!`,
          {
            sourceType: 'challenge',
            postId: post.id
          }
        );
      }

      updatedPost = post;
      return db;
    });

    res.json({
      msg: approve ? 'Fight approved and active' : 'Fight cancelled',
      post: normalizePostForResponse(updatedPost, [])
    });
  } catch (err) {
    if (err.code === 'POST_NOT_FOUND') {
      return res.status(404).json({ msg: 'Post not found' });
    }
    if (err.code === 'NOT_CHALLENGE') {
      return res.status(400).json({ msg: 'This is not a user-vs-user challenge' });
    }
    if (err.code === 'NOT_CHALLENGER') {
      return res.status(403).json({ msg: 'Only the challenger can approve this fight' });
    }
    if (err.code === 'INVALID_STATUS') {
      return res.status(400).json({ msg: 'This challenge is not awaiting approval' });
    }
    console.error('Error approving challenge:', err.message);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

// @desc    Get pending challenges for the current user
// @route   GET /api/posts/pending-challenges
// @access  Private
export const getPendingChallenges = async (req, res) => {
  try {
    const db = await readDb();
    const userId = req.user.id;

    const challenges = db.posts.filter((post) => {
      if (post.type !== 'fight' || !post.fight) return false;
      if (post.fight.fightMode !== 'user_vs_user') return false;

      // Challenges where user is opponent and needs to respond
      const awaitingResponse =
        post.fight.opponentId === userId &&
        post.fight.status === 'pending_opponent';

      // Challenges where user is challenger and needs to approve
      const awaitingApproval =
        post.fight.challengerId === userId &&
        post.fight.status === 'pending_approval';

      return awaitingResponse || awaitingApproval;
    });

    // Check for expired challenges and update them
    const now = new Date();
    const processedChallenges = [];

    for (const post of challenges) {
      if (
        post.fight.status === 'pending_opponent' &&
        new Date(post.fight.expiresAt) < now
      ) {
        // Mark as expired (will be persisted separately if needed)
        post.fight.status = 'expired';
      }

      if (post.fight.status !== 'expired') {
        processedChallenges.push(normalizePostForResponse(post, db.users));
      }
    }

    res.json({
      challenges: processedChallenges,
      awaitingResponse: processedChallenges.filter(
        (p) => p.fight.opponentId === userId && p.fight.status === 'pending_opponent'
      ).length,
      awaitingApproval: processedChallenges.filter(
        (p) => p.fight.challengerId === userId && p.fight.status === 'pending_approval'
      ).length
    });
  } catch (err) {
    console.error('Error fetching pending challenges:', err.message);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

// @desc    Search users for challenge
// @route   GET /api/posts/search-users
// @access  Private
export const searchUsersForChallenge = async (req, res) => {
  const { q } = req.query;

  if (!q || q.length < 2) {
    return res.json({ users: [] });
  }

  try {
    const db = await readDb();
    const searchTerm = q.toLowerCase();

    const matchingUsers = db.users
      .filter((user) => {
        const userId = resolveUserId(user);
        if (userId === req.user.id) return false; // Exclude self
        return user.username.toLowerCase().includes(searchTerm);
      })
      .slice(0, 10)
        .map((user) => ({
          id: resolveUserId(user),
          username: user.username,
          profilePicture: user.profile?.profilePicture || user.profile?.avatar || '',
          rank: getRankInfo(user.stats?.points || 0).rank
        }));

    res.json({ users: matchingUsers });
  } catch (err) {
    console.error('Error searching users:', err.message);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};
