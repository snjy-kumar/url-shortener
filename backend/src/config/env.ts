import * as dotenv from 'dotenv';

dotenv.config();

interface Config {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  JWT_REFRESH_SECRET: string;
  JWT_REFRESH_EXPIRES_IN: string;
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
  BASE_URL: string;
  SHORT_CODE_LENGTH: number;
  CORS_ORIGIN: string;
  LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug';
  LOG_FILE_PATH: string;
  REDIS_URL?: string;
  BCRYPT_SALT_ROUNDS: number;
  MAX_LOGIN_ATTEMPTS: number;
  LOCK_TIME: number;
  EMAIL_VERIFICATION_EXPIRES: number;
  PASSWORD_RESET_EXPIRES: number;
  TRUST_PROXY: boolean;
}

const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Environment variable ${key} is required`);
  }
  return value;
};

const getEnvNumber = (key: string, defaultValue?: number): number => {
  const value = process.env[key];
  if (value) {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      throw new Error(`Environment variable ${key} must be a number`);
    }
    return parsed;
  }
  if (defaultValue === undefined) {
    throw new Error(`Environment variable ${key} is required`);
  }
  return defaultValue;
};

const getEnvBoolean = (key: string, defaultValue: boolean): boolean => {
  const value = process.env[key];
  if (!value) {return defaultValue;}
  return value.toLowerCase() === 'true';
};

// Validate critical env vars in production
const validateProductionConfig = () => {
  const nodeEnv = process.env['NODE_ENV'] || 'development';
  if (nodeEnv === 'production') {
    const jwtSecret = process.env['JWT_SECRET'];
    const jwtRefreshSecret = process.env['JWT_REFRESH_SECRET'];
    
    if (!jwtSecret || jwtSecret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters in production');
    }
    if (!jwtRefreshSecret || jwtRefreshSecret.length < 32) {
      throw new Error('JWT_REFRESH_SECRET must be at least 32 characters in production');
    }
    if (jwtSecret === jwtRefreshSecret) {
      throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be different');
    }
    if (!process.env['DATABASE_URL']) {
      throw new Error('DATABASE_URL is required in production');
    }
    if (!process.env['BASE_URL'] || process.env['BASE_URL'].includes('localhost')) {
      throw new Error('BASE_URL must be set to production URL');
    }
  }
};

validateProductionConfig();

export const config: Config = {
  NODE_ENV: (process.env['NODE_ENV'] as Config['NODE_ENV']) || 'development',
  PORT: getEnvNumber('PORT', 3000),
  DATABASE_URL: getEnvVar('DATABASE_URL'),
  JWT_SECRET: getEnvVar('JWT_SECRET'),
  JWT_EXPIRES_IN: getEnvVar('JWT_EXPIRES_IN', '24h'),
  JWT_REFRESH_SECRET: getEnvVar('JWT_REFRESH_SECRET'),
  JWT_REFRESH_EXPIRES_IN: getEnvVar('JWT_REFRESH_EXPIRES_IN', '7d'),
  RATE_LIMIT_WINDOW_MS: getEnvNumber('RATE_LIMIT_WINDOW_MS', 900000),
  RATE_LIMIT_MAX_REQUESTS: getEnvNumber('RATE_LIMIT_MAX_REQUESTS', 100),
  BASE_URL: getEnvVar('BASE_URL'),
  SHORT_CODE_LENGTH: getEnvNumber('SHORT_CODE_LENGTH', 7),
  CORS_ORIGIN: getEnvVar('CORS_ORIGIN'),
  LOG_LEVEL: (process.env['LOG_LEVEL'] as Config['LOG_LEVEL']) || 'info',
  LOG_FILE_PATH: getEnvVar('LOG_FILE_PATH', 'logs/app.log'),
  REDIS_URL: process.env['REDIS_URL'] || undefined,
  BCRYPT_SALT_ROUNDS: getEnvNumber('BCRYPT_SALT_ROUNDS', 12),
  MAX_LOGIN_ATTEMPTS: getEnvNumber('MAX_LOGIN_ATTEMPTS', 5),
  LOCK_TIME: getEnvNumber('LOCK_TIME', 2 * 60 * 60 * 1000),
  EMAIL_VERIFICATION_EXPIRES: getEnvNumber(
    'EMAIL_VERIFICATION_EXPIRES',
    24 * 60 * 60 * 1000
  ),
  PASSWORD_RESET_EXPIRES: getEnvNumber(
    'PASSWORD_RESET_EXPIRES',
    60 * 60 * 1000
  ),
  TRUST_PROXY: getEnvBoolean('TRUST_PROXY', true),
};

export const isDevelopment = config.NODE_ENV === 'development';
export const isProduction = config.NODE_ENV === 'production';
export const isTest = config.NODE_ENV === 'test';
