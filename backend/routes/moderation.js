import express from 'express';
import auth from '../middleware/auth.js';
import {
  getModerationLogs,
  getReportsQueue
} from '../controllers/moderationController.js';

const router = express.Router();

router.get('/logs', auth, getModerationLogs);
router.get('/reports-queue', auth, getReportsQueue);

export default router;

