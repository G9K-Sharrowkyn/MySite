const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { body, validationResult } = require('express-validator');

// Rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Increased from 5 to 100 for development
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for general API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased from 100 to 1000 for development
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for voting endpoints
const voteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50, // Increased from 10 to 50 for development
  message: 'Too many votes from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// GDPR compliance middleware
const gdprCompliance = (req, res, next) => {
  // Check if user has given consent
  if (req.user && !req.user.consent?.privacyPolicy) {
    return res.status(403).json({ 
      message: 'Privacy policy consent required',
      requiresConsent: true 
    });
  }
  next();
};

// Cookie consent middleware
const cookieConsent = (req, res, next) => {
  if (req.user && !req.user.consent?.cookies) {
    // Allow basic functionality but restrict tracking
    req.restrictedTracking = true;
  }
  next();
};

// Input validation middleware
const validateRegistration = [
  body('username')
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  body('consent.privacyPolicy')
    .isBoolean()
    .withMessage('Privacy policy consent is required'),
  body('consent.termsOfService')
    .isBoolean()
    .withMessage('Terms of service consent is required'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array() 
      });
    }
    next();
  }
];

const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array() 
      });
    }
    next();
  }
];

// CSRF protection for sensitive operations
const csrfProtection = (req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
    const csrfToken = req.headers['x-csrf-token'];
    if (!csrfToken) {
      return res.status(403).json({ message: 'CSRF token required' });
    }
    // In a real implementation, you'd validate the token
    // For now, we'll just check if it exists
  }
  next();
};

// Data sanitization middleware
const sanitizeInput = (req, res, next) => {
  // Sanitize user input to prevent XSS
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key]
          .replace(/[<>]/g, '') // Remove potential HTML tags
          .trim();
      }
    });
  }
  next();
};

// Logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });
  next();
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      message: 'Validation Error',
      errors: Object.values(err.errors).map(e => e.message)
    });
  }
  
  if (err.name === 'CastError') {
    return res.status(400).json({ 
      message: 'Invalid ID format' 
    });
  }
  
  if (err.code === 11000) {
    return res.status(400).json({ 
      message: 'Duplicate field value' 
    });
  }
  
  res.status(500).json({ 
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { error: err.message })
  });
};

module.exports = {
  authLimiter,
  apiLimiter,
  voteLimiter,
  gdprCompliance,
  cookieConsent,
  validateRegistration,
  validateLogin,
  csrfProtection,
  sanitizeInput,
  requestLogger,
  errorHandler
}; 