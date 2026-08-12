import { NextFunction, Request, Response } from 'express';
import { getAuth } from '@clerk/express';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

export const isAdminUserId = (userId: string): boolean =>
  config.ADMIN_CLERK_USER_IDS.includes(userId);

/**
 * Requires Clerk auth + membership in ADMIN_CLERK_USER_IDS.
 * Mount after clerkMiddleware + requireClerkAuth (or call alone after clerk).
 */
export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const auth = getAuth(req);

  if (!auth.isAuthenticated) {
    logger.warn('Unauthorized admin request', {
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

  if (!isAdminUserId(auth.userId)) {
    logger.warn('Forbidden admin request', {
      path: req.path,
      method: req.method,
      requestId: req.id,
      userId: auth.userId,
    });
    res.status(403).json({
      success: false,
      message: 'Forbidden',
    });
    return;
  }

  next();
};
