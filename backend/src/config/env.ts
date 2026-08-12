import * as dotenv from 'dotenv';

dotenv.config();

interface Config {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  DATABASE_URL: string;
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
  AUTH_RATE_LIMIT_MAX_REQUESTS: number;
  GUEST_CREATE_RATE_LIMIT_MAX_REQUESTS: number;
  BASE_URL: string;
  SHORT_CODE_LENGTH: number;
  CORS_ORIGIN: string;
  LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug';
  LOG_FILE_PATH: string;
  TRUST_PROXY: boolean;
  CLERK_PUBLISHABLE_KEY: string;
  CLERK_SECRET_KEY: string;
  CLERK_WEBHOOK_SIGNING_SECRET: string | undefined;
  CLERK_AUTHORIZED_PARTIES: string[];
  ADMIN_CLERK_USER_IDS: string[];
  REDIS_URL: string | undefined;
  REDIRECT_CACHE_TTL_SECONDS: number;
  TURNSTILE_SECRET_KEY: string | undefined;
  TURNSTILE_REQUIRED_IN_PROD: boolean;
  SAFE_BROWSING_API_KEY: string | undefined;
  SAFE_BROWSING_FAIL_CLOSED: boolean;
}

const required = (key: string, fallback?: string): string => {
  const value = process.env[key] || fallback;
  if (!value) {
    throw new Error(`Environment variable ${key} is required`);
  }
  return value;
};

const number = (key: string, fallback: number): number => {
  const raw = process.env[key];
  if (!raw) {
    return fallback;
  }
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`${key} must be a number`);
  }
  return parsed;
};

const nodeEnv = (process.env['NODE_ENV'] as Config['NODE_ENV']) || 'development';

if (nodeEnv === 'production') {
  if (!process.env['BASE_URL'] || process.env['BASE_URL'].includes('localhost')) {
    throw new Error('BASE_URL must be a production URL');
  }
}

const corsOriginRaw = required('CORS_ORIGIN');
const corsOrigins = corsOriginRaw
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

if (nodeEnv === 'production' && corsOrigins.includes('*')) {
  throw new Error('CORS_ORIGIN must not include * in production');
}

/** Origins allowed to mint JWTs accepted by this API (excludes wildcard). */
const authorizedParties = corsOrigins.filter((o) => o !== '*');

if (nodeEnv === 'production' && authorizedParties.length === 0) {
  throw new Error(
    'CORS_ORIGIN must list explicit frontend origin(s) for JWT party checks'
  );
}

export const config: Config = {
  NODE_ENV: nodeEnv,
  PORT: number('PORT', 3000),
  DATABASE_URL: required('DATABASE_URL'),
  RATE_LIMIT_WINDOW_MS: number('RATE_LIMIT_WINDOW_MS', 900000),
  RATE_LIMIT_MAX_REQUESTS: number('RATE_LIMIT_MAX_REQUESTS', 100),
  AUTH_RATE_LIMIT_MAX_REQUESTS: number('AUTH_RATE_LIMIT_MAX_REQUESTS', 60),
  GUEST_CREATE_RATE_LIMIT_MAX_REQUESTS: number(
    'GUEST_CREATE_RATE_LIMIT_MAX_REQUESTS',
    20
  ),
  BASE_URL: required('BASE_URL'),
  SHORT_CODE_LENGTH: number('SHORT_CODE_LENGTH', 7),
  CORS_ORIGIN: corsOriginRaw,
  LOG_LEVEL: (process.env['LOG_LEVEL'] as Config['LOG_LEVEL']) || 'info',
  LOG_FILE_PATH: required('LOG_FILE_PATH', 'logs/app.log'),
  TRUST_PROXY: (process.env['TRUST_PROXY'] || 'false').toLowerCase() === 'true',
  CLERK_PUBLISHABLE_KEY: required('CLERK_PUBLISHABLE_KEY'),
  CLERK_SECRET_KEY: required('CLERK_SECRET_KEY'),
  CLERK_WEBHOOK_SIGNING_SECRET: process.env['CLERK_WEBHOOK_SIGNING_SECRET'],
  CLERK_AUTHORIZED_PARTIES: authorizedParties,
  ADMIN_CLERK_USER_IDS: (process.env['ADMIN_CLERK_USER_IDS'] || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean),
  REDIS_URL: process.env['REDIS_URL'] || undefined,
  REDIRECT_CACHE_TTL_SECONDS: number('REDIRECT_CACHE_TTL_SECONDS', 300),
  TURNSTILE_SECRET_KEY: process.env['TURNSTILE_SECRET_KEY'] || undefined,
  TURNSTILE_REQUIRED_IN_PROD:
    (process.env['TURNSTILE_REQUIRED_IN_PROD'] || 'false').toLowerCase() ===
    'true',
  SAFE_BROWSING_API_KEY: process.env['SAFE_BROWSING_API_KEY'] || undefined,
  SAFE_BROWSING_FAIL_CLOSED:
    (process.env['SAFE_BROWSING_FAIL_CLOSED'] || 'false').toLowerCase() ===
    'true',
};
