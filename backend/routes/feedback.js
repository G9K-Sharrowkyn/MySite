import express from 'express';
import { submitFeedback, getFeedback, updateFeedbackStatus } from '../controllers/feedbackController.js';
import { optionalAuth } from '../middleware/optionalAuth.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// Submit feedback (authenticated or anonymous)
router.post('/', optionalAuth, submitFeedback);

// Get all feedback (admin only)
router.get('/', authMiddleware, getFeedback);

// Update feedback status (admin only)
router.put('/:id', authMiddleware, updateFeedbackStatus);

export default router;
