import { NextFunction, Request, Response } from 'express';
import { getAuth } from '@clerk/express';
import { logger } from '../utils/logger.js';

/**
 * Requires a signed-in Clerk user. Responds 401 JSON (API-friendly).
 * Must run after clerkMiddleware().
 */
export const requireClerkAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const auth = getAuth(req);

  if (!auth.isAuthenticated) {
    logger.warn('Unauthorized API request', {
      path: req.path,
      method: req.method,
      requestId: req.id,
      ip: req.ip,
    });
    res.status(401).json({
      success: false,
      message: 'Unauthorized',
    });
    return;
  }

  next();
};
