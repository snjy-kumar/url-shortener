import { Request } from 'express';
import { CacheService } from './cacheService';
import { logger } from '../utils/logger';

export interface SecurityConfig {
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  maxRequestsPerDay: number;
  blockDurationMinutes: number;
  whitelistedIPs: string[];
  blacklistedIPs: string[];
  suspiciousActivityThreshold: number;
  maxFailedAttemptsBeforeBlock: number;
}

export interface RateLimitInfo {
  remainingRequests: number;
  resetTime: number;
  isBlocked: boolean;
  blockExpiresAt?: number;
}

export interface SecurityAnalytics {
  totalRequests: number;
  blockedRequests: number;
  suspiciousActivities: number;
  topIPs: Array<{ ip: string; requests: number }>;
  geographicData: Array<{ country: string; requests: number }>;
}

export class SecurityService {
  private static defaultConfig: SecurityConfig = {
    maxRequestsPerMinute: 60,
    maxRequestsPerHour: 1000,
    maxRequestsPerDay: 10000,
    blockDurationMinutes: 60,
    whitelistedIPs: ['127.0.0.1', '::1'],
    blacklistedIPs: [],
    suspiciousActivityThreshold: 100,
    maxFailedAttemptsBeforeBlock: 5,
  };

  private static config: SecurityConfig = { ...this.defaultConfig };

  /**
   * Update security configuration
   */
  static updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Security configuration updated', { config: this.config });
  }

  /**
   * Get current security configuration
   */
  static getConfig(): SecurityConfig {
    return { ...this.config };
  }

  /**
   * Check if IP is whitelisted
   */
  static isWhitelisted(ip: string): boolean {
    return this.config.whitelistedIPs.includes(ip);
  }

  /**
   * Check if IP is blacklisted
   */
  static isBlacklisted(ip: string): boolean {
    return this.config.blacklistedIPs.includes(ip);
  }

  /**
   * Add IP to whitelist
   */
  static async addToWhitelist(ip: string): Promise<void> {
    if (!this.config.whitelistedIPs.includes(ip)) {
      this.config.whitelistedIPs.push(ip);
      await CacheService.set(`whitelist:${ip}`, 'true', { ttl: 86400 * 30 }); // 30 days
      logger.info('IP added to whitelist', { ip });
    }
  }

  /**
   * Add IP to blacklist
   */
  static async addToBlacklist(ip: string, reason?: string): Promise<void> {
    if (!this.config.blacklistedIPs.includes(ip)) {
      this.config.blacklistedIPs.push(ip);
      await CacheService.set(`blacklist:${ip}`, reason || 'Manual block', {
        ttl: 86400 * 7,
      }); // 7 days
      logger.warn('IP added to blacklist', { ip, reason });
    }
  }

  /**
   * Remove IP from blacklist
   */
  static async removeFromBlacklist(ip: string): Promise<void> {
    this.config.blacklistedIPs = this.config.blacklistedIPs.filter(
      (blockedIp) => blockedIp !== ip
    );
    await CacheService.delete(`blacklist:${ip}`);
    await CacheService.delete(`block:${ip}`);
    logger.info('IP removed from blacklist', { ip });
  }

  /**
   * Check rate limits for an IP
   */
  static async checkRateLimit(
    ip: string,
    endpoint?: string
  ): Promise<RateLimitInfo> {
    if (this.isWhitelisted(ip)) {
      return {
        remainingRequests: this.config.maxRequestsPerMinute,
        resetTime: Date.now() + 60000,
        isBlocked: false,
      };
    }

    if (this.isBlacklisted(ip)) {
      return {
        remainingRequests: 0,
        resetTime: Date.now() + this.config.blockDurationMinutes * 60000,
        isBlocked: true,
        blockExpiresAt: Date.now() + this.config.blockDurationMinutes * 60000,
      };
    }

    // Check if IP is temporarily blocked
    const blockKey = `block:${ip}`;
    const blockInfo = await CacheService.get<string>(blockKey);
    if (blockInfo) {
      const blockData = JSON.parse(blockInfo);
      return {
        remainingRequests: 0,
        resetTime: blockData.expiresAt,
        isBlocked: true,
        blockExpiresAt: blockData.expiresAt,
      };
    }

    // Check minute rate limit
    const minuteKey = `rate:${ip}:minute`;
    const minuteRequests = await CacheService.get<string>(minuteKey);
    const currentMinuteRequests = minuteRequests ? parseInt(minuteRequests) : 0;

    // Check hour rate limit
    const hourKey = `rate:${ip}:hour`;
    const hourRequests = await CacheService.get<string>(hourKey);
    const currentHourRequests = hourRequests ? parseInt(hourRequests) : 0;

    // Check day rate limit
    const dayKey = `rate:${ip}:day`;
    const dayRequests = await CacheService.get<string>(dayKey);
    const currentDayRequests = dayRequests ? parseInt(dayRequests) : 0;

    // Check if any limit is exceeded
    const isMinuteLimitExceeded =
      currentMinuteRequests >= this.config.maxRequestsPerMinute;
    const isHourLimitExceeded =
      currentHourRequests >= this.config.maxRequestsPerHour;
    const isDayLimitExceeded =
      currentDayRequests >= this.config.maxRequestsPerDay;

    if (isMinuteLimitExceeded || isHourLimitExceeded || isDayLimitExceeded) {
      // Block the IP temporarily
      await this.blockIPTemporarily(ip, 'Rate limit exceeded');

      return {
        remainingRequests: 0,
        resetTime: Date.now() + this.config.blockDurationMinutes * 60000,
        isBlocked: true,
        blockExpiresAt: Date.now() + this.config.blockDurationMinutes * 60000,
      };
    }

    // Calculate remaining requests (most restrictive limit)
    const remainingMinute =
      this.config.maxRequestsPerMinute - currentMinuteRequests;
    const remainingHour = this.config.maxRequestsPerHour - currentHourRequests;
    const remainingDay = this.config.maxRequestsPerDay - currentDayRequests;
    const remainingRequests = Math.min(
      remainingMinute,
      remainingHour,
      remainingDay
    );

    return {
      remainingRequests,
      resetTime: Date.now() + 60000, // Next minute
      isBlocked: false,
    };
  }

  /**
   * Record request for rate limiting
   */
  static async recordRequest(ip: string, endpoint?: string): Promise<void> {
    if (this.isWhitelisted(ip)) {
      return;
    }

    const now = Date.now();
    const minuteKey = `rate:${ip}:minute`;
    const hourKey = `rate:${ip}:hour`;
    const dayKey = `rate:${ip}:day`;

    // Increment counters
    await Promise.all([
      CacheService.increment(minuteKey, { increment: 1, ttl: 60 }), // 1 minute TTL
      CacheService.increment(hourKey, { increment: 1, ttl: 3600 }), // 1 hour TTL
      CacheService.increment(dayKey, { increment: 1, ttl: 86400 }), // 1 day TTL
    ]);

    // Record endpoint-specific metrics if provided
    if (endpoint) {
      const endpointKey = `endpoint:${endpoint}:${ip}`;
      await CacheService.increment(endpointKey, { increment: 1, ttl: 3600 });
    }

    // Record general analytics
    await this.recordAnalytics(ip, endpoint);
  }

  /**
   * Block IP temporarily
   */
  static async blockIPTemporarily(ip: string, reason: string): Promise<void> {
    const blockKey = `block:${ip}`;
    const expiresAt = Date.now() + this.config.blockDurationMinutes * 60000;

    const blockData = {
      reason,
      blockedAt: Date.now(),
      expiresAt,
    };

    await CacheService.set(blockKey, JSON.stringify(blockData), {
      ttl: this.config.blockDurationMinutes * 60,
    });

    logger.warn('IP temporarily blocked', {
      ip,
      reason,
      duration: this.config.blockDurationMinutes,
      expiresAt,
    });
  }

  /**
   * Detect suspicious activity
   */
  static async detectSuspiciousActivity(req: Request): Promise<boolean> {
    const ip = req.ip || '127.0.0.1'; // Fallback to localhost
    const userAgent = req.get('User-Agent') || '';
    const referer = req.get('Referer') || '';

    // Check for common attack patterns
    const suspiciousPatterns = [
      /bot|crawler|spider|scraper/i,
      /sql|union|select|insert|delete|drop/i,
      /script|javascript|vbscript/i,
      /<.*>/,
      /\.\./,
      /%[0-9a-f]{2}/i,
    ];

    const isSuspiciousUserAgent = suspiciousPatterns.some((pattern) =>
      pattern.test(userAgent)
    );
    const isSuspiciousReferer = suspiciousPatterns.some((pattern) =>
      pattern.test(referer)
    );
    const isSuspiciousURL = suspiciousPatterns.some((pattern) =>
      pattern.test(req.url)
    );

    // Check request frequency
    const requestKey = `suspicious:${ip}`;
    const recentRequests = await CacheService.increment(requestKey, {
      increment: 1,
      ttl: 300,
    }); // 5 minutes

    const isSuspicious =
      isSuspiciousUserAgent ||
      isSuspiciousReferer ||
      isSuspiciousURL ||
      recentRequests > this.config.suspiciousActivityThreshold;

    if (isSuspicious) {
      logger.warn('Suspicious activity detected', {
        ip,
        userAgent,
        referer,
        url: req.url,
        recentRequests,
      });

      // Auto-block if too many suspicious activities
      if (recentRequests > this.config.maxFailedAttemptsBeforeBlock) {
        await this.blockIPTemporarily(ip, 'Suspicious activity detected');
      }
    }

    return isSuspicious;
  }

  /**
   * Record analytics data
   */
  static async recordAnalytics(ip: string, endpoint?: string): Promise<void> {
    const analyticsKey = 'security:analytics';
    const analytics = await CacheService.get<string>(analyticsKey);

    let data: SecurityAnalytics = analytics
      ? JSON.parse(analytics)
      : {
          totalRequests: 0,
          blockedRequests: 0,
          suspiciousActivities: 0,
          topIPs: [],
          geographicData: [],
        };

    data.totalRequests++;

    // Update top IPs
    const existingIP = data.topIPs.find((item) => item.ip === ip);
    if (existingIP) {
      existingIP.requests++;
    } else {
      data.topIPs.push({ ip, requests: 1 });
    }

    // Sort and limit top IPs
    data.topIPs.sort((a, b) => b.requests - a.requests);
    data.topIPs = data.topIPs.slice(0, 100);

    await CacheService.set(analyticsKey, JSON.stringify(data), { ttl: 86400 }); // 1 day
  }

  /**
   * Get security analytics
   */
  static async getAnalytics(): Promise<SecurityAnalytics> {
    const analyticsKey = 'security:analytics';
    const analytics = await CacheService.get<string>(analyticsKey);

    return analytics
      ? JSON.parse(analytics)
      : {
          totalRequests: 0,
          blockedRequests: 0,
          suspiciousActivities: 0,
          topIPs: [],
          geographicData: [],
        };
  }

  /**
   * Clear all rate limiting data for an IP
   */
  static async clearRateLimitData(ip: string): Promise<void> {
    const keys = [
      `rate:${ip}:minute`,
      `rate:${ip}:hour`,
      `rate:${ip}:day`,
      `block:${ip}`,
      `suspicious:${ip}`,
    ];

    await Promise.all(keys.map((key) => CacheService.delete(key)));
    logger.info('Rate limit data cleared for IP', { ip });
  }

  /**
   * Get blocked IPs with details
   */
  static async getBlockedIPs(): Promise<
    Array<{ ip: string; reason: string; expiresAt: number }>
  > {
    const analytics = await this.getAnalytics();
    const blockedIPs: Array<{ ip: string; reason: string; expiresAt: number }> =
      [];

    // Get temporarily blocked IPs
    for (const ipData of analytics.topIPs.slice(0, 50)) {
      const blockKey = `block:${ipData.ip}`;
      const blockInfo = await CacheService.get<string>(blockKey);
      if (blockInfo) {
        const blockData = JSON.parse(blockInfo);
        blockedIPs.push({
          ip: ipData.ip,
          reason: blockData.reason,
          expiresAt: blockData.expiresAt,
        });
      }
    }

    // Add permanently blacklisted IPs
    for (const ip of this.config.blacklistedIPs) {
      const blacklistInfo = await CacheService.get<string>(`blacklist:${ip}`);
      blockedIPs.push({
        ip,
        reason: blacklistInfo || 'Blacklisted',
        expiresAt: -1, // Permanent
      });
    }

    return blockedIPs;
  }

  /**
   * Health check for security service
   */
  static async healthCheck(): Promise<{ status: string; details: any }> {
    try {
      const analytics = await this.getAnalytics();
      const blockedIPs = await this.getBlockedIPs();

      return {
        status: 'healthy',
        details: {
          totalRequests: analytics.totalRequests,
          blockedRequests: analytics.blockedRequests,
          activeBlocks: blockedIPs.length,
          whitelistedIPs: this.config.whitelistedIPs.length,
          blacklistedIPs: this.config.blacklistedIPs.length,
        },
      };
    } catch (error) {
      logger.error('Security service health check failed:', error);
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
}
