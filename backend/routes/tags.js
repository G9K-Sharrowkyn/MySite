import express from 'express';
import taggingService from '../services/taggingService.js';
import Tag from '../models/Tag.js';
import Post from '../models/Post.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// GET /api/tags - Pobierz wszystkie tagi
router.get('/', async (req, res) => {
  try {
    const { category, limit = 50, trending = false } = req.query;
    
    let tags;
    if (trending === 'true') {
      tags = await taggingService.getTrendingTags(parseInt(limit));
    } else {
      tags = await taggingService.getPopularTags(category, parseInt(limit));
    }
    
    res.json({
      success: true,
      tags
    });
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({
      success: false,
      message: 'Błąd podczas pobierania tagów'
    });
  }
});

// GET /api/tags/categories - Pobierz tagi pogrupowane według kategorii
router.get('/categories', async (req, res) => {
  try {
    const categories = ['universe', 'character', 'power_tier', 'genre'];
    const tagsByCategory = {};
    
    for (const category of categories) {
      tagsByCategory[category] = await taggingService.getPopularTags(category, 20);
    }
    
    res.json({
      success: true,
      categories: tagsByCategory
    });
  } catch (error) {
    console.error('Error fetching tag categories:', error);
    res.status(500).json({
      success: false,
      message: 'Błąd podczas pobierania kategorii tagów'
    });
  }
});

// GET /api/tags/search - Wyszukaj tagi
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({
        success: true,
        tags: []
      });
    }
    
    const tags = await taggingService.searchTags(q);
    
    res.json({
      success: true,
      tags
    });
  } catch (error) {
    console.error('Error searching tags:', error);
    res.status(500).json({
      success: false,
      message: 'Błąd podczas wyszukiwania tagów'
    });
  }
});

// GET /api/tags/trending - Pobierz trending tagi
router.get('/trending', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const tags = await taggingService.getTrendingTags(parseInt(limit));
    
    res.json({
      success: true,
      tags
    });
  } catch (error) {
    console.error('Error fetching trending tags:', error);
    res.status(500).json({
      success: false,
      message: 'Błąd podczas pobierania trending tagów'
    });
  }
});

// POST /api/tags/filter-posts - Filtruj posty według tagów
router.post('/filter-posts', async (req, res) => {
  try {
    const filters = req.body;
    const posts = await taggingService.filterPosts(filters);
    
    res.json({
      success: true,
      posts,
      count: posts.length
    });
  } catch (error) {
    console.error('Error filtering posts:', error);
    res.status(500).json({
      success: false,
      message: 'Błąd podczas filtrowania postów'
    });
  }
});

// POST /api/tags/auto-tag - Automatyczne tagowanie posta (dla moderatorów)
router.post('/auto-tag', authenticateToken, async (req, res) => {
  try {
    const { postId } = req.body;
    
    // Sprawdź czy użytkownik jest moderatorem
    if (!req.user.isModerator) {
      return res.status(403).json({
        success: false,
        message: 'Brak uprawnień'
      });
    }
    
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post nie został znaleziony'
      });
    }
    
    const taggingResult = await taggingService.autoTagPost(post);
    
    // Aktualizuj post
    post.tags = taggingResult.tags;
    post.autoTags = taggingResult.autoTags;
    await post.save();
    
    // Aktualizuj statystyki tagów
    await taggingService.updateTagStats(taggingResult.tags);
    
    res.json({
      success: true,
      message: 'Post został automatycznie otagowany',
      tags: taggingResult.tags,
      autoTags: taggingResult.autoTags
    });
  } catch (error) {
    console.error('Error auto-tagging post:', error);
    res.status(500).json({
      success: false,
      message: 'Błąd podczas automatycznego tagowania'
    });
  }
});

// POST /api/tags/initialize - Inicjalizuj podstawowe tagi (dla administratorów)
router.post('/initialize', authenticateToken, async (req, res) => {
  try {
    // Sprawdź czy użytkownik jest administratorem
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Brak uprawnień administratora'
      });
    }
    
    await taggingService.initializeBaseTags();
    
    res.json({
      success: true,
      message: 'Podstawowe tagi zostały zainicjalizowane'
    });
  } catch (error) {
    console.error('Error initializing tags:', error);
    res.status(500).json({
      success: false,
      message: 'Błąd podczas inicjalizacji tagów'
    });
  }
});

// GET /api/tags/stats - Statystyki tagów
router.get('/stats', async (req, res) => {
  try {
    const totalTags = await Tag.countDocuments({ active: true });
    const trendingCount = await Tag.countDocuments({ trending: true });
    const categoryCounts = await Tag.aggregate([
      { $match: { active: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);
    
    const topTags = await Tag.find({ active: true })
      .sort({ postCount: -1 })
      .limit(10)
      .select('name postCount category');
    
    res.json({
      success: true,
      stats: {
        totalTags,
        trendingCount,
        categoryCounts,
        topTags
      }
    });
  } catch (error) {
    console.error('Error fetching tag stats:', error);
    res.status(500).json({
      success: false,
      message: 'Błąd podczas pobierania statystyk tagów'
    });
  }
});

// PUT /api/tags/:id - Aktualizuj tag (dla moderatorów)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    if (!req.user.isModerator) {
      return res.status(403).json({
        success: false,
        message: 'Brak uprawnień'
      });
    }
    
    const { id } = req.params;
    const updates = req.body;
    
    const tag = await Tag.findByIdAndUpdate(id, updates, { new: true });
    
    if (!tag) {
      return res.status(404).json({
        success: false,
        message: 'Tag nie został znaleziony'
      });
    }
    
    res.json({
      success: true,
      message: 'Tag został zaktualizowany',
      tag
    });
  } catch (error) {
    console.error('Error updating tag:', error);
    res.status(500).json({
      success: false,
      message: 'Błąd podczas aktualizacji tagu'
    });
  }
});

// DELETE /api/tags/:id - Usuń tag (dla administratorów)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Brak uprawnień administratora'
      });
    }
    
    const { id } = req.params;
    const tag = await Tag.findByIdAndDelete(id);
    
    if (!tag) {
      return res.status(404).json({
        success: false,
        message: 'Tag nie został znaleziony'
      });
    }
    
    // Usuń tag z wszystkich postów
    await Post.updateMany(
      { tags: tag.name },
      { $pull: { tags: tag.name } }
    );
    
    res.json({
      success: true,
      message: 'Tag został usunięty'
    });
  } catch (error) {
    console.error('Error deleting tag:', error);
    res.status(500).json({
      success: false,
      message: 'Błąd podczas usuwania tagu'
    });
  }
});

export default router;