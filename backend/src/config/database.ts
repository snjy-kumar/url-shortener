import { PrismaClient } from '@prisma/client';
import { config } from './env';
import { logger } from '../utils/logger';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const createPrismaClient = () => {
  return new PrismaClient({
    log:
      config.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
    errorFormat: config.NODE_ENV === 'production' ? 'minimal' : 'pretty',
    datasources: {
      db: {
        url: config.DATABASE_URL,
      },
    },
  });
};

export const prisma = globalThis.__prisma ?? createPrismaClient();

if (config.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

// Add connection lifecycle hooks
prisma.$use(async (params, next) => {
  const before = Date.now();
  try {
    const result = await next(params);
    const after = Date.now();
    const duration = after - before;
    
    // Log slow queries (> 1000ms)
    if (duration > 1000) {
      logger.warn('Slow query detected', {
        model: params.model,
        action: params.action,
        duration: `${duration}ms`,
      });
    }
    
    return result;
  } catch (error) {
    logger.error('Database query error', {
      model: params.model,
      action: params.action,
      error,
    });
    throw error;
  }
});

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
    logger.info('Prisma client disconnected');
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
