import express from 'express';
import { getDonationStats, recordDonation } from '../controllers/donationController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// @route   GET api/donations/stats
// @desc    Get donation statistics
// @access  Public
router.get('/stats', getDonationStats);

// @route   POST api/donations/record
// @desc    Record a donation
// @access  Private
router.post('/record', auth, recordDonation);

export default router;
