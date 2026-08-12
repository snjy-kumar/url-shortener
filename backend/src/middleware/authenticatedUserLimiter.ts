import { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { getAuth } from '@clerk/express';
import { config } from '../config/env.js';

/**
 * Stricter limiter for authenticated URL API routes.
 * Keyed by Clerk userId (falls back to IP only if somehow unauthenticated).
 * Mount after requireClerkAuth.
 */
export const authenticatedUserLimiter: RequestHandler = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.AUTH_RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const auth = getAuth(req);
    if (auth.isAuthenticated) {
      return auth.userId;
    }
    return req.ip || 'anonymous';
  },
  validate: {
    // Custom key prefers userId; IP fallback is intentional for edge cases.
    keyGeneratorIpFallback: false,
  },
  message: {
    success: false,
    message: 'Too many requests',
  },
});

/**
 * Anonymous POST /shorten only — skipped when Clerk session present.
 * Abuse surface for open create; keep lower than auth limits.
 */
export const guestCreateLimiter: RequestHandler = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.GUEST_CREATE_RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => getAuth(req).isAuthenticated,
  message: {
    success: false,
    message: 'Too many requests',
  },
});

/** Signed-in create on POST /shorten — skipped for guests. */
export const authenticatedCreateLimiter: RequestHandler = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.AUTH_RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => !getAuth(req).isAuthenticated,
  keyGenerator: (req) => {
    const auth = getAuth(req);
    if (auth.isAuthenticated) {
      return auth.userId;
    }
    return req.ip || 'anonymous';
  },
  validate: {
    keyGeneratorIpFallback: false,
  },
  message: {
    success: false,
    message: 'Too many requests',
  },
});
