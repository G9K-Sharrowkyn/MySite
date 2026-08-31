import { v4 as uuidv4 } from 'uuid';
import {
  commentsRepo,
  charactersRepo,
  messagesRepo,
  postsRepo,
  usersRepo,
  withRepositoryTransaction
} from '../repositories/index.js';
import { autoTagPost } from '../utils/tagging.js';
import { createNotification } from './notificationController.js';
import { findProfanityMatches } from '../utils/profanity.js';
import { addRankPoints, getRankInfo, RANK_POINT_VALUES, updateLeveledBadgeProgress } from '../utils/rankSystem.js';
import { getUserDisplayName } from '../utils/userDisplayName.js';
import { logModerationAction } from '../utils/moderationAudit.js';
import { applyDailyActivityBonusAtomic } from '../utils/coinBonus.js';
import { parseLimit, parsePagination } from '../utils/pagination.js';
import { getReaction } from '../config/reactionCatalog.js';
import { sanitizePostPhotos } from '../utils/imageSecurity.js';
import { getIdempotencyKey } from '../utils/idempotency.js';
import { isMongoMode } from '../services/jsonDb.js';

const resolveUserId = (user) => user?.id || user?._id;
const resolveRole = (user) => user?.role || 'user';

const getRoleRankOverride = (role) => {
  const safe = String(role || '').toLowerCase();
  if (safe === 'admin') return 'Overwatcher';
  if (safe === 'moderator') return 'Seer';
  return null;
};

const buildAuthor = (user) => {
  if (!user) return null;
  const profile = user.profile || {};
  const rankInfo = getRankInfo(user.stats?.points || 0);
  const roleRank = getRoleRankOverride(user.role);
  return {
    id: resolveUserId(user),
    username: user.username,
    displayName: getUserDisplayName(user),
    profilePicture: profile.profilePicture || profile.avatar || '',
    rank: roleRank || rankInfo.rank
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

const normalizeFightTeams = (value) => {
  const list = Array.isArray(value) ? value : [];
  return list
    .map(normalizeFightTeam)
    .map((team) => String(team || '').trim())
    .filter(Boolean);
};

const getFightTeamsFromFight = (fight) => {
  const fromArray = normalizeFightTeams(fight?.teams);
  if (fromArray.length) return fromArray;
  const out = [];
  const teamA = String(normalizeFightTeam(fight?.teamA) || '').trim();
  const teamB = String(normalizeFightTeam(fight?.teamB) || '').trim();
  if (teamA) out.push(teamA);
  if (teamB) out.push(teamB);
  return out;
};

const getFightTeamsFromRequest = (body = {}, fallbackFight = null) => {
  const fromArray = normalizeFightTeams(body?.fightTeams || body?.fight?.teams);
  if (fromArray.length) return fromArray;
  const out = [];
  const teamA = String(normalizeFightTeam(body?.teamA ?? fallbackFight?.teamA) || '').trim();
  const teamB = String(normalizeFightTeam(body?.teamB ?? fallbackFight?.teamB) || '').trim();
  if (teamA) out.push(teamA);
  if (teamB) out.push(teamB);
  return out;
};

const normalizeFightVoteTeamKey = (value) => {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim().toLowerCase();
  if (!raw) return null;
  if (raw === 'draw' || raw === 'tie') return 'draw';
  if (['a', 'teama', 'team a', 'fighter1', 'fighterone'].includes(raw)) return '0';
  if (['b', 'teamb', 'team b', 'fighter2', 'fightertwo'].includes(raw)) return '1';
  if (/^\d+$/.test(raw)) return String(Number(raw));
  return null;
};

const ensureFightVotesShape = (fight, teamCount) => {
  if (!fight) return { teams: [], draw: 0, voters: [] };
  fight.votes = fight.votes || {};
  fight.votes.voters = Array.isArray(fight.votes.voters) ? fight.votes.voters : [];
  fight.votes.draw = Number(fight.votes.draw || 0) || 0;

  const legacyA = Number(fight.votes.teamA || 0) || 0;
  const legacyB = Number(fight.votes.teamB || 0) || 0;

  let teams = Array.isArray(fight.votes.teams) ? [...fight.votes.teams] : [];
  if (!teams.length && teamCount) {
    teams = new Array(teamCount).fill(0);
    if (teamCount > 0) teams[0] = legacyA;
    if (teamCount > 1) teams[1] = legacyB;
  }

  const size = Math.max(0, Number(teamCount) || 0);
  for (let i = 0; i < size; i += 1) {
    teams[i] = Number(teams[i] || 0) || 0;
  }
  fight.votes.teams = teams.slice(0, size);

  // Keep legacy fields in sync (used by older UI paths + other systems like betting/share).
  fight.votes.teamA = fight.votes.teams[0] || 0;
  fight.votes.teamB = fight.votes.teams[1] || 0;
  return fight.votes;
};

const normalizeVoteVisibility = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'final' || raw === 'hidden') return 'final';
  return 'live';
};

const POST_GROUP_IDS = new Set(['dragon_ball', 'star_wars', 'marvel', 'dc']);

const normalizePostGroup = (value) => {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return null;
  if (raw === 'none' || raw === 'all') return null;
  return POST_GROUP_IDS.has(raw) ? raw : null;
};

const getFightMyVote = (fight, viewerUserId) => {
  if (!viewerUserId || !fight?.votes?.voters) return null;
  const vote = (fight.votes.voters || []).find((entry) => entry.userId === viewerUserId);
  return normalizeFightVoteTeamKey(vote?.team) || null;
};

const shouldRevealFightVotes = (fight, now = new Date()) => {
  const visibility = normalizeVoteVisibility(fight?.voteVisibility);
  if (visibility !== 'final') return true;
  const lockTimeValue = fight?.lockTime;
  if (!lockTimeValue) return true; // no lockTime -> don't hide forever
  const lockTime = new Date(lockTimeValue);
  if (Number.isNaN(lockTime.getTime())) return true;
  if (fight?.status && fight.status !== 'active') return true;
  return now >= lockTime;
};

export const normalizePostForResponse = (post, users, options = {}) => {
  const author = users.find((user) => resolveUserId(user) === post.authorId);
  const normalized = { ...post };
  const postId = normalized.id || normalized._id;
  const viewerUserId = options.viewerUserId || null;
  const viewerReaction = viewerUserId
    ? (post.reactions || []).find((reaction) => reaction.userId === viewerUserId)
    : null;
  delete normalized.idempotencyKey;

  if (normalized.fight) {
    const now = options.now instanceof Date ? options.now : new Date();
    const voteVisibility = normalizeVoteVisibility(normalized.fight.voteVisibility);
    const revealVotes = shouldRevealFightVotes(normalized.fight, now);
    const myVote = getFightMyVote(normalized.fight, viewerUserId);
    const teams = getFightTeamsFromFight(normalized.fight);
    const rawVotes = ensureFightVotesShape(normalized.fight, teams.length);
    const teamsVotes = revealVotes ? (rawVotes.teams || []) : new Array(teams.length).fill(0);
    const draw = revealVotes ? rawVotes.draw || 0 : 0;
    const teamA = teamsVotes[0] || 0;
    const teamB = teamsVotes[1] || 0;

    normalized.fight = {
      ...normalized.fight,
      teams,
      teamA: normalizeFightTeam(normalized.fight.teamA || teams[0] || ''),
      teamB: normalizeFightTeam(normalized.fight.teamB || teams[1] || ''),
      voteVisibility,
      votesHidden: !revealVotes && voteVisibility === 'final',
      myVote,
      votes: {
        teams: teamsVotes,
        teamA,
        teamB,
        draw,
        // Never ship the voters list to the client (privacy + payload size).
        voters: []
      }
    };
  }

  return {
    ...normalized,
    id: postId,
    author: buildAuthor(author),
    userReaction: viewerReaction
      ? {
          id: viewerReaction.reactionId,
          icon: viewerReaction.reactionIcon,
          name: viewerReaction.reactionName
        }
      : null
  };
};

const findPostById = (posts, id) =>
  posts.find((entry) => entry.id === id || entry._id === id);

const isPostSoftDeleted = (post) =>
  Boolean(post?.moderation?.deleted?.isDeleted);

const assertPostActive = (post) => {
  if (!post || isPostSoftDeleted(post)) {
    const error = new Error('Post not found');
    error.code = 'POST_NOT_FOUND';
    throw error;
  }
};

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

const buildActivePostQuery = ({ category, group, authorId } = {}) => {
  const conditions = [{ 'moderation.deleted.isDeleted': { $ne: true } }];
  if (authorId) conditions.push({ authorId });
  const normalizedGroup = normalizePostGroup(group);
  if (normalizedGroup) conditions.push({ group: normalizedGroup });

  const normalizedCategory = String(category || '').toLowerCase();
  if (normalizedCategory && normalizedCategory !== 'all') {
    if (normalizedCategory === 'fight') {
      conditions.push({ type: 'fight' });
    } else if (normalizedCategory === 'discussion') {
      conditions.push({ type: { $ne: 'fight' } });
      conditions.push({
        $or: [
          { category: 'discussion' },
          { category: { $exists: false } },
          { category: null },
          { category: '' }
        ]
      });
    } else {
      conditions.push({ type: { $ne: 'fight' }, category: normalizedCategory });
    }
  }
  return conditions.length === 1 ? conditions[0] : { $and: conditions };
};

const loadPostResponseContext = async (posts) => {
  const authorIds = [...new Set(posts.map((post) => post.authorId).filter(Boolean))];
  const postIds = [...new Set(posts.map((post) => post.id || post._id).filter(Boolean))];
  const [users, comments] = await Promise.all([
    authorIds.length ? usersRepo.findManyBy({ id: { $in: authorIds } }) : [],
    postIds.length
      ? commentsRepo.findManyBy(
          {
            postId: { $in: postIds },
            $or: [{ type: 'post' }, { type: { $exists: false } }]
          },
          { projection: { postId: 1, type: 1 } }
        )
      : []
  ]);
  return { users, commentCounts: buildCommentCountByPostId(comments) };
};

const notifyAdminsForProfanity = async (db, payload) => {
  const { author, postId, text, matches } = payload || {};
  if (!matches || matches.length === 0) return;
  const context = db?.mongoDb || db?.db ? db : db ? { db } : undefined;
  const admins = await usersRepo.findManyBy(
    { role: 'admin' },
    { limit: 100 },
    context
  );
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
  const { sortBy = 'createdAt', category, group } = req.query;
  try {
    const viewerUserId = req.user?.id || null;
    const now = new Date();
    const { page: pageNumber, limit: limitNumber } = parsePagination(req.query, {
      defaultLimit: 10,
      maxLimit: 50
    });
    const query = buildActivePostQuery({ category, group });
    const skip = (pageNumber - 1) * limitNumber;
    const [totalPosts, pagedPosts] = await Promise.all([
      postsRepo.countBy(query),
      sortBy === 'likes'
        ? isMongoMode()
          ? import('../services/mongoDb.js').then(({ aggregateMongoDocuments }) =>
              aggregateMongoDocuments('posts', [
                { $match: query },
                { $set: { _likeCount: { $size: { $ifNull: ['$likes', []] } } } },
                { $sort: { _likeCount: -1, createdAt: -1 } },
                { $skip: skip },
                { $limit: limitNumber },
                { $unset: ['_id', '_likeCount'] }
              ])
            )
          : postsRepo
              .findManyBy(query)
              .then((posts) => sortPosts(posts, 'likes').slice(skip, skip + limitNumber))
        : postsRepo.findManyBy(query, {
            sort: { createdAt: -1 },
            skip,
            limit: limitNumber
          })
    ]);
    const { users, commentCounts } = await loadPostResponseContext(pagedPosts);

    const postsWithUserInfo = pagedPosts.map((post) => {
      const normalized = normalizePostForResponse(post, users, { viewerUserId, now });
      const postId = normalized.id;
      return {
        ...normalized,
        commentCount: commentCounts.get(postId) || 0,
        reactionsSummary: buildReactionSummary(post.reactions || [])
      };
    });

    res.json({
      posts: postsWithUserInfo,
      totalPosts,
      currentPage: pageNumber,
      totalPages: Math.ceil(totalPosts / limitNumber)
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
    const viewerUserId = req.user?.id || null;
    const now = new Date();
    const sorted = await postsRepo.findManyBy(
      buildActivePostQuery({ category, authorId: userId }),
      { sort: { createdAt: -1 } }
    );
    const { users, commentCounts } = await loadPostResponseContext(sorted);

    const postsWithUserInfo = sorted.map((post) => {
      const normalized = normalizePostForResponse(post, users, { viewerUserId, now });
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
    const viewerUserId = req.user?.id || null;
    const now = new Date();
    const post = await postsRepo.findById(id);

    if (!post || isPostSoftDeleted(post)) {
      return res.status(404).json({ msg: 'Post not found' });
    }

    const [author, commentCount] = await Promise.all([
      usersRepo.findById(post.authorId),
      commentsRepo.countBy({
        postId: post.id || post._id,
        $or: [{ type: 'post' }, { type: { $exists: false } }]
      })
    ]);
    const normalized = normalizePostForResponse(
      post,
      author ? [author] : [],
      { viewerUserId, now }
    );

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
    voteVisibility,
    isOfficial,
    moderatorCreated,
    category,
    group
  } = req.body;

  if (!title || !content) {
    return res.status(400).json({ message: 'Title and content are required.' });
  }

  try {
    const idempotencyKey = getIdempotencyKey(req);
    const now = new Date();
    const postType = type || 'discussion';
    const safePhotos = sanitizePostPhotos(photos);
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
    let idempotencyReplay = false;
    const resolvedCategory = postType === 'fight' ? null : (category || 'discussion');
    const resolvedGroup = normalizePostGroup(group);
    const characters = await charactersRepo.findManyBy({}, { limit: 5000 });

    await withRepositoryTransaction(async (context) => {
      author = await usersRepo.findById(req.user.id, 'id', context);
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

      if (idempotencyKey) {
        const existingPost = await postsRepo.findOneBy({
          authorId: req.user.id,
          idempotencyKey,
          'moderation.deleted.isDeleted': { $ne: true }
        }, {}, context);
        if (existingPost) {
          createdPost = existingPost;
          idempotencyReplay = true;
          return;
        }
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
        photos: safePhotos,
        poll: null,
        fight: null,
        reactions: [],
        isOfficial: Boolean(isOfficial),
        moderatorCreated: Boolean(moderatorCreated),
        category: resolvedCategory,
        group: resolvedGroup,
        featured: false,
        tags: [],
        autoTags: {
          universes: [],
          characters: [],
          powerTiers: [],
          categories: []
        },
        ...(idempotencyKey ? { idempotencyKey } : {})
      };

      if (postType === 'fight') {
        const lockTime = resolveLockTime(voteDuration);
        const normalizedVisibility = normalizeVoteVisibility(voteVisibility);
        const fightTeams = getFightTeamsFromRequest(req.body);
        const resolvedTeamA = fightTeams[0] || String(teamA || '').trim();
        const resolvedTeamB = fightTeams[1] || String(teamB || '').trim();
        const resolvedTeams = fightTeams.length ? fightTeams : [resolvedTeamA, resolvedTeamB].filter(Boolean);
        postData.fight = {
          teams: resolvedTeams,
          teamA: resolvedTeamA || '',
          teamB: resolvedTeamB || '',
          votes: {
            teams: new Array(resolvedTeams.length).fill(0),
            teamA: 0,
            teamB: 0,
            draw: 0,
            voters: []
          },
          status: 'active',
          isOfficial: Boolean(isOfficial),
          voteVisibility: normalizedVisibility,
          lockTime: lockTime ? lockTime.toISOString() : null,
          winner: null,
          winnerTeam: null
        };
        postData.poll = {
          options: [resolvedTeamA || '', resolvedTeamB || ''],
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

      const autoTagPayload = autoTagPost({ characters }, {
        title,
        content,
        teamA: postData.fight?.teamA || teamA,
        teamB: postData.fight?.teamB || teamB,
        fightTeams: postData.fight?.teams || [],
        fight: postData.fight
      });
      postData.tags = autoTagPayload.tags;
      postData.autoTags = autoTagPayload.autoTags;

      if (idempotencyKey) {
        const inserted = await postsRepo.insertIfAbsent(
          { authorId: req.user.id, idempotencyKey },
          postData,
          context
        );
        if (!inserted.inserted) {
          createdPost = inserted.item;
          idempotencyReplay = true;
          return;
        }
      } else {
        await postsRepo.insert(postData, context);
      }

      const matches = findProfanityMatches(`${title} ${content}`);
      if (matches.length) {
        await notifyAdminsForProfanity(context, {
          author,
          postId: postData.id,
          text: content,
          matches
        });
      }

      author = await usersRepo.updateById(req.user.id, (storedAuthor) => {
        if (!storedAuthor.activity) {
          storedAuthor.activity = {
            postsCreated: 0,
            commentsPosted: 0,
            reactionsGiven: 0,
            likesReceived: 0,
            tournamentsWon: 0,
            tournamentsParticipated: 0
          };
        }
        storedAuthor.activity.postsCreated += 1;
        if (postType === 'fight') {
          storedAuthor.activity.fightsCreated = (storedAuthor.activity.fightsCreated || 0) + 1;
          updateLeveledBadgeProgress(
            storedAuthor,
            'badge_manager',
            storedAuthor.activity.fightsCreated,
            20,
            20
          );
        }
        
        // Update stats.posts for leaderboard
        if (!storedAuthor.stats) storedAuthor.stats = {};
        storedAuthor.stats.posts = (storedAuthor.stats.posts || 0) + 1;
        
        addRankPoints(storedAuthor, RANK_POINT_VALUES.post);
        storedAuthor.updatedAt = now.toISOString();
        return storedAuthor;
      }, 'id', context);
      await applyDailyActivityBonusAtomic(req.user.id, 'post', 100, context);

      createdPost = postData;
    });

    if (idempotencyReplay) {
      res.set('Idempotency-Replayed', 'true');
    }
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
    if (err.code === 'INVALID_IMAGE_SOURCE') {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === 'INVALID_IDEMPOTENCY_KEY') {
      return res.status(400).json({ message: err.message });
    }
    console.error('Error creating post:', err.message);
    res.status(500).send('Server Error');
  }
};

export const updatePost = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    let responsePayload;
    const now = new Date();
    const characters = await charactersRepo.findManyBy({}, { limit: 5000 });

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

    await withRepositoryTransaction(async (context) => {
      const post = await postsRepo.findById(id, 'id', context);
      if (!post) {
        const error = new Error('Post not found');
        error.code = 'POST_NOT_FOUND';
        throw error;
      }
      assertPostActive(post);

      const user = await usersRepo.findById(req.user.id, 'id', context);
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

      if (typeof updates?.title === 'string') post.title = updates.title;
      if (typeof updates?.content === 'string') post.content = updates.content;
      if (typeof updates?.type === 'string') post.type = updates.type;
      if (Object.prototype.hasOwnProperty.call(updates || {}, 'photos')) {
        post.photos = sanitizePostPhotos(updates.photos);
      }
      if (Object.prototype.hasOwnProperty.call(updates || {}, 'group')) {
        post.group = normalizePostGroup(updates.group);
      }

      // Keep schema consistent: fight posts have no category.
      if (post.type === 'fight') {
        post.category = null;
      } else if (typeof updates?.category === 'string' || updates?.category === null) {
        post.category = updates.category || 'discussion';
      }

      const looksLikeFightUpdate =
        post.type === 'fight' ||
        String(updates?.type || '').toLowerCase() === 'fight' ||
        typeof updates?.teamA === 'string' ||
        typeof updates?.teamB === 'string' ||
        Array.isArray(updates?.fightTeams) ||
        Array.isArray(updates?.fight?.teams) ||
        typeof updates?.voteVisibility === 'string' ||
        typeof updates?.voteDuration === 'string';

      if (looksLikeFightUpdate) {
        post.type = 'fight';
        post.category = null;
        post.fight = post.fight || {};
        post.fight.status = post.fight.status || 'active';

        const hasTeamsUpdate =
          Array.isArray(updates?.fightTeams) || Array.isArray(updates?.fight?.teams);

        if (hasTeamsUpdate) {
          const nextTeams = getFightTeamsFromRequest(updates, post.fight);
          post.fight.teams = nextTeams;
          post.fight.teamA = nextTeams[0] || '';
          post.fight.teamB = nextTeams[1] || '';
        } else {
          // Keep any existing multi-team configuration unless explicitly updated.
          const existingTeams = getFightTeamsFromFight(post.fight);
          post.fight.teams = existingTeams;
          post.fight.teamA =
            typeof updates?.teamA === 'string' ? updates.teamA : (post.fight.teamA || existingTeams[0] || '');
          post.fight.teamB =
            typeof updates?.teamB === 'string' ? updates.teamB : (post.fight.teamB || existingTeams[1] || '');

          if (Array.isArray(post.fight.teams) && post.fight.teams.length) {
            const synced = [...post.fight.teams];
            if (post.fight.teamA) synced[0] = post.fight.teamA;
            if (post.fight.teamB) {
              synced[1] = post.fight.teamB;
            }
            post.fight.teams = normalizeFightTeams(synced);
          } else {
            post.fight.teams = normalizeFightTeams([post.fight.teamA, post.fight.teamB]);
          }
        }

        ensureFightVotesShape(post.fight, post.fight.teams?.length || 0);
        if (typeof updates?.voteVisibility === 'string') {
          post.fight.voteVisibility = normalizeVoteVisibility(updates.voteVisibility);
        } else {
          post.fight.voteVisibility = normalizeVoteVisibility(post.fight.voteVisibility);
        }
        if (typeof updates?.voteDuration === 'string') {
          const lockTime = resolveLockTime(updates.voteDuration);
          post.fight.lockTime = lockTime ? lockTime.toISOString() : null;
        }

        post.poll = post.poll || { options: [], votes: { voters: [] } };
        post.poll.options = [post.fight.teamA || '', post.fight.teamB || ''];
      } else if (
        String(post.type || '').toLowerCase() === 'other' &&
        Array.isArray(updates?.pollOptions)
      ) {
        const options = updates.pollOptions
          .map((opt) => String(opt || '').trim())
          .filter(Boolean);
        if (options.length) {
          post.poll = post.poll || { options: [], votes: { voters: [] } };
          post.poll.options = options;
        }
      }

      // Remove legacy fields that should not exist at the top level.
      delete post.teamA;
      delete post.teamB;
      delete post.voteVisibility;

      const autoTagPayload = autoTagPost({ characters }, {
        title: post.title,
        content: post.content,
        teamA: post.fight?.teamA || '',
        teamB: post.fight?.teamB || '',
        fightTeams: post.fight?.teams || [],
        fight: post.fight
      });
      post.tags = autoTagPayload.tags;
      post.autoTags = autoTagPayload.autoTags;

      post.updatedAt = now.toISOString();
      await postsRepo.updateById(id, () => post, 'id', context);

      const viewerUserId = req.user?.id || null;
      const author = post.authorId
        ? await usersRepo.findById(post.authorId, 'id', context)
        : null;
      const normalized = normalizePostForResponse(post, [author].filter(Boolean), {
        viewerUserId,
        now
      });
      const commentCount = await commentsRepo.countBy({
        postId: normalized.id,
        $or: [{ type: 'post' }, { type: { $exists: false } }]
      }, context);

      responsePayload = {
        ...normalized,
        commentCount,
        reactionsSummary: buildReactionSummary(post.reactions || [])
      };
    });

    res.json(responsePayload);
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
    if (err.code === 'INVALID_IMAGE_SOURCE') {
      return res.status(400).json({ msg: err.message });
    }
    console.error('Error updating post:', err.message);
    res.status(500).send('Server Error');
  }
};

export const deletePost = async (req, res) => {
  const { id } = req.params;

  try {
    await withRepositoryTransaction(async (context) => {
      const post = await postsRepo.findById(id, 'id', context);
      if (!post) {
        const error = new Error('Post not found');
        error.code = 'POST_NOT_FOUND';
        throw error;
      }

      const user = await usersRepo.findById(req.user.id, 'id', context);
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

      const now = new Date().toISOString();
      post.moderation = post.moderation || {};
      post.moderation.deleted = {
        isDeleted: true,
        deletedAt: now,
        deletedById: req.user.id,
        deletedByUsername: user.username || '',
        deletedByRole: user.role || 'user',
        reason: String(req.body?.reason || '').trim()
      };
      post.updatedAt = now;
      await postsRepo.updateById(id, () => post, 'id', context);
      await logModerationAction({
        db: context,
        actor: user,
        action: 'post.delete',
        targetType: 'post',
        targetId: id,
        details: {
          postType: post.type || 'unknown',
          ownPost: post.authorId === req.user.id,
          reason: post.moderation?.deleted?.reason || ''
        }
      });
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

export const getDeletedPosts = async (req, res) => {
  try {
    const actor = await usersRepo.findById(req.user.id);
    if (!actor || (actor.role !== 'admin' && actor.role !== 'moderator')) {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const limit = parseLimit(req.query.limit, { fallback: 50, max: 100 });
    const deletedPosts = await postsRepo.findManyBy(
      { 'moderation.deleted.isDeleted': true },
      { sort: { 'moderation.deleted.deletedAt': -1 }, limit }
    );
    const authorIds = [...new Set(deletedPosts.map((post) => post.authorId).filter(Boolean))];
    const authors = authorIds.length
      ? await usersRepo.findManyBy({ id: { $in: authorIds } }, { limit: authorIds.length })
      : [];
    const deleted = deletedPosts.map((post) => normalizePostForResponse(post, authors));
    return res.json({ posts: deleted });
  } catch (err) {
    console.error('Error fetching deleted posts:', err.message);
    return res.status(500).json({ msg: 'Server Error' });
  }
};

export const restorePost = async (req, res) => {
  const { id } = req.params;
  try {
    let restoredPost = null;
    await withRepositoryTransaction(async (context) => {
      const actor = await usersRepo.findById(req.user.id, 'id', context);
      if (!actor || (actor.role !== 'admin' && actor.role !== 'moderator')) {
        const error = new Error('Access denied');
        error.code = 'ACCESS_DENIED';
        throw error;
      }

      const post = await postsRepo.findById(id, 'id', context);
      if (!post) {
        const error = new Error('Post not found');
        error.code = 'POST_NOT_FOUND';
        throw error;
      }
      if (!isPostSoftDeleted(post)) {
        const error = new Error('Post is not deleted');
        error.code = 'NOT_DELETED';
        throw error;
      }

      post.moderation = post.moderation || {};
      post.moderation.deleted = {
        ...(post.moderation.deleted || {}),
        isDeleted: false,
        restoredAt: new Date().toISOString(),
        restoredById: req.user.id,
        restoredByUsername: actor.username || ''
      };
      post.updatedAt = new Date().toISOString();
      restoredPost = post;
      await postsRepo.updateById(id, () => post, 'id', context);

      await logModerationAction({
        db: context,
        actor,
        action: 'post.restore',
        targetType: 'post',
        targetId: resolveUserId(post) || id,
        details: {
          postType: post.type || 'unknown'
        }
      });
    });

    return res.json({ msg: 'Post restored successfully', post: restoredPost });
  } catch (err) {
    if (err.code === 'ACCESS_DENIED') return res.status(403).json({ msg: 'Access denied' });
    if (err.code === 'POST_NOT_FOUND') return res.status(404).json({ msg: 'Post not found' });
    if (err.code === 'NOT_DELETED') return res.status(400).json({ msg: 'Post is not deleted' });
    console.error('Error restoring post:', err.message);
    return res.status(500).json({ msg: 'Server Error' });
  }
};

export const toggleLike = async (req, res) => {
  const { id } = req.params;

  try {
    let likesCount = 0;
    let isLiked = false;

    await withRepositoryTransaction(async (context) => {
      const post = await postsRepo.findById(id, 'id', context);
      if (!post) {
        const error = new Error('Post not found');
        error.code = 'POST_NOT_FOUND';
        throw error;
      }
      assertPostActive(post);

      const existingLikes = Array.isArray(post.likes) ? post.likes : [];
      const index = existingLikes.findIndex((like) => like.userId === req.user.id);
      const wasLiked = index > -1;
      isLiked = !wasLiked;
      const now = new Date().toISOString();
      await postsRepo.updateById(id, (storedPost) => {
        storedPost.likes = Array.isArray(storedPost.likes) ? storedPost.likes : [];
        const storedIndex = storedPost.likes.findIndex((like) => like.userId === req.user.id);
        if (storedIndex > -1) storedPost.likes.splice(storedIndex, 1);
        else storedPost.likes.push({ userId: req.user.id, likedAt: now });
        isLiked = storedIndex === -1;
        likesCount = storedPost.likes.length;
        storedPost.updatedAt = now;
        return storedPost;
      }, 'id', context);

      if (post.authorId) {
        await usersRepo.updateById(post.authorId, (author) => {
          author.activity = author.activity || {
            postsCreated: 0,
            likesReceived: 0,
            commentsPosted: 0,
            tournamentsWon: 0,
            tournamentsParticipated: 0
          };
          author.activity.likesReceived = Math.max(
            0,
            Number(author.activity.likesReceived || 0) + (isLiked ? 1 : -1)
          );
          author.updatedAt = now;
          return author;
        }, 'id', context);
      }
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

    await withRepositoryTransaction(async (context) => {
      const post = await postsRepo.findById(id, 'id', context);
      if (!post) {
        const error = new Error('Post not found');
        error.code = 'POST_NOT_FOUND';
        throw error;
      }
      assertPostActive(post);

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

      const currentVotes = post.poll.votes || { voters: [] };
      const alreadyVoted = currentVotes.voters.find(
        (vote) => vote.userId === req.user.id
      );
      if (alreadyVoted) {
        const error = new Error('User already voted in this poll');
        error.code = 'ALREADY_VOTED';
        throw error;
      }

      await postsRepo.updateById(id, (storedPost) => {
        storedPost.poll.votes = storedPost.poll.votes || { voters: [] };
        if (storedPost.poll.votes.voters.some((vote) => vote.userId === req.user.id)) {
          const error = new Error('User already voted in this poll');
          error.code = 'ALREADY_VOTED';
          throw error;
        }
        storedPost.poll.votes.voters.push({
          userId: req.user.id,
          optionIndex,
          votedAt: new Date().toISOString()
        });
        optionVotes = storedPost.poll.votes.voters.filter(
          (vote) => vote.optionIndex === optionIndex
        ).length;
        totalVotes = storedPost.poll.votes.voters.length;
        storedPost.updatedAt = new Date().toISOString();
        return storedPost;
      }, 'id', context);
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
  const limit = parseLimit(req.query.limit, { fallback: 10, max: 50 });

  try {
    const viewerUserId = req.user?.id || null;
    const now = new Date();
    const query = {
      isOfficial: true,
      type: 'fight',
      'fight.status': 'active',
      'moderation.deleted.isDeleted': { $ne: true }
    };
    const [fights, totalFights] = await Promise.all([
      postsRepo.findManyBy(query, { sort: { createdAt: -1 }, limit }),
      postsRepo.countBy(query)
    ]);
    const { users, commentCounts } = await loadPostResponseContext(fights);
    const fightsWithUserInfo = fights.map((post) =>
      normalizePostForResponse(post, users, {
        viewerUserId,
        now,
        commentCount: commentCounts.get(post.id || post._id) || 0
      })
    );

    res.json({
      fights: fightsWithUserInfo,
      totalFights
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
    let updatedFight;

    await withRepositoryTransaction(async (context) => {
      const post = await postsRepo.findById(id, 'id', context);
      if (!post) {
        const error = new Error('Post not found');
        error.code = 'POST_NOT_FOUND';
        throw error;
      }
      assertPostActive(post);

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

      const fightTeams = getFightTeamsFromFight(post.fight);
      const teamCount = Math.max(2, fightTeams.length);
      const nextTeamKey = normalizeFightVoteTeamKey(team);
      const nextTeamIndex =
        nextTeamKey && nextTeamKey !== 'draw' ? Number(nextTeamKey) : null;
      if (
        !nextTeamKey ||
        (nextTeamKey !== 'draw' &&
          (!Number.isFinite(nextTeamIndex) ||
            nextTeamIndex < 0 ||
            nextTeamIndex >= teamCount))
      ) {
        const error = new Error('Invalid team choice');
        error.code = 'INVALID_TEAM';
        throw error;
      }

      const votes = ensureFightVotesShape(post.fight, teamCount);

      const existingVoteIndex = votes.voters.findIndex(
        (vote) => vote.userId === req.user.id
      );

      if (existingVoteIndex > -1) {
        const prevTeamRaw = votes.voters[existingVoteIndex].team;
        const prevKey = normalizeFightVoteTeamKey(prevTeamRaw);
        if (prevKey === 'draw') {
          votes.draw = Math.max(0, (votes.draw || 0) - 1);
        } else if (prevKey !== null) {
          const prevIndex = Number(prevKey);
          if (Number.isFinite(prevIndex) && prevIndex >= 0 && prevIndex < votes.teams.length) {
            votes.teams[prevIndex] = Math.max(0, (votes.teams[prevIndex] || 0) - 1);
          }
        }
        votes.voters[existingVoteIndex].team = nextTeamKey;
        votes.voters[existingVoteIndex].votedAt = new Date().toISOString();
      } else {
        votes.voters.push({
          userId: req.user.id,
          team: nextTeamKey,
          votedAt: new Date().toISOString()
        });
      }

      if (nextTeamKey === 'draw') {
        votes.draw = (votes.draw || 0) + 1;
      } else {
        const nextIndex = Number(nextTeamKey);
        if (Number.isFinite(nextIndex) && nextIndex >= 0 && nextIndex < votes.teams.length) {
          votes.teams[nextIndex] = (votes.teams[nextIndex] || 0) + 1;
        }
      }

      // Keep legacy fields in sync for compatibility.
      votes.teamA = votes.teams[0] || 0;
      votes.teamB = votes.teams[1] || 0;

      updatedVotes = votes;
      updatedFight = post.fight;
      post.updatedAt = new Date().toISOString();
      await postsRepo.updateById(id, () => post, 'id', context);
    });

    const now = new Date();
    const revealVotes = shouldRevealFightVotes(updatedFight, now);
    const visibility = normalizeVoteVisibility(updatedFight?.voteVisibility);
    const votesHidden = !revealVotes && visibility === 'final';
    const teamCount = Math.max(2, Array.isArray(updatedVotes?.teams) ? updatedVotes.teams.length : 2);
    const safeTeams = Array.isArray(updatedVotes?.teams) ? updatedVotes.teams : [];
    const sanitizedVotes = {
      teams: new Array(teamCount).fill(0).map((_, index) => (safeTeams[index] || 0)),
      teamA: safeTeams[0] || 0,
      teamB: safeTeams[1] || 0,
      draw: updatedVotes?.draw || 0
    };

    res.json({
      msg: 'Vote recorded successfully',
      votes: votesHidden
        ? { teams: new Array(teamCount).fill(0), teamA: 0, teamB: 0, draw: 0 }
        : sanitizedVotes,
      votesHidden
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
  const reaction = getReaction(req.body?.reactionId);
  if (!reaction) {
    return res.status(400).json({ msg: 'Invalid reaction' });
  }
  const reactionId = reaction.id;
  const reactionIcon = reaction.icon;
  const reactionName = reaction.name;

  try {
    let reactionsArray = [];

    await withRepositoryTransaction(async (context) => {
      const post = await postsRepo.findById(id, 'id', context);
      if (!post) {
        const error = new Error('Post not found');
        error.code = 'POST_NOT_FOUND';
        throw error;
      }
      assertPostActive(post);

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

      await postsRepo.updateById(id, (storedPost) => {
        storedPost.reactions = Array.isArray(storedPost.reactions) ? storedPost.reactions : [];
        const storedIndex = storedPost.reactions.findIndex(
          (storedReaction) => storedReaction.userId === req.user.id
        );
        if (storedIndex > -1) storedPost.reactions[storedIndex] = nextReaction;
        else storedPost.reactions.push(nextReaction);
        reactionsArray = buildReactionSummary(storedPost.reactions);
        storedPost.updatedAt = new Date().toISOString();
        return storedPost;
      }, 'id', context);

      if (await usersRepo.findById(req.user.id, 'id', context)) {
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
            reactingUser.updatedAt = new Date().toISOString();
            return reactingUser;
          }, 'id', context);
        }
        await applyDailyActivityBonusAtomic(req.user.id, 'reaction', 50, context);
      }
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

    await withRepositoryTransaction(async (context) => {
      const post = await postsRepo.findById(id, 'id', context);
      if (!post) {
        const error = new Error('Post not found');
        error.code = 'POST_NOT_FOUND';
        throw error;
      }
      assertPostActive(post);

      await postsRepo.updateById(id, (storedPost) => {
        storedPost.reactions = Array.isArray(storedPost.reactions) ? storedPost.reactions : [];
        const beforeCount = storedPost.reactions.length;
        storedPost.reactions = storedPost.reactions.filter((storedReaction) => {
          if (storedReaction.userId !== req.user.id) return true;
          if (!reactionId) return false;
          return storedReaction.reactionId !== reactionId;
        });
        removed = storedPost.reactions.length !== beforeCount;
        reactionsArray = buildReactionSummary(storedPost.reactions);
        storedPost.updatedAt = new Date().toISOString();
        return storedPost;
      }, 'id', context);
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
    photos,
    group
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
    const idempotencyKey = getIdempotencyKey(req);
    const now = new Date();
    const safePhotos = sanitizePostPhotos(photos);
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days to respond
    let createdPost;
    let challenger;
    let opponent;
    let idempotencyReplay = false;
    const resolvedGroup = normalizePostGroup(group);
    const characters = await charactersRepo.findManyBy({}, { limit: 5000 });

    await withRepositoryTransaction(async (context) => {
      challenger = await usersRepo.findById(req.user.id, context);
      if (!challenger) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      opponent = await usersRepo.findById(opponentId, context);
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

      if (idempotencyKey) {
        const existingPost = await postsRepo.findOneBy(
          {
            authorId: req.user.id,
            idempotencyKey,
            deletedAt: { $exists: false }
          },
          {},
          context
        );
        if (existingPost) {
          createdPost = existingPost;
          opponent = await usersRepo.findById(existingPost.fight?.opponentId, context);
          idempotencyReplay = true;
          return;
        }
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
        photos: safePhotos,
        poll: null,
        reactions: [],
        group: resolvedGroup,
        isOfficial: false,
        moderatorCreated: false,
        category: null,
        featured: false,
        ...(idempotencyKey ? { idempotencyKey } : {}),
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

      const autoTagPayload = autoTagPost({ characters }, {
        title,
        content,
        teamA: challengerTeam,
        teamB: '',
        fight: postData.fight
      });
      postData.tags = autoTagPayload.tags;
      postData.autoTags = autoTagPayload.autoTags;

      const insertResult = idempotencyKey
        ? await postsRepo.insertIfAbsent(
            { authorId: req.user.id, idempotencyKey },
            postData,
            context
          )
        : { item: await postsRepo.insert(postData, context), inserted: true };
      if (!insertResult.inserted) {
        createdPost = insertResult.item;
        opponent = await usersRepo.findById(createdPost.fight?.opponentId, context);
        idempotencyReplay = true;
        return;
      }

      // Create notification for opponent
      await createNotification(
        context,
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
      await messagesRepo.insert({
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
      }, context);

      // Update challenger activity
      challenger = await usersRepo.updateById(req.user.id, (storedUser) => {
        if (!storedUser.activity) {
          storedUser.activity = {
            postsCreated: 0,
            commentsPosted: 0,
            reactionsGiven: 0,
            likesReceived: 0,
            tournamentsWon: 0,
            tournamentsParticipated: 0
          };
        }
        storedUser.activity.postsCreated += 1;
        storedUser.activity.fightsCreated = (storedUser.activity.fightsCreated || 0) + 1;
        updateLeveledBadgeProgress(
          storedUser,
          'badge_manager',
          storedUser.activity.fightsCreated,
          20,
          20
        );
        addRankPoints(storedUser, RANK_POINT_VALUES.post);
        storedUser.updatedAt = now.toISOString();
        return storedUser;
      }, context);
      await applyDailyActivityBonusAtomic(req.user.id, 'post', 100, context);
      challenger = await usersRepo.findById(req.user.id, context);

      createdPost = postData;
    });

    if (idempotencyReplay) {
      res.set('Idempotency-Replayed', 'true');
    }
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
    if (err.code === 'INVALID_IMAGE_SOURCE') {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === 'INVALID_IDEMPOTENCY_KEY') {
      return res.status(400).json({ message: err.message });
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

    await withRepositoryTransaction(async (context) => {
      const post = await postsRepo.findById(id, context);
      if (!post) {
        const error = new Error('Post not found');
        error.code = 'POST_NOT_FOUND';
        throw error;
      }
      assertPostActive(post);

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
        challenger = await usersRepo.findById(post.fight.challengerId, context);
        if (challenger) {
          await createNotification(
            context,
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

        updatedPost = await postsRepo.updateById(id, () => post, context);
        return;
      }

      // Opponent accepted - set their team
      post.fight.opponentTeam = opponentTeam;
      post.fight.teamB = opponentTeam;
      post.fight.status = 'pending_approval';
      post.fight.respondedAt = now;
      post.updatedAt = now;

      // Notify challenger that opponent responded
      challenger = await usersRepo.findById(post.fight.challengerId, context);
      if (challenger) {
        await createNotification(
          context,
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
        const opponent = await usersRepo.findById(req.user.id, context);
        if (opponent) {
          await messagesRepo.insert({
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
          }, context);
        }
      }

      updatedPost = await postsRepo.updateById(id, () => post, context);
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

    await withRepositoryTransaction(async (context) => {
      const post = await postsRepo.findById(id, context);
      if (!post) {
        const error = new Error('Post not found');
        error.code = 'POST_NOT_FOUND';
        throw error;
      }
      assertPostActive(post);

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
        const opponent = await usersRepo.findById(post.fight.opponentId, context);
        if (opponent) {
          await createNotification(
            context,
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

        updatedPost = await postsRepo.updateById(id, () => post, context);
        return;
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
      const opponent = await usersRepo.findById(post.fight.opponentId, context);
      if (opponent) {
        await createNotification(
          context,
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

      updatedPost = await postsRepo.updateById(id, () => post, context);
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
    const userId = req.user.id;
    const nowIso = new Date().toISOString();
    const challenges = await withRepositoryTransaction(async (context) => {
      const expired = await postsRepo.findManyBy(
        {
          type: 'fight',
          'fight.fightMode': 'user_vs_user',
          'fight.status': 'pending_opponent',
          'fight.expiresAt': { $lt: nowIso },
          'fight.opponentId': userId
        },
        { limit: 100 },
        context
      );
      await Promise.all(expired.map((post) =>
        postsRepo.updateById(post.id, (storedPost) => {
          storedPost.fight.status = 'expired';
          storedPost.updatedAt = nowIso;
          return storedPost;
        }, context)
      ));
      return postsRepo.findManyBy(
        {
          type: 'fight',
          'fight.fightMode': 'user_vs_user',
          $or: [
            {
              'fight.opponentId': userId,
              'fight.status': 'pending_opponent',
              'fight.expiresAt': { $gte: nowIso }
            },
            {
              'fight.challengerId': userId,
              'fight.status': 'pending_approval'
            }
          ]
        },
        { sort: { createdAt: -1 }, limit: 100 },
        context
      );
    });
    const participantIds = [...new Set(challenges.flatMap((post) => [
      post.fight?.challengerId,
      post.fight?.opponentId
    ]).filter(Boolean))];
    const users = participantIds.length
      ? await usersRepo.findManyBy({ id: { $in: participantIds } }, { limit: participantIds.length })
      : [];
    const processedChallenges = challenges.map((post) =>
      normalizePostForResponse(post, users)
    );

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
    const escapedSearch = String(q)
      .trim()
      .slice(0, 80)
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const users = await usersRepo.findManyBy(
      {
        id: { $ne: req.user.id },
        username: { $regex: escapedSearch, $options: 'i' }
      },
      { sort: { username: 1 }, limit: 10 }
    );
    const matchingUsers = users.map((user) => ({
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
