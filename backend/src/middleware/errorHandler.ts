import { Request, Response, NextFunction } from 'express';
import { Prisma } from '../generated/prisma/client.js';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { isAppError } from '../utils/errors.js';

export const errorHandler = (
  err: Error & { status?: number; statusCode?: number },
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal server error';

  if (isAppError(err)) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      statusCode = 409;
      message = 'Resource already exists';
    } else if (err.code === 'P2025') {
      statusCode = 404;
      message = 'Resource not found';
    } else {
      message = 'Database error';
    }
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    message = 'Invalid data provided';
  } else if (err.status || err.statusCode) {
    statusCode = err.status || err.statusCode || 500;
    message = err.message || message;
  }

  if (statusCode >= 500) {
    logger.error('Server error', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      requestId: req.id,
    });
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(config.NODE_ENV === 'development' && statusCode >= 500
      ? { error: err.message }
      : {}),
  });
};

export const notFoundHandler = (_req: Request, res: Response): void => {
  res.status(404).json({ success: false, message: 'Route not found' });
};

export const setupGlobalErrorHandlers = (): void => {
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason });
  });
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  });
};
