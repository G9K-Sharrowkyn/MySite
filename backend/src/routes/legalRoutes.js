const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { 
  getPrivacyPolicy, 
  getTermsOfService, 
  getCookiePolicy, 
  updateConsent, 
  exportUserData, 
  deleteAccount 
} = require('../controllers/legalController');

const router = express.Router();

// Public legal document endpoints
router.get('/privacy-policy', getPrivacyPolicy);
router.get('/terms-of-service', getTermsOfService);
router.get('/cookies', getCookiePolicy);

// Protected endpoints requiring authentication
router.use(protect);

// POST /api/legal/consent - Update user consent
router.post('/consent', updateConsent);

// GET /api/legal/data-export - Export user data (GDPR)
router.get('/data-export', exportUserData);

// DELETE /api/legal/delete-account - Delete user account (GDPR)
router.delete('/delete-account', deleteAccount);

module.exports = router; 