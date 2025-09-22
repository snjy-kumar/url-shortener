import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { config } from './config/env';
import { prisma } from './config/database';
import { redisConfig } from './config/redis';
import { logger } from './utils/logger';
import {
  errorHandler,
  setupGlobalErrorHandlers,
  notFoundHandler,
} from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

// Import routes (to be created)
import urlRoutes from './routes/url';
import authRoutes from './routes/auth';
import qrRoutes from './routes/qr';
import apiKeyRoutes from './routes/apiKeys';
import expirationRoutes from './routes/expiration';
import analyticsRoutes from './routes/analytics';
import securityRoutes from './routes/security';
import monitoringRoutes from './routes/monitoring';
// Import security middleware
import { securityStack } from './middleware/advancedSecurity';

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: config.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Rate limiting (basic - will be enhanced by security middleware)
const limiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Advanced security middleware (applied globally)
app.use(securityStack);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Compression middleware
app.use(compression());

// Request logging
app.use(requestLogger);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    // Check Redis connection
    const { CacheService } = await import('./services/cacheService');
    const cacheHealth = await CacheService.healthCheck();

    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.NODE_ENV,
      services: {
        database: 'healthy',
        cache: cacheHealth.status,
        cacheLatency: cacheHealth.latency,
      },
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'Service Unavailable',
      timestamp: new Date().toISOString(),
    });
  }
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/urls', urlRoutes);
app.use('/api/v1/qr', qrRoutes);
app.use('/api/v1/api-keys', apiKeyRoutes);
app.use('/api/v1/expiration', expirationRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/security', securityRoutes);
app.use('/api/v1/monitoring', monitoringRoutes);

// Import URL controller for redirection
import { UrlController } from './controllers/urlController';

// URL redirection route (this should be last to catch short codes)
app.get('/:shortCode', UrlController.redirectToOriginal);

// 404 handler for unmatched routes
app.use('*', notFoundHandler);

// Error handling middleware (should be last)
app.use(errorHandler);

// Setup global error handlers
setupGlobalErrorHandlers();

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('✅ Database connected successfully');

    // Initialize Redis connection (optional - app works without it)
    try {
      await redisConfig.connect();
      logger.info('✅ Redis connected successfully');
    } catch (error) {
      logger.warn(
        '⚠️ Redis connection failed, continuing without cache:',
        error
      );
    }

    // Start expiration cleanup service
    const { ExpirationService } = await import('./services/expirationService');
    ExpirationService.startCleanupProcess();
    logger.info('✅ URL expiration cleanup service started');

    app.listen(config.PORT, () => {
      logger.info(`🚀 Server running on port ${config.PORT}`);
      logger.info(`📊 Environment: ${config.NODE_ENV}`);
      logger.info(`🔗 Base URL: ${config.BASE_URL}`);
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');

  // Stop expiration service
  const { ExpirationService } = await import('./services/expirationService');
  ExpirationService.stopCleanupProcess();

  await prisma.$disconnect();
  await redisConfig.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');

  // Stop expiration service
  const { ExpirationService } = await import('./services/expirationService');
  ExpirationService.stopCleanupProcess();

  await prisma.$disconnect();
  await redisConfig.quit();
  process.exit(0);
});

startServer();

// Export app for testing
export { app };

export default app;
