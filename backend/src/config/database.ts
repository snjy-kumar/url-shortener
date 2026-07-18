import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { Pool } from 'pg';
import { config } from './env.js';

declare global {
  var __prisma: PrismaClient | undefined;
  var __pool: Pool | undefined;
}

const createPrismaClient = () => {
  const pool =
    globalThis.__pool ??
    new Pool({
      connectionString: config.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      statement_timeout: 60_000,
    });

  if (config.NODE_ENV !== 'production') {
    globalThis.__pool = pool;
  }

  return new PrismaClient({
    adapter: new PrismaPg(pool),
    log: config.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    errorFormat: config.NODE_ENV === 'production' ? 'minimal' : 'pretty',
  });
};

export const prisma = globalThis.__prisma ?? createPrismaClient();

if (config.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}
