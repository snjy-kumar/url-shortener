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

const expiryFieldValidators = [
  body('expiresAt')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === '') {
        return true;
      }
      if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
        throw new Error('expiresAt must be an ISO datetime or null');
      }
      return true;
    }),

  body('expiresIn')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === '') {
        return true;
      }
      if (typeof value === 'number') {
        if (!Number.isFinite(value) || value <= 0) {
          throw new Error('expiresIn must be a positive number of seconds');
        }
        return true;
      }
      if (typeof value === 'string') {
        const raw = value.trim().toLowerCase();
        if (/^\d+$/.test(raw) || /^\d+(?:\.\d+)?(s|m|h|d|w)$/.test(raw)) {
          return true;
        }
      }
      throw new Error('expiresIn must look like 30m, 12h, 7d, 1w, or seconds');
    }),

  body('maxClicks')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null) {
        return true;
      }
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
        throw new Error('maxClicks must be a positive integer or null');
      }
      return true;
    }),

  body().custom((_, { req }) => {
    const { expiresAt, expiresIn } = req.body as {
      expiresAt?: unknown;
      expiresIn?: unknown;
    };
    const atSet = expiresAt !== undefined && expiresAt !== null && expiresAt !== '';
    const inSet = expiresIn !== undefined && expiresIn !== null && expiresIn !== '';
    if (atSet && inSet) {
      throw new Error('Provide expiresAt or expiresIn, not both');
    }
    return true;
  }),
];

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
    )
    .customSanitizer((value: string) => value.toLowerCase()),

  ...expiryFieldValidators,
  handleValidationErrors,
];

export const validateUpdateUrl = [
  body('originalUrl')
    .optional()
    .isLength({ min: 1, max: 2048 })
    .withMessage('URL must be between 1 and 2048 characters')
    .custom((value: string) => {
      if (!isValidUrl(normalizeUrl(value))) {
        throw new Error('Please provide a valid http(s) URL');
      }
      return true;
    }),

  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),

  body('customAlias')
    .optional()
    .isLength({ min: 3, max: 50 })
    .withMessage('Custom alias must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage(
      'Custom alias can only contain letters, numbers, hyphens, and underscores'
    )
    .customSanitizer((value: string) => value.toLowerCase()),

  ...expiryFieldValidators,

  body().custom((_, { req }) => {
    const bodyData = req.body as Record<string, unknown>;
    const keys = [
      'originalUrl',
      'customAlias',
      'isActive',
      'expiresAt',
      'expiresIn',
      'maxClicks',
    ];
    if (!keys.some((key) => bodyData[key] !== undefined)) {
      throw new Error(
        'Provide originalUrl, customAlias, isActive, expiresAt, expiresIn, and/or maxClicks'
      );
    }
    return true;
  }),

  handleValidationErrors,
];
