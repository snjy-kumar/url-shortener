import * as winston from 'winston';
import { config } from '../config/env';
import * as path from 'path';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// Define colors for different log levels
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
};

winston.addColors(colors);

// Create Winston logger
export const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  levels,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'url-shortener' },
  transports: [
    // Write all logs with importance level of `error` or less to `error.log`
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
    }),
    // Write all logs to the main log file
    new winston.transports.File({
      filename: path.join(process.cwd(), config.LOG_FILE_PATH),
    }),
  ],
});

// If we're not in production, also log to the console
if (config.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [${level}]: ${message} ${
            Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
          }`;
        })
      ),
    })
  );
}

export default logger;

// Create a stream for HTTP logging (morgan)
export const httpLogStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

// Security logging
export const securityLogger = {
  logSecurityEvent: (event: string, details: Record<string, any>) => {
    logger.warn(`Security Event: ${event}`, {
      securityEvent: true,
      event,
      ...details,
      timestamp: new Date().toISOString(),
    });
  },

  logAuthAttempt: (
    success: boolean,
    email?: string,
    ip?: string,
    details?: Record<string, any>
  ) => {
    const level = success ? 'info' : 'warn';
    logger[level](`Authentication attempt: ${success ? 'success' : 'failed'}`, {
      authAttempt: true,
      success,
      email,
      ip,
      ...details,
      timestamp: new Date().toISOString(),
    });
  },

  logRateLimitViolation: (
    ip: string,
    endpoint: string,
    details?: Record<string, any>
  ) => {
    logger.warn('Rate limit violation', {
      rateLimitViolation: true,
      ip,
      endpoint,
      ...details,
      timestamp: new Date().toISOString(),
    });
  },
};

// Business logic logging
export const businessLogger = {
  logUrlCreated: (urlId: string, userId?: number, customAlias?: string) => {
    logger.info('URL created', {
      business: true,
      action: 'url_created',
      urlId,
      userId,
      customAlias,
      timestamp: new Date().toISOString(),
    });
  },

  logUrlAccessed: (shortCode: string, ip?: string, userAgent?: string) => {
    logger.info('URL accessed', {
      business: true,
      action: 'url_accessed',
      shortCode,
      ip,
      userAgent,
      timestamp: new Date().toISOString(),
    });
  },

  logApiKeyUsed: (apiKeyId: string, endpoint: string, userId?: number) => {
    logger.info('API key used', {
      business: true,
      action: 'api_key_used',
      apiKeyId,
      endpoint,
      userId,
      timestamp: new Date().toISOString(),
    });
  },
};
