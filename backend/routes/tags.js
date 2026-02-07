import express from 'express';
import { readDb, withDb } from '../repositories/index.js';
import { autoTagPost, getBaseTags } from '../utils/tagging.js';
import { normalizePostForResponse } from '../controllers/postController.js';
import { optionalAuth } from '../middleware/optionalAuth.js';

const router = express.Router();

const CATEGORY_KEYS = ['universe', 'character', 'power_tier', 'genre'];

const normalizeTagName = (value) => String(value || '').trim();

const extractTagsByCategory = (post) => {
  const autoTags = post.autoTags || {};
  const tags = Array.isArray(post.tags) ? post.tags : [];

  return {
    universe: (autoTags.universes || []).map(normalizeTagName).filter(Boolean),
    character: (autoTags.characters || []).map(normalizeTagName).filter(Boolean),
    power_tier: (autoTags.powerTiers || []).map(normalizeTagName).filter(Boolean),
    genre: [
      ...(autoTags.categories || []).map(normalizeTagName),
      ...tags.map(normalizeTagName)
    ].filter(Boolean)
  };
};

const resolveUserId = (user) => user?.id || user?._id;

const buildAuthor = (user) => {
  if (!user) return null;
  return {
    id: resolveUserId(user),
    username: user.username,
    profilePicture: user.profile?.profilePicture || user.profile?.avatar || '',
    role: user.role || 'user'
  };
};

const buildTagIndex = (posts) => {
  const index = {
    universe: new Map(),
    character: new Map(),
    power_tier: new Map(),
    genre: new Map()
  };

  posts.forEach((post) => {
    const tagsByCategory = extractTagsByCategory(post);
    CATEGORY_KEYS.forEach((category) => {
      const bucket = index[category];
      tagsByCategory[category].forEach((tag) => {
        const key = tag.toLowerCase();
        const entry = bucket.get(key) || { name: tag, postCount: 0 };
        entry.postCount += 1;
        bucket.set(key, entry);
      });
    });
  });

  return index;
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

const findStoredTagIndex = (tags, id) =>
  tags.findIndex((tag) => {
    const tagId = resolveTagId(tag);
    if (tagId === id) return true;
    if (tag?.name && tag.name.toLowerCase() === id.toLowerCase()) return true;
    return false;
  });

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
    const db = await readDb();
    const index = buildTagIndex(db.posts || []);
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
    const db = await readDb();
    const index = buildTagIndex(db.posts || []);
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

    const db = await readDb();
    const index = buildTagIndex(db.posts || []);
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
    const limit = Number(req.query.limit || 10);
    const db = await readDb();
    const index = buildTagIndex(db.posts || []);
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
    const db = await readDb();
    const viewerUserId = req.user?.id || null;
    const now = new Date();

    const hasFilters = CATEGORY_KEYS.some(
      (category) => Array.isArray(filters[category]) && filters[category].length > 0
    );

    let posts = db.posts || [];

    const normalizedCategory = String(postCategory || '').toLowerCase();
    if (normalizedCategory && normalizedCategory !== 'all') {
      posts = posts.filter((post) => {
        if (normalizedCategory === 'fight') {
          return post.type === 'fight';
        }
        if (post.type === 'fight') return false;
        const postCategory = String(
          post.category || (post.type !== 'fight' ? 'discussion' : '')
        ).toLowerCase();
        return postCategory === normalizedCategory;
      });
    }

    const normalizedGroup = String(group || '').trim().toLowerCase();
    if (normalizedGroup && normalizedGroup !== 'all' && normalizedGroup !== 'none') {
      posts = posts.filter(
        (post) => String(post?.group || '').trim().toLowerCase() === normalizedGroup
      );
    }

    if (hasFilters) {
      posts = posts.filter((post) => {
        const tagsByCategory = extractTagsByCategory(post);
        return CATEGORY_KEYS.every((category) => {
          const wanted = filters[category] || [];
          if (!wanted.length) {
            return true;
          }
          const normalizedWanted = wanted.map((tag) => tag.toLowerCase());
          return tagsByCategory[category].some((tag) =>
            normalizedWanted.includes(tag.toLowerCase())
          );
        });
      });
    }

    const sorted = [...posts].sort((a, b) => {
      if (sortBy === 'likes') {
        return (b.likes?.length || 0) - (a.likes?.length || 0);
      }
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const paged = sorted.slice(
      (pageNumber - 1) * limitNumber,
      pageNumber * limitNumber
    );

    const commentCounts = buildCommentCountByPostId(db.comments || []);
    const formatted = paged.map((post) => {
      const normalized = normalizePostForResponse(post, db.users, { viewerUserId, now });
      const postId = normalized.id;
      return {
        ...normalized,
        commentCount: commentCounts.get(postId) || 0,
        reactionsSummary: buildReactionSummary(post.reactions || [])
      };
    });

    res.json({
      success: true,
      posts: formatted,
      count: posts.length
    });
  } catch (error) {
    console.error('Error filtering posts:', error);
    res.status(500).json({ success: false, message: 'Failed to filter posts' });
  }
});

// POST /api/tags/auto-tag - generate tags from content
router.post('/auto-tag', async (req, res) => {
  try {
    const db = await readDb();
    const tagged = autoTagPost(db, req.body || {});
    res.json({ success: true, ...tagged });
  } catch (error) {
    console.error('Error auto-tagging:', error);
    res.status(500).json({ success: false, message: 'Failed to auto-tag content' });
  }
});

// POST /api/tags/initialize - seed base tags
router.post('/initialize', async (_req, res) => {
  try {
    const baseTags = getBaseTags();
    let created = [];

    await withDb((db) => {
      db.tags = Array.isArray(db.tags) ? db.tags : [];
      const existing = new Set(
        db.tags.map((tag) => `${tag.category}:${tag.name}`.toLowerCase())
      );

      baseTags.forEach((tag) => {
        const key = `${tag.category}:${tag.name}`.toLowerCase();
        if (existing.has(key)) {
          return;
        }

        const id = resolveTagId(tag) || `${tag.category}:${tag.name.toLowerCase()}`;
        db.tags.push({
          ...tag,
          id,
          _id: id,
          usageCount: 0,
          createdAt: new Date().toISOString(),
          isActive: true
        });
        created.push(tag.name);
      });

      return db;
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
    const db = await readDb();
    const index = buildTagIndex(db.posts || []);
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
      storedTags: (db.tags || []).length,
      categories
    });
  } catch (error) {
    console.error('Error fetching tag stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tag stats' });
  }
});

// PUT /api/tags/:id - update stored tag metadata
router.put('/:id', async (req, res) => {
  try {
    let updated;
    await withDb((db) => {
      db.tags = Array.isArray(db.tags) ? db.tags : [];
      const index = findStoredTagIndex(db.tags, req.params.id);
      if (index < 0) {
        const error = new Error('Tag not found');
        error.code = 'NOT_FOUND';
        throw error;
      }

      const tag = db.tags[index];
      const nextName = req.body?.name ?? tag.name;
      const nextCategory = req.body?.category ?? tag.category;
      const nextId = resolveTagId({ ...tag, name: nextName, category: nextCategory });

      tag.name = nextName;
      tag.category = nextCategory;
      if (req.body?.color !== undefined) tag.color = req.body.color;
      if (req.body?.isActive !== undefined) {
        tag.isActive = Boolean(req.body.isActive);
      }
      tag.id = nextId;
      tag._id = nextId;
      tag.updatedAt = new Date().toISOString();
      updated = normalizeStoredTag(tag);
      return db;
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
router.delete('/:id', async (req, res) => {
  try {
    let removed = false;
    await withDb((db) => {
      db.tags = Array.isArray(db.tags) ? db.tags : [];
      const before = db.tags.length;
      db.tags = db.tags.filter(
        (tag) => resolveTagId(tag) !== req.params.id
      );
      removed = db.tags.length !== before;
      return db;
    });

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

