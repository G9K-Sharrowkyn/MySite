import { body, validationResult } from 'express-validator';

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
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),

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
    .withMessage('Password is required'),

  validate
];

/**
 * Profile update validation rules
 */
export const profileUpdateValidation = [
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),

  body('profilePicture')
    .optional()
    .trim()
    .isURL()
    .withMessage('Profile picture must be a valid URL'),

  validate
];

/**
 * Post creation validation rules
 */
export const postValidation = [
  body('title')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),

  body('content')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Content cannot exceed 5000 characters'),

  body('type')
    .isIn(['discussion', 'fight', 'other'])
    .withMessage('Invalid post type'),

  validate
];

/**
 * Comment validation rules
 */
export const commentValidation = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Comment must be between 1 and 1000 characters'),

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
 * Fighter proposal validation rules
 */
export const fighterProposalValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Fighter name must be between 2 and 100 characters'),

  body('universe')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Universe must be between 2 and 100 characters'),

  body('imageUrl')
    .trim()
    .notEmpty()
    .withMessage('Image is required for fighter proposal'),

  body('suggestedDivision')
    .optional()
    .isIn(['regular-people', 'metahuman', 'planet-busters', 'god-tier', 'universal-threat', 'omnipotent'])
    .withMessage('Invalid division ID'),

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
  fighterProposalValidation,
  sanitizeInput
};
