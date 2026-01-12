import { Request, Response, NextFunction } from 'express';
import { logger } from './logger.js';

/**
 * Async handler wrapper to catch promise rejections
 * Prevents unhandled promise rejections from crashing the server
 * 
 * Usage:
 * router.get('/path', asyncHandler(async (req, res) => {
 *   const data = await someAsyncOperation();
 *   res.json(data);
 * }));
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      logger.error('Async handler caught error:', {
        error: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userId: (req as any).user?.id,
      });
      next(error);
    });
  };
};

/**
 * Typed async handler for authenticated requests
 */
export const authenticatedAsyncHandler = <T extends Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: T, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      logger.error('Authenticated async handler caught error:', {
        error: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userId: (req as any).user?.id,
      });
      next(error);
    });
  };
};
