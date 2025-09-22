import { Request, Response, NextFunction } from 'express';
import { SecurityService, SecurityConfig } from '../services/securityService';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: { id: number; email: string; role: string };
}

export class SecurityController {
  /**
   * Get security configuration
   * GET /api/v1/security/config
   */
  static async getConfig(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const config = SecurityService.getConfig();

      res.json({
        success: true,
        data: {
          maxRequestsPerMinute: config.maxRequestsPerMinute,
          maxRequestsPerHour: config.maxRequestsPerHour,
          maxRequestsPerDay: config.maxRequestsPerDay,
          blockDurationMinutes: config.blockDurationMinutes,
          suspiciousActivityThreshold: config.suspiciousActivityThreshold,
          maxFailedAttemptsBeforeBlock: config.maxFailedAttemptsBeforeBlock,
          whitelistedIPsCount: config.whitelistedIPs.length,
          blacklistedIPsCount: config.blacklistedIPs.length,
        },
      });
    } catch (error) {
      logger.error('Error getting security config:', error);
      next(error);
    }
  }

  /**
   * Update security configuration
   * PUT /api/v1/security/config
   */
  static async updateConfig(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const {
        maxRequestsPerMinute,
        maxRequestsPerHour,
        maxRequestsPerDay,
        blockDurationMinutes,
        suspiciousActivityThreshold,
        maxFailedAttemptsBeforeBlock,
      } = req.body;

      const updateData: Partial<SecurityConfig> = {};

      if (maxRequestsPerMinute !== undefined) {
        updateData.maxRequestsPerMinute = Math.max(
          1,
          Math.min(1000, maxRequestsPerMinute)
        );
      }

      if (maxRequestsPerHour !== undefined) {
        updateData.maxRequestsPerHour = Math.max(
          10,
          Math.min(100000, maxRequestsPerHour)
        );
      }

      if (maxRequestsPerDay !== undefined) {
        updateData.maxRequestsPerDay = Math.max(
          100,
          Math.min(1000000, maxRequestsPerDay)
        );
      }

      if (blockDurationMinutes !== undefined) {
        updateData.blockDurationMinutes = Math.max(
          1,
          Math.min(1440, blockDurationMinutes)
        ); // Max 24 hours
      }

      if (suspiciousActivityThreshold !== undefined) {
        updateData.suspiciousActivityThreshold = Math.max(
          10,
          Math.min(1000, suspiciousActivityThreshold)
        );
      }

      if (maxFailedAttemptsBeforeBlock !== undefined) {
        updateData.maxFailedAttemptsBeforeBlock = Math.max(
          1,
          Math.min(100, maxFailedAttemptsBeforeBlock)
        );
      }

      SecurityService.updateConfig(updateData);

      logger.info('Security configuration updated', {
        userId: req.user?.id,
        updateData,
      });

      res.json({
        success: true,
        message: 'Security configuration updated successfully',
        data: SecurityService.getConfig(),
      });
    } catch (error) {
      logger.error('Error updating security config:', error);
      next(error);
    }
  }

  /**
   * Get security analytics
   * GET /api/v1/security/analytics
   */
  static async getAnalytics(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const analytics = await SecurityService.getAnalytics();
      const healthCheck = await SecurityService.healthCheck();

      res.json({
        success: true,
        data: {
          ...analytics,
          healthStatus: healthCheck.status,
          healthDetails: healthCheck.details,
        },
      });
    } catch (error) {
      logger.error('Error getting security analytics:', error);
      next(error);
    }
  }

  /**
   * Get blocked IPs
   * GET /api/v1/security/blocked-ips
   */
  static async getBlockedIPs(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const blockedIPs = await SecurityService.getBlockedIPs();

      res.json({
        success: true,
        data: blockedIPs,
        total: blockedIPs.length,
      });
    } catch (error) {
      logger.error('Error getting blocked IPs:', error);
      next(error);
    }
  }

  /**
   * Add IP to whitelist
   * POST /api/v1/security/whitelist
   */
  static async addToWhitelist(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { ip } = req.body;

      if (!ip) {
        res.status(400).json({
          success: false,
          message: 'IP address is required',
        });
        return;
      }

      // Basic IP validation
      const ipRegex =
        /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
      if (!ipRegex.test(ip)) {
        res.status(400).json({
          success: false,
          message: 'Invalid IP address format',
        });
        return;
      }

      await SecurityService.addToWhitelist(ip);

      logger.info('IP added to whitelist', {
        ip,
        userId: req.user?.id,
      });

      res.json({
        success: true,
        message: 'IP added to whitelist successfully',
        data: { ip },
      });
    } catch (error) {
      logger.error('Error adding IP to whitelist:', error);
      next(error);
    }
  }

  /**
   * Add IP to blacklist
   * POST /api/v1/security/blacklist
   */
  static async addToBlacklist(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { ip, reason } = req.body;

      if (!ip) {
        res.status(400).json({
          success: false,
          message: 'IP address is required',
        });
        return;
      }

      // Basic IP validation
      const ipRegex =
        /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
      if (!ipRegex.test(ip)) {
        res.status(400).json({
          success: false,
          message: 'Invalid IP address format',
        });
        return;
      }

      await SecurityService.addToBlacklist(ip, reason);

      logger.info('IP added to blacklist', {
        ip,
        reason,
        userId: req.user?.id,
      });

      res.json({
        success: true,
        message: 'IP added to blacklist successfully',
        data: { ip, reason },
      });
    } catch (error) {
      logger.error('Error adding IP to blacklist:', error);
      next(error);
    }
  }

  /**
   * Remove IP from blacklist
   * DELETE /api/v1/security/blacklist/:ip
   */
  static async removeFromBlacklist(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { ip } = req.params;

      if (!ip) {
        res.status(400).json({
          success: false,
          message: 'IP address is required',
        });
        return;
      }

      await SecurityService.removeFromBlacklist(ip);

      logger.info('IP removed from blacklist', {
        ip,
        userId: req.user?.id,
      });

      res.json({
        success: true,
        message: 'IP removed from blacklist successfully',
        data: { ip },
      });
    } catch (error) {
      logger.error('Error removing IP from blacklist:', error);
      next(error);
    }
  }

  /**
   * Clear rate limit data for an IP
   * DELETE /api/v1/security/rate-limit/:ip
   */
  static async clearRateLimit(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { ip } = req.params;

      if (!ip) {
        res.status(400).json({
          success: false,
          message: 'IP address is required',
        });
        return;
      }

      await SecurityService.clearRateLimitData(ip);

      logger.info('Rate limit data cleared for IP', {
        ip,
        userId: req.user?.id,
      });

      res.json({
        success: true,
        message: 'Rate limit data cleared successfully',
        data: { ip },
      });
    } catch (error) {
      logger.error('Error clearing rate limit data:', error);
      next(error);
    }
  }

  /**
   * Test security configuration
   * POST /api/v1/security/test
   */
  static async testSecurity(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { testType, ip } = req.body;
      const testIP = ip || req.ip;

      let testResult: any = {};

      switch (testType) {
        case 'rate-limit':
          testResult = await SecurityService.checkRateLimit(testIP);
          break;

        case 'suspicious-activity':
          testResult = await SecurityService.detectSuspiciousActivity(req);
          break;

        case 'whitelist':
          testResult = { isWhitelisted: SecurityService.isWhitelisted(testIP) };
          break;

        case 'blacklist':
          testResult = { isBlacklisted: SecurityService.isBlacklisted(testIP) };
          break;

        default:
          res.status(400).json({
            success: false,
            message:
              'Invalid test type. Available types: rate-limit, suspicious-activity, whitelist, blacklist',
          });
          return;
      }

      res.json({
        success: true,
        data: {
          testType,
          testedIP: testIP,
          result: testResult,
        },
      });
    } catch (error) {
      logger.error('Error testing security:', error);
      next(error);
    }
  }

  /**
   * Security dashboard summary
   * GET /api/v1/security/dashboard
   */
  static async getDashboard(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const analytics = await SecurityService.getAnalytics();
      const blockedIPs = await SecurityService.getBlockedIPs();
      const config = SecurityService.getConfig();
      const healthCheck = await SecurityService.healthCheck();

      const dashboard = {
        overview: {
          totalRequests: analytics.totalRequests,
          blockedRequests: analytics.blockedRequests,
          suspiciousActivities: analytics.suspiciousActivities,
          activeBlocks: blockedIPs.length,
          healthStatus: healthCheck.status,
        },
        configuration: {
          rateLimit: {
            perMinute: config.maxRequestsPerMinute,
            perHour: config.maxRequestsPerHour,
            perDay: config.maxRequestsPerDay,
          },
          security: {
            blockDuration: config.blockDurationMinutes,
            suspiciousThreshold: config.suspiciousActivityThreshold,
            maxFailedAttempts: config.maxFailedAttemptsBeforeBlock,
          },
          ipLists: {
            whitelisted: config.whitelistedIPs.length,
            blacklisted: config.blacklistedIPs.length,
          },
        },
        topIPs: analytics.topIPs.slice(0, 10),
        recentBlocks: blockedIPs
          .filter(
            (block) => block.expiresAt > Date.now() || block.expiresAt === -1
          )
          .slice(0, 10),
      };

      res.json({
        success: true,
        data: dashboard,
      });
    } catch (error) {
      logger.error('Error getting security dashboard:', error);
      next(error);
    }
  }
}
