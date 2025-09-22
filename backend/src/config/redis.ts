import { createClient, RedisClientType } from 'redis';
import { config } from './env';
import { logger } from '../utils/logger';

class RedisConfig {
  private client: RedisClientType | null = null;
  private isConnected = false;

  /**
   * Initialize Redis connection
   */
  async connect(): Promise<void> {
    try {
      this.client = createClient({
        url: config.REDIS_URL || 'redis://localhost:6379',
        socket: {
          reconnectStrategy: (retries) => {
            if (retries < 3) {
              logger.info(`Redis reconnection attempt ${retries + 1}`);
              return Math.min(retries * 50, 500);
            }
            logger.error('Redis reconnection failed after 3 attempts');
            return false;
          },
        },
      });

      this.client.on('error', (err) => {
        logger.error('Redis Client Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis client connected');
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        logger.warn('Redis client disconnected');
        this.isConnected = false;
      });

      await this.client.connect();
      logger.info('Redis connection established');
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      // Don't throw error - application should work without Redis
      this.isConnected = false;
    }
  }

  /**
   * Get Redis client instance
   */
  getClient(): RedisClientType | null {
    return this.client;
  }

  /**
   * Check if Redis is connected
   */
  isClientConnected(): boolean {
    return this.isConnected && this.client?.isOpen === true;
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.client && this.client.isOpen) {
      await this.client.disconnect();
      logger.info('Redis client disconnected');
    }
  }

  /**
   * Graceful shutdown
   */
  async quit(): Promise<void> {
    if (this.client && this.client.isOpen) {
      await this.client.quit();
      logger.info('Redis client quit gracefully');
    }
  }
}

// Create singleton instance
const redisConfig = new RedisConfig();

export { redisConfig };
