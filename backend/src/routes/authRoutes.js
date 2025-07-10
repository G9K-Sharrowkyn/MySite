const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { register, login, logout } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});

router.post(
  '/register',
  limiter,
  [
    body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
    body('email').isEmail().withMessage('Provide a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('consent.privacyPolicy').equals('true').withMessage('Privacy consent is required'),
    body('consent.termsOfService').equals('true').withMessage('Terms consent is required'),
    body('consent.cookies').equals('true').withMessage('Cookie consent is required')
  ],
  register
);

router.post(
  '/login',
  limiter,
  [
    body('email').isEmail().withMessage('Provide a valid email'),
    body('password').exists().withMessage('Password is required')
  ],
  login
);

router.post('/logout', protect, logout);

module.exports = router;