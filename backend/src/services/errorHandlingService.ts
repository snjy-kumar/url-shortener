import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { CacheService } from './cacheService';

export enum ErrorCategory {
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  NOT_FOUND = 'not_found',
  RATE_LIMIT = 'rate_limit',
  SECURITY = 'security',
  DATABASE = 'database',
  CACHE = 'cache',
  EXTERNAL_API = 'external_api',
  SYSTEM = 'system',
  BUSINESS_LOGIC = 'business_logic',
  UNKNOWN = 'unknown',
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface ErrorDetails {
  id: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  originalError?: Error;
  context?: Record<string, any>;
  timestamp: number;
  ip?: string;
  userId?: number;
  userAgent?: string;
  endpoint?: string;
  method?: string;
  statusCode: number;
  stackTrace?: string;
  requestId?: string;
}

export interface ErrorMetrics {
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  errorsByStatusCode: Record<number, number>;
  errorsByEndpoint: Record<string, number>;
  recentErrors: ErrorDetails[];
  errorRate: number; // errors per minute
  topErrors: Array<{ message: string; count: number; category: ErrorCategory }>;
}

export interface AuditLogEntry {
  id: string;
  userId?: number;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;
  ip: string;
  userAgent: string;
  timestamp: number;
  success: boolean;
  errorMessage?: string;
}

export class ErrorHandlingService {
  private static readonly ERROR_CACHE_TTL = 86400; // 24 hours
  private static readonly AUDIT_CACHE_TTL = 86400 * 7; // 7 days
  private static readonly MAX_RECENT_ERRORS = 100;
  private static readonly MAX_AUDIT_ENTRIES = 1000;

  /**
   * Generate unique error ID
   */
  private static generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique audit ID
   */
  private static generateAuditId(): string {
    return `aud_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Categorize error based on error type and message
   */
  static categorizeError(
    error: Error | any,
    statusCode?: number
  ): ErrorCategory {
    if (statusCode) {
      if (statusCode === 400) return ErrorCategory.VALIDATION;
      if (statusCode === 401) return ErrorCategory.AUTHENTICATION;
      if (statusCode === 403) return ErrorCategory.AUTHORIZATION;
      if (statusCode === 404) return ErrorCategory.NOT_FOUND;
      if (statusCode === 429) return ErrorCategory.RATE_LIMIT;
    }

    const message = error?.message?.toLowerCase() || '';
    const name = error?.name?.toLowerCase() || '';

    // Database errors
    if (
      name.includes('prisma') ||
      message.includes('database') ||
      message.includes('sql')
    ) {
      return ErrorCategory.DATABASE;
    }

    // Cache errors
    if (message.includes('redis') || message.includes('cache')) {
      return ErrorCategory.CACHE;
    }

    // Security errors
    if (
      message.includes('security') ||
      message.includes('blocked') ||
      message.includes('suspicious')
    ) {
      return ErrorCategory.SECURITY;
    }

    // Validation errors
    if (
      message.includes('validation') ||
      message.includes('invalid') ||
      name.includes('validation')
    ) {
      return ErrorCategory.VALIDATION;
    }

    // External API errors
    if (
      message.includes('fetch') ||
      message.includes('axios') ||
      message.includes('request')
    ) {
      return ErrorCategory.EXTERNAL_API;
    }

    // System errors
    if (name.includes('system') || message.includes('internal')) {
      return ErrorCategory.SYSTEM;
    }

    return ErrorCategory.UNKNOWN;
  }

  /**
   * Determine error severity
   */
  static determineSeverity(
    category: ErrorCategory,
    statusCode?: number
  ): ErrorSeverity {
    // Critical errors
    if (
      category === ErrorCategory.SYSTEM ||
      category === ErrorCategory.DATABASE
    ) {
      return ErrorSeverity.CRITICAL;
    }

    // High severity errors
    if (category === ErrorCategory.SECURITY || statusCode === 500) {
      return ErrorSeverity.HIGH;
    }

    // Medium severity errors
    if (
      category === ErrorCategory.EXTERNAL_API ||
      category === ErrorCategory.CACHE
    ) {
      return ErrorSeverity.MEDIUM;
    }

    // Low severity errors (client errors)
    if (statusCode && statusCode >= 400 && statusCode < 500) {
      return ErrorSeverity.LOW;
    }

    return ErrorSeverity.MEDIUM;
  }

  /**
   * Log and track error
   */
  static async logError(
    error: Error | any,
    req?: Request,
    statusCode: number = 500,
    context?: Record<string, any>
  ): Promise<ErrorDetails> {
    const errorId = this.generateErrorId();
    const category = this.categorizeError(error, statusCode);
    const severity = this.determineSeverity(category, statusCode);

    const errorDetails: ErrorDetails = {
      id: errorId,
      category,
      severity,
      message: error?.message || 'Unknown error',
      originalError: error,
      context,
      timestamp: Date.now(),
      ip: req?.ip,
      userId: (req as any)?.user?.id,
      userAgent: req?.get('User-Agent'),
      endpoint: req?.path,
      method: req?.method,
      statusCode,
      stackTrace: error?.stack,
      requestId: (req as any)?.id,
    };

    // Log to winston logger
    const logLevel = this.getLogLevel(severity);
    logger[logLevel]('Error occurred', {
      errorId,
      category,
      severity,
      message: errorDetails.message,
      statusCode,
      ip: errorDetails.ip,
      endpoint: errorDetails.endpoint,
      method: errorDetails.method,
      userId: errorDetails.userId,
      context,
      stack: error?.stack,
    });

    // Store error for metrics
    await this.storeError(errorDetails);

    // Update error metrics
    await this.updateErrorMetrics(errorDetails);

    // Alert on critical errors
    if (severity === ErrorSeverity.CRITICAL) {
      await this.sendCriticalErrorAlert(errorDetails);
    }

    return errorDetails;
  }

  /**
   * Get winston log level for severity
   */
  private static getLogLevel(
    severity: ErrorSeverity
  ): 'error' | 'warn' | 'info' {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return 'error';
      case ErrorSeverity.MEDIUM:
        return 'warn';
      case ErrorSeverity.LOW:
      default:
        return 'info';
    }
  }

  /**
   * Store error details in cache
   */
  private static async storeError(errorDetails: ErrorDetails): Promise<void> {
    try {
      // Store individual error
      await CacheService.set(`error:${errorDetails.id}`, errorDetails, {
        ttl: this.ERROR_CACHE_TTL,
      });

      // Add to recent errors list
      const recentErrorsKey = 'errors:recent';
      const recentErrors =
        (await CacheService.get<ErrorDetails[]>(recentErrorsKey)) || [];

      recentErrors.unshift(errorDetails);
      if (recentErrors.length > this.MAX_RECENT_ERRORS) {
        recentErrors.pop();
      }

      await CacheService.set(recentErrorsKey, recentErrors, {
        ttl: this.ERROR_CACHE_TTL,
      });
    } catch (cacheError) {
      logger.error('Failed to store error in cache:', cacheError);
    }
  }

  /**
   * Update error metrics
   */
  private static async updateErrorMetrics(
    errorDetails: ErrorDetails
  ): Promise<void> {
    try {
      const metricsKey = 'errors:metrics';
      const metrics = (await CacheService.get<ErrorMetrics>(metricsKey)) || {
        totalErrors: 0,
        errorsByCategory: {} as Record<ErrorCategory, number>,
        errorsBySeverity: {} as Record<ErrorSeverity, number>,
        errorsByStatusCode: {} as Record<number, number>,
        errorsByEndpoint: {} as Record<string, number>,
        recentErrors: [],
        errorRate: 0,
        topErrors: [],
      };

      // Update counters
      metrics.totalErrors++;
      metrics.errorsByCategory[errorDetails.category] =
        (metrics.errorsByCategory[errorDetails.category] || 0) + 1;
      metrics.errorsBySeverity[errorDetails.severity] =
        (metrics.errorsBySeverity[errorDetails.severity] || 0) + 1;
      metrics.errorsByStatusCode[errorDetails.statusCode] =
        (metrics.errorsByStatusCode[errorDetails.statusCode] || 0) + 1;

      if (errorDetails.endpoint) {
        metrics.errorsByEndpoint[errorDetails.endpoint] =
          (metrics.errorsByEndpoint[errorDetails.endpoint] || 0) + 1;
      }

      // Update top errors
      const existingError = metrics.topErrors.find(
        (e) => e.message === errorDetails.message
      );
      if (existingError) {
        existingError.count++;
      } else {
        metrics.topErrors.push({
          message: errorDetails.message,
          count: 1,
          category: errorDetails.category,
        });
      }

      // Sort and limit top errors
      metrics.topErrors.sort((a, b) => b.count - a.count);
      metrics.topErrors = metrics.topErrors.slice(0, 50);

      // Calculate error rate (errors in last minute)
      const oneMinuteAgo = Date.now() - 60000;
      const recentErrors =
        (await CacheService.get<ErrorDetails[]>('errors:recent')) || [];
      metrics.errorRate = recentErrors.filter(
        (e) => e.timestamp > oneMinuteAgo
      ).length;

      await CacheService.set(metricsKey, metrics, {
        ttl: this.ERROR_CACHE_TTL,
      });
    } catch (metricsError) {
      logger.error('Failed to update error metrics:', metricsError);
    }
  }

  /**
   * Send critical error alert
   */
  private static async sendCriticalErrorAlert(
    errorDetails: ErrorDetails
  ): Promise<void> {
    try {
      // In a real implementation, this would send notifications via:
      // - Email
      // - Slack/Discord webhook
      // - SMS
      // - Monitoring service (PagerDuty, etc.)

      logger.error('CRITICAL ERROR ALERT', {
        errorId: errorDetails.id,
        message: errorDetails.message,
        category: errorDetails.category,
        endpoint: errorDetails.endpoint,
        ip: errorDetails.ip,
        userId: errorDetails.userId,
        timestamp: new Date(errorDetails.timestamp).toISOString(),
      });

      // Store alert in cache for monitoring dashboard
      const alertKey = `alert:critical:${errorDetails.id}`;
      await CacheService.set(
        alertKey,
        {
          ...errorDetails,
          alertSent: true,
          alertTimestamp: Date.now(),
        },
        { ttl: 86400 * 7 }
      ); // Keep alerts for 7 days
    } catch (alertError) {
      logger.error('Failed to send critical error alert:', alertError);
    }
  }

  /**
   * Log audit trail
   */
  static async logAudit(
    action: string,
    resource: string,
    req: Request,
    success: boolean = true,
    resourceId?: string,
    details?: Record<string, any>,
    errorMessage?: string
  ): Promise<void> {
    try {
      const auditId = this.generateAuditId();
      const userId = (req as any)?.user?.id;

      const auditEntry: AuditLogEntry = {
        id: auditId,
        userId,
        action,
        resource,
        resourceId,
        details,
        ip: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || '',
        timestamp: Date.now(),
        success,
        errorMessage,
      };

      // Log to winston
      logger.info('Audit trail', auditEntry);

      // Store in cache
      await CacheService.set(`audit:${auditId}`, auditEntry, {
        ttl: this.AUDIT_CACHE_TTL,
      });

      // Add to recent audit entries
      const recentAuditKey = 'audit:recent';
      const recentAudits =
        (await CacheService.get<AuditLogEntry[]>(recentAuditKey)) || [];

      recentAudits.unshift(auditEntry);
      if (recentAudits.length > this.MAX_AUDIT_ENTRIES) {
        recentAudits.pop();
      }

      await CacheService.set(recentAuditKey, recentAudits, {
        ttl: this.AUDIT_CACHE_TTL,
      });
    } catch (auditError) {
      logger.error('Failed to log audit trail:', auditError);
    }
  }

  /**
   * Get error metrics
   */
  static async getErrorMetrics(): Promise<ErrorMetrics> {
    try {
      const metrics = await CacheService.get<ErrorMetrics>('errors:metrics');
      return (
        metrics || {
          totalErrors: 0,
          errorsByCategory: {} as Record<ErrorCategory, number>,
          errorsBySeverity: {} as Record<ErrorSeverity, number>,
          errorsByStatusCode: {} as Record<number, number>,
          errorsByEndpoint: {} as Record<string, number>,
          recentErrors: [],
          errorRate: 0,
          topErrors: [],
        }
      );
    } catch (error) {
      logger.error('Failed to get error metrics:', error);
      throw error;
    }
  }

  /**
   * Get recent errors
   */
  static async getRecentErrors(limit: number = 50): Promise<ErrorDetails[]> {
    try {
      const recentErrors =
        (await CacheService.get<ErrorDetails[]>('errors:recent')) || [];
      return recentErrors.slice(0, limit);
    } catch (error) {
      logger.error('Failed to get recent errors:', error);
      return [];
    }
  }

  /**
   * Get audit trail
   */
  static async getAuditTrail(limit: number = 100): Promise<AuditLogEntry[]> {
    try {
      const auditTrail =
        (await CacheService.get<AuditLogEntry[]>('audit:recent')) || [];
      return auditTrail.slice(0, limit);
    } catch (error) {
      logger.error('Failed to get audit trail:', error);
      return [];
    }
  }

  /**
   * Clear old errors and audit entries
   */
  static async cleanup(): Promise<void> {
    try {
      const cutoffTime = Date.now() - this.ERROR_CACHE_TTL * 1000;

      // Clean recent errors
      const recentErrors =
        (await CacheService.get<ErrorDetails[]>('errors:recent')) || [];
      const filteredErrors = recentErrors.filter(
        (error) => error.timestamp > cutoffTime
      );
      await CacheService.set('errors:recent', filteredErrors, {
        ttl: this.ERROR_CACHE_TTL,
      });

      // Clean audit trail
      const auditCutoffTime = Date.now() - this.AUDIT_CACHE_TTL * 1000;
      const recentAudits =
        (await CacheService.get<AuditLogEntry[]>('audit:recent')) || [];
      const filteredAudits = recentAudits.filter(
        (audit) => audit.timestamp > auditCutoffTime
      );
      await CacheService.set('audit:recent', filteredAudits, {
        ttl: this.AUDIT_CACHE_TTL,
      });

      logger.info('Error and audit cleanup completed', {
        errorsRemoved: recentErrors.length - filteredErrors.length,
        auditsRemoved: recentAudits.length - filteredAudits.length,
      });
    } catch (error) {
      logger.error('Failed to cleanup errors and audit entries:', error);
    }
  }

  /**
   * Get error by ID
   */
  static async getErrorById(errorId: string): Promise<ErrorDetails | null> {
    try {
      return await CacheService.get<ErrorDetails>(`error:${errorId}`);
    } catch (error) {
      logger.error('Failed to get error by ID:', error);
      return null;
    }
  }

  /**
   * Health check for error handling service
   */
  static async healthCheck(): Promise<{ status: string; details: any }> {
    try {
      const metrics = await this.getErrorMetrics();
      const recentErrors = await this.getRecentErrors(10);
      const criticalErrorsLast24h = recentErrors.filter(
        (error) =>
          error.severity === ErrorSeverity.CRITICAL &&
          error.timestamp > Date.now() - 86400000
      ).length;

      return {
        status: criticalErrorsLast24h > 10 ? 'unhealthy' : 'healthy',
        details: {
          totalErrors: metrics.totalErrors,
          errorRate: metrics.errorRate,
          criticalErrorsLast24h,
          recentErrorsCount: recentErrors.length,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
}
