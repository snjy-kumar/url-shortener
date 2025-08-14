import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { config } from '../config/env';

interface CustomError extends Error {
  statusCode?: number;
  code?: string;
}

export const errorHandler = (
  error: CustomError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal Server Error';

  // Log the error
  logger.error('Error occurred:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Prisma error handling
  if (error.code === 'P2002') {
    statusCode = 409;
    message = 'Resource already exists';
  } else if (error.code === 'P2025') {
    statusCode = 404;
    message = 'Resource not found';
  }

  // Validation error handling
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation error';
  }

  // JWT error handling
  if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    message,
    ...(config.NODE_ENV === 'development' && {
      error: error.message,
      stack: error.stack,
    }),
  });
};
