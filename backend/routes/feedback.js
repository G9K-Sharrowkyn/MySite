import express from 'express';
import { submitFeedback, getFeedback, updateFeedbackStatus, deleteFeedback, approveCharacterSuggestion } from '../controllers/feedbackController.js';
import { optionalAuth } from '../middleware/optionalAuth.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// Submit feedback (authenticated or anonymous)
router.post('/', optionalAuth, submitFeedback);

// Get all feedback (admin only)
router.get('/', authMiddleware, getFeedback);

// Update feedback status (admin only)
router.put('/:id', authMiddleware, updateFeedbackStatus);

// Delete feedback (admin/moderator only)
router.delete('/:id', authMiddleware, deleteFeedback);

// Approve character suggestion (admin/moderator only)
router.post('/:id/approve-character', authMiddleware, approveCharacterSuggestion);

export default router;
