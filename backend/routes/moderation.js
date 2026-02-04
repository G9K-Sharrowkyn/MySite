import express from 'express';
import auth from '../middleware/auth.js';
import {
  getModerationLogs,
  getReportsQueue,
  listUsersForModeration,
  suspendUser,
  unsuspendUser
} from '../controllers/moderationController.js';

const router = express.Router();

router.get('/logs', auth, getModerationLogs);
router.get('/reports-queue', auth, getReportsQueue);
router.get('/users', auth, listUsersForModeration);
router.post('/users/:userId/suspend', auth, suspendUser);
router.post('/users/:userId/unsuspend', auth, unsuspendUser);

export default router;
