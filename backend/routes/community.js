import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { readDb, withDb } from '../repositories/index.js';

const router = express.Router();

const resolveUserId = (user) => user?.id || user?._id;

const findUserById = (db, userId) =>
  (db.users || []).find((entry) => resolveUserId(entry) === userId);

// GET /api/community/discussions
router.get('/discussions', async (_req, res) => {
  try {
    const db = await readDb();
    const discussions = (db.communityDiscussions || [])
      .slice()
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    res.json(discussions);
  } catch (error) {
    console.error('Error fetching discussions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/community/discussions
router.post('/discussions', async (req, res) => {
  try {
    const { title, content, category, userId } = req.body;
    if (!title || !content || !userId) {
      return res.status(400).json({ message: 'Missing discussion data' });
    }

    let created;
    await withDb((db) => {
      const user = findUserById(db, userId);
      const now = new Date().toISOString();
      created = {
        id: uuidv4(),
        title: title.trim(),
        content: content.trim(),
        category: category || 'general',
        createdAt: now,
        updatedAt: now,
        replyCount: 0,
        likes: 0,
        views: 0,
        user: user
          ? {
              id: resolveUserId(user),
              username: user.username,
              avatar: user.profile?.profilePicture || user.profile?.avatar || '',
              isModerator: user.role === 'moderator'
            }
          : {
              id: userId,
              username: 'Unknown',
              avatar: '',
              isModerator: false
            }
      };

      db.communityDiscussions = Array.isArray(db.communityDiscussions)
        ? db.communityDiscussions
        : [];
      db.communityDiscussions.unshift(created);
      return db;
    });

    res.status(201).json(created);
  } catch (error) {
    console.error('Error creating discussion:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/community/hot-debates
router.get('/hot-debates', async (_req, res) => {
  try {
    const db = await readDb();
    res.json(db.communityHotDebates || []);
  } catch (error) {
    console.error('Error fetching hot debates:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/community/character-rankings
router.get('/character-rankings', async (_req, res) => {
  try {
    const db = await readDb();
    res.json(db.communityCharacterRankings || []);
  } catch (error) {
    console.error('Error fetching character rankings:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/community/polls
router.get('/polls', async (_req, res) => {
  try {
    const db = await readDb();
    res.json(db.communityPolls || []);
  } catch (error) {
    console.error('Error fetching polls:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

