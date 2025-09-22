import express from 'express';
import { ApiKeyController } from '../controllers/apiKeyController';
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

// API Key validation rules
const createApiKeyValidation = [
  body('name')
    .notEmpty()
    .withMessage('API key name is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),

  body('expiresAt')
    .optional()
    .isISO8601()
    .withMessage('Expiration date must be a valid ISO 8601 date')
    .custom((value) => {
      if (new Date(value) <= new Date()) {
        throw new Error('Expiration date must be in the future');
      }
      return true;
    }),
];

const updateApiKeyValidation = [
  body('name')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),

  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean value'),
];

// Apply authentication to all API key routes
router.use(authenticateToken);

/**
 * @route   POST /api/v1/api-keys
 * @desc    Create a new API key
 * @access  Private
 */
router.post(
  '/',
  createApiKeyValidation,
  validateRequest,
  ApiKeyController.createApiKey
);

/**
 * @route   GET /api/v1/api-keys
 * @desc    List user's API keys
 * @access  Private
 */
router.get('/', ApiKeyController.listApiKeys);

/**
 * @route   GET /api/v1/api-keys/:keyId
 * @desc    Get a specific API key
 * @access  Private
 */
router.get('/:keyId', ApiKeyController.getApiKey);

/**
 * @route   PUT /api/v1/api-keys/:keyId
 * @desc    Update an API key
 * @access  Private
 */
router.put(
  '/:keyId',
  updateApiKeyValidation,
  validateRequest,
  ApiKeyController.updateApiKey
);

/**
 * @route   DELETE /api/v1/api-keys/:keyId
 * @desc    Delete an API key
 * @access  Private
 */
router.delete('/:keyId', ApiKeyController.deleteApiKey);

/**
 * @route   POST /api/v1/api-keys/:keyId/regenerate
 * @desc    Regenerate an API key
 * @access  Private
 */
router.post('/:keyId/regenerate', ApiKeyController.regenerateApiKey);

/**
 * @route   GET /api/v1/api-keys/:keyId/stats
 * @desc    Get API key usage statistics
 * @access  Private
 */
router.get('/:keyId/stats', ApiKeyController.getApiKeyStats);

export default router;
