import * as Sentry from '@sentry/node';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Initialize Sentry for error tracking and performance monitoring
 * 
 * Features:
 * - Automatic error capture
 * - Performance tracing (APM)
 * - Request/response context
 * - User identification
 * - Release tracking
 * 
 * Environment Variables Required:
 * - SENTRY_DSN: Your Sentry project DSN
 * - SENTRY_ENVIRONMENT: Environment name (production, staging, development)
 * - SENTRY_TRACES_SAMPLE_RATE: Performance sampling rate (0.0 to 1.0)
 */

export interface SentryConfig {
  enabled: boolean;
  dsn?: string;
  environment: string;
  tracesSampleRate: number;
  profilesSampleRate: number;
  beforeSend?: (event: Sentry.Event) => Sentry.Event | null;
}

class SentryService {
  private initialized = false;

  /**
   * Initialize Sentry with configuration
   */
  initialize(): void {
    const dsn = process.env['SENTRY_DSN'];
    const environment = process.env['SENTRY_ENVIRONMENT'] || config.NODE_ENV;
    const tracesSampleRate = parseFloat(process.env['SENTRY_TRACES_SAMPLE_RATE'] || '0.1');

    // Don't initialize in development unless explicitly enabled
    if (config.NODE_ENV === 'development' && !dsn) {
      logger.info('Sentry disabled in development (no SENTRY_DSN provided)');
      return;
    }

    if (!dsn) {
      logger.warn('⚠️  SENTRY_DSN not configured - error tracking disabled');
      return;
    }

    try {
      Sentry.init({
        dsn,
        environment,
        
        // Performance Monitoring (APM)
        tracesSampleRate, // Sample 10% of transactions by default
        
        // Set sampling rate for profiling
        profilesSampleRate: 0, // Disabled (requires native module)
        
        // Release tracking
        release: process.env['SENTRY_RELEASE'] || `url-shortener-backend@${process.env['npm_package_version'] || '1.0.0'}`,
        
        // Server name
        serverName: process.env['HOSTNAME'] || 'unknown',
        
        // Integrations
        integrations: [
          // HTTP integration for automatic request tracking
          new Sentry.Integrations.Http({ tracing: true }),
          
          // Express integration
          new Sentry.Integrations.Express({
            app: undefined, // Will be set via requestHandler
          }),
          
          // OnUncaughtException - capture but don't exit
          new Sentry.Integrations.OnUncaughtException({
            exitEvenIfOtherHandlersAreRegistered: false,
          }),
          
          // OnUnhandledRejection
          new Sentry.Integrations.OnUnhandledRejection({
            mode: 'warn', // Log but don't crash
          }),
        ],
        
        // Filter sensitive data
        beforeSend: (event) => {
          // Remove sensitive headers
          if (event.request?.headers) {
            delete event.request.headers['authorization'];
            delete event.request.headers['cookie'];
            delete event.request.headers['x-api-key'];
          }
          
          // Remove sensitive data from context
          if (event.extra) {
            delete event.extra['password'];
            delete event.extra['token'];
            delete event.extra['secret'];
          }
          
          return event;
        },
        
        // Don't send certain errors
        ignoreErrors: [
          // Browser/client errors that somehow reach server
          'Non-Error exception captured',
          'Non-Error promise rejection captured',
          
          // Known/expected errors
          'ECONNRESET',
          'ECONNREFUSED',
          'ETIMEDOUT',
          'EPIPE',
          'Socket hang up',
        ],
        
        // Breadcrumbs configuration
        maxBreadcrumbs: 50,
        
        // Debug mode (only in development)
        debug: config.NODE_ENV === 'development',
        
        // Attach stack traces
        attachStacktrace: true,
        
        // Send default PII (Personally Identifiable Information)
        sendDefaultPii: false, // Disabled for privacy
      });

      this.initialized = true;
      logger.info('✅ Sentry initialized', {
        environment,
        tracesSampleRate,
        dsn: dsn.substring(0, 40) + '...',
      });
    } catch (error) {
      logger.error('❌ Failed to initialize Sentry:', error);
    }
  }

  /**
   * Check if Sentry is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Capture an exception
   */
  captureException(error: Error | unknown, context?: Record<string, any>): string | undefined {
    if (!this.initialized) {
      return undefined;
    }

    return Sentry.captureException(error, {
      extra: context,
    });
  }

  /**
   * Capture a message
   */
  captureMessage(message: string, level: Sentry.SeverityLevel = 'info', context?: Record<string, any>): string | undefined {
    if (!this.initialized) {
      return undefined;
    }

    return Sentry.captureMessage(message, {
      level,
      extra: context,
    });
  }

  /**
   * Set user context
   */
  setUser(user: { id: string; email?: string; username?: string }): void {
    if (!this.initialized) {
      return;
    }

    Sentry.setUser(user);
  }

  /**
   * Clear user context
   */
  clearUser(): void {
    if (!this.initialized) {
      return;
    }

    Sentry.setUser(null);
  }

  /**
   * Set context/tags
   */
  setContext(name: string, context: Record<string, any>): void {
    if (!this.initialized) {
      return;
    }

    Sentry.setContext(name, context);
  }

  /**
   * Set tag
   */
  setTag(key: string, value: string): void {
    if (!this.initialized) {
      return;
    }

    Sentry.setTag(key, value);
  }

  /**
   * Add breadcrumb
   */
  addBreadcrumb(breadcrumb: Sentry.Breadcrumb): void {
    if (!this.initialized) {
      return;
    }

    Sentry.addBreadcrumb(breadcrumb);
  }

  /**
   * Start a transaction (for performance monitoring)
   */
  startTransaction(context: Record<string, any>): any {
    return Sentry.startTransaction(context as any);
  }

  /**
   * Flush pending events (useful before shutdown)
   */
  async flush(timeout = 2000): Promise<boolean> {
    if (!this.initialized) {
      return true;
    }

    try {
      return await Sentry.flush(timeout);
    } catch (error) {
      logger.error('Error flushing Sentry:', error);
      return false;
    }
  }

  /**
   * Close Sentry connection
   */
  async close(timeout = 2000): Promise<boolean> {
    if (!this.initialized) {
      return true;
    }

    try {
      return await Sentry.close(timeout);
    } catch (error) {
      logger.error('Error closing Sentry:', error);
      return false;
    }
  }
}

// Export singleton instance
export const sentryService = new SentryService();

// Export Sentry for middleware usage
export { Sentry };
