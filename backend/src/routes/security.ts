import { Router } from 'express';
import { SecurityController } from '../controllers/securityController';
import { authenticateToken } from '../middleware/auth';
import { adminSecurityStack } from '../middleware/advancedSecurity';
import { body, param, validationResult } from 'express-validator';

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

// IP validation
const validateIP = [
  body('ip').isIP().withMessage('Must be a valid IP address'),
];

const validateIPParam = [
  param('ip').isIP().withMessage('Must be a valid IP address'),
];

// Configuration validation
const validateConfig = [
  body('maxRequestsPerMinute')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Must be between 1 and 1000'),
  body('maxRequestsPerHour')
    .optional()
    .isInt({ min: 10, max: 100000 })
    .withMessage('Must be between 10 and 100000'),
  body('maxRequestsPerDay')
    .optional()
    .isInt({ min: 100, max: 1000000 })
    .withMessage('Must be between 100 and 1000000'),
  body('blockDurationMinutes')
    .optional()
    .isInt({ min: 1, max: 1440 })
    .withMessage('Must be between 1 and 1440 minutes'),
  body('suspiciousActivityThreshold')
    .optional()
    .isInt({ min: 10, max: 1000 })
    .withMessage('Must be between 10 and 1000'),
  body('maxFailedAttemptsBeforeBlock')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Must be between 1 and 100'),
];

// Test validation
const validateTest = [
  body('testType')
    .isIn(['rate-limit', 'suspicious-activity', 'whitelist', 'blacklist'])
    .withMessage('Invalid test type'),
  body('ip').optional().isIP().withMessage('Must be a valid IP address'),
];

// Apply authentication and admin security to all routes
router.use(authenticateToken);
router.use(adminSecurityStack);

// Security dashboard
router.get('/dashboard', SecurityController.getDashboard);

// Configuration management
router.get('/config', SecurityController.getConfig);
router.put(
  '/config',
  validateConfig,
  validateRequest,
  SecurityController.updateConfig
);

// Analytics and monitoring
router.get('/analytics', SecurityController.getAnalytics);
router.get('/blocked-ips', SecurityController.getBlockedIPs);

// IP management
router.post(
  '/whitelist',
  validateIP,
  validateRequest,
  SecurityController.addToWhitelist
);
router.post(
  '/blacklist',
  [
    ...validateIP,
    body('reason').optional().isString().withMessage('Reason must be a string'),
  ],
  validateRequest,
  SecurityController.addToBlacklist
);
router.delete(
  '/blacklist/:ip',
  validateIPParam,
  validateRequest,
  SecurityController.removeFromBlacklist
);

// Rate limiting management
router.delete(
  '/rate-limit/:ip',
  validateIPParam,
  validateRequest,
  SecurityController.clearRateLimit
);

// Security testing
router.post(
  '/test',
  validateTest,
  validateRequest,
  SecurityController.testSecurity
);

export default router;
