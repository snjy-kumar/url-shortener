import express from 'express';
import { EnhancedAnalyticsController } from '../controllers/enhancedAnalyticsController';
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
const validateCompareAnalytics = [
  body('shortCodes')
    .isArray({ min: 1, max: 10 })
    .withMessage('Short codes must be an array with 1-10 items'),
  body('shortCodes.*')
    .isString()
    .withMessage('Each short code must be a string'),
];

// Apply authentication to all analytics routes
router.use(authenticateToken);

/**
 * @route   GET /api/v1/analytics/dashboard
 * @desc    Get user analytics dashboard
 * @access  Private
 */
router.get('/dashboard', EnhancedAnalyticsController.getUserDashboard);

/**
 * @route   GET /api/v1/analytics/:shortCode/detailed
 * @desc    Get detailed analytics for a URL
 * @access  Private
 * @query   startDate, endDate, country, referer, device, browser
 */
router.get(
  '/:shortCode/detailed',
  EnhancedAnalyticsController.getDetailedAnalytics
);

/**
 * @route   GET /api/v1/analytics/:shortCode/export
 * @desc    Export analytics data
 * @access  Private
 * @query   format (json|csv), startDate, endDate, country, referer, device, browser
 */
router.get('/:shortCode/export', EnhancedAnalyticsController.exportAnalytics);

/**
 * @route   GET /api/v1/analytics/:shortCode/realtime
 * @desc    Get real-time analytics for a URL
 * @access  Private
 */
router.get(
  '/:shortCode/realtime',
  EnhancedAnalyticsController.getRealtimeAnalytics
);

/**
 * @route   POST /api/v1/analytics/compare
 * @desc    Compare analytics between multiple URLs
 * @access  Private
 */
router.post(
  '/compare',
  validateCompareAnalytics,
  validateRequest,
  EnhancedAnalyticsController.compareAnalytics
);

export default router;
