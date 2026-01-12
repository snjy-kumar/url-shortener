import { logger } from './logger.js';

/**
 * Critical startup validations
 * If any of these fail, the application MUST NOT start
 * 
 * NOTE: This does NOT import config.ts to avoid circular dependencies
 * and to ensure validation runs before config initialization
 */
export const validateStartup = (): void => {
  logger.info('🔍 Running startup validations...');

  const errors: string[] = [];
  const nodeEnv = process.env['NODE_ENV'] || 'development';

  // 1. Critical environment variables
  const requiredEnvVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'BASE_URL',
    'CORS_ORIGIN',
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      errors.push(`❌ Missing critical environment variable: ${envVar}`);
    }
  }

  // 2. JWT secret strength (production only)
  if (nodeEnv === 'production') {
    const jwtSecret = process.env['JWT_SECRET'];
    const jwtRefreshSecret = process.env['JWT_REFRESH_SECRET'];

    if (jwtSecret && jwtSecret.length < 32) {
      errors.push('❌ JWT_SECRET must be at least 32 characters in production');
    }

    if (jwtRefreshSecret && jwtRefreshSecret.length < 32) {
      errors.push('❌ JWT_REFRESH_SECRET must be at least 32 characters in production');
    }

    if (jwtSecret === jwtRefreshSecret) {
      errors.push('❌ JWT_SECRET and JWT_REFRESH_SECRET must be different');
    }

    // 3. Production-specific checks
    const baseUrl = process.env['BASE_URL'] || '';
    if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
      errors.push('❌ BASE_URL must not contain localhost in production');
    }

    const corsOrigin = process.env['CORS_ORIGIN'] || '';
    if (corsOrigin === '*') {
      logger.warn('⚠️  CORS_ORIGIN is set to "*" - this is not recommended for production');
    }

    const trustProxy = process.env['TRUST_PROXY'];
    if (trustProxy !== 'true') {
      logger.warn('⚠️  TRUST_PROXY is disabled - IP addresses may be incorrect behind load balancer');
    }
  }

  // 4. Database URL format validation
  const dbUrl = process.env['DATABASE_URL'];
  if (dbUrl && !dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
    errors.push('❌ DATABASE_URL must be a valid PostgreSQL connection string');
  }

  // 5. Redis URL format validation (if provided)
  const redisUrl = process.env['REDIS_URL'];
  if (redisUrl && !redisUrl.startsWith('redis://') && !redisUrl.startsWith('rediss://')) {
    errors.push('❌ REDIS_URL must be a valid Redis connection string');
  }

  // 6. Port validation
  const port = parseInt(process.env['PORT'] || '3000', 10);
  if (port < 1 || port > 65535) {
    errors.push(`❌ PORT must be between 1 and 65535 (got: ${port})`);
  }

  // 7. Rate limit configuration
  const rateLimitMax = parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || '100', 10);
  if (rateLimitMax < 1) {
    errors.push('❌ RATE_LIMIT_MAX_REQUESTS must be at least 1');
  }

  const rateLimitWindow = parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '900000', 10);
  if (rateLimitWindow < 1000) {
    errors.push('❌ RATE_LIMIT_WINDOW_MS must be at least 1000 (1 second)');
  }

  // 8. Short code length validation
  const shortCodeLength = parseInt(process.env['SHORT_CODE_LENGTH'] || '7', 10);
  if (shortCodeLength < 4 || shortCodeLength > 20) {
    errors.push('❌ SHORT_CODE_LENGTH must be between 4 and 20');
  }

  // If any errors, fail startup
  if (errors.length > 0) {
    logger.error('🚨 STARTUP VALIDATION FAILED:');
    errors.forEach((error) => logger.error(error));
    logger.error('');
    logger.error('Application cannot start with invalid configuration.');
    logger.error('Please fix the above errors and try again.');
    process.exit(1);
  }

  logger.info('✅ All startup validations passed');

  // Log configuration summary (non-sensitive)
  logger.info('📋 Configuration Summary:', {
    nodeEnv,
    port,
    baseUrl: process.env['BASE_URL'],
    corsOrigin: (process.env['CORS_ORIGIN'] || '').substring(0, 50) + ((process.env['CORS_ORIGIN'] || '').length > 50 ? '...' : ''),
    shortCodeLength,
    rateLimit: `${rateLimitMax} requests per ${rateLimitWindow}ms`,
    trustProxy: process.env['TRUST_PROXY'] === 'true',
    hasRedis: !!process.env['REDIS_URL'],
    logLevel: process.env['LOG_LEVEL'] || 'info',
  });
};
