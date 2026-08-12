import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'crypto';
import { clerkMiddleware } from '@clerk/express';

import { config } from './config/env.js';
import { prisma } from './config/database.js';
import { logger } from './utils/logger.js';
import { asyncHandler } from './utils/asyncHandler.js';
import {
  errorHandler,
  setupGlobalErrorHandlers,
  notFoundHandler,
} from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { UrlController } from './controllers/urlController.js';
import { ClerkWebhookController } from './controllers/clerkWebhookController.js';
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

// Raw body required for Svix signature verification (before express.json).
app.post(
  '/api/v1/webhooks/clerk',
  express.raw({ type: 'application/json' }),
  ClerkWebhookController.handle
);

app.get(
  '/health',
  asyncHandler(async (_req, res) => {
    const checks = {
      status: 'OK' as string,
      timestamp: new Date().toISOString(),
      services: {
        database: 'unknown',
      },
    };

    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.services.database = 'healthy';
    } catch {
      checks.services.database = 'unhealthy';
      checks.status = 'Service Unavailable';
    }

    res.status(checks.status === 'OK' ? 200 : 503).json(checks);
  })
);

// API stack only — Clerk + body parsers + compression stay off the redirect hot path.
const api = express.Router();
api.use(
  clerkMiddleware({
    ...(config.CLERK_AUTHORIZED_PARTIES.length > 0
      ? { authorizedParties: config.CLERK_AUTHORIZED_PARTIES }
      : {}),
  })
);
api.use(
  rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    max: config.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
  })
);
api.use(express.json({ limit: '1mb' }));
api.use(express.urlencoded({ extended: true, limit: '1mb' }));
api.use(compression());
api.use(requestLogger);
api.use('/urls', urlRoutes);
app.use('/api/v1', api);

const redirectLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

app.get('/:shortCode', redirectLimiter, UrlController.redirectToOriginal);

app.use('/{*splat}', notFoundHandler);
app.use(errorHandler);

let server: ReturnType<typeof app.listen> | null = null;

const startServer = async () => {
  await prisma.$connect();
  logger.info('Database connected');

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
