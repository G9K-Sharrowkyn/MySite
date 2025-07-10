const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { getDonationConfig, recordDonation } = require('../controllers/donationController');

const router = express.Router();

router.get('/config', getDonationConfig);
router.post('/history', protect, recordDonation);

module.exports = router;