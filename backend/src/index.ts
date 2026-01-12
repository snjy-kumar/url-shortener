import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'crypto';

import { config } from './config/env.js';
import { prisma } from './config/database.js';
import { redisConfig } from './config/redis.js';
import { logger } from './utils/logger.js';
import { validateStartup } from './utils/startupValidation.js';
import { DatabaseMonitor } from './utils/dbMonitoring.js';
import { asyncHandler } from './utils/asyncHandler.js';

// Initialize Sentry FIRST (before any other imports that might throw)
import { sentryService } from './services/sentryService.js';
import { sentryRequestHandler, sentryTracingHandler, sentryErrorHandler, sentryUserContext } from './middleware/sentry.js';
sentryService.initialize();

// Initialize APM
import { apmService, apmMiddleware } from './services/apmService.js';

// CRITICAL: Validate environment and configuration before ANYTHING else
// This prevents the app from starting with invalid/dangerous config
validateStartup();

const app = express();

// Setup global error handlers EARLY to catch startup errors
import {
  errorHandler,
  setupGlobalErrorHandlers,
  notFoundHandler,
} from './middleware/errorHandler.js';
setupGlobalErrorHandlers();

import { requestLogger } from './middleware/requestLogger.js';

// Import routes
import urlRoutes from './routes/url.js';
import authRoutes from './routes/auth.js';
import qrRoutes from './routes/qr.js';
import apiKeyRoutes from './routes/apiKeys.js';
import expirationRoutes from './routes/expiration.js';
import analyticsRoutes from './routes/analytics.js';
import securityRoutes from './routes/security.js';
import monitoringRoutes from './routes/monitoring.js';
// Import security middleware
import { securityStack } from './middleware/advancedSecurity.js';

// Trust proxy - CRITICAL for production behind load balancer
if (config.TRUST_PROXY) {
  app.set('trust proxy', 1);
}

// Sentry request handler - MUST be first middleware
app.use(sentryRequestHandler());

// Sentry tracing for APM
app.use(sentryTracingHandler());

// APM middleware for performance monitoring
app.use(apmMiddleware);

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

// CRITICAL: Rate limiter for public redirect endpoint
// Prevents DDoS attacks via short code enumeration
const redirectLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: {
    error: 'Too many redirect requests, please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip health check and API routes
  skip: (req) => req.path === '/health' || req.path.startsWith('/api/'),
});

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

// Sentry user context (after auth middleware would extract user)
app.use(sentryUserContext);

// Health check endpoint - CRITICAL for load balancers and monitoring
app.get('/health', asyncHandler(async (req, res) => {
  const checks = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.NODE_ENV,
    services: {
      database: { status: 'unknown', latency: 0 },
      cache: { status: 'unknown', latency: 0 },
      pool: { active: 0, idle: 0, total: 0, utilizationPercent: 0 },
    },
  };

  let isHealthy = true;

  // Check database connection
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - dbStart;
    checks.services.database = { status: 'healthy', latency: dbLatency };

    // Get pool statistics
    const poolStats = await DatabaseMonitor.getPoolStats();
    checks.services.pool = poolStats;

    // Alert if pool utilization is high
    if (poolStats.utilizationPercent > 90) {
      logger.warn('⚠️ Database pool utilization high during health check', poolStats);
    }
  } catch (error) {
    logger.error('Database health check failed:', error);
    checks.services.database = { status: 'unhealthy', latency: 0 };
    isHealthy = false;
  }

  // Check Redis connection (optional - don't fail health check if Redis is down)
  try {
    const { CacheService } = await import('./services/cacheService.js');
    const cacheHealth = await CacheService.healthCheck();
    checks.services.cache = {
      status: cacheHealth.status,
      latency: cacheHealth.latency || 0,
    };
  } catch (error) {
    logger.warn('Redis health check failed (non-critical):', error);
    checks.services.cache = { status: 'degraded', latency: 0 };
    // Don't mark overall health as failed - app works without Redis
  }

  // Update status
  checks.status = isHealthy ? 'OK' : 'Service Unavailable';

  res.status(isHealthy ? 200 : 503).json(checks);
}));

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
import { UrlController } from './controllers/urlController.js';

// CRITICAL: Apply rate limiting BEFORE redirect handler to prevent DDoS
// URL redirection route (this should be last to catch short codes)
app.get('/:shortCode', redirectLimiter, UrlController.redirectToOriginal);

// 404 handler for unmatched routes
app.use('*', notFoundHandler);

// Sentry error handler - MUST be before other error handlers
app.use(sentryErrorHandler());

// Error handling middleware (should be last)
app.use(errorHandler);

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
    const { ExpirationService } = await import('./services/expirationService.js');
    ExpirationService.startCleanupProcess();
    logger.info('✅ URL expiration cleanup service started');

    // Start database connection pool monitoring
    DatabaseMonitor.startMonitoring(60000); // Check every minute
    logger.info('✅ Database connection pool monitoring started');

    // Start APM monitoring
    apmService.start(60000); // Log metrics every minute
    logger.info('✅ APM (Application Performance Monitoring) started');

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
      const { ExpirationService } = await import('./services/expirationService.js');
      ExpirationService.stopCleanupProcess();
      logger.info('Expiration service stopped');
    } catch (error) {
      logger.error('Error stopping expiration service:', error);
    }

    // Stop database monitoring
    DatabaseMonitor.stopMonitoring();
    logger.info('Database monitoring stopped');

    // Stop APM monitoring
    apmService.stop();
    logger.info('APM monitoring stopped');

    // Flush Sentry events
    if (sentryService.isInitialized()) {
      await sentryService.flush(5000);
      await sentryService.close(2000);
      logger.info('Sentry flushed and closed');
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
