import { redisConfig } from '../config/redis';
import { logger } from '../utils/logger';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
}

export class CacheService {
  private static readonly DEFAULT_TTL = 3600; // 1 hour
  private static readonly URL_CACHE_TTL = 86400; // 24 hours
  private static readonly ANALYTICS_CACHE_TTL = 300; // 5 minutes
  private static readonly RATE_LIMIT_TTL = 900; // 15 minutes

  /**
   * Generate cache key with optional prefix
   */
  private static generateKey(key: string, prefix?: string): string {
    return prefix ? `${prefix}:${key}` : key;
  }

  /**
   * Generic get method
   */
  static async get<T>(
    key: string,
    options: CacheOptions = {}
  ): Promise<T | null> {
    try {
      const client = redisConfig.getClient();
      if (!client || !redisConfig.isClientConnected()) {
        return null;
      }

      const cacheKey = this.generateKey(key, options.prefix);
      const value = await client.get(cacheKey);

      if (!value || typeof value !== 'string') {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Generic set method
   */
  static async set(
    key: string,
    value: any,
    options: CacheOptions = {}
  ): Promise<boolean> {
    try {
      const client = redisConfig.getClient();
      if (!client || !redisConfig.isClientConnected()) {
        return false;
      }

      const cacheKey = this.generateKey(key, options.prefix);
      const ttl = options.ttl || this.DEFAULT_TTL;

      await client.setEx(cacheKey, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Delete a cache entry
   */
  static async delete(
    key: string,
    options: CacheOptions = {}
  ): Promise<boolean> {
    try {
      const client = redisConfig.getClient();
      if (!client || !redisConfig.isClientConnected()) {
        return false;
      }

      const cacheKey = this.generateKey(key, options.prefix);
      const result = await client.del(cacheKey);
      return result > 0;
    } catch (error) {
      logger.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Delete multiple cache entries by pattern
   */
  static async deletePattern(
    pattern: string,
    options: CacheOptions = {}
  ): Promise<number> {
    try {
      const client = redisConfig.getClient();
      if (!client || !redisConfig.isClientConnected()) {
        return 0;
      }

      const searchPattern = this.generateKey(pattern, options.prefix);
      const keys = await client.keys(searchPattern);

      if (keys.length === 0) {
        return 0;
      }

      const deletedCount = await client.del(keys);
      return deletedCount;
    } catch (error) {
      logger.error('Cache deletePattern error:', error);
      return 0;
    }
  }

  /**
   * Check if a key exists
   */
  static async exists(
    key: string,
    options: CacheOptions = {}
  ): Promise<boolean> {
    try {
      const client = redisConfig.getClient();
      if (!client || !redisConfig.isClientConnected()) {
        return false;
      }

      const cacheKey = this.generateKey(key, options.prefix);
      const result = await client.exists(cacheKey);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error:', error);
      return false;
    }
  }

  /**
   * Cache URL data
   */
  static async cacheUrl(shortCode: string, urlData: any): Promise<boolean> {
    return this.set(shortCode, urlData, {
      ttl: this.URL_CACHE_TTL,
      prefix: 'url',
    });
  }

  /**
   * Get cached URL data
   */
  static async getCachedUrl(shortCode: string): Promise<any> {
    return this.get(shortCode, { prefix: 'url' });
  }

  /**
   * Invalidate URL cache
   */
  static async invalidateUrl(shortCode: string): Promise<boolean> {
    return this.delete(shortCode, { prefix: 'url' });
  }

  /**
   * Invalidate all URLs for a user
   */
  static async invalidateUserUrls(userId: number): Promise<number> {
    return this.deletePattern(`*`, { prefix: `user:${userId}:urls` });
  }

  /**
   * Cache analytics data
   */
  static async cacheAnalytics(key: string, data: any): Promise<boolean> {
    return this.set(key, data, {
      ttl: this.ANALYTICS_CACHE_TTL,
      prefix: 'analytics',
    });
  }

  /**
   * Get cached analytics data
   */
  static async getCachedAnalytics(key: string): Promise<any> {
    return this.get(key, { prefix: 'analytics' });
  }

  /**
   * Increment a counter (useful for rate limiting)
   */
  static async increment(
    key: string,
    options: CacheOptions & { increment?: number } = {}
  ): Promise<number> {
    try {
      const client = redisConfig.getClient();
      if (!client || !redisConfig.isClientConnected()) {
        return 0;
      }

      const cacheKey = this.generateKey(key, options.prefix);
      const increment = options.increment || 1;

      const newValue = await client.incrBy(cacheKey, increment);

      // Set expiration if this is a new key
      if (newValue === increment && options.ttl) {
        await client.expire(cacheKey, options.ttl);
      }

      return newValue;
    } catch (error) {
      logger.error('Cache increment error:', error);
      return 0;
    }
  }

  /**
   * Rate limiting functionality
   */
  static async checkRateLimit(
    identifier: string,
    limit: number,
    windowSeconds: number = 900
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    try {
      const client = redisConfig.getClient();
      if (!client || !redisConfig.isClientConnected()) {
        // If Redis is not available, allow the request
        return {
          allowed: true,
          remaining: limit - 1,
          resetTime: Date.now() + windowSeconds * 1000,
        };
      }

      const key = this.generateKey(identifier, 'rate_limit');
      const currentCount = await this.increment(key, {
        ttl: windowSeconds,
        prefix: '',
      });

      const allowed = currentCount <= limit;
      const remaining = Math.max(0, limit - currentCount);
      const resetTime = Date.now() + windowSeconds * 1000;

      return { allowed, remaining, resetTime };
    } catch (error) {
      logger.error('Rate limit check error:', error);
      // If there's an error, allow the request
      return {
        allowed: true,
        remaining: limit - 1,
        resetTime: Date.now() + windowSeconds * 1000,
      };
    }
  }

  /**
   * Cache user session data
   */
  static async cacheUserSession(
    userId: number,
    sessionData: any
  ): Promise<boolean> {
    return this.set(`user:${userId}`, sessionData, {
      ttl: 86400, // 24 hours
      prefix: 'session',
    });
  }

  /**
   * Get cached user session
   */
  static async getCachedUserSession(userId: number): Promise<any> {
    return this.get(`user:${userId}`, { prefix: 'session' });
  }

  /**
   * Invalidate user session
   */
  static async invalidateUserSession(userId: number): Promise<boolean> {
    return this.delete(`user:${userId}`, { prefix: 'session' });
  }

  /**
   * Cache API key validation results
   */
  static async cacheApiKeyValidation(
    apiKey: string,
    validationResult: any
  ): Promise<boolean> {
    return this.set(apiKey, validationResult, {
      ttl: 300, // 5 minutes
      prefix: 'api_key',
    });
  }

  /**
   * Get cached API key validation
   */
  static async getCachedApiKeyValidation(apiKey: string): Promise<any> {
    return this.get(apiKey, { prefix: 'api_key' });
  }

  /**
   * Health check for cache service
   */
  static async healthCheck(): Promise<{
    status: string;
    connected: boolean;
    latency?: number;
  }> {
    try {
      const client = redisConfig.getClient();
      if (!client || !redisConfig.isClientConnected()) {
        return { status: 'unhealthy', connected: false };
      }

      const start = Date.now();
      await client.ping();
      const latency = Date.now() - start;

      return { status: 'healthy', connected: true, latency };
    } catch (error) {
      logger.error('Cache health check error:', error);
      return { status: 'unhealthy', connected: false };
    }
  }

  /**
   * Clear all cache (use with caution)
   */
  static async clearAll(): Promise<boolean> {
    try {
      const client = redisConfig.getClient();
      if (!client || !redisConfig.isClientConnected()) {
        return false;
      }

      await client.flushAll();
      logger.info('All cache cleared');
      return true;
    } catch (error) {
      logger.error('Cache clear all error:', error);
      return false;
    }
  }
}
