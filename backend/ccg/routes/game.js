import express from 'express';
import { createRoom, joinRoom, getRoomState } from '../controllers/gameController.js';
import { playVsBot, joinQueue, leaveQueue, getQueueStatus } from '../controllers/matchmakingController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/room', protect, createRoom);
router.post('/room/:roomId/join', protect, joinRoom);

// Matchmaking routes
router.post('/play-vs-bot', protect, playVsBot);
router.post('/join-queue', protect, joinQueue);
router.post('/leave-queue', protect, leaveQueue);
router.get('/queue-status', protect, getQueueStatus);

export default router;
