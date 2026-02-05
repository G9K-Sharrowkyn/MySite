import express from 'express';
import auth from '../middleware/auth.js';
import { blockUser, getBlockStatus, listBlockedUsers, unblockUser } from '../controllers/blocksController.js';

const router = express.Router();

router.get('/', auth, listBlockedUsers);
router.get('/status/:userId', auth, getBlockStatus);
router.post('/:userId', auth, blockUser);
router.delete('/:userId', auth, unblockUser);

export default router;
