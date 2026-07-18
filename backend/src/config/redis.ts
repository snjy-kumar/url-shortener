import { createClient, RedisClientType } from 'redis';
import { config } from './env.js';
import { logger } from '../utils/logger.js';

class RedisConfig {
  private client: RedisClientType | null = null;
  private isConnected = false;

  async connect(): Promise<void> {
    if (!config.REDIS_URL) {
      logger.info('REDIS_URL not set — cache disabled');
      return;
    }

    this.client = createClient({ url: config.REDIS_URL });
    this.client.on('error', (err) => {
      logger.error('Redis error:', err);
      this.isConnected = false;
    });
    this.client.on('connect', () => {
      this.isConnected = true;
    });

    await this.client.connect();
    this.isConnected = true;
  }

  getClient(): RedisClientType | null {
    return this.client;
  }

  isClientConnected(): boolean {
    return this.isConnected && this.client?.isOpen === true;
  }

  async quit(): Promise<void> {
    if (this.client?.isOpen) {
      await this.client.quit();
      this.isConnected = false;
    }
  }
}

export const redisConfig = new RedisConfig();
