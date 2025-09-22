import { Request, Response, NextFunction } from 'express';
import { SecurityService, RateLimitInfo } from '../services/securityService';
import { logger } from '../utils/logger';

export interface SecurityRequest extends Request {
  rateLimitInfo?: RateLimitInfo;
  isSuspicious?: boolean;
  securityHeaders?: Record<string, string>;
}

/**
 * Advanced rate limiting middleware
 */
export const advancedRateLimit = async (
  req: SecurityRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ip = req.ip || '127.0.0.1'; // Fallback to localhost
    const endpoint = req.route?.path || req.path;

    // Check if IP is blacklisted
    if (SecurityService.isBlacklisted(ip)) {
      logger.warn('Blocked request from blacklisted IP', { ip, endpoint });
      res.status(403).json({
        success: false,
        message: 'Access denied',
        code: 'IP_BLACKLISTED',
      });
      return;
    }

    // Check rate limits
    const rateLimitInfo = await SecurityService.checkRateLimit(ip, endpoint);
    req.rateLimitInfo = rateLimitInfo;

    // Set rate limit headers
    res.set({
      'X-RateLimit-Remaining': rateLimitInfo.remainingRequests.toString(),
      'X-RateLimit-Reset': rateLimitInfo.resetTime.toString(),
      'X-RateLimit-Limit':
        SecurityService.getConfig().maxRequestsPerMinute.toString(),
    });

    if (rateLimitInfo.isBlocked) {
      const retryAfter = rateLimitInfo.blockExpiresAt
        ? Math.ceil((rateLimitInfo.blockExpiresAt - Date.now()) / 1000)
        : 3600; // Default 1 hour

      res.set('Retry-After', retryAfter.toString());

      logger.warn('Rate limit exceeded', {
        ip,
        endpoint,
        remainingRequests: rateLimitInfo.remainingRequests,
        blockExpiresAt: rateLimitInfo.blockExpiresAt,
      });

      res.status(429).json({
        success: false,
        message: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter,
        remainingRequests: rateLimitInfo.remainingRequests,
      });
      return;
    }

    // Record the request
    await SecurityService.recordRequest(ip, endpoint);

    next();
  } catch (error) {
    logger.error('Rate limit middleware error:', error);
    next(); // Continue on error to avoid blocking legitimate requests
  }
};

/**
 * Suspicious activity detection middleware
 */
export const suspiciousActivityDetection = async (
  req: SecurityRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const isSuspicious = await SecurityService.detectSuspiciousActivity(req);
    req.isSuspicious = isSuspicious;

    if (isSuspicious) {
      // Add additional security headers for suspicious requests
      req.securityHeaders = {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      };

      // Set security headers
      res.set(req.securityHeaders);
    }

    next();
  } catch (error) {
    logger.error('Suspicious activity detection error:', error);
    next();
  }
};

/**
 * IP whitelist middleware for administrative endpoints
 */
export const ipWhitelistOnly = (
  req: SecurityRequest,
  res: Response,
  next: NextFunction
): void => {
  const ip = req.ip || '127.0.0.1'; // Fallback to localhost

  if (!SecurityService.isWhitelisted(ip)) {
    logger.warn('Unauthorized access attempt to admin endpoint', {
      ip,
      endpoint: req.path,
      userAgent: req.get('User-Agent'),
    });

    res.status(403).json({
      success: false,
      message: 'Access denied - IP not whitelisted',
      code: 'IP_NOT_WHITELISTED',
    });
    return;
  }

  next();
};

/**
 * Security headers middleware
 */
export const securityHeaders = (
  req: SecurityRequest,
  res: Response,
  next: NextFunction
): void => {
  // Basic security headers
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Permitted-Cross-Domain-Policies': 'none',
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
  });

  // Additional headers for suspicious requests
  if (req.securityHeaders) {
    res.set(req.securityHeaders);
  }

  next();
};

/**
 * DDoS protection middleware - more aggressive rate limiting for potential attacks
 */
export const ddosProtection = async (
  req: SecurityRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ip = req.ip || '127.0.0.1'; // Fallback to localhost
    const userAgent = req.get('User-Agent') || '';

    // Skip for whitelisted IPs
    if (SecurityService.isWhitelisted(ip)) {
      next();
      return;
    }

    // Check for common DDoS patterns
    const isDDoSPattern =
      !userAgent ||
      userAgent.length < 10 ||
      /curl|wget|python|ruby|perl|php/i.test(userAgent) ||
      req.get('Connection') === 'close';

    if (isDDoSPattern) {
      const ddosKey = `ddos:${ip}`;
      const config = SecurityService.getConfig();

      // More aggressive rate limiting for potential DDoS
      const rateLimitInfo = await SecurityService.checkRateLimit(ip);

      if (rateLimitInfo.remainingRequests < config.maxRequestsPerMinute / 2) {
        await SecurityService.blockIPTemporarily(
          ip,
          'Potential DDoS attack detected'
        );

        logger.warn('Potential DDoS attack blocked', {
          ip,
          userAgent,
          endpoint: req.path,
          remainingRequests: rateLimitInfo.remainingRequests,
        });

        res.status(429).json({
          success: false,
          message: 'Service temporarily unavailable',
          code: 'DDOS_PROTECTION_TRIGGERED',
        });
        return;
      }
    }

    next();
  } catch (error) {
    logger.error('DDoS protection middleware error:', error);
    next();
  }
};

/**
 * Request size limiter middleware
 */
export const requestSizeLimiter = (maxSizeKB: number = 1024) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.get('Content-Length') || '0');
    const maxSizeBytes = maxSizeKB * 1024;

    if (contentLength > maxSizeBytes) {
      logger.warn('Request size limit exceeded', {
        ip: req.ip,
        contentLength,
        maxSize: maxSizeBytes,
        endpoint: req.path,
      });

      res.status(413).json({
        success: false,
        message: 'Request entity too large',
        code: 'REQUEST_TOO_LARGE',
        maxSizeKB,
      });
      return;
    }

    next();
  };
};

/**
 * API key rate limiting (separate from IP-based limiting)
 */
export const apiKeyRateLimit = async (
  req: SecurityRequest & { apiKeyId?: string },
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.apiKeyId) {
      next();
      return;
    }

    const apiKeyId = req.apiKeyId;
    const rateLimitInfo = await SecurityService.checkRateLimit(
      `api:${apiKeyId}`
    );

    if (rateLimitInfo.isBlocked) {
      res.status(429).json({
        success: false,
        message: 'API key rate limit exceeded',
        code: 'API_KEY_RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((rateLimitInfo.resetTime - Date.now()) / 1000),
      });
      return;
    }

    await SecurityService.recordRequest(`api:${apiKeyId}`);
    next();
  } catch (error) {
    logger.error('API key rate limit middleware error:', error);
    next();
  }
};

/**
 * Geo-blocking middleware (placeholder for future implementation)
 */
export const geoBlocking = (blockedCountries: string[] = []) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // TODO: Implement geo-blocking using IP geolocation
    // This would require a geolocation service like MaxMind GeoIP2
    next();
  };
};

/**
 * Combined security middleware stack
 */
export const securityStack = [
  securityHeaders,
  suspiciousActivityDetection,
  ddosProtection,
  advancedRateLimit,
];

/**
 * Admin-only security middleware stack
 */
export const adminSecurityStack = [
  securityHeaders,
  ipWhitelistOnly,
  suspiciousActivityDetection,
  advancedRateLimit,
];
