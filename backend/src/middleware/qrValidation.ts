import { Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';

export const validateQRCodeGeneration = [
  param('shortCode')
    .notEmpty()
    .withMessage('Short code is required')
    .isAlphanumeric()
    .withMessage('Short code must contain only letters and numbers')
    .isLength({ min: 6, max: 10 })
    .withMessage('Short code must be between 6 and 10 characters'),

  body('size')
    .optional()
    .isInt({ min: 64, max: 2048 })
    .withMessage('Size must be between 64 and 2048 pixels'),

  body('color')
    .optional()
    .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .withMessage('Color must be a valid hex color code'),

  body('backgroundColor')
    .optional()
    .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .withMessage('Background color must be a valid hex color code'),

  body('format')
    .optional()
    .isIn(['PNG', 'SVG'])
    .withMessage('Format must be either PNG or SVG'),

  body('logoUrl')
    .optional()
    .isURL()
    .withMessage('Logo URL must be a valid URL'),

  body('logoSize')
    .optional()
    .isInt({ min: 16, max: 256 })
    .withMessage('Logo size must be between 16 and 256 pixels'),

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
