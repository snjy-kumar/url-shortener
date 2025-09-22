import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger';
import {
  ErrorHandlingService,
  ErrorCategory,
} from '../services/errorHandlingService';

interface ErrorResponse {
  success: false;
  message: string;
  error?: string;
  details?: any;
  code?: string;
  errorId?: string;
}

/**
 * Enhanced error handler middleware with comprehensive logging and tracking
 */
export const errorHandler = async (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  let statusCode = 500;
  let message = 'Internal server error';
  let code = 'INTERNAL_ERROR';
  let details: any = null;

  // Handle known error types
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Database constraint errors
    switch (err.code) {
      case 'P2002':
        statusCode = 409;
        message = 'Resource already exists';
        code = 'DUPLICATE_RESOURCE';
        details = { constraint: err.meta?.['target'] };
        break;
      case 'P2025':
        statusCode = 404;
        message = 'Resource not found';
        code = 'RESOURCE_NOT_FOUND';
        break;
      case 'P2003':
        statusCode = 400;
        message = 'Foreign key constraint failed';
        code = 'FOREIGN_KEY_CONSTRAINT';
        break;
      default:
        statusCode = 500;
        message = 'Database error occurred';
        code = 'DATABASE_ERROR';
        details = { prismaCode: err.code };
    }
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    message = 'Invalid data provided';
    code = 'VALIDATION_ERROR';
  } else if (err instanceof Prisma.PrismaClientInitializationError) {
    statusCode = 503;
    message = 'Database connection failed';
    code = 'DATABASE_CONNECTION_ERROR';
  } else if (err.name === 'ValidationError') {
    // Express-validator or custom validation errors
    statusCode = 400;
    message = 'Validation failed';
    code = 'VALIDATION_ERROR';
    details = err.details || err.errors;
  } else if (err.name === 'UnauthorizedError' || err.status === 401) {
    statusCode = 401;
    message = 'Authentication required';
    code = 'AUTHENTICATION_REQUIRED';
  } else if (err.name === 'ForbiddenError' || err.status === 403) {
    statusCode = 403;
    message = 'Access denied';
    code = 'ACCESS_DENIED';
  } else if (err.name === 'NotFoundError' || err.status === 404) {
    statusCode = 404;
    message = 'Resource not found';
    code = 'RESOURCE_NOT_FOUND';
  } else if (err.name === 'RateLimitError' || err.status === 429) {
    statusCode = 429;
    message = 'Too many requests';
    code = 'RATE_LIMIT_EXCEEDED';
    details = { retryAfter: err.retryAfter };
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    code = 'INVALID_TOKEN';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    code = 'TOKEN_EXPIRED';
  } else if (err.status || err.statusCode) {
    // HTTP errors with explicit status codes
    statusCode = err.status || err.statusCode;
    message = err.message || message;
    code = err.code || code;
  } else if (err.message) {
    // Generic errors with messages
    message = err.message;
  }

  // Log the error using the enhanced error handling service
  const errorDetails = await ErrorHandlingService.logError(
    err,
    req,
    statusCode,
    {
      originalUrl: req.originalUrl,
      query: req.query,
      body: req.method !== 'GET' ? req.body : undefined,
      params: req.params,
      headers: {
        'user-agent': req.get('User-Agent'),
        referer: req.get('Referer'),
        origin: req.get('Origin'),
      },
    }
  );

  // Prepare response
  const errorResponse: ErrorResponse = {
    success: false,
    message,
    code,
    errorId: errorDetails.id,
  };

  // Add details for development environment
  if (process.env['NODE_ENV'] === 'development') {
    errorResponse.error = err.message;
    errorResponse.details = details || {
      stack: err.stack,
      name: err.name,
    };
  }

  // Log audit trail for certain error types
  if (statusCode === 401 || statusCode === 403 || statusCode === 429) {
    await ErrorHandlingService.logAudit(
      'error_occurred',
      'security',
      req,
      false,
      errorDetails.id,
      { statusCode, message, category: errorDetails.category },
      message
    );
  }

  // Set appropriate headers based on error type
  if (statusCode === 429) {
    res.set('Retry-After', '60'); // 1 minute default
  }

  if (statusCode >= 500) {
    res.set('X-Error-ID', errorDetails.id);
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

/**
 * Async error wrapper to catch async function errors
 */
export const asyncErrorHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 handler for unmatched routes
 */
export const notFoundHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  (error as any).status = 404;
  (error as any).code = 'ROUTE_NOT_FOUND';

  // Log the 404 error
  await ErrorHandlingService.logError(error, req, 404, {
    attemptedRoute: req.originalUrl,
    method: req.method,
  });

  res.status(404).json({
    success: false,
    message: 'Route not found',
    code: 'ROUTE_NOT_FOUND',
    path: req.originalUrl,
    method: req.method,
  });
};

/**
 * Request timeout handler
 */
export const timeoutHandler = (timeoutMs: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const timeout = setTimeout(async () => {
      if (!res.headersSent) {
        const error = new Error('Request timeout');
        (error as any).status = 408;
        (error as any).code = 'REQUEST_TIMEOUT';

        await ErrorHandlingService.logError(error, req, 408, {
          timeoutMs,
          originalUrl: req.originalUrl,
        });

        res.status(408).json({
          success: false,
          message: 'Request timeout',
          code: 'REQUEST_TIMEOUT',
          timeout: timeoutMs,
        });
      }
    }, timeoutMs);

    res.on('finish', () => {
      clearTimeout(timeout);
    });

    next();
  };
};

/**
 * Global uncaught exception handler
 */
export const setupGlobalErrorHandlers = (): void => {
  process.on('uncaughtException', async (error: Error) => {
    logger.error('Uncaught Exception:', error);

    await ErrorHandlingService.logError(error, undefined, 500, {
      type: 'uncaughtException',
      critical: true,
    });

    // Graceful shutdown
    process.exit(1);
  });

  process.on(
    'unhandledRejection',
    async (reason: any, promise: Promise<any>) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);

      const error =
        reason instanceof Error ? reason : new Error(String(reason));
      await ErrorHandlingService.logError(error, undefined, 500, {
        type: 'unhandledRejection',
        critical: true,
      });

      // Graceful shutdown
      process.exit(1);
    }
  );

  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');

    await ErrorHandlingService.logAudit(
      'server_shutdown',
      'system',
      { ip: 'system' } as Request,
      true,
      undefined,
      { signal: 'SIGTERM' }
    );

    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully');

    await ErrorHandlingService.logAudit(
      'server_shutdown',
      'system',
      { ip: 'system' } as Request,
      true,
      undefined,
      { signal: 'SIGINT' }
    );

    process.exit(0);
  });
};
