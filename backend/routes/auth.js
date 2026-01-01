import express from 'express';
import { register, login, changePassword, updateTimezone, forgotPassword, resetPassword } from '../controllers/authController.js';
import { registerValidation, loginValidation } from '../middleware/validation.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// @route   POST api/auth/register
// @desc    Register user
// @access  Public
router.post('/register', registerValidation, register);

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', loginValidation, login);

// @route   POST api/auth/forgot-password
// @desc    Request password reset email
// @access  Public
router.post('/forgot-password', forgotPassword);

// @route   POST api/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post('/reset-password', resetPassword);

// @route   PUT api/auth/change-password
// @desc    Change user password
// @access  Private
router.put('/change-password', auth, changePassword);

// @route   PUT api/auth/update-timezone
// @desc    Update user timezone
// @access  Private
router.put('/update-timezone', auth, updateTimezone);

export default router;
