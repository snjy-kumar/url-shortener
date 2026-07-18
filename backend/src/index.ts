import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'crypto';

import { config } from './config/env.js';
import { prisma } from './config/database.js';
import { redisConfig } from './config/redis.js';
import { logger } from './utils/logger.js';
import { asyncHandler } from './utils/asyncHandler.js';
import {
  errorHandler,
  setupGlobalErrorHandlers,
  notFoundHandler,
} from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { CacheService } from './services/cacheService.js';
import { UrlController } from './controllers/urlController.js';
import urlRoutes from './routes/url.js';

setupGlobalErrorHandlers();

const app = express();

if (config.TRUST_PROXY) {
  app.set('trust proxy', 1);
}

app.use((req, res, next) => {
  req.id = req.get('X-Request-ID') || randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
});

app.use(helmet());

const corsOrigins = config.CORS_ORIGIN.split(',').map((o) => o.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || corsOrigins.includes(origin) || corsOrigins.includes('*')) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

app.use(
  rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    max: config.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

const redirectLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(compression());
app.use(requestLogger);

app.get(
  '/health',
  asyncHandler(async (_req, res) => {
    const checks = {
      status: 'OK' as string,
      timestamp: new Date().toISOString(),
      services: {
        database: 'unknown',
        cache: 'unknown',
      },
    };

    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.services.database = 'healthy';
    } catch {
      checks.services.database = 'unhealthy';
      checks.status = 'Service Unavailable';
    }

    const cache = await CacheService.healthCheck();
    checks.services.cache = cache.status;

    res.status(checks.status === 'OK' ? 200 : 503).json(checks);
  })
);

app.use('/api/v1/urls', urlRoutes);
app.get('/:shortCode', redirectLimiter, UrlController.redirectToOriginal);

app.use('/{*splat}', notFoundHandler);
app.use(errorHandler);

let server: ReturnType<typeof app.listen> | null = null;

const startServer = async () => {
  await prisma.$connect();
  logger.info('Database connected');

  try {
    await redisConfig.connect();
    logger.info('Redis connected');
  } catch (error) {
    logger.warn('Redis unavailable — continuing without cache', { error });
  }

  server = app.listen(config.PORT, () => {
    logger.info(`Server listening on port ${config.PORT}`);
  });
};

const shutdown = async (signal: string) => {
  logger.info(`${signal} received — shutting down`);
  const active = server;
  if (active) {
    await new Promise<void>((resolve) => {
      active.close(() => resolve());
    });
  }
  await prisma.$disconnect();
  await redisConfig.quit();
  process.exit(0);
};

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

startServer().catch((error) => {
  logger.error('Failed to start server', error);
  process.exit(1);
});
