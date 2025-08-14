import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import process from 'process';

const prisma = new PrismaClient();

async function main() {
  logger.info('🌱 Starting database seeding...');

  // Add sample data for development
  const sampleUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewreZhO5hQ8K6Rb.',
      name: 'Admin User',
    },
  });

  logger.info(`👤 Created user: ${sampleUser.email}`);

  // Add sample URLs
  const sampleUrls = [
    {
      shortCode: 'github',
      originalUrl: 'https://github.com',
      title: 'GitHub',
      description: 'GitHub Development Platform',
      userId: sampleUser.id,
    },
    {
      shortCode: 'google',
      originalUrl: 'https://google.com',
      title: 'Google',
      description: 'Google Search Engine',
      userId: sampleUser.id,
    },
  ];

  for (const urlData of sampleUrls) {
    const url = await prisma.url.upsert({
      where: { shortCode: urlData.shortCode },
      update: {},
      create: urlData,
    });
    logger.info(`🔗 Created URL: ${url.shortCode} -> ${url.originalUrl}`);
  }

  logger.info('✅ Database seeding completed!');
}

main()
  .catch((e) => {
    logger.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
