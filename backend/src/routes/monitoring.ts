import { Router } from 'express';
import { MonitoringController } from '../controllers/monitoringController';
import { authenticateToken } from '../middleware/auth';
import { adminSecurityStack } from '../middleware/advancedSecurity';
import { query, param, validationResult } from 'express-validator';

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

// Query parameter validation
const validateLimit = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 500 })
    .withMessage('Limit must be between 1 and 500'),
];

const validateUserId = [
  query('userId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer'),
];

const validateExportParams = [
  query('format')
    .optional()
    .isIn(['json', 'csv'])
    .withMessage('Format must be json or csv'),
  query('days')
    .optional()
    .isInt({ min: 1, max: 30 })
    .withMessage('Days must be between 1 and 30'),
];

const validateErrorId = [
  param('errorId')
    .notEmpty()
    .withMessage('Error ID is required')
    .matches(/^err_\d+_[a-z0-9]+$/)
    .withMessage('Invalid error ID format'),
];

// Apply authentication and admin security to all routes
router.use(authenticateToken);
router.use(adminSecurityStack);

// System health (lighter security for monitoring)
router.get('/health', MonitoringController.getSystemHealth);

// Dashboard
router.get('/dashboard', MonitoringController.getDashboard);

// Error monitoring
router.get(
  '/errors',
  validateLimit,
  validateRequest,
  MonitoringController.getErrorMetrics
);
router.get(
  '/errors/recent',
  validateLimit,
  validateRequest,
  MonitoringController.getRecentErrors
);
router.get(
  '/errors/:errorId',
  validateErrorId,
  validateRequest,
  MonitoringController.getErrorById
);

// Audit monitoring
router.get(
  '/audit',
  [
    ...validateLimit,
    ...validateUserId,
    query('action')
      .optional()
      .isString()
      .withMessage('Action must be a string'),
    query('resource')
      .optional()
      .isString()
      .withMessage('Resource must be a string'),
  ],
  validateRequest,
  MonitoringController.getAuditTrail
);

// Data export
router.get(
  '/export/errors',
  validateExportParams,
  validateRequest,
  MonitoringController.exportErrors
);

// System management
router.post('/cleanup', MonitoringController.cleanup);

export default router;
