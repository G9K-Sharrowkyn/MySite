import express from 'express';
import {
  register,
  login,
  loginWithGoogle,
  changePassword,
  updateTimezone,
  forgotPassword,
  resetPassword,
  resendVerificationEmail,
  verifyEmail,
  verifyLoginTwoFactor,
  establishSession,
  logout
} from '../controllers/authController.js';
import {
  registerValidation,
  loginValidation,
  passwordResetValidation,
  changePasswordValidation,
  emailOnlyValidation,
  twoFactorValidation
} from '../middleware/validation.js';
import auth from '../middleware/auth.js';
import { optionalAuth } from '../middleware/optionalAuth.js';

const router = express.Router();

// @route   POST api/auth/register
// @desc    Register user
// @access  Public
router.post('/register', registerValidation, register);

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', loginValidation, login);

// @route   POST api/auth/google
// @desc    Authenticate/register with Google ID token
// @access  Public
router.post('/google', loginWithGoogle);

// @route   POST api/auth/forgot-password
// @desc    Request password reset email
// @access  Public
router.post('/forgot-password', emailOnlyValidation, forgotPassword);

// @route   POST api/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post('/reset-password', passwordResetValidation, resetPassword);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', emailOnlyValidation, resendVerificationEmail);
router.post('/verify-2fa', twoFactorValidation, verifyLoginTwoFactor);
router.post('/session', auth, establishSession);
router.post('/logout', optionalAuth, logout);

// @route   PUT api/auth/change-password
// @desc    Change user password
// @access  Private
router.put('/change-password', auth, changePasswordValidation, changePassword);

// @route   PUT api/auth/update-timezone
// @desc    Update user timezone
// @access  Private
router.put('/update-timezone', auth, updateTimezone);

export default router;
