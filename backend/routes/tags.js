import express from 'express';
import {
  charactersRepo,
  commentsRepo,
  postsRepo,
  tagsRepo,
  usersRepo,
  withRepositoryTransaction
} from '../repositories/index.js';
import { autoTagPost, getBaseTags } from '../utils/tagging.js';
import { normalizePostForResponse } from '../controllers/postController.js';
import { optionalAuth } from '../middleware/optionalAuth.js';
import auth from '../middleware/auth.js';
import roleMiddleware from '../middleware/roleMiddleware.js';
import { parseLimit, parsePagination } from '../utils/pagination.js';

const router = express.Router();

const CATEGORY_KEYS = ['universe', 'character', 'power_tier', 'genre'];

const ACTIVE_POST_QUERY = { 'moderation.deleted.isDeleted': { $ne: true } };

const loadTagIndex = async () => {
  const [universes, characters, powerTiers, genres] = await Promise.all([
    postsRepo.groupArrayValues(['autoTags.universes'], ACTIVE_POST_QUERY),
    postsRepo.groupArrayValues(['autoTags.characters'], ACTIVE_POST_QUERY),
    postsRepo.groupArrayValues(['autoTags.powerTiers'], ACTIVE_POST_QUERY),
    postsRepo.groupArrayValues(['autoTags.categories', 'tags'], ACTIVE_POST_QUERY)
  ]);
  const toMap = (entries) => new Map(entries.map((entry) => [
    entry.tag.toLowerCase(),
    { name: entry.tag, postCount: entry.count }
  ]));
  return {
    universe: toMap(universes),
    character: toMap(characters),
    power_tier: toMap(powerTiers),
    genre: toMap(genres)
  };
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

const mapTagEntries = (entries, category) =>
  [...entries.values()]
    .sort((a, b) => b.postCount - a.postCount)
    .map((entry) => ({
      _id: `${category}:${entry.name.toLowerCase()}`,
      name: entry.name,
      postCount: entry.postCount,
      category
    }));

const resolveTagId = (tag) => {
  if (tag?.id) return tag.id;
  if (tag?._id) return tag._id;
  if (!tag?.name || !tag?.category) return null;
  return `${tag.category}:${tag.name.toLowerCase()}`;
};

const normalizeStoredTag = (tag) => {
  const id = resolveTagId(tag);
  return {
    ...tag,
    id,
    _id: id,
    isActive: tag?.isActive !== false
  };
};

// GET /api/tags - list tags (simple)
router.get('/', async (_req, res) => {
  try {
    const index = await loadTagIndex();
    const tags = CATEGORY_KEYS.flatMap((category) =>
      mapTagEntries(index[category], category)
    );

    res.json({ success: true, tags });
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tags' });
  }
});

// GET /api/tags/categories - tags grouped by category
router.get('/categories', async (_req, res) => {
  try {
    const index = await loadTagIndex();
    const categories = {};

    CATEGORY_KEYS.forEach((category) => {
      categories[category] = mapTagEntries(index[category], category).slice(0, 20);
    });

    res.json({ success: true, categories });
  } catch (error) {
    console.error('Error fetching tag categories:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tag categories' });
  }
});

// GET /api/tags/search - search tags
router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').toLowerCase();
    if (q.length < 2) {
      return res.json({ success: true, tags: [] });
    }

    const index = await loadTagIndex();
    const results = CATEGORY_KEYS.flatMap((category) =>
      mapTagEntries(index[category], category)
    ).filter((tag) => tag.name.toLowerCase().includes(q));

    res.json({ success: true, tags: results.slice(0, 50) });
  } catch (error) {
    console.error('Error searching tags:', error);
    res.status(500).json({ success: false, message: 'Failed to search tags' });
  }
});

// GET /api/tags/trending - trending tags
router.get('/trending', async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit, { fallback: 10, max: 50 });
    const index = await loadTagIndex();
    const tags = CATEGORY_KEYS.flatMap((category) =>
      mapTagEntries(index[category], category)
    )
      .sort((a, b) => b.postCount - a.postCount)
      .slice(0, limit);

    res.json({ success: true, tags });
  } catch (error) {
    console.error('Error fetching trending tags:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch trending tags' });
  }
});

// POST /api/tags/filter-posts - filter posts by tags
router.post('/filter-posts', optionalAuth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      postCategory,
      group,
      ...filters
    } = req.body || {};
    const viewerUserId = req.user?.id || null;
    const now = new Date();

    const hasFilters = CATEGORY_KEYS.some(
      (category) => Array.isArray(filters[category]) && filters[category].length > 0
    );

    const query = { ...ACTIVE_POST_QUERY };
    const clauses = [];
    const normalizedCategory = String(postCategory || '').toLowerCase();
    if (normalizedCategory && normalizedCategory !== 'all') {
      if (normalizedCategory === 'fight') {
        clauses.push({ type: 'fight' });
      } else if (normalizedCategory === 'discussion') {
        clauses.push({ type: { $ne: 'fight' } });
        clauses.push({ $or: [{ category: 'discussion' }, { category: { $exists: false } }] });
      } else {
        clauses.push({ type: { $ne: 'fight' }, category: normalizedCategory });
      }
    }

    const normalizedGroup = String(group || '').trim().toLowerCase();
    if (normalizedGroup && normalizedGroup !== 'all' && normalizedGroup !== 'none') {
      clauses.push({ group: normalizedGroup });
    }

    if (hasFilters) {
      const pathsByCategory = {
        universe: ['autoTags.universes'],
        character: ['autoTags.characters'],
        power_tier: ['autoTags.powerTiers'],
        genre: ['autoTags.categories', 'tags']
      };
      CATEGORY_KEYS.forEach((category) => {
        const wanted = Array.isArray(filters[category]) ? filters[category] : [];
        if (!wanted.length) return;
        const alternatives = [];
        wanted.forEach((tag) => {
          const escaped = String(tag).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          pathsByCategory[category].forEach((path) => {
            alternatives.push({ [path]: { $regex: `^${escaped}$`, $options: 'i' } });
          });
        });
        clauses.push({ $or: alternatives });
      });
    }
    if (clauses.length) query.$and = clauses;

    const { page: pageNumber, limit: limitNumber } = parsePagination(
      { page, limit },
      { defaultLimit: 10, maxLimit: 50 }
    );
    const skip = (pageNumber - 1) * limitNumber;
    const [paged, count] = await Promise.all([
      sortBy === 'likes'
        ? postsRepo.findTopByArrayLength('likes', { skip, limit: limitNumber }, query)
        : postsRepo.findManyBy(query, {
            sort: { createdAt: -1 },
            skip,
            limit: limitNumber
          }),
      postsRepo.countBy(query)
    ]);
    const postIds = paged.map((post) => post.id);
    const authorIds = [...new Set(paged.map((post) => post.authorId).filter(Boolean))];
    const [commentCountObject, users] = await Promise.all([
      postIds.length
        ? commentsRepo.groupCountBy('postId', {
            postId: { $in: postIds },
            $or: [{ type: 'post' }, { type: { $exists: false } }]
          })
        : {},
      authorIds.length
        ? usersRepo.findManyBy({ id: { $in: authorIds } }, { limit: authorIds.length })
        : []
    ]);
    const formatted = paged.map((post) => {
      const normalized = normalizePostForResponse(post, users, { viewerUserId, now });
      const postId = normalized.id;
      return {
        ...normalized,
        commentCount: commentCountObject[postId] || 0,
        reactionsSummary: buildReactionSummary(post.reactions || [])
      };
    });

    res.json({
      success: true,
      posts: formatted,
      count
    });
  } catch (error) {
    console.error('Error filtering posts:', error);
    res.status(500).json({ success: false, message: 'Failed to filter posts' });
  }
});

// POST /api/tags/auto-tag - generate tags from content
router.post('/auto-tag', auth, async (req, res) => {
  try {
    const characters = await charactersRepo.findManyBy({}, { limit: 5000 });
    const tagged = autoTagPost({ characters }, req.body || {});
    res.json({ success: true, ...tagged });
  } catch (error) {
    console.error('Error auto-tagging:', error);
    res.status(500).json({ success: false, message: 'Failed to auto-tag content' });
  }
});

// POST /api/tags/initialize - seed base tags
router.post('/initialize', auth, roleMiddleware(['moderator', 'admin']), async (_req, res) => {
  try {
    const baseTags = getBaseTags();
    let created = [];

    await withRepositoryTransaction(async (context) => {
      for (const tag of baseTags) {
        const id = resolveTagId(tag) || `${tag.category}:${tag.name.toLowerCase()}`;
        const result = await tagsRepo.insertIfAbsent(
          { id },
          {
            ...tag,
            id,
            _id: id,
            usageCount: 0,
            createdAt: new Date().toISOString(),
            isActive: true
          },
          context
        );
        if (result.inserted) created.push(tag.name);
      }
    });

    res.json({ success: true, created, count: created.length });
  } catch (error) {
    console.error('Error initializing tags:', error);
    res.status(500).json({ success: false, message: 'Failed to initialize tags' });
  }
});

// GET /api/tags/stats - aggregate tag stats
router.get('/stats', async (_req, res) => {
  try {
    const index = await loadTagIndex();
    const categories = {};
    const totals = {};

    CATEGORY_KEYS.forEach((category) => {
      const entries = mapTagEntries(index[category], category);
      categories[category] = entries;
      totals[category] = entries.length;
    });

    const allTags = CATEGORY_KEYS.flatMap((category) =>
      mapTagEntries(index[category], category)
    );

    res.json({
      success: true,
      totals,
      totalTags: allTags.length,
      topTags: allTags.slice().sort((a, b) => b.postCount - a.postCount).slice(0, 10),
      storedTags: await tagsRepo.countBy({}),
      categories
    });
  } catch (error) {
    console.error('Error fetching tag stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tag stats' });
  }
});

// PUT /api/tags/:id - update stored tag metadata
router.put('/:id', auth, roleMiddleware(['moderator', 'admin']), async (req, res) => {
  try {
    let updated;
    await withRepositoryTransaction(async (context) => {
      const stored =
        (await tagsRepo.findById(req.params.id, context)) ||
        (await tagsRepo.findOneBy(
          { name: { $regex: `^${String(req.params.id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
          {},
          context
        ));
      if (!stored) {
        const error = new Error('Tag not found');
        error.code = 'NOT_FOUND';
        throw error;
      }

      const nextName = req.body?.name ?? stored.name;
      const nextCategory = req.body?.category ?? stored.category;
      const nextId = resolveTagId({ ...stored, name: nextName, category: nextCategory });
      updated = await tagsRepo.updateById(stored.id, (tag) => {
        tag.name = nextName;
        tag.category = nextCategory;
        if (req.body?.color !== undefined) tag.color = req.body.color;
        if (req.body?.isActive !== undefined) tag.isActive = Boolean(req.body.isActive);
        tag.id = nextId;
        tag._id = nextId;
        tag.updatedAt = new Date().toISOString();
        return tag;
      }, context);
      updated = normalizeStoredTag(updated);
    });

    res.json({ success: true, tag: updated });
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Tag not found' });
    }
    console.error('Error updating tag:', error);
    res.status(500).json({ success: false, message: 'Failed to update tag' });
  }
});

// DELETE /api/tags/:id - delete stored tag
router.delete('/:id', auth, roleMiddleware(['moderator', 'admin']), async (req, res) => {
  try {
    let removed = false;
    const stored = await tagsRepo.findById(req.params.id);
    if (stored) {
      removed = Boolean(await tagsRepo.removeById(stored.id));
    }

    if (!removed) {
      return res.status(404).json({ success: false, message: 'Tag not found' });
    }

    res.json({ success: true, message: 'Tag deleted' });
  } catch (error) {
    console.error('Error deleting tag:', error);
    res.status(500).json({ success: false, message: 'Failed to delete tag' });
  }
});

export default router;

