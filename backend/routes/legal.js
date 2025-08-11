import express from 'express';
import {
  requestDataDeletion,
  requestDataModification,
  getPrivacyPolicy,
  getTermsOfService,
  getCookiePolicy,
  saveConsent
} from '../controllers/legalController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// @route   POST api/legal/request-data-deletion
// @desc    Request data deletion
// @access  Private
router.post('/request-data-deletion', auth, requestDataDeletion);

// @route   POST api/legal/request-data-modification
// @desc    Request data modification
// @access  Private
router.post('/request-data-modification', auth, requestDataModification);

// @route   GET api/legal/privacy-policy
// @desc    Get privacy policy
// @access  Public
router.get('/privacy-policy', getPrivacyPolicy);

// @route   GET api/legal/terms-of-service
// @desc    Get terms of service
// @access  Public
router.get('/terms-of-service', getTermsOfService);

// @route   POST api/legal/consent
// @desc    Save user cookie consent
// @access  Private
router.post('/consent', auth, saveConsent);

// @route   GET api/legal/cookie-policy
// @desc    Get cookie policy
// @access  Public
router.get('/cookie-policy', getCookiePolicy);

export default router;
