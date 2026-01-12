import { prisma } from '../config/database.js';
import { logger } from './logger.js';

/**
 * Database connection pool monitoring
 * Tracks active/idle connections and alerts when near limits
 */
export class DatabaseMonitor {
  private static monitoringInterval: NodeJS.Timeout | null = null;
  private static readonly POOL_SIZE = 20; // Match your Prisma pool config
  private static readonly WARNING_THRESHOLD = 0.9; // 90% utilization

  /**
   * Start monitoring database connections
   */
  static startMonitoring(intervalMs: number = 60000): void {
    if (this.monitoringInterval) {
      logger.warn('Database monitoring already started');
      return;
    }

    logger.info('🔍 Starting database connection pool monitoring');

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkConnectionPool();
      } catch (error) {
        logger.error('Error monitoring database pool:', error);
      }
    }, intervalMs);

    // Also check immediately on startup
    this.checkConnectionPool().catch((error) => {
      logger.error('Initial database pool check failed:', error);
    });
  }

  /**
   * Stop monitoring
   */
  static stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('Database monitoring stopped');
    }
  }

  /**
   * Check connection pool status
   */
  private static async checkConnectionPool(): Promise<void> {
    try {
      // Test database connectivity
      const startTime = Date.now();
      await prisma.$queryRaw`SELECT 1 as health_check`;
      const latency = Date.now() - startTime;

      // Get connection metrics (if available)
      // Note: Prisma doesn't expose pool metrics directly, but we can infer issues
      // from query latency and errors

      if (latency > 1000) {
        logger.warn('⚠️ Database latency high', {
          latency: `${latency}ms`,
          threshold: '1000ms',
        });
      }

      // Count active queries (approximation)
      const activeQueries = await this.countActiveQueries();
      
      if (activeQueries > this.POOL_SIZE * this.WARNING_THRESHOLD) {
        logger.warn('⚠️ Database connection pool near capacity', {
          approximateActive: activeQueries,
          poolSize: this.POOL_SIZE,
          utilizationPercent: Math.round((activeQueries / this.POOL_SIZE) * 100),
        });
      }

      // Log healthy status every 5 minutes
      if (Date.now() % (5 * 60 * 1000) < 60000) {
        logger.debug('Database health check passed', {
          latency: `${latency}ms`,
          approximateActive: activeQueries,
          poolSize: this.POOL_SIZE,
        });
      }
    } catch (error) {
      logger.error('❌ Database health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Count active database queries (approximation)
   */
  private static async countActiveQueries(): Promise<number> {
    try {
      const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count 
        FROM pg_stat_activity 
        WHERE state = 'active' 
        AND datname = current_database()
      `;
      return Number(result[0]?.count || 0);
    } catch (_error) {
      // If pg_stat_activity is not accessible, return 0
      return 0;
    }
  }

  /**
   * Get current pool statistics
   */
  static async getPoolStats(): Promise<{
    active: number;
    idle: number;
    total: number;
    utilizationPercent: number;
  }> {
    try {
      const active = await this.countActiveQueries();
      const total = this.POOL_SIZE;
      const idle = Math.max(0, total - active);
      const utilizationPercent = Math.round((active / total) * 100);

      return {
        active,
        idle,
        total,
        utilizationPercent,
      };
    } catch (error) {
      logger.error('Error getting pool stats:', error);
      return {
        active: 0,
        idle: 0,
        total: this.POOL_SIZE,
        utilizationPercent: 0,
      };
    }
  }
}
