import { createClient, RedisClientType } from 'redis';
import { config } from './env.js';
import { logger } from '../utils/logger.js';

class RedisConfig {
  private client: RedisClientType | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  /**
   * Initialize Redis connection
   */
  async connect(): Promise<void> {
    try {
      const redisUrl = config.REDIS_URL || 'redis://localhost:6379';
      
      this.client = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            this.reconnectAttempts = retries;
            
            if (retries >= this.maxReconnectAttempts) {
              logger.error(`Redis reconnection failed after ${retries} attempts`);
              this.isConnected = false;
              return false;
            }
            
            const delay = Math.min(retries * 100, 3000);
            logger.info(`Redis reconnection attempt ${retries + 1}, delay: ${delay}ms`);
            return delay;
          },
          connectTimeout: 10000,
        },
        // Add command timeout
        commandsQueueMaxLength: 1000,
      });

      this.client.on('error', (err) => {
        logger.error('Redis Client Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis client connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
      });

      this.client.on('ready', () => {
        logger.info('Redis client ready');
      });

      this.client.on('disconnect', () => {
        logger.warn('Redis client disconnected');
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        logger.info('Redis client reconnecting...');
      });

      await this.client.connect();
      logger.info('Redis connection established successfully');
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
   * Health check with latency measurement
   */
  async healthCheck(): Promise<{ connected: boolean; latency?: number }> {
    if (!this.isClientConnected() || !this.client) {
      return { connected: false };
    }

    try {
      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;
      return { connected: true, latency };
    } catch (error) {
      logger.error('Redis health check failed:', error);
      return { connected: false };
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.client && this.client.isOpen) {
      try {
        await this.client.disconnect();
        logger.info('Redis client disconnected');
      } catch (error) {
        logger.error('Error disconnecting Redis:', error);
      }
    }
  }

  /**
   * Graceful shutdown
   */
  async quit(): Promise<void> {
    if (this.client && this.client.isOpen) {
      try {
        await this.client.quit();
        logger.info('Redis client quit gracefully');
      } catch (error) {
        logger.error('Error quitting Redis:', error);
        // Force disconnect if quit fails
        await this.disconnect();
      }
    }
  }
}

// Create singleton instance
const redisConfig = new RedisConfig();

export { redisConfig };