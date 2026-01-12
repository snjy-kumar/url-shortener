import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';
import { Pool } from 'pg';
import { config } from './env.js';
import { logger } from '../utils/logger.js';

declare global {
   
  var __prisma: PrismaClient | undefined;
  var __pool: Pool | undefined;
}

const createPrismaClient = () => {
  // Create PostgreSQL connection pool for better connection management
  const pool = globalThis.__pool ?? new Pool({
    connectionString: config.DATABASE_URL,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 10000, // Return error after 10 seconds
    // Enable statement timeout for long-running queries
    statement_timeout: 60000, // 60 seconds
  });

  // Reuse pool in development
  if (config.NODE_ENV !== 'production') {
    globalThis.__pool = pool;
  }

  // Create Prisma adapter with the PostgreSQL pool
  const adapter = new PrismaPg(pool);

  // Create Prisma Client with adapter (Prisma 7 pattern)
  return new PrismaClient({
    adapter,
    log:
      config.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
    errorFormat: config.NODE_ENV === 'production' ? 'minimal' : 'pretty',
  });
};

export const prisma = globalThis.__prisma ?? createPrismaClient();

if (config.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

// Connection check
export const checkDatabaseConnection = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error('Database connection check failed:', error);
    return false;
  }
};

// Graceful disconnect
const disconnectPrisma = async () => {
  try {
    await prisma.$disconnect();
    // Also end the pool
    if (globalThis.__pool) {
      await globalThis.__pool.end();
    }
    logger.info('Prisma client and connection pool disconnected');
  } catch (error) {
    logger.error('Error disconnecting Prisma:', error);
  }
};

// Graceful shutdown
process.on('beforeExit', async () => {
  await disconnectPrisma();
});

process.on('SIGINT', async () => {
  await disconnectPrisma();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnectPrisma();
  process.exit(0);
});
