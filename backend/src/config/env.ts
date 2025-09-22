import * as dotenv from 'dotenv';

dotenv.config();

interface Config {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
  BASE_URL: string;
  SHORT_CODE_LENGTH: number;
  CORS_ORIGIN: string;
  LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug';
  LOG_FILE_PATH: string;
  REDIS_URL?: string;
  BCRYPT_SALT_ROUNDS: number;
}

const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Environment variable ${key} is required`);
  }
  return value;
};

const getEnvNumber = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  return value ? parseInt(value, 10) : defaultValue;
};

export const config: Config = {
  NODE_ENV: (process.env['NODE_ENV'] as Config['NODE_ENV']) || 'development',
  PORT: getEnvNumber('PORT', 3000),
  DATABASE_URL: getEnvVar('DATABASE_URL'),
  JWT_SECRET: getEnvVar('JWT_SECRET'),
  JWT_EXPIRES_IN: getEnvVar('JWT_EXPIRES_IN', '24h'),
  RATE_LIMIT_WINDOW_MS: getEnvNumber('RATE_LIMIT_WINDOW_MS', 900000),
  RATE_LIMIT_MAX_REQUESTS: getEnvNumber('RATE_LIMIT_MAX_REQUESTS', 100),
  BASE_URL: getEnvVar('BASE_URL', 'http://localhost:3000'),
  SHORT_CODE_LENGTH: getEnvNumber('SHORT_CODE_LENGTH', 7),
  CORS_ORIGIN: getEnvVar('CORS_ORIGIN', 'http://localhost:3001'),
  LOG_LEVEL: (process.env['LOG_LEVEL'] as Config['LOG_LEVEL']) || 'info',
  LOG_FILE_PATH: getEnvVar('LOG_FILE_PATH', 'logs/app.log'),
  REDIS_URL: process.env['REDIS_URL'] || undefined,
  BCRYPT_SALT_ROUNDS: getEnvNumber('BCRYPT_SALT_ROUNDS', 12),
};

export const isDevelopment = config.NODE_ENV === 'development';
export const isProduction = config.NODE_ENV === 'production';
export const isTest = config.NODE_ENV === 'test';
