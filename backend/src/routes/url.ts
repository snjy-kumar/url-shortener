import { Router } from 'express';
import { UrlController } from '../controllers/urlController';
import { validateCreateUrl } from '../middleware/validation';
import { optionalAuthentication, authenticateToken } from '../middleware/auth';
import { body, validationResult } from 'express-validator';

const router = Router();

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

// Bulk operations validation
const validateBulkCreate = [
  body('urls')
    .isArray({ min: 1, max: 100 })
    .withMessage('URLs must be an array with 1-100 items'),
  body('urls.*.originalUrl')
    .notEmpty()
    .withMessage('Original URL is required for each item'),
];

const validateBulkDelete = [
  body('shortCodes')
    .isArray({ min: 1, max: 100 })
    .withMessage('Short codes must be an array with 1-100 items'),
];

const validateBulkUpdate = [
  body('updates')
    .isArray({ min: 1, max: 100 })
    .withMessage('Updates must be an array with 1-100 items'),
  body('updates.*.shortCode')
    .notEmpty()
    .withMessage('Short code is required for each update'),
];

// Apply optional authentication to most routes
router.use(optionalAuthentication);

// Bulk operations routes (require authentication)
router.post(
  '/bulk',
  authenticateToken,
  validateBulkCreate,
  validateRequest,
  UrlController.bulkCreateUrls
);
router.delete(
  '/bulk',
  authenticateToken,
  validateBulkDelete,
  validateRequest,
  UrlController.bulkDeleteUrls
);
router.put(
  '/bulk',
  authenticateToken,
  validateBulkUpdate,
  validateRequest,
  UrlController.bulkUpdateUrls
);

// Password utility routes (require authentication)
router.post(
  '/check-password-strength',
  authenticateToken,
  UrlController.checkPasswordStrength
);
router.post(
  '/generate-password',
  authenticateToken,
  UrlController.generateSecurePassword
);

// Create a short URL
router.post('/shorten', validateCreateUrl, UrlController.createShortUrl);

// List URLs with pagination
router.get('/', UrlController.listUrls);

// Get analytics for a URL
router.get('/:shortCode/analytics', UrlController.getUrlAnalytics);

// Verify password for password-protected URL
router.post('/:shortCode/verify-password', UrlController.verifyPassword);

// Update URL password
router.put(
  '/:shortCode/password',
  authenticateToken,
  UrlController.updateUrlPassword
);

// Get URL details by short code
router.get('/:shortCode', UrlController.getUrlDetails);

// Update URL by short code
router.put('/:shortCode', UrlController.updateUrl);

// Delete URL by short code
router.delete('/:shortCode', UrlController.deleteUrl);

export default router;
