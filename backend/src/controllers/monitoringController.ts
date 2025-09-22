import { Request, Response, NextFunction } from 'express';
import { ErrorHandlingService } from '../services/errorHandlingService';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: { id: number; email: string; role: string };
}

export class MonitoringController {
  /**
   * Get error metrics and analytics
   * GET /api/v1/monitoring/errors
   */
  static async getErrorMetrics(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const metrics = await ErrorHandlingService.getErrorMetrics();
      const healthCheck = await ErrorHandlingService.healthCheck();

      res.json({
        success: true,
        data: {
          ...metrics,
          healthStatus: healthCheck.status,
          healthDetails: healthCheck.details,
        },
      });
    } catch (error) {
      logger.error('Error getting error metrics:', error);
      next(error);
    }
  }

  /**
   * Get recent errors
   * GET /api/v1/monitoring/errors/recent
   */
  static async getRecentErrors(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { limit = 50 } = req.query;
      const limitNumber = Math.min(parseInt(limit as string) || 50, 200);

      const errors = await ErrorHandlingService.getRecentErrors(limitNumber);

      res.json({
        success: true,
        data: errors,
        total: errors.length,
        limit: limitNumber,
      });
    } catch (error) {
      logger.error('Error getting recent errors:', error);
      next(error);
    }
  }

  /**
   * Get specific error by ID
   * GET /api/v1/monitoring/errors/:errorId
   */
  static async getErrorById(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { errorId } = req.params;

      if (!errorId) {
        res.status(400).json({
          success: false,
          message: 'Error ID is required',
        });
        return;
      }

      const error = await ErrorHandlingService.getErrorById(errorId);

      if (!error) {
        res.status(404).json({
          success: false,
          message: 'Error not found',
        });
        return;
      }

      res.json({
        success: true,
        data: error,
      });
    } catch (error) {
      logger.error('Error getting error by ID:', error);
      next(error);
    }
  }

  /**
   * Get audit trail
   * GET /api/v1/monitoring/audit
   */
  static async getAuditTrail(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { limit = 100, userId, action, resource } = req.query;
      const limitNumber = Math.min(parseInt(limit as string) || 100, 500);

      const auditTrail = await ErrorHandlingService.getAuditTrail(limitNumber);

      // Filter audit trail based on query parameters
      let filteredAudit = auditTrail;

      if (userId) {
        const userIdNumber = parseInt(userId as string);
        filteredAudit = filteredAudit.filter(
          (entry) => entry.userId === userIdNumber
        );
      }

      if (action) {
        filteredAudit = filteredAudit.filter((entry) =>
          entry.action.toLowerCase().includes((action as string).toLowerCase())
        );
      }

      if (resource) {
        filteredAudit = filteredAudit.filter((entry) =>
          entry.resource
            .toLowerCase()
            .includes((resource as string).toLowerCase())
        );
      }

      res.json({
        success: true,
        data: filteredAudit,
        total: filteredAudit.length,
        limit: limitNumber,
        filters: { userId, action, resource },
      });
    } catch (error) {
      logger.error('Error getting audit trail:', error);
      next(error);
    }
  }

  /**
   * Get monitoring dashboard data
   * GET /api/v1/monitoring/dashboard
   */
  static async getDashboard(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const [errorMetrics, recentErrors, auditTrail, errorHealthCheck] =
        await Promise.all([
          ErrorHandlingService.getErrorMetrics(),
          ErrorHandlingService.getRecentErrors(10),
          ErrorHandlingService.getAuditTrail(20),
          ErrorHandlingService.healthCheck(),
        ]);

      // Calculate additional statistics
      const now = Date.now();
      const oneHourAgo = now - 3600000;
      const oneDayAgo = now - 86400000;

      const errorsLastHour = recentErrors.filter(
        (error) => error.timestamp > oneHourAgo
      );
      const errorsLast24Hours = recentErrors.filter(
        (error) => error.timestamp > oneDayAgo
      );

      const criticalErrorsLast24h = errorsLast24Hours.filter(
        (error) => error.severity === 'critical'
      ).length;

      const auditFailuresLast24h = auditTrail.filter(
        (entry) => !entry.success && entry.timestamp > oneDayAgo
      ).length;

      const dashboard = {
        overview: {
          totalErrors: errorMetrics.totalErrors,
          errorRate: errorMetrics.errorRate,
          errorsLastHour: errorsLastHour.length,
          errorsLast24Hours: errorsLast24Hours.length,
          criticalErrorsLast24h,
          auditFailuresLast24h,
          healthStatus: errorHealthCheck.status,
        },
        errorDistribution: {
          byCategory: errorMetrics.errorsByCategory,
          bySeverity: errorMetrics.errorsBySeverity,
          byStatusCode: errorMetrics.errorsByStatusCode,
          byEndpoint: Object.entries(errorMetrics.errorsByEndpoint)
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .slice(0, 10)
            .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {}),
        },
        topErrors: errorMetrics.topErrors.slice(0, 10),
        recentErrors: recentErrors.slice(0, 5),
        recentAuditEntries: auditTrail.slice(0, 10),
        trends: {
          errorTrend: this.calculateTrend(recentErrors),
          auditTrend: this.calculateTrend(auditTrail),
        },
      };

      res.json({
        success: true,
        data: dashboard,
        timestamp: now,
      });
    } catch (error) {
      logger.error('Error getting monitoring dashboard:', error);
      next(error);
    }
  }

  /**
   * Cleanup old errors and audit entries
   * POST /api/v1/monitoring/cleanup
   */
  static async cleanup(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      await ErrorHandlingService.cleanup();

      // Log the cleanup action
      await ErrorHandlingService.logAudit(
        'cleanup_performed',
        'monitoring',
        req,
        true,
        undefined,
        { performedBy: req.user?.id }
      );

      res.json({
        success: true,
        message: 'Cleanup completed successfully',
      });
    } catch (error) {
      logger.error('Error performing cleanup:', error);
      next(error);
    }
  }

  /**
   * Get system health status
   * GET /api/v1/monitoring/health
   */
  static async getSystemHealth(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const errorHealthCheck = await ErrorHandlingService.healthCheck();

      // Add other health checks here (database, cache, etc.)
      const healthStatus = {
        overall: 'healthy',
        timestamp: Date.now(),
        services: {
          errorHandling: errorHealthCheck,
          // Add other service health checks
        },
      };

      // Determine overall health
      const isUnhealthy = Object.values(healthStatus.services).some(
        (service) => service.status === 'unhealthy'
      );

      if (isUnhealthy) {
        healthStatus.overall = 'unhealthy';
      }

      const statusCode = healthStatus.overall === 'healthy' ? 200 : 503;

      res.status(statusCode).json({
        success: healthStatus.overall === 'healthy',
        data: healthStatus,
      });
    } catch (error) {
      logger.error('Error getting system health:', error);
      res.status(503).json({
        success: false,
        message: 'Health check failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Export error data
   * GET /api/v1/monitoring/export/errors
   */
  static async exportErrors(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { format = 'json', days = 7 } = req.query;
      const daysNumber = Math.min(parseInt(days as string) || 7, 30);
      const cutoffTime = Date.now() - daysNumber * 24 * 60 * 60 * 1000;

      const errors = await ErrorHandlingService.getRecentErrors(1000);
      const filteredErrors = errors.filter(
        (error) => error.timestamp > cutoffTime
      );

      if (format === 'csv') {
        // Convert to CSV format
        const csvHeaders = [
          'ID',
          'Timestamp',
          'Category',
          'Severity',
          'Message',
          'Status Code',
          'IP',
          'Endpoint',
          'Method',
          'User ID',
        ];

        const csvRows = filteredErrors.map((error) => [
          error.id,
          new Date(error.timestamp).toISOString(),
          error.category,
          error.severity,
          `"${error.message.replace(/"/g, '""')}"`,
          error.statusCode,
          error.ip || '',
          error.endpoint || '',
          error.method || '',
          error.userId || '',
        ]);

        const csvContent = [
          csvHeaders.join(','),
          ...csvRows.map((row) => row.join(',')),
        ].join('\n');

        res.set({
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="errors_${daysNumber}days.csv"`,
        });

        res.send(csvContent);
      } else {
        // JSON format
        res.set({
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="errors_${daysNumber}days.json"`,
        });

        res.json({
          exportInfo: {
            generatedAt: new Date().toISOString(),
            daysCovered: daysNumber,
            totalErrors: filteredErrors.length,
          },
          data: filteredErrors,
        });
      }

      // Log the export action
      await ErrorHandlingService.logAudit(
        'data_export',
        'monitoring',
        req,
        true,
        undefined,
        {
          type: 'errors',
          format,
          days: daysNumber,
          count: filteredErrors.length,
        }
      );
    } catch (error) {
      logger.error('Error exporting errors:', error);
      next(error);
    }
  }

  /**
   * Calculate trend for time-series data
   */
  private static calculateTrend(entries: Array<{ timestamp: number }>): string {
    if (entries.length < 2) return 'stable';

    const now = Date.now();
    const oneHourAgo = now - 3600000;
    const twoHoursAgo = now - 7200000;

    const recentCount = entries.filter(
      (entry) => entry.timestamp > oneHourAgo
    ).length;
    const previousCount = entries.filter(
      (entry) => entry.timestamp > twoHoursAgo && entry.timestamp <= oneHourAgo
    ).length;

    if (recentCount > previousCount * 1.2) return 'increasing';
    if (recentCount < previousCount * 0.8) return 'decreasing';
    return 'stable';
  }
}
