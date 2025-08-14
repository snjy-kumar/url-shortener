import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';

export const validateCreateUrl = [
  body('originalUrl')
    .notEmpty()
    .withMessage('Original URL is required')
    .isLength({ min: 1, max: 2048 })
    .withMessage('URL must be between 1 and 2048 characters')
    .custom((value) => {
      // Basic URL validation
      const urlPattern = /^(https?:\/\/)?([\w\-\.]+)\.([a-z]{2,})(\/.*)?$/i;
      const normalizedUrl = value.startsWith('http')
        ? value
        : `https://${value}`;

      try {
        new URL(normalizedUrl);
        return true;
      } catch {
        if (!urlPattern.test(value)) {
          throw new Error('Please provide a valid URL');
        }
        return true;
      }
    }),

  body('customAlias')
    .optional()
    .isLength({ min: 3, max: 50 })
    .withMessage('Custom alias must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage(
      'Custom alias can only contain letters, numbers, hyphens, and underscores'
    ),

  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),

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

  // Middleware to handle validation errors
  (req: Request, res: Response, next: NextFunction) => {
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
  },
];
