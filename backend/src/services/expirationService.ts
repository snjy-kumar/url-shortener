import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { CacheService } from './cacheService';

export class ExpirationService {
  private static readonly CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds
  private static readonly BATCH_SIZE = 100;
  private static cleanupTimer: NodeJS.Timeout | null = null;

  /**
   * Start the automatic cleanup process
   */
  static startCleanupProcess(): void {
    if (this.cleanupTimer) {
      logger.warn('Cleanup process is already running');
      return;
    }

    logger.info('Starting URL expiration cleanup process');

    // Run immediately on start
    this.performCleanup();

    // Schedule recurring cleanup
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Stop the automatic cleanup process
   */
  static stopCleanupProcess(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      logger.info('URL expiration cleanup process stopped');
    }
  }

  /**
   * Perform the actual cleanup operation
   */
  static async performCleanup(): Promise<{ cleaned: number; errors: number }> {
    try {
      logger.info('Starting URL expiration cleanup');

      const startTime = Date.now();
      let totalCleaned = 0;
      let totalErrors = 0;

      // Find expired URLs in batches
      let hasMore = true;
      while (hasMore) {
        const expiredUrls = await prisma.url.findMany({
          where: {
            expiresAt: {
              lte: new Date(),
            },
            isActive: true,
          },
          select: {
            id: true,
            shortCode: true,
            customAlias: true,
            expiresAt: true,
          },
          take: this.BATCH_SIZE,
        });

        if (expiredUrls.length === 0) {
          hasMore = false;
          break;
        }

        // Process batch
        const { cleaned, errors } = await this.processBatch(expiredUrls);
        totalCleaned += cleaned;
        totalErrors += errors;

        // If we got less than batch size, we're done
        if (expiredUrls.length < this.BATCH_SIZE) {
          hasMore = false;
        }
      }

      const duration = Date.now() - startTime;

      logger.info('URL expiration cleanup completed', {
        cleaned: totalCleaned,
        errors: totalErrors,
        duration: `${duration}ms`,
      });

      return { cleaned: totalCleaned, errors: totalErrors };
    } catch (error) {
      logger.error('Error during URL expiration cleanup:', error);
      return { cleaned: 0, errors: 1 };
    }
  }

  /**
   * Process a batch of expired URLs
   */
  private static async processBatch(
    expiredUrls: Array<{
      id: number;
      shortCode: string;
      customAlias: string | null;
      expiresAt: Date | null;
    }>
  ): Promise<{ cleaned: number; errors: number }> {
    let cleaned = 0;
    let errors = 0;

    const urlIds = expiredUrls.map((url) => url.id);

    try {
      // Soft delete expired URLs
      const updateResult = await prisma.url.updateMany({
        where: {
          id: {
            in: urlIds,
          },
        },
        data: {
          isActive: false,
          updatedAt: new Date(),
        },
      });

      cleaned = updateResult.count;

      // Invalidate cache for each expired URL
      await Promise.all(
        expiredUrls.map(async (url) => {
          try {
            await CacheService.invalidateUrl(url.shortCode);
            if (url.customAlias) {
              await CacheService.invalidateUrl(url.customAlias);
            }
          } catch (cacheError) {
            logger.warn('Failed to invalidate cache for expired URL:', {
              shortCode: url.shortCode,
              error: cacheError,
            });
          }
        })
      );

      logger.debug(`Processed batch: ${cleaned} URLs marked as inactive`);
    } catch (error) {
      logger.error('Error processing batch of expired URLs:', error);
      errors = expiredUrls.length;
    }

    return { cleaned, errors };
  }

  /**
   * Get statistics about upcoming expirations
   */
  static async getExpirationStats(): Promise<{
    expiredCount: number;
    expiringIn24h: number;
    expiringIn7days: number;
    expiringIn30days: number;
  }> {
    try {
      const now = new Date();
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const in30days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const [expiredCount, expiringIn24h, expiringIn7days, expiringIn30days] =
        await Promise.all([
          prisma.url.count({
            where: {
              expiresAt: { lte: now },
              isActive: true,
            },
          }),
          prisma.url.count({
            where: {
              expiresAt: { gte: now, lte: in24h },
              isActive: true,
            },
          }),
          prisma.url.count({
            where: {
              expiresAt: { gte: now, lte: in7days },
              isActive: true,
            },
          }),
          prisma.url.count({
            where: {
              expiresAt: { gte: now, lte: in30days },
              isActive: true,
            },
          }),
        ]);

      return {
        expiredCount,
        expiringIn24h,
        expiringIn7days,
        expiringIn30days,
      };
    } catch (error) {
      logger.error('Error getting expiration stats:', error);
      return {
        expiredCount: 0,
        expiringIn24h: 0,
        expiringIn7days: 0,
        expiringIn30days: 0,
      };
    }
  }

  /**
   * Manually clean up specific URLs by ID
   */
  static async cleanupSpecificUrls(
    urlIds: number[]
  ): Promise<{ cleaned: number; errors: number }> {
    try {
      const now = new Date();

      const updateResult = await prisma.url.updateMany({
        where: {
          id: { in: urlIds },
          expiresAt: { lte: now },
          isActive: true,
        },
        data: {
          isActive: false,
          updatedAt: new Date(),
        },
      });

      // Get the URLs that were updated for cache invalidation
      const updatedUrls = await prisma.url.findMany({
        where: {
          id: { in: urlIds },
          isActive: false,
        },
        select: {
          shortCode: true,
          customAlias: true,
        },
      });

      // Invalidate cache
      await Promise.all(
        updatedUrls.map(async (url) => {
          await CacheService.invalidateUrl(url.shortCode);
          if (url.customAlias) {
            await CacheService.invalidateUrl(url.customAlias);
          }
        })
      );

      logger.info(`Manually cleaned up ${updateResult.count} expired URLs`);
      return { cleaned: updateResult.count, errors: 0 };
    } catch (error) {
      logger.error('Error manually cleaning up URLs:', error);
      return { cleaned: 0, errors: urlIds.length };
    }
  }

  /**
   * Extend expiration for specific URLs
   */
  static async extendExpiration(
    urlIds: number[],
    newExpirationDate: Date
  ): Promise<{ updated: number; errors: number }> {
    try {
      if (newExpirationDate <= new Date()) {
        throw new Error('New expiration date must be in the future');
      }

      const updateResult = await prisma.url.updateMany({
        where: {
          id: { in: urlIds },
          isActive: true,
        },
        data: {
          expiresAt: newExpirationDate,
          updatedAt: new Date(),
        },
      });

      // Get the URLs that were updated for cache invalidation
      const updatedUrls = await prisma.url.findMany({
        where: {
          id: { in: urlIds },
        },
        select: {
          shortCode: true,
          customAlias: true,
        },
      });

      // Invalidate cache to refresh with new expiration
      await Promise.all(
        updatedUrls.map(async (url) => {
          await CacheService.invalidateUrl(url.shortCode);
          if (url.customAlias) {
            await CacheService.invalidateUrl(url.customAlias);
          }
        })
      );

      logger.info(`Extended expiration for ${updateResult.count} URLs`);
      return { updated: updateResult.count, errors: 0 };
    } catch (error) {
      logger.error('Error extending URL expiration:', error);
      return { updated: 0, errors: urlIds.length };
    }
  }

  /**
   * Validate expiration date
   */
  static validateExpirationDate(expirationDate: string | Date): Date {
    const date =
      typeof expirationDate === 'string'
        ? new Date(expirationDate)
        : expirationDate;

    if (isNaN(date.getTime())) {
      throw new Error('Invalid expiration date format');
    }

    if (date <= new Date()) {
      throw new Error('Expiration date must be in the future');
    }

    // Optional: Set maximum expiration (e.g., 10 years)
    const maxExpiration = new Date();
    maxExpiration.setFullYear(maxExpiration.getFullYear() + 10);

    if (date > maxExpiration) {
      throw new Error(
        'Expiration date cannot be more than 10 years in the future'
      );
    }

    return date;
  }

  /**
   * Health check for expiration service
   */
  static getStatus(): { running: boolean; nextCleanup: Date | null } {
    return {
      running: this.cleanupTimer !== null,
      nextCleanup: this.cleanupTimer
        ? new Date(Date.now() + this.CLEANUP_INTERVAL)
        : null,
    };
  }
}
