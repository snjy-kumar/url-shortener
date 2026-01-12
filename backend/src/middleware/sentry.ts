import { Request, Response, NextFunction } from 'express';
import { Sentry, sentryService } from '../services/sentryService.js';

/**
 * Sentry request handler middleware
 * Must be the first middleware to capture all requests
 */
export const sentryRequestHandler = () => {
  if (!sentryService.isInitialized()) {
    return (req: Request, res: Response, next: NextFunction) => next();
  }
  
  return Sentry.Handlers.requestHandler({
    user: ['id', 'email', 'username'],
    ip: true,
    request: ['method', 'url', 'headers', 'data'],
    transaction: 'methodPath', // Group transactions by method + path
  });
};

/**
 * Sentry tracing handler for performance monitoring
 * Should be after request handler
 */
export const sentryTracingHandler = () => {
  if (!sentryService.isInitialized()) {
    return (req: Request, res: Response, next: NextFunction) => next();
  }
  
  return Sentry.Handlers.tracingHandler();
};

/**
 * Sentry error handler middleware
 * Must be after all controllers and before other error handlers
 */
export const sentryErrorHandler = () => {
  if (!sentryService.isInitialized()) {
    return (err: Error, req: Request, res: Response, next: NextFunction) => next(err);
  }
  
  return Sentry.Handlers.errorHandler({
    shouldHandleError(_error) {
      // Only capture 5xx errors and specific exceptions
      return true; // Capture all errors, filter in Sentry config
    },
  });
};

/**
 * Add user context to Sentry from authenticated requests
 */
export const sentryUserContext = (req: Request, res: Response, next: NextFunction): void => {
  const user = (req as any).user;
  
  if (user && sentryService.isInitialized()) {
    sentryService.setUser({
      id: user.id,
      email: user.email,
      username: user.username || user.name,
    });
  }
  
  next();
};

/**
 * Add custom context to Sentry
 */
export const addSentryContext = (name: string, context: Record<string, any>): void => {
  sentryService.setContext(name, context);
};

/**
 * Add breadcrumb for tracking user actions
 */
export const addSentryBreadcrumb = (message: string, category: string, data?: Record<string, any>): void => {
  sentryService.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
    timestamp: Date.now() / 1000,
  });
};
