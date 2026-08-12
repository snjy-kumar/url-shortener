import { Redis } from 'ioredis';
import { config } from '../config/env.js';
import { logger } from './logger.js';

export type CachedRedirect = {
  id: number;
  originalUrl: string;
  isActive: boolean;
  expiresAt: string | null;
  maxClicks: number | null;
};

type CacheBackend = {
  get(key: string): Promise<CachedRedirect | null>;
  set(key: string, value: CachedRedirect, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
};

/** Simple LRU for single-node / Redis-missing fallback. */
class MemoryLru implements CacheBackend {
  private map = new Map<string, { value: CachedRedirect; expiresAt: number }>();
  constructor(private readonly maxEntries: number) {}

  async get(key: string): Promise<CachedRedirect | null> {
    const hit = this.map.get(key);
    if (!hit) {
      return null;
    }
    if (hit.expiresAt < Date.now()) {
      this.map.delete(key);
      return null;
    }
    this.map.delete(key);
    this.map.set(key, hit);
    return hit.value;
  }

  async set(
    key: string,
    value: CachedRedirect,
    ttlSeconds: number
  ): Promise<void> {
    if (this.map.has(key)) {
      this.map.delete(key);
    }
    while (this.map.size >= this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      this.map.delete(oldest);
    }
    this.map.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async del(key: string): Promise<void> {
    this.map.delete(key);
  }
}

class RedisBackend implements CacheBackend {
  constructor(private readonly client: Redis) {}

  async get(key: string): Promise<CachedRedirect | null> {
    const raw = await this.client.get(key);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as CachedRedirect;
    } catch {
      return null;
    }
  }

  async set(
    key: string,
    value: CachedRedirect,
    ttlSeconds: number
  ): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }
}

const PREFIX = 'redirect:';
let backend: CacheBackend = new MemoryLru(2048);
let mode: 'memory' | 'redis' = 'memory';

export const getRedirectCacheMode = (): 'memory' | 'redis' => mode;

export const initRedirectCache = async (): Promise<void> => {
  const url = config.REDIS_URL;
  if (!url) {
    logger.info('Redirect cache: in-memory LRU (set REDIS_URL for Redis)');
    return;
  }

  try {
    const client = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: true,
    });
    await client.connect();
    await client.ping();
    backend = new RedisBackend(client);
    mode = 'redis';
    logger.info('Redirect cache: Redis connected');
  } catch (error) {
    logger.warn('Redirect cache: Redis failed, using memory LRU', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    backend = new MemoryLru(2048);
    mode = 'memory';
  }
};

export const redirectCache = {
  async get(shortCode: string): Promise<CachedRedirect | null> {
    try {
      return await backend.get(PREFIX + shortCode);
    } catch {
      return null;
    }
  },
  async set(shortCode: string, value: CachedRedirect): Promise<void> {
    try {
      await backend.set(
        PREFIX + shortCode,
        value,
        config.REDIRECT_CACHE_TTL_SECONDS
      );
    } catch {
      // ignore cache write failures
    }
  },
  async invalidate(shortCode: string): Promise<void> {
    try {
      await backend.del(PREFIX + shortCode);
    } catch {
      // ignore
    }
  },
};
