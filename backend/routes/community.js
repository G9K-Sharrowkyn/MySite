import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  communityCharacterRankingsRepo,
  communityDiscussionsRepo,
  communityHotDebatesRepo,
  communityPollsRepo,
  usersRepo
} from '../repositories/index.js';
import auth from '../middleware/auth.js';

const router = express.Router();

const resolveUserId = (user) => user?.id || user?._id;

// GET /api/community/discussions
router.get('/discussions', async (_req, res) => {
  try {
    const discussions = await communityDiscussionsRepo.findManyBy(
      {},
      { sort: { createdAt: -1 }, limit: 100 }
    );
    res.json(discussions);
  } catch (error) {
    console.error('Error fetching discussions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/community/discussions
router.post('/discussions', auth, async (req, res) => {
  try {
    const { title, content, category } = req.body;
    const userId = req.user.id;
    if (!title || !content) {
      return res.status(400).json({ message: 'Missing discussion data' });
    }

    let created;
    const user = await usersRepo.findById(userId);
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
    await communityDiscussionsRepo.insert(created);

    res.status(201).json(created);
  } catch (error) {
    console.error('Error creating discussion:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/community/hot-debates
router.get('/hot-debates', async (_req, res) => {
  try {
    res.json(await communityHotDebatesRepo.findManyBy({}, { limit: 100 }));
  } catch (error) {
    console.error('Error fetching hot debates:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/community/character-rankings
router.get('/character-rankings', async (_req, res) => {
  try {
    res.json(await communityCharacterRankingsRepo.findManyBy({}, { limit: 100 }));
  } catch (error) {
    console.error('Error fetching character rankings:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/community/polls
router.get('/polls', async (_req, res) => {
  try {
    res.json(await communityPollsRepo.findManyBy({}, { limit: 100 }));
  } catch (error) {
    console.error('Error fetching polls:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

