import { logger } from '../utils/logger.js';

/**
 * Simple APM (Application Performance Monitoring) service
 * Tracks response times, database queries, cache hits/misses, and errors
 * 
 * This is a lightweight alternative to full APM solutions like New Relic/DataDog
 * For production, consider integrating with a proper APM service
 */

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  tags?: Record<string, string>;
  success: boolean;
}

interface AggregatedMetrics {
  count: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  p50: number;
  p95: number;
  p99: number;
  successRate: number;
}

class APMService {
  private metrics: PerformanceMetric[] = [];
  private maxMetricsStorage = 10000; // Store last 10k metrics
  private flushInterval: NodeJS.Timeout | null = null;

  /**
   * Start APM monitoring
   */
  start(intervalMs = 60000): void {
    logger.info('🔍 Starting APM (Application Performance Monitoring)');
    
    // Flush metrics periodically
    this.flushInterval = setInterval(() => {
      this.logAggregatedMetrics();
    }, intervalMs);
  }

  /**
   * Stop APM monitoring
   */
  stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
      logger.info('APM monitoring stopped');
    }
  }

  /**
   * Record a performance metric
   */
  recordMetric(name: string, duration: number, success = true, tags?: Record<string, string>): void {
    const metric: PerformanceMetric = {
      name,
      duration,
      timestamp: Date.now(),
      success,
      tags,
    };

    this.metrics.push(metric);

    // Prevent memory leaks by limiting stored metrics
    if (this.metrics.length > this.maxMetricsStorage) {
      this.metrics.shift();
    }

    // Log slow operations
    if (duration > 1000) {
      logger.warn('⚠️  Slow operation detected', {
        name,
        duration: `${duration}ms`,
        tags,
      });
    }
  }

  /**
   * Start timing an operation
   */
  startTimer(name: string, tags?: Record<string, string>): (success?: boolean) => void {
    const startTime = Date.now();
    
    return (success = true) => {
      const duration = Date.now() - startTime;
      this.recordMetric(name, duration, success, tags);
    };
  }

  /**
   * Decorator/wrapper for timing async functions
   */
  async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    tags?: Record<string, string>
  ): Promise<T> {
    const endTimer = this.startTimer(name, tags);
    try {
      const result = await fn();
      endTimer(true);
      return result;
    } catch (error) {
      endTimer(false);
      throw error;
    }
  }

  /**
   * Get metrics for a specific operation
   */
  getMetrics(name: string, since?: number): PerformanceMetric[] {
    const cutoff = since || Date.now() - 60000; // Last minute by default
    return this.metrics.filter(
      (m) => m.name === name && m.timestamp >= cutoff
    );
  }

  /**
   * Calculate aggregated metrics
   */
  private aggregateMetrics(metrics: PerformanceMetric[]): AggregatedMetrics | null {
    if (metrics.length === 0) {
      return null;
    }

    const durations = metrics.map((m) => m.duration).sort((a, b) => a - b);
    const successCount = metrics.filter((m) => m.success).length;

    const p50Index = Math.floor(durations.length * 0.5);
    const p95Index = Math.floor(durations.length * 0.95);
    const p99Index = Math.floor(durations.length * 0.99);

    return {
      count: metrics.length,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: durations[0] ?? 0,
      maxDuration: durations[durations.length - 1] ?? 0,
      p50: durations[p50Index] ?? 0,
      p95: durations[p95Index] ?? 0,
      p99: durations[p99Index] ?? 0,
      successRate: (successCount / metrics.length) * 100,
    };
  }

  /**
   * Log aggregated metrics for all operations
   */
  private logAggregatedMetrics(): void {
    const cutoff = Date.now() - 60000; // Last minute
    const recentMetrics = this.metrics.filter((m) => m.timestamp >= cutoff);

    if (recentMetrics.length === 0) {
      return;
    }

    // Group by operation name
    const metricsByName = new Map<string, PerformanceMetric[]>();
    for (const metric of recentMetrics) {
      const existing = metricsByName.get(metric.name) || [];
      existing.push(metric);
      metricsByName.set(metric.name, existing);
    }

    logger.info('📊 APM Metrics (last minute):');
    
    for (const [name, metrics] of metricsByName.entries()) {
      const agg = this.aggregateMetrics(metrics);
      if (agg) {
        logger.info(`  ${name}:`, {
          count: agg.count,
          avg: `${agg.avgDuration.toFixed(2)}ms`,
          p50: `${agg.p50}ms`,
          p95: `${agg.p95}ms`,
          p99: `${agg.p99}ms`,
          successRate: `${agg.successRate.toFixed(1)}%`,
        });
      }
    }
  }

  /**
   * Get current stats summary
   */
  getStats(since?: number): Record<string, AggregatedMetrics> {
    const cutoff = since || Date.now() - 60000;
    const recentMetrics = this.metrics.filter((m) => m.timestamp >= cutoff);

    const metricsByName = new Map<string, PerformanceMetric[]>();
    for (const metric of recentMetrics) {
      const existing = metricsByName.get(metric.name) || [];
      existing.push(metric);
      metricsByName.set(metric.name, existing);
    }

    const stats: Record<string, AggregatedMetrics> = {};
    for (const [name, metrics] of metricsByName.entries()) {
      const agg = this.aggregateMetrics(metrics);
      if (agg) {
        stats[name] = agg;
      }
    }

    return stats;
  }

  /**
   * Clear all stored metrics
   */
  clear(): void {
    this.metrics = [];
    logger.info('APM metrics cleared');
  }
}

// Export singleton instance
export const apmService = new APMService();

/**
 * Express middleware for automatic request timing
 */
export const apmMiddleware = (req: any, res: any, next: any): void => {
  const startTime = Date.now();

  // Hook into response finish
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const success = res.statusCode < 400;
    
    apmService.recordMetric('http.request', duration, success, {
      method: req.method,
      path: req.route?.path || req.path,
      status: String(res.statusCode),
    });
  });

  next();
};
