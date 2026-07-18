import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { isValidUrl, normalizeUrl } from '../utils/url.js';

const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
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

export const validateCreateUrl = [
  body('originalUrl')
    .notEmpty()
    .withMessage('Original URL is required')
    .isLength({ min: 1, max: 2048 })
    .withMessage('URL must be between 1 and 2048 characters')
    .custom((value: string) => {
      if (!isValidUrl(normalizeUrl(value))) {
        throw new Error('Please provide a valid http(s) URL');
      }
      return true;
    }),

  body('customAlias')
    .optional({ values: 'falsy' })
    .isLength({ min: 3, max: 50 })
    .withMessage('Custom alias must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage(
      'Custom alias can only contain letters, numbers, hyphens, and underscores'
    ),

  handleValidationErrors,
];
