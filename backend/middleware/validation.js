import { body, validationResult } from 'express-validator';
import { sanitizePostPhotos } from '../utils/imageSecurity.js';

/**
 * Middleware to check validation results
 */
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      msg: 'Validation error',
      errors: errors.array()
    });
  }
  next();
};

/**
 * Registration validation rules
 */
export const registerValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username can only contain letters, numbers, underscores, and hyphens'),

  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('password')
    .isLength({ min: 10, max: 128 })
    .withMessage('Password must be between 10 and 128 characters long')
    .matches(/[A-Za-z]/)
    .withMessage('Password must contain a letter')
    .matches(/\d/)
    .withMessage('Password must contain a number'),

  body('consent.termsOfService')
    .equals('true')
    .withMessage('You must accept the Terms of Service'),

  body('consent.privacyPolicy')
    .equals('true')
    .withMessage('You must acknowledge the Privacy Policy'),

  body('consent.minimumAgeConfirmed')
    .equals('true')
    .withMessage('You must confirm that you meet the minimum age requirement'),

  validate
];

/**
 * Login validation rules
 */
export const loginValidation = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ max: 128 })
    .withMessage('Password is too long'),

  validate
];

/**
 * Profile update validation rules
 */
export const profileUpdateValidation = [
  body('displayName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 60 })
    .withMessage('Display name must be between 1 and 60 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),

  body('bio')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Bio cannot exceed 1000 characters'),

  body('location')
    .optional()
    .trim()
    .isLength({ max: 120 })
    .withMessage('Location cannot exceed 120 characters'),

  body('favoriteUniverse')
    .optional()
    .trim()
    .isLength({ max: 120 })
    .withMessage('Favorite universe cannot exceed 120 characters'),

  body('website')
    .optional({ checkFalsy: true })
    .isURL({ protocols: ['https'], require_protocol: true })
    .withMessage('Website must be a valid HTTPS URL'),

  body('birthDate')
    .optional({ checkFalsy: true })
    .isISO8601({ strict: true })
    .withMessage('Birth date must be a valid date'),

  body('interests')
    .optional()
    .isArray({ max: 50 })
    .withMessage('Too many interests'),

  body('interests.*')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 60 })
    .withMessage('Each interest must be between 1 and 60 characters'),

  body('profilePicture')
    .optional()
    .trim()
    .isLength({ max: 2_500_000 })
    .withMessage('Profile picture payload is too large'),

  body('avatar')
    .optional()
    .trim()
    .isLength({ max: 2_500_000 })
    .withMessage('Avatar payload is too large'),

  body('backgroundImage')
    .optional()
    .trim()
    .isLength({ max: 2_500_000 })
    .withMessage('Background image payload is too large'),

  body('selectedCharacters')
    .optional()
    .isArray({ max: 100 })
    .withMessage('Too many selected characters'),

  validate
];

/**
 * Post creation validation rules
 */
export const postValidation = [
  body('title')
    .isString()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),

  body('content')
    .isString()
    .trim()
    .isLength({ min: 1, max: 10000 })
    .withMessage('Content must be between 1 and 10000 characters'),

  body('type')
    .optional()
    .isIn(['discussion', 'fight', 'other'])
    .withMessage('Invalid post type'),

  body('photos')
    .optional()
    .isArray({ max: 6 })
    .withMessage('A post can contain at most 6 photos')
    .bail()
    .custom((value) => {
      sanitizePostPhotos(value);
      return true;
    })
    .withMessage('Post images must be uploaded images or managed site paths'),

  body('pollOptions')
    .optional()
    .isArray({ max: 10 })
    .withMessage('A poll can contain at most 10 options'),

  validate
];

export const postUpdateValidation = [
  body('title')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),

  body('content')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 10000 })
    .withMessage('Content must be between 1 and 10000 characters'),

  body('type')
    .optional()
    .isIn(['discussion', 'fight', 'other'])
    .withMessage('Invalid post type'),

  body('photos')
    .optional()
    .isArray({ max: 6 })
    .withMessage('A post can contain at most 6 photos')
    .bail()
    .custom((value) => {
      sanitizePostPhotos(value);
      return true;
    })
    .withMessage('Post images must be uploaded images or managed site paths'),

  body('pollOptions')
    .optional()
    .isArray({ max: 10 })
    .withMessage('A poll can contain at most 10 options'),

  validate
];

/**
 * Comment validation rules
 */
export const commentValidation = [
  (req, res, next) => {
    const value = req.body?.text ?? req.body?.content;
    if (typeof value !== 'string' || value.trim().length < 1 || value.trim().length > 2000) {
      return res.status(400).json({
        msg: 'Comment must be between 1 and 2000 characters'
      });
    }
    return next();
  }
];

export const passwordResetValidation = [
  body('token').isString().isLength({ min: 32, max: 256 }),
  body('newPassword')
    .isLength({ min: 10, max: 128 })
    .matches(/[A-Za-z]/)
    .matches(/\d/),
  validate
];

export const changePasswordValidation = [
  body('currentPassword').isString().isLength({ min: 1, max: 128 }),
  body('newPassword')
    .isLength({ min: 10, max: 128 })
    .matches(/[A-Za-z]/)
    .matches(/\d/),
  validate
];

export const emailOnlyValidation = [
  body('email').trim().isEmail().normalizeEmail(),
  validate
];

export const twoFactorValidation = [
  body('challengeToken').isString().isLength({ min: 20, max: 4096 }),
  body('code').matches(/^\d{6}$/),
  validate
];

/**
 * Division join validation rules
 */
export const divisionJoinValidation = [
  body('divisionId')
    .trim()
    .notEmpty()
    .withMessage('Division ID is required')
    .isIn(['regular-people', 'metahuman', 'planet-busters', 'god-tier', 'universal-threat', 'omnipotent'])
    .withMessage('Invalid division ID'),

  body('team.mainCharacter')
    .notEmpty()
    .withMessage('Main character is required'),

  body('team.mainCharacter.id')
    .notEmpty()
    .withMessage('Main character ID is required'),

  validate
];

/**
 * Bet placement validation rules
 */
export const betValidation = [
  body('fightId')
    .notEmpty()
    .withMessage('Fight ID is required'),

  body('team')
    .isIn(['A', 'B'])
    .withMessage('Team must be either A or B'),

  body('amount')
    .isInt({ min: 1, max: 10000 })
    .withMessage('Bet amount must be between 1 and 10000'),

  validate
];

/**
 * Sanitize user input to prevent XSS
 */
export const sanitizeInput = (req, res, next) => {
  // Basic XSS prevention - strip HTML tags from text fields
  const sanitize = (obj) => {
    for (let key in obj) {
      if (typeof obj[key] === 'string') {
        // Remove HTML tags and script content
        obj[key] = obj[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<[^>]+>/g, '');
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitize(obj[key]);
      }
    }
  };

  if (req.body) {
    sanitize(req.body);
  }

  next();
};

export default {
  validate,
  registerValidation,
  loginValidation,
  profileUpdateValidation,
  postValidation,
  commentValidation,
  divisionJoinValidation,
  betValidation,
  sanitizeInput
};
