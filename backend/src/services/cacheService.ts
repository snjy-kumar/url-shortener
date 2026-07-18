import { redisConfig } from '../config/redis.js';
import { logger } from '../utils/logger.js';

interface CachedUrl {
  id: number;
  originalUrl: string;
}

export class CacheService {
  private static readonly URL_TTL = 86400;

  private static key(shortCode: string) {
    return `url:${shortCode}`;
  }

  static async getCachedUrl(shortCode: string): Promise<CachedUrl | null> {
    try {
      const client = redisConfig.getClient();
      if (!client || !redisConfig.isClientConnected()) {
        return null;
      }
      const value = await client.get(this.key(shortCode));
      if (!value || typeof value !== 'string') {
        return null;
      }
      return JSON.parse(value) as CachedUrl;
    } catch (error) {
      logger.error('Cache get error', { error });
      return null;
    }
  }

  static async cacheUrl(shortCode: string, data: CachedUrl): Promise<void> {
    try {
      const client = redisConfig.getClient();
      if (!client || !redisConfig.isClientConnected()) {
        return;
      }
      await client.setEx(this.key(shortCode), this.URL_TTL, JSON.stringify(data));
    } catch (error) {
      logger.error('Cache set error', { error });
    }
  }

  static async healthCheck(): Promise<{ status: string; latency: number }> {
    const start = Date.now();
    try {
      const client = redisConfig.getClient();
      if (!client || !redisConfig.isClientConnected()) {
        return { status: 'unavailable', latency: 0 };
      }
      await client.ping();
      return { status: 'healthy', latency: Date.now() - start };
    } catch {
      return { status: 'unhealthy', latency: Date.now() - start };
    }
  }
}
