import { PrismaClient } from '@prisma/client';
import { beforeAll, afterAll, beforeEach } from '@jest/globals';
import process from 'process';

// Use a separate test database URL if available
const testDatabaseUrl =
  process.env['TEST_DATABASE_URL'] || process.env['DATABASE_URL'];

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: testDatabaseUrl,
    },
  },
  log: process.env['NODE_ENV'] === 'test' ? [] : ['error'],
});

beforeAll(async () => {
  // Connect to test database
  await prisma.$connect();

  // Ensure we're using a test database
  if (!testDatabaseUrl?.includes('test')) {
    // Use a simple log message instead of console for now
    process.stdout.write(
      '⚠️  Warning: Not using a test database. Set TEST_DATABASE_URL environment variable.\n'
    );
  }
});

afterAll(async () => {
  // Clean up and disconnect
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Clean database before each test
  try {
    const tablenames = await prisma.$queryRaw<
      Array<{ tablename: string }>
    >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

    const tables = tablenames
      .map(({ tablename }) => tablename)
      .filter((name) => name !== '_prisma_migrations')
      .map((name) => `"public"."${name}"`)
      .join(', ');

    if (tables) {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
    }
  } catch (error) {
    // Use process.stderr instead of console for error logging
    process.stderr.write(`Error cleaning test database: ${error}\n`);
  }
});

// Export prisma instance for use in tests
export { prisma };

// Test utilities
export const createTestUser = async () => {
  return await prisma.user.create({
    data: {
      email: 'test@example.com',
      password: 'hashedpassword123',
      name: 'Test User',
    },
  });
};

export const createTestUrl = async (userId?: number) => {
  return await prisma.url.create({
    data: {
      shortCode: 'test123',
      originalUrl: 'https://example.com',
      title: 'Test URL',
      description: 'A test URL',
      userId: userId,
    },
  });
};

export const cleanupTestData = async () => {
  await prisma.analytics.deleteMany();
  await prisma.url.deleteMany();
  await prisma.user.deleteMany();
};
