import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'crypto';

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

// Import routes
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

// Trust proxy - CRITICAL for production behind load balancer
if (config.TRUST_PROXY) {
  app.set('trust proxy', 1);
}

// Request ID middleware
app.use((req, res, next) => {
  req.id = req.get('X-Request-ID') || randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Security middleware
app.use(helmet());

// CORS configuration - support multiple origins
const corsOrigins = config.CORS_ORIGIN.split(',').map(origin => origin.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      
      if (corsOrigins.indexOf(origin) !== -1 || corsOrigins.includes('*')) {
        callback(null, true);
      } else {
        logger.warn('CORS blocked origin', { origin, allowed: corsOrigins });
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-ID',
      'X-Request-Time',
    ],
    exposedHeaders: [
      'X-Request-ID',
      'X-Request-Time',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
    ],
    maxAge: 86400, // 24 hours
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

    server = app.listen(config.PORT, () => {
      logger.info(`🚀 Server running on port ${config.PORT}`);
      logger.info(`📊 Environment: ${config.NODE_ENV}`);
      logger.info(`🔗 Base URL: ${config.BASE_URL}`);
      logger.info(`🔒 Trust Proxy: ${config.TRUST_PROXY}`);
      logger.info(`⏰ Server started at: ${new Date().toISOString()}`);
    });

    // Handle server errors
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${config.PORT} is already in use`);
      } else {
        logger.error('Server error:', error);
      }
      process.exit(1);
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown handler
let isShuttingDown = false;
let server: any = null;

const gracefulShutdown = async (signal: string) => {
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress, forcing exit');
    process.exit(1);
  }

  isShuttingDown = true;
  logger.info(`${signal} received, starting graceful shutdown`);

  try {
    // Stop accepting new connections
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });
      logger.info('HTTP server closed');
    }

    // Stop expiration service
    try {
      const { ExpirationService } = await import('./services/expirationService');
      ExpirationService.stopCleanupProcess();
      logger.info('Expiration service stopped');
    } catch (error) {
      logger.error('Error stopping expiration service:', error);
    }

    // Close database connection
    await prisma.$disconnect();
    logger.info('Database disconnected');

    // Close Redis connection
    await redisConfig.quit();
    logger.info('Redis disconnected');

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors during shutdown
process.on('exit', (code) => {
  logger.info(`Process exiting with code ${code}`);
});

startServer();

// Export app for testing
export { app };

export default app;
