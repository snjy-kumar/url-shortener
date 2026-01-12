import { Request } from 'express';

/**
 * Safely extract client IP address from request
 * Handles proxy headers correctly in production
 */
export const getClientIp = (req: Request): string => {
  // When behind a proxy (production)
  const forwardedFor = req.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can be a comma-separated list
    return forwardedFor.split(',')[0]?.trim() || '0.0.0.0';
  }

  // Direct connection or fallback
  return (
    req.ip ||
    req.socket.remoteAddress ||
    req.connection?.remoteAddress ||
    '0.0.0.0'
  );
};

/**
 * Get user agent from request
 */
export const getUserAgent = (req: Request): string => {
  return req.get('User-Agent') || 'unknown';
};

/**
 * Get referer from request
 */
export const getReferer = (req: Request): string | null => {
  return req.get('Referer') || req.get('Referrer') || null;
};

/**
 * Sanitize string to prevent XSS
 */
export const sanitizeString = (str: string): string => {
  return str
    .replace(/[<>"']/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();
};

/**
 * Validate and sanitize URL
 */
export const sanitizeUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Invalid protocol');
    }
    return parsed.toString();
  } catch (_error) {
    throw new Error('Invalid URL format');
  }
};

/**
 * Rate limit key generator
 */
export const generateRateLimitKey = (req: Request, identifier: string): string => {
  const ip = getClientIp(req);
  return `ratelimit:${identifier}:${ip}`;
};
