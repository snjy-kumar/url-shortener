import express from 'express';
import { ExpirationController } from '../controllers/expirationController';
import { authenticateToken } from '../middleware/auth';
import { body, validationResult } from 'express-validator';

const router = express.Router();

// Validation middleware
const validateRequest = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((error) => ({
        field: error.type === 'field' ? error.path : 'unknown',
        message: error.msg,
      })),
    });
    return;
  }
  next();
};

// Validation rules
const validateExtendExpiration = [
  body('urlIds')
    .isArray({ min: 1 })
    .withMessage('URL IDs must be an array with at least one item'),
  body('urlIds.*')
    .isInt({ min: 1 })
    .withMessage('Each URL ID must be a positive integer'),
  body('newExpirationDate')
    .isISO8601()
    .withMessage('New expiration date must be a valid ISO 8601 date'),
];

const validateCleanupSpecific = [
  body('urlIds')
    .isArray({ min: 1 })
    .withMessage('URL IDs must be an array with at least one item'),
  body('urlIds.*')
    .isInt({ min: 1 })
    .withMessage('Each URL ID must be a positive integer'),
];

// Apply authentication to all expiration routes
router.use(authenticateToken);

/**
 * @route   GET /api/v1/expiration/stats
 * @desc    Get expiration statistics
 * @access  Private
 */
router.get('/stats', ExpirationController.getStats);

/**
 * @route   GET /api/v1/expiration/status
 * @desc    Get expiration service status
 * @access  Private
 */
router.get('/status', ExpirationController.getStatus);

/**
 * @route   POST /api/v1/expiration/cleanup
 * @desc    Manually trigger cleanup of expired URLs
 * @access  Private
 */
router.post('/cleanup', ExpirationController.triggerCleanup);

/**
 * @route   POST /api/v1/expiration/extend
 * @desc    Extend expiration date for specific URLs
 * @access  Private
 */
router.post(
  '/extend',
  validateExtendExpiration,
  validateRequest,
  ExpirationController.extendExpiration
);

/**
 * @route   POST /api/v1/expiration/cleanup-specific
 * @desc    Clean up specific URLs by ID
 * @access  Private
 */
router.post(
  '/cleanup-specific',
  validateCleanupSpecific,
  validateRequest,
  ExpirationController.cleanupSpecific
);

export default router;
